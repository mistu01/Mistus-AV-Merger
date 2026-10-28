"""
Job queue runner, OS process scheduling via psutil, and pause/resume lifecycle.
"""

import asyncio
import json
import os
import platform
import subprocess
import sys
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

try:
    import psutil
except ImportError:
    psutil = None

from mistus_av_merger.config import get_data_dir
from mistus_av_merger.core.segment_planner import SegmentPlanner


class RenderJob:
    def __init__(
        self,
        job_id: str,
        audio_path: str,
        video_path: str,
        output_path: str,
        mode: str,
        mode_reason: str,
        duration: float,
        options: Dict[str, Any],
    ):
        self.job_id = job_id
        self.audio_path = audio_path
        self.video_path = video_path
        self.output_path = output_path
        self.mode = mode
        self.mode_reason = mode_reason
        self.duration = duration
        self.options = options

        self.status: str = "queued"  # queued, rendering, paused, completed, failed
        self.encoder: str = "-"
        self.progress: float = 0.0
        self.fps: float = 0.0
        self.speed: str = "0.0x"
        self.eta_seconds: int = 0
        self.current_segment: int = 1
        self.total_segments: int = 1
        self.logs: List[str] = []
        self.process: Optional[subprocess.Popen] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.job_id,
            "audioPath": self.audio_path,
            "videoPath": self.video_path,
            "outputPath": self.output_path,
            "mode": self.mode,
            "modeReason": self.mode_reason,
            "duration": self.duration,
            "status": self.status,
            "encoder": self.encoder,
            "progress": self.progress,
            "fps": self.fps,
            "speed": self.speed,
            "etaSeconds": self.eta_seconds,
            "currentSegment": self.current_segment,
            "totalSegments": self.total_segments,
            "logs": self.logs[-50:],
        }


