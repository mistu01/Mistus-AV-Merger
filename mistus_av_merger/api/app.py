"""
FastAPI REST API and WebSocket live progress server for Mistus AV Merger.
Localhost-only binding with CSRF origin protection and `/api/v1` routes.
"""

import os
import random
import string
import subprocess
import threading
import time
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from mistus_av_merger import __version__, VERSION_CODE
from mistus_av_merger.config import SettingsManager, get_app_root, is_portable_mode
from mistus_av_merger.core._build_info import BUILD_INFO
from mistus_av_merger.core.ffmpeg_builder import FFmpegCommandBuilder
from mistus_av_merger.core.hwdetect import HardwareDetector
from mistus_av_merger.core.jobs import JobQueueManager, RenderJob
from mistus_av_merger.core.pairing import AutoPairingEngine
from mistus_av_merger.core.presets import PresetManager
from mistus_av_merger.core.scanner import (
    AUDIO_EXTENSIONS,
    VIDEO_EXTENSIONS,
    MediaScanner,
    natural_sort_key,
)

app = FastAPI(
    title="Mistus AV Merger API",
    version=__version__,
    description="Localhost REST and WebSocket API for Mistus AV Merger",
)

# CORS: localhost only
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1", "http://localhost", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def _resolve_ffmpeg() -> str:
    try:
        from mistus_av_merger.core.hwdetect import get_ffmpeg_binary
        return get_ffmpeg_binary()
    except Exception:
        return "ffmpeg"


settings_mgr = SettingsManager()
hw_detector = HardwareDetector()
scanner = MediaScanner()
preset_mgr = PresetManager()
queue_mgr = JobQueueManager()
queue_mgr.load_session()

ffmpeg_builder = FFmpegCommandBuilder(ffmpeg_bin=_resolve_ffmpeg())
_active_job: Optional[RenderJob] = None
_active_lock = threading.Lock()
_encoder_cache: Optional[str] = None
_encoder_lock = threading.Lock()


def _background_hw_probe():
    """Probes encoders once at startup so GPU selection is ready before the
    first render (the micro-encode sweep takes a few seconds)."""
    try:
        hw_detector.probe_all()
        global _encoder_cache
        with _encoder_lock:
            _encoder_cache = hw_detector.recommended_encoder
    except Exception as e:
        print(f"[Warning] Hardware probe failed: {e}")


threading.Thread(target=_background_hw_probe, name="hw-probe", daemon=True).start()


# Host header origin validation middleware
@app.middleware("http")
async def enforce_localhost_security(request: Request, call_next):
    host = request.headers.get("host", "")
    # Allow local loops
    if not any(local in host for local in ("127.0.0.1", "localhost", "0.0.0.0", "run.app")):
        return Response("Forbidden: Localhost access only", status_code=403)
    return await call_next(request)


# ---------------- API v1 Routes ----------------

@app.get("/api/v1/health")
def get_health():
    return {
        "status": "healthy",
        "app": "Mistus AV Merger",
        "version": __version__,
        "version_code": VERSION_CODE,
    }


@app.get("/api/v1/version")
def get_version_info():
    return {
        "version": __version__,
        "version_code": VERSION_CODE,
        "build_info": BUILD_INFO,
        "portable_mode": is_portable_mode(),
    }


@app.get("/api/v1/hardware")
def get_hardware_info():
    """Non-blocking: returns the startup probe result once available."""
    summary = hw_detector.get_summary(block=False)
    summary["probing"] = not summary.pop("probed", False)
    return summary


@app.get("/api/v1/presets")
def get_presets():
    return preset_mgr.list_all()


class ScanRequest(BaseModel):
    folder_path: str
    recursive: bool = False
    depth: int = 3


@app.post("/api/v1/scan")
def scan_media_folder(req: ScanRequest):
    folder = Path(req.folder_path)
    if not folder.exists():
        raise HTTPException(status_code=404, detail="Directory not found")

    audio, video, skipped = scanner.scan_directory(folder, req.recursive, req.depth)
    return {
        "audio": [a.to_dict() for a in audio],
        "video": [v.to_dict() for v in video],
        "skipped": [{"path": str(p), "reason": r} for p, r in skipped],
    }


class PairRequest(BaseModel):
    audio_files: List[Dict[str, Any]]
    video_files: List[Dict[str, Any]]
    mode: str = "cycle"
    single_video_id: Optional[str] = None
    seed: int = 42
    fuzzy_threshold: float = 0.65


