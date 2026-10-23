"""
Directory scanner and ffprobe metadata extraction engine with mtime+size caching.
"""

import asyncio
import json
import os
import re
import shutil
import subprocess
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple


AUDIO_EXTENSIONS: Set[str] = {".mp3", ".wav", ".flac", ".m4a", ".aac", ".ogg", ".opus", ".wma"}
VIDEO_EXTENSIONS: Set[str] = {".mp4", ".mkv", ".mov", ".avi", ".webm", ".m4v", ".ts"}


def natural_sort_key(s: str) -> List[Any]:
    """Natural sort key separating digits and non-digits for human order."""
    return [int(text) if text.isdigit() else text.lower() for text in re.split(r"(\d+)", s)]


class MediaProbeResult:
    def __init__(
        self,
        path: Path,
        duration: float,
        format_name: str,
        size_bytes: int,
        audio_codec: Optional[str] = None,
        video_codec: Optional[str] = None,
        width: Optional[int] = None,
        height: Optional[int] = None,
        fps: Optional[float] = None,
    ):
        self.path = path
        self.filename = path.name
        self.duration = duration
        self.format_name = format_name
        self.size_bytes = size_bytes
        self.audio_codec = audio_codec
        self.video_codec = video_codec
        self.width = width
        self.height = height
        self.fps = fps

    def to_dict(self) -> Dict[str, Any]:
        return {
            "path": str(self.path),
            "filename": self.filename,
            "duration": self.duration,
            "format": self.format_name,
            "sizeBytes": self.size_bytes,
            "audioCodec": self.audio_codec,
            "videoCodec": self.video_codec,
            "width": self.width,
            "height": self.height,
            "fps": self.fps,
        }


class MediaScanner:
    """Scans directories, probes media with ffprobe, and caches probe entries."""

    def __init__(self, ffprobe_bin: str = "ffprobe"):
        if ffprobe_bin == "ffprobe":
            # Default: resolve the bundled ffprobe (bundled ./bin wins over PATH).
            from mistus_av_merger.core.binaries import get_ffprobe_path
            self.ffprobe_bin = str(get_ffprobe_path())
        else:
            self.ffprobe_bin = shutil.which(ffprobe_bin) or ffprobe_bin
        self._cache: Dict[Tuple[str, float, int], MediaProbeResult] = {}

    def probe_file(self, file_path: Path) -> Optional[MediaProbeResult]:
        """Probes a single media file via ffprobe or returns cached result."""
        if not file_path.exists():
            return None

        stat = file_path.stat()
        cache_key = (str(file_path.resolve()), stat.st_mtime, stat.st_size)
        if cache_key in self._cache:
            return self._cache[cache_key]

        cmd = [
            self.ffprobe_bin,
            "-v", "quiet",
            "-print_format", "json",
            "-show_format",
            "-show_streams",
            str(file_path)
        ]

        try:
            res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=6)
            if res.returncode != 0:
                return None

            data = json.loads(res.stdout.decode("utf-8", errors="replace"))
            fmt = data.get("format", {})
            duration = float(fmt.get("duration", 0.0))
            format_name = fmt.get("format_name", "")
            size_bytes = int(fmt.get("size", stat.st_size))

            audio_codec = None
            video_codec = None
            width = None
            height = None
            fps = None

            for stream in data.get("streams", []):
                codec_type = stream.get("codec_type")
                if codec_type == "audio" and not audio_codec:
                    audio_codec = stream.get("codec_name")
                elif codec_type == "video" and not video_codec:
                    video_codec = stream.get("codec_name")
                    width = stream.get("width")
                    height = stream.get("height")
                    # Calculate fps
                    r_frame_rate = stream.get("r_frame_rate", "30/1")
                    if "/" in r_frame_rate:
                        num, den = r_frame_rate.split("/")
                        if float(den) > 0:
                            fps = round(float(num) / float(den), 2)

            probe_result = MediaProbeResult(
                path=file_path,
                duration=duration,
                format_name=format_name,
                size_bytes=size_bytes,
                audio_codec=audio_codec,
                video_codec=video_codec,
                width=width,
                height=height,
                fps=fps,
            )
            self._cache[cache_key] = probe_result
            return probe_result
        except Exception:
            return None

    def scan_directory(
        self,
        folder_path: Path,
        recursive: bool = False,
        max_depth: int = 3,
    ) -> Tuple[List[MediaProbeResult], List[MediaProbeResult], List[Tuple[Path, str]]]:
        """
        Scans directory for media files.
        Returns: (audio_files, video_files, skipped_files_with_reasons)
        """
        if not folder_path.exists() or not folder_path.is_dir():
            return [], [], [(folder_path, "Directory not found")]

        audio_items: List[MediaProbeResult] = []
        video_items: List[MediaProbeResult] = []
        skipped: List[Tuple[Path, str]] = []

        def walk(current_dir: Path, depth: int):
            if depth > max_depth:
                return
            try:
                for entry in current_dir.iterdir():
                    if entry.is_dir() and recursive:
                        walk(entry, depth + 1)
                    elif entry.is_file():
                        ext = entry.suffix.lower()
                        if ext in AUDIO_EXTENSIONS:
                            probe = self.probe_file(entry)
                            if probe and probe.duration > 0:
                                audio_items.append(probe)
                            else:
                                skipped.append((entry, "Unreadable or zero-duration audio track"))
                        elif ext in VIDEO_EXTENSIONS:
                            probe = self.probe_file(entry)
                            if probe and probe.duration > 0:
                                video_items.append(probe)
                            else:
                                skipped.append((entry, "Unreadable or zero-duration video clip"))
            except Exception as e:
                skipped.append((current_dir, f"Permission error: {e}"))

        walk(folder_path, 1)

        # Sort naturally
        audio_items.sort(key=lambda x: natural_sort_key(x.filename))
        video_items.sort(key=lambda x: natural_sort_key(x.filename))

        return audio_items, video_items, skipped