class JobQueueManager:
    """Manages execution queue, OS prioritization, and session recovery."""

    def __init__(self):
        self.jobs: List[RenderJob] = []
        self.is_running: bool = False
        self.is_paused: bool = False
        self.concurrency: int = 1
        self.cpu_profile: str = "balanced"
        self.session_file = get_data_dir() / "active_session.json"

    def add_job(self, job: RenderJob):
        self.jobs.append(job)
        self.save_session()

    def remove_job(self, job_id: str):
        self.jobs = [j for j in self.jobs if j.job_id != job_id]
        self.save_session()

    def move_job(self, job_id: str, direction: str):
        idx = next((i for i, j in enumerate(self.jobs) if j.job_id == job_id), -1)
        if idx == -1:
            return
        target_idx = idx - 1 if direction == "up" else idx + 1
        if 0 <= target_idx < len(self.jobs):
            self.jobs[idx], self.jobs[target_idx] = self.jobs[target_idx], self.jobs[idx]
            self.save_session()

    def threads_for_profile(self) -> Optional[int]:
        """Translates the CPU profile into an ffmpeg -threads value.

        aggressive -> None (all cores), balanced -> cores/2,
        low -> 2, idle -> 1 (keeps the machine usable).
        """
        profile = (self.cpu_profile or "balanced").lower()
        if profile == "aggressive":
            return None
        try:
            cores = os.cpu_count() or 4
        except Exception:
            cores = 4
        if profile == "balanced":
            return max(2, cores // 2)
        if profile == "low":
            return 2
        if profile == "idle":
            return 1
        return None

    def apply_cpu_profile(self, proc: subprocess.Popen):
        """Applies nice / priority class to process using psutil."""
        if not psutil or not proc.pid:
            return

        try:
            p = psutil.Process(proc.pid)
            system = platform.system()
            if system == "Windows":
                if self.cpu_profile == "idle":
                    p.nice(psutil.IDLE_PRIORITY_CLASS)
                elif self.cpu_profile == "low":
                    p.nice(psutil.BELOW_NORMAL_PRIORITY_CLASS)
                else:
                    p.nice(psutil.NORMAL_PRIORITY_CLASS)
            else:
                # POSIX nice: -20 to 19 (higher number is lower priority)
                if self.cpu_profile == "idle":
                    p.nice(19)
                elif self.cpu_profile == "low":
                    p.nice(15)
                elif self.cpu_profile == "balanced":
                    p.nice(10)
                else:
                    p.nice(0)
        except Exception as e:
            print(f"[Warning] Could not set process priority: {e}")

    def pause_job(self, job_id: str):
        job = next((j for j in self.jobs if j.job_id == job_id), None)
        if not job or not job.process or not psutil:
            return

        try:
            p = psutil.Process(job.process.pid)
            p.suspend()
            job.status = "paused"
            self.save_session()
        except Exception as e:
            print(f"[Warning] Failed to suspend job {job_id}: {e}")

    def resume_job(self, job_id: str):
        job = next((j for j in self.jobs if j.job_id == job_id), None)
        if not job or not job.process or not psutil:
            return

        try:
            p = psutil.Process(job.process.pid)
            p.resume()
            job.status = "rendering"
            self.save_session()
        except Exception as e:
            print(f"[Warning] Failed to resume job {job_id}: {e}")

    def save_session(self):
        """Persists current queue state to active_session.json atomically."""
        try:
            data = {
                "schema_version": 2,
                "settings": {
                    "cpu_profile": self.cpu_profile,
                    "concurrency": self.concurrency,
                    "is_running": self.is_running,
                },
                "jobs": [{**j.to_dict(), "options": j.options} for j in self.jobs],
            }
            tmp_file = self.session_file.with_suffix(".tmp")
            with open(tmp_file, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2)
            os.replace(tmp_file, self.session_file)
        except Exception as e:
            print(f"[Warning] Failed to persist session: {e}")

    def load_session(self):
        """Restores queue from session file if available, recovering interrupted renders."""
        if not self.session_file.exists():
            return
        try:
            with open(self.session_file, "r", encoding="utf-8") as f:
                data = json.load(f)
            # Rehydrate queue-level settings (schema 2+)
            settings = data.get("settings") or {}
            if isinstance(settings.get("cpu_profile"), str):
                self.cpu_profile = settings["cpu_profile"]
            if isinstance(settings.get("concurrency"), int):
                self.concurrency = max(1, min(4, settings["concurrency"]))
            if isinstance(settings.get("is_running"), bool):
                self.is_running = settings["is_running"]
            self.is_paused = False

            # Rehydrate jobs preserving queue order and crash state
            self.jobs = []
            for jd in data.get("jobs", []):
                raw_status = jd.get("status", "queued")
                job = RenderJob(
                    job_id=jd["id"],
                    audio_path=jd.get("audioPath", ""),
                    video_path=jd.get("videoPath", ""),
                    output_path=jd.get("outputPath", ""),
                    mode=jd.get("mode", "copy"),
                    mode_reason=jd.get("modeReason", ""),
                    duration=float(jd.get("duration") or 0.0),
                    options=dict(jd.get("options") or {}),
                )
                job.total_segments = max(1, int(jd.get("totalSegments") or 1))
                job.encoder = str(jd.get("encoder") or "-")
                job.logs = list(jd.get("logs") or [])

                if raw_status == "completed":
                    job.status = "completed"
                    job.progress = 100.0
                    job.speed = "-"
                    job.eta_seconds = 0
                elif raw_status == "rendering":
                    # Accidental exit / PC shutdown interrupted this render.
                    # Reset to queued so it resumes exactly where it left off.
                    job.status = "queued"
                    job.progress = 0.0
                    job.logs.append("[info] Resumed after unexpected exit / PC shutdown.")
                elif raw_status == "paused":
                    job.status = "queued"
                    job.progress = 0.0
                elif raw_status == "failed":
                    job.status = "failed"
                    job.progress = float(jd.get("progress") or 0.0)
                else:
                    job.status = "queued"
                    job.progress = 0.0

                self.jobs.append(job)
        except Exception as e:
            print(f"[Warning] Failed to reload session: {e}")


def is_output_file_complete(
    output_path: Path,
    expected_duration: float = 0.0,
    ffprobe_bin: Optional[str] = None,
) -> bool:
    """
    Carefully inspects an output file to determine if it already exists and is a complete,
    valid render (not a truncated or 0-byte corrupt artifact from an interrupted run).
    """
    try:
        if not output_path.is_file():
            return False
        # If file is too small (< 2KB), it cannot be a valid video render
        if output_path.stat().st_size < 2048:
            return False

        from mistus_av_merger.core.binaries import get_ffprobe_path
        probe_bin = ffprobe_bin or str(get_ffprobe_path())

        creationflags = subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0
        cmd = [
            probe_bin,
            "-v", "error",
            "-print_format", "json",
            "-show_format",
            "-show_streams",
            str(output_path),
        ]
        res = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=8,
            creationflags=creationflags,
        )
        if res.returncode != 0:
            return False

        data = json.loads(res.stdout.decode("utf-8", errors="replace"))
        fmt = data.get("format", {})
        streams = data.get("streams", [])

        # Must have at least 1 video stream and 1 audio stream
        has_video = any(s.get("codec_type") == "video" for s in streams)
        has_audio = any(s.get("codec_type") == "audio" for s in streams)
        if not has_video or not has_audio:
            return False

        # If expected_duration is known (> 1.0s), verify file duration is complete
        file_duration = float(fmt.get("duration", 0.0))
        if expected_duration > 1.0:
            # Complete if within 2.5s of expected duration, or >= 98% of expected duration
            if file_duration < (expected_duration - 2.5) and file_duration < (expected_duration * 0.98):
                return False
        elif file_duration <= 0.5:
            return False

        return True
    except Exception:
        return False