@app.post("/api/v1/pair")
def generate_pairing(req: PairRequest):
    plan = AutoPairingEngine.pair(
        req.audio_files,
        req.video_files,
        mode=req.mode,
        single_video_id=req.single_video_id,
        seed=req.seed,
        fuzzy_threshold=req.fuzzy_threshold,
    )
    return plan


# ---------------- Real Filesystem Browsing ----------------

_FILE_SYSTEM_BLACKLIST = {"System Volume Information", "$RECYCLE.BIN", "$RECYCLER", "Config.Msi"}
_KINDS = {".mp3": "audio", ".wav": "audio", ".flac": "audio", ".m4a": "audio", ".aac": "audio",
          ".ogg": "audio", ".opus": "audio", ".wma": "audio", ".mp4": "video", ".mkv": "video",
          ".mov": "video", ".avi": "video", ".webm": "video", ".m4v": "video", ".ts": "video",
          ".jpg": "image", ".jpeg": "image", ".png": "image", ".webp": "image",
          ".bmp": "image", ".gif": "image"}
_IMAGE_EXTS = tuple(ext for ext, kind in _KINDS.items() if kind == "image")


def _list_drives() -> List[Dict[str, str]]:
    """Enumerated letters exist on Windows only; other platforms return the home mount."""
    drives: List[Dict[str, str]] = []
    if os.name == "nt":
        for letter in string.ascii_uppercase:
            root = Path(f"{letter}:\\")
            try:
                if root.exists():
                    drives.append({"label": f"{letter}: Drive", "path": str(root)})
            except (OSError, PermissionError):
                continue
    else:
        drives.append({"label": "Computer", "path": "/"})
    return drives


def _windows_known_folder(guid_str: str) -> Optional[str]:
    """Resolves a Windows known folder (Desktop, Documents, ...) via the shell API.

    This follows OneDrive "folder backup" redirection — e.g. Desktop actually
    resolves to C:\\Users\\<name>\\OneDrive\\Desktop when backup is enabled —
    which plain `Path.home() / name` misses, producing empty listings.
    """
    if os.name != "nt":
        return None
    try:
        import ctypes
        import uuid
        from ctypes import wintypes

        class _GUID(ctypes.Structure):
            _fields_ = [
                ("Data1", ctypes.c_ulong),
                ("Data2", ctypes.c_ushort),
                ("Data3", ctypes.c_ushort),
                ("Data4", ctypes.c_ubyte * 8),
            ]

        shell32 = ctypes.windll.shell32
        shell32.SHGetKnownFolderPath.restype = ctypes.HRESULT
        shell32.SHGetKnownFolderPath.argtypes = (
            ctypes.POINTER(_GUID),
            wintypes.DWORD,
            wintypes.HANDLE,
            ctypes.POINTER(ctypes.c_wchar_p),
        )
        guid = _GUID.from_buffer_copy(uuid.UUID(guid_str).bytes_le)
        out = ctypes.c_wchar_p()
        hr = shell32.SHGetKnownFolderPath(
            ctypes.byref(guid), 0, None, ctypes.byref(out)
        )
        result = out.value if hr == 0 else None
        ctypes.windll.ole32.CoTaskMemFree(out)
        return result
    except Exception:
        return None


_KNOWN_FOLDER_GUIDS = {
    "Desktop": "{B4BFCC3A-DB2C-424C-B029-7FE99A87C641}",
    "Documents": "{FDD39AD0-238F-46AF-ADB4-6C85480369C7}",
    "Downloads": "{374DE290-123F-4565-9164-39C4925E467B}",
    "Music": "{4BD8D571-6D19-48D3-BE97-422220080E43}",
    "Videos": "{59461737-7FC0-4C37-917B-0D9926C42F0A}",
    "Pictures": "{33E28130-4E1E-4676-8A4A-A3A6968734E6}",
}


def _list_shortcuts() -> List[Dict[str, str]]:
    home = Path.home()
    shortcuts = [{"label": "Home", "path": str(home), "icon": "home"}]
    for label, guid in _KNOWN_FOLDER_GUIDS.items():
        resolved = _windows_known_folder(guid)
        if not resolved:
            candidate = home / label
            if candidate.is_dir():
                resolved = str(candidate)
        if resolved and Path(resolved).is_dir():
            shortcuts.append({"label": label, "path": resolved, "icon": label.lower()})
    return shortcuts


@app.get("/api/v1/fs/list")
def browse_fs(path: Optional[str] = None, show_hidden: bool = False):
    """Lists drives/shortcuts (root view) or the real content of a directory."""
    if path:
        dir_path = Path(path).expanduser()
        if not dir_path.exists():
            raise HTTPException(status_code=404, detail="Directory not found")
        if not dir_path.is_dir():
            raise HTTPException(status_code=400, detail="Not a directory")
    else:
        dir_path = None

    if dir_path is None:
        return {
            "path": None,
            "parent": None,
            "isRoot": True,
            "drives": _list_drives(),
            "shortcuts": _list_shortcuts(),
            "entries": [],
        }

    parent = str(dir_path.parent) if dir_path.parent != dir_path else None
    entries: List[Dict[str, Any]] = []
    try:
        with os.scandir(dir_path) as it:
            for entry in it:
                try:
                    name = entry.name
                    if name in _FILE_SYSTEM_BLACKLIST:
                        continue
                    if not show_hidden and name.startswith("."):
                        continue
                    is_dir = entry.is_dir(follow_symlinks=False)
                    if is_dir and os.name == "nt":
                        try:
                            if entry.is_junction():
                                continue  # skip Windows junctions/symlink dirs to avoid loops
                        except AttributeError:
                            pass
                    if is_dir:
                        entries.append({"name": name, "path": str(entry.path), "isDir": True,
                                        "kind": "dir", "sizeBytes": None})
                    else:
                        ext = os.path.splitext(name)[1].lower()
                        kind = _KINDS.get(ext)
                        if kind is None:
                            continue  # browser only lists media files (plus directories)
                        entries.append({"name": name, "path": str(entry.path), "isDir": False,
                                        "kind": kind, "sizeBytes": entry.stat(follow_symlinks=False).st_size})
                except (OSError, PermissionError):
                    continue  # unreadable items are simply hidden
    except PermissionError:
        raise HTTPException(status_code=403, detail="Access denied by the operating system")
    except OSError as e:
        raise HTTPException(status_code=400, detail=str(e))

    dirs = [e for e in entries if e["isDir"]]
    files = [e for e in entries if not e["isDir"]]
    dirs.sort(key=lambda e: natural_sort_key(e["name"]))
    files.sort(key=lambda e: natural_sort_key(e["name"]))

    return {
        "path": str(dir_path),
        "parent": parent,
        "isRoot": False,
        "drives": _list_drives(),
        "shortcuts": _list_shortcuts(),
        "entries": dirs + files,
    }


class FsProbeRequest(BaseModel):
    path: str


@app.post("/api/v1/fs/probe")
def probe_fs_file(req: FsProbeRequest):
    """Full ffprobe of one media file (duration, codecs, resolution) for the UI."""
    file_path = Path(req.path).expanduser()
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    ext = os.path.splitext(file_path)[1].lower()
    kind = _KINDS.get(ext)
    if kind is None:
        raise HTTPException(status_code=400, detail="Not a supported media file")
    result = scanner.probe_file(file_path)
    if result is None:
        raise HTTPException(status_code=422, detail="ffprobe could not read this file")
    data = result.to_dict()
    data["kind"] = kind
    return data


@app.get("/api/v1/queue")
def list_queue():
    return [j.to_dict() for j in queue_mgr.jobs]


class QueueSettingsRequest(BaseModel):
    cpu_profile: Optional[str] = None
    concurrency: Optional[int] = None


@app.get("/api/v1/queue/settings")
def get_queue_settings():
    return {
        "cpu_profile": queue_mgr.cpu_profile,
        "concurrency": queue_mgr.concurrency,
    }


@app.post("/api/v1/queue/settings")
def set_queue_settings(req: QueueSettingsRequest):
    """Persists render-tuning settings (CPU profile / parallel jobs)."""
    if req.cpu_profile is not None:
        if req.cpu_profile not in ("aggressive", "balanced", "low", "idle"):
            raise HTTPException(status_code=400, detail=f"Unknown CPU profile: {req.cpu_profile}")
        queue_mgr.cpu_profile = req.cpu_profile
    if req.concurrency is not None:
        queue_mgr.concurrency = max(1, min(4, int(req.concurrency)))
    queue_mgr.save_session()
    return {
        "cpu_profile": queue_mgr.cpu_profile,
        "concurrency": queue_mgr.concurrency,
    }


class SettingsUpdateRequest(BaseModel):
    last_audio_folder: Optional[str] = None
    last_video_folder: Optional[str] = None
    last_output_folder: Optional[str] = None
    last_overlay_folder: Optional[str] = None
    last_single_audio: Optional[str] = None
    last_single_video: Optional[str] = None
    last_single_overlay: Optional[str] = None
    last_bulk_mode: Optional[str] = None
    last_naming_pattern: Optional[str] = None
    collision_policy: Optional[str] = None
    cpu_profile: Optional[str] = None
    concurrency: Optional[int] = None
    segment_duration_sec: Optional[int] = None


@app.get("/api/v1/settings")
def get_app_settings():
    return settings_mgr.settings


@app.post("/api/v1/settings")
def set_app_settings(req: SettingsUpdateRequest):
    for key, val in req.model_dump(exclude_unset=True).items():
        if val is not None:
            settings_mgr.set(key, val)
    return settings_mgr.settings


# ---------------- Real Render Worker ----------------

_MP4_SAFE_AUDIO_EXTS = {".aac", ".mp3", ".m4a", ".ac3"}
_DIRTY_AUDIO_EXTS = {".flac", ".wav", ".wma", ".ogg", ".opus", ".aiff", ".aif", ".mka"}


def _needs_audio_transcode(audio_path: Path, output_path: Path) -> bool:
    """MP4-family containers only accept a subset of audio codecs losslessly."""
    if Path(output_path).suffix.lower() == ".mkv":
        return False
    return Path(audio_path).suffix.lower() in _DIRTY_AUDIO_EXTS


def _pick_encoder() -> str:
    """Resolves the best available (hardware-first)VIDEO encoder once.

    Prefers the result of the startup background probe; only falls back to a
    synchronous probe when that thread has not finished yet."""
    global _encoder_cache
    with _encoder_lock:
        if _encoder_cache is None:
            try:
                if hw_detector.available_encoders:
                    _encoder_cache = hw_detector.recommended_encoder
                else:
                    hw_detector.probe_all()
                    _encoder_cache = hw_detector.recommended_encoder
            except Exception:
                _encoder_cache = "libx264"
        return _encoder_cache


def _pick_probe_duration(path: Path) -> Optional[float]:
    try:
        result = scanner.probe_file(path)
        return result.duration if result else None
    except Exception:
        return None


# Output size targets: MB of file size per hour of AUDIO (effects on or off).
# (mb_per_hour, audio_bitrate_kbps) — video bitrate = the remainder.
_SIZE_TIERS = {
    "small": (250.0, 128),
    "balanced": (325.0, 160),
    "high": (400.0, 192),
}


def _apply_size_tier(options: Dict[str, Any], audio_dur: float) -> None:
    """Converts a sizeTarget tier into concrete per-job bitrate caps.

    video_kbps = (MB/hour * 8192 kbit/MB / 3600 s) - audio kbps, floored at a
    sane minimum. Stored in options so it persists with the job for resumes.
    """
    tier = str(options.get("sizeTarget") or "balanced").lower()
    if tier == "unlimited" or audio_dur <= 0:
        options.pop("videoBitrateKbps", None)
        options.pop("audioBitrateKbps", None)
        return
    mb_per_hour, audio_kbps = _SIZE_TIERS.get(tier, _SIZE_TIERS["balanced"])
    total_kbps = mb_per_hour * 8192.0 / 3600.0
    options["audioBitrateKbps"] = audio_kbps
    options["videoBitrateKbps"] = max(150, int(round(total_kbps - audio_kbps)))


class QueueAddRequest(BaseModel):
    jobs: List[Dict[str, Any]]
    auto_start: bool = False
    skip_existing: bool = True


def _resolve_job_overlay(raw: Dict[str, Any], options: Dict[str, Any], mode: str) -> tuple[str, str]:
    """Resolves the concrete overlay image for one job.

    Two sources: an explicit `overlayPath` (single mode pick) or an
    `overlay_folder` (bulk mode) from which ONE image is drawn at random for
    this specific job. Returns (resolved_path_or_empty, adjusted_mode).
    """
    overlay_path = str(options.get("overlayPath") or "").strip()
    overlay_folder = str(raw.get("overlay_folder") or "").strip()

    if overlay_folder:
        folder = Path(overlay_folder)
        if not folder.is_dir():
            raise HTTPException(status_code=400, detail=f"Overlay image folder not found: {folder}")
        images = sorted(
            p for p in folder.iterdir()
            if p.suffix.lower() in _IMAGE_EXTS and p.is_file()
        )
        if not images:
            raise HTTPException(status_code=400, detail=f"No overlay images found in: {folder}")
        overlay_path = str(random.choice(images))

    if overlay_path:
        if not Path(overlay_path).exists():
            raise HTTPException(status_code=400, detail=f"Overlay image not found: {overlay_path}")
        if mode == "copy":
            # Stream copy cannot burn an overlay; force a re-encode.
            mode = "encode"
    return overlay_path, mode


@app.post("/api/v1/queue/add")
def add_jobs(req: QueueAddRequest):
    added = []
    for raw in req.jobs:
        audio_path = Path(str(raw.get("audio_path", "")))
        video_path = Path(str(raw.get("video_path", "")))
        output_path = Path(str(raw.get("output_path", "")))
        if req.skip_existing and output_path.exists() and output_path.stat().st_size > 0:
            continue
        if not audio_path.exists():
            raise HTTPException(status_code=400, detail=f"Audio file not found: {audio_path}")
        if not video_path.exists():
            raise HTTPException(status_code=400, detail=f"Video file not found: {video_path}")

        try:
            output_path.parent.mkdir(parents=True, exist_ok=True)
        except OSError as e:
            raise HTTPException(status_code=400, detail=f"Cannot create output folder: {e}")

        mode = str(raw.get("mode") or "copy")
        mode_reason = str(raw.get("mode_reason") or "")
        options = dict(raw.get("options") or {})
        overlay_path, mode = _resolve_job_overlay(raw, options, mode)
        if overlay_path:
            options["overlayPath"] = overlay_path
        else:
            options.pop("overlayPath", None)

        has_effects = bool(
            (options.get("resolution") and options.get("resolution") != "original")
            or (options.get("vhsPreset") and options.get("vhsPreset") not in ("none", "off"))
            or options.get("nightModeEnabled")
            or options.get("noiseStaticEnabled")
            or (options.get("overlayEnabled") and (options.get("overlayPath") or raw.get("overlay_folder")))
        )
        if has_effects:
            mode = "encode"
            mode_reason = "Visual effects / overlay active (re-encode required)" 

        audio_dur = raw.get("duration")
        if not audio_dur:
            probed = _pick_probe_duration(audio_path)
            audio_dur = probed or 0.0
        video_dur = _pick_probe_duration(video_path) or 0.0

        if mode == "encode":
            _apply_size_tier(options, float(audio_dur))
        else:
            options.pop("videoBitrateKbps", None)
            options.pop("audioBitrateKbps", None)

        job = RenderJob(
            job_id=f"job_{uuid.uuid4().hex[:12]}",
            audio_path=str(audio_path),
            video_path=str(video_path),
            output_path=str(output_path),
            mode=mode,
            mode_reason=mode_reason,
            duration=float(audio_dur),
            options={**options, "video_duration_sec": video_dur},
        )
        job.total_segments = 1
        queue_mgr.add_job(job)
        added.append(job.to_dict())

    if req.auto_start and added and not queue_mgr.is_running:
        queue_mgr.is_running = True

    return {"added": added, "queue": [j.to_dict() for j in queue_mgr.jobs]}


def _execute_job(job: RenderJob):
    """Runs one render end-to-end, streaming ffmpeg's progress into the job."""
    global _active_job
    output = Path(job.output_path)
    audio = Path(job.audio_path)
    video = Path(job.video_path)
    opts = job.options or {}

    try:
        job_threads = int(opts.get("threads") or 0) or queue_mgr.threads_for_profile()
        if job.mode == "encode":
            preset = preset_mgr.get_preset(str(opts.get("vhsPreset") or "none"))
            filtergraph = preset["filtergraph"] if preset else ""
            noise_static = bool(opts.get("noiseStaticEnabled"))
            video_dur = float(opts.get("video_duration_sec") or 0.0)
            audio_dur = float(job.duration or 0.0)
            encoder = str(opts.get("encoder") or _pick_encoder())

            overlay_timeout = opts.get("overlayTimeout")
            has_timed_overlay = False
            if opts.get("overlayPath") and overlay_timeout is not None:
                str_timeout = str(overlay_timeout).strip().lower()
                if str_timeout not in ("full", "0", ""):
                    try:
                        has_timed_overlay = float(str_timeout) > 0
                    except ValueError:
                        pass

            # Fast loop-aware pipeline: if video clip is shorter than audio, render the filtered loop once,
            # then stream-copy loop it across the full audio for 10x-50x speed!
            # Timed overlays (e.g. first 30s only) change visual content over time, so they use direct encode.
            if not has_timed_overlay and video_dur > 0 and audio_dur > (video_dur * 1.05):
                loop_dur = min(audio_dur, max(video_dur, 5.0))
                from mistus_av_merger.config import get_temp_dir
                temp_loop = get_temp_dir() / f"filtered_loop_{job.job_id}.mp4"
                temp_loop.parent.mkdir(parents=True, exist_ok=True)

                def _build_loop_cmd(enc: str) -> List[str]:
                    return ffmpeg_builder.build_filtered_loop_clip(
                        video_path=video,
                        output_path=temp_loop,
                        encoder=enc,
                        resolution=str(opts.get("resolution") or "original"),
                        filtergraph=filtergraph,
                        night_mode=bool(opts.get("nightModeEnabled")),
                        night_intensity=float(opts.get("nightIntensity", 0.7)),
                        noise_static=noise_static,
                        noise_seed=int(opts.get("noiseSeed") or 1994),
                        overlay_path=Path(str(opts.get("overlayPath"))) if opts.get("overlayPath") else None,
                        overlay_opacity=float(opts.get("overlayOpacity", 0.8)),
                        duration_sec=loop_dur,
                        bitrate_kbps=int(opts["videoBitrateKbps"]) if opts.get("videoBitrateKbps") else None,
                        threads=job_threads,
                    )

                job.logs.append(f"[info] Fast loop pipeline: pre-rendering {loop_dur:.1f}s loop clip ({encoder})...")
                command = _build_loop_cmd(encoder)
                job.encoder = encoder
                _run_render_process(job, command)

                if job.status != "completed":
                    sw = _sw_fallback_encoder(encoder)
                    if sw:
                        job.logs.append(f"[warn] {encoder} failed; retrying with {sw}")
                        encoder = sw
                        job.encoder = encoder
                        command = _build_loop_cmd(encoder)
                        _run_render_process(job, command)

                if job.status == "completed" and temp_loop.exists():
                    job.logs.append(f"[info] Stream-copy looping across {audio_dur:.1f}s audio track...")
                    copy_cmd = ffmpeg_builder.build_stream_copy_loop(
                        video_path=temp_loop,
                        audio_path=audio,
                        output_path=output,
                        audio_transcode=_needs_audio_transcode(audio, output),
                        audio_duration_sec=audio_dur,
                        video_duration_sec=loop_dur,
                        threads=job_threads,
                    )
                    _run_render_process(job, copy_cmd)
                    try:
                        temp_loop.unlink(missing_ok=True)
                    except Exception:
                        pass
                return

            def _build_encode_command(encoder: str) -> List[str]:
                return ffmpeg_builder.build_reencode_render(
                    video_path=video,
                    audio_path=audio,
                    output_path=output,
                    encoder=encoder,
                    resolution=str(opts.get("resolution") or "original"),
                    filtergraph=filtergraph,
                    night_mode=bool(opts.get("nightModeEnabled")),
                    night_intensity=float(opts.get("nightIntensity", 0.7)),
                    noise_static=noise_static,
                    noise_seed=int(opts.get("noiseSeed") or 1994),
                    overlay_path=Path(str(opts.get("overlayPath"))) if opts.get("overlayPath") else None,
                    overlay_opacity=float(opts.get("overlayOpacity", 0.8)),
                    overlay_timeout=opts.get("overlayTimeout"),
                    duration_sec=job.duration or None,
                    bitrate_kbps=int(opts["videoBitrateKbps"]) if opts.get("videoBitrateKbps") else None,
                    audio_bitrate_kbps=int(opts["audioBitrateKbps"]) if opts.get("audioBitrateKbps") else None,
                    threads=job_threads,
                )

            encoder = str(opts.get("encoder") or _pick_encoder())
            command = _build_encode_command(encoder)
            fallbacks = 0
            while True:
                job.encoder = encoder
                _run_render_process(job, command)
                if job.status == "completed":
                    break
                sw = _sw_fallback_encoder(encoder)
                if sw is None or fallbacks >= 1:
                    break
                job.logs.append(f"[warn] {encoder} failed; retrying with {sw}")
                encoder = sw
                command = _build_encode_command(encoder)
                fallbacks += 1
        else:
            video_dur = float(opts.get("video_duration_sec") or 0.0)
            command = ffmpeg_builder.build_stream_copy_loop(
                video_path=video,
                audio_path=audio,
                output_path=output,
                audio_transcode=_needs_audio_transcode(audio, output),
                audio_duration_sec=job.duration or None,
                video_duration_sec=video_dur or None,
                threads=job_threads,
            )
            _run_render_process(job, command)
    except Exception as exc:  # defensive: a bad job must not kill the worker
        job.status = "failed"
        job.logs.append(f"[error] {exc}")
    finally:
        job.process = None
        with _active_lock:
            if _active_job is job:
                _active_job = None
        queue_mgr.save_session()


def _sw_fallback_encoder(encoder: str) -> Optional[str]:
    """Software encoder to retry with when a hardware encoder fails."""
    if encoder.startswith("h264_"):
        return "libx264"
    if encoder.startswith("hevc_"):
        return "libx264"
    return None


def _run_render_process(job: RenderJob, command: List[str]):
    """Launches ffmpeg, streams progress into the job, sets the final status."""
    global _active_job
    output = Path(command[-1])

    job.status = "rendering"
    job.progress = 0.0
    job.logs.append(f"[cmd] {Path(command[0]).name} ({job.encoder}) render: {Path(job.audio_path).name}")
    queue_mgr.save_session()

    creationflags = subprocess.CREATE_NO_WINDOW if hasattr(subprocess, "CREATE_NO_WINDOW") else 0
    proc = subprocess.Popen(
        command,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding="utf-8",
        errors="replace",
        creationflags=creationflags,
    )
    queue_mgr.apply_cpu_profile(proc)
    job.process = proc
    with _active_lock:
        _active_job = job

    for line in proc.stdout:
        line = line.strip()
        if not line:
            continue
        if "=" in line:
            key, _, value = line.partition("=")
            if key in ("out_time_ms", "out_time_us") and job.duration > 0:
                try:
                    micros = int(value)
                    if micros > 0:
                        done = min(100.0, (micros / 1_000_000.0) / job.duration * 100.0)
                        job.progress = round(done, 1)
                        if job.speed:
                            try:
                                mult = float(job.speed.rstrip("x"))
                                if mult > 0.05:
                                    job.eta_seconds = int(max(0, (job.duration - micros / 1_000_000.0) / mult))
                            except ValueError:
                                pass
                except ValueError:
                    pass
            elif key == "fps":
                try:
                    job.fps = round(float(value), 1)
                except ValueError:
                    pass
            elif key == "speed":
                job.speed = value
            elif line.startswith("progress="):
                continue
        else:
            job.logs.append(line)

    rc = proc.wait()
    if rc == 0 and output.exists():
        job.status = "completed"
        job.progress = 100.0
        job.speed = "-"
        job.eta_seconds = 0
    else:
        job.status = "failed"
        job.logs.append(f"[error] ffmpeg exited with code {rc}")


def _render_worker_loop():
    while True:
        if not queue_mgr.is_running or queue_mgr.is_paused:
            time.sleep(0.25)
            continue
        job = next((j for j in queue_mgr.jobs if j.status == "queued"), None)
        if job is None:
            time.sleep(0.25)
            continue
        _execute_job(job)


threading.Thread(target=_render_worker_loop, name="render-worker", daemon=True).start()


@app.post("/api/v1/queue/start")
def start_queue():
    queue_mgr.is_running = True
    queue_mgr.is_paused = False
    for job in queue_mgr.jobs:
        if job.status == "paused":
            queue_mgr.resume_job(job.job_id)
    return {"status": "started", "queue": [j.to_dict() for j in queue_mgr.jobs]}


@app.post("/api/v1/queue/pause")
def pause_queue():
    queue_mgr.is_paused = True
    for job in queue_mgr.jobs:
        if job.status == "rendering":
            queue_mgr.pause_job(job.job_id)
    return {"status": "paused", "queue": [j.to_dict() for j in queue_mgr.jobs]}


@app.post("/api/v1/queue/resume")
def resume_queue():
    queue_mgr.is_paused = False
    for job in queue_mgr.jobs:
        if job.status == "paused":
            queue_mgr.resume_job(job.job_id)
    return {"status": "resumed", "queue": [j.to_dict() for j in queue_mgr.jobs]}


@app.post("/api/v1/queue/stop")
@app.post("/api/v1/queue/stop-all")
def stop_queue_immediately():
    """Immediately halts running render process, deletes partial file, and stops queue."""
    global _active_job
    queue_mgr.is_running = False
    queue_mgr.is_paused = False

    with _active_lock:
        job = _active_job
        if job and job.process:
            try:
                proc = job.process
                if psutil:
                    try:
                        p = psutil.Process(proc.pid)
                        if job.status == "paused":
                            p.resume()
                        for child in p.children(recursive=True):
                            try:
                                child.kill()
                            except Exception:
                                pass
                        p.kill()
                    except Exception:
                        proc.kill()
                else:
                    proc.kill()
            except Exception as e:
                print(f"[Warning] Failed to stop render process: {e}")

            job.status = "failed"
            job.logs.append("[info] Render stopped immediately by user.")

            try:
                out_p = Path(job.output_path)
                if out_p.exists():
                    out_p.unlink(missing_ok=True)
            except Exception:
                pass

            _active_job = None

    queue_mgr.save_session()
    return {"status": "stopped", "queue": [j.to_dict() for j in queue_mgr.jobs]}


@app.post("/api/v1/queue/stop-after-current")
def stop_after_current():
    """Lets the in-flight render finish, then stops starting new jobs."""
    queue_mgr.is_running = False
    return {"status": "stopping_after_current"}


@app.post("/api/v1/queue/clear-completed")
def clear_completed_jobs():
    queue_mgr.jobs = [j for j in queue_mgr.jobs if j.status not in ("completed", "failed")]
    queue_mgr.save_session()
    return {"status": "cleared", "queue": [j.to_dict() for j in queue_mgr.jobs]}


@app.post("/api/v1/queue/clear")
@app.post("/api/v1/queue/clear-all")
def clear_all_jobs():
    """Immediately terminates any running job and clears the entire queue."""
    stop_queue_immediately()
    queue_mgr.jobs.clear()
    queue_mgr.save_session()
    return {"status": "cleared", "queue": []}


class JobMoveRequest(BaseModel):
    direction: str = "up"


@app.delete("/api/v1/queue/jobs/{job_id}")
def remove_job(job_id: str):
    job = next((j for j in queue_mgr.jobs if j.job_id == job_id), None)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.process:
        try:
            import psutil as _psutil
            p = _psutil.Process(job.process.pid)
            if job.status == "paused":
                p.resume()
            p.terminate()
        except Exception:
            pass
    queue_mgr.remove_job(job_id)
    return {"status": "removed", "queue": [j.to_dict() for j in queue_mgr.jobs]}


@app.post("/api/v1/queue/jobs/{job_id}/pause")
def pause_single_job(job_id: str):
    queue_mgr.pause_job(job_id)
    return {"status": "paused", "queue": [j.to_dict() for j in queue_mgr.jobs]}


@app.post("/api/v1/queue/jobs/{job_id}/resume")
def resume_single_job(job_id: str):
    queue_mgr.resume_job(job_id)
    return {"status": "resumed", "queue": [j.to_dict() for j in queue_mgr.jobs]}


@app.post("/api/v1/queue/jobs/{job_id}/move")
def move_single_job(job_id: str, req: JobMoveRequest):
    queue_mgr.move_job(job_id, req.direction)
    return {"status": "moved", "queue": [j.to_dict() for j in queue_mgr.jobs]}


@app.post("/api/v1/system/shutdown")
def shutdown_server():
    """Clean exit triggered from Web UI Quit button."""
    import threading
    import time
    def _delayed_exit():
        time.sleep(0.5)
        os._exit(0)
    threading.Thread(target=_delayed_exit, daemon=True).start()
    return {"status": "shutting_down"}


# Mount static web frontend if built. In frozen (PyInstaller onedir) builds the
# frontend is bundled into the _internal directory next to the Python modules,
# so resolve from both the app root (dev/portable) and the package root (frozen).
def _find_frontend_dist():
    me = Path(__file__).resolve()
    candidates = [get_app_root() / "dist"]
    # Source: mistus_av_merger/dist sits next to the package. Frozen onedir:
    # the frontend is bundled at _internal/dist, i.e. two levels above app.py
    # (_internal/mistus_av_merger/api/app.py -> parents[2] == _internal).
    candidates.append(me.parent.parent / "dist")
    candidates.append(me.parents[2] / "dist" if len(me.parents) > 2 else me.parents[-1] / "dist")
    for candidate in candidates:
        if candidate.is_dir():
            return candidate
    return None


dist_dir = _find_frontend_dist()
if dist_dir and (dist_dir / "index.html").exists():
    app.mount("/", StaticFiles(directory=str(dist_dir), html=True), name="static")
