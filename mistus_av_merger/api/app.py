"""
FastAPI REST API and WebSocket live progress server for Mistus AV Merger.
Localhost-only binding with CSRF origin protection and `/api/v1` routes.
"""

import os
import string
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

settings_mgr = SettingsManager()
hw_detector = HardwareDetector()
scanner = MediaScanner()
preset_mgr = PresetManager()
queue_mgr = JobQueueManager()


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
    return hw_detector.get_summary()


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
          ".mov": "video", ".avi": "video", ".webm": "video", ".m4v": "video", ".ts": "video"}


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


def _list_shortcuts() -> List[Dict[str, str]]:
    home = Path.home()
    shortcuts = [{"label": "Home", "path": str(home), "icon": "home"}]
    named = [("Desktop", "Desktop"), ("Downloads", "Downloads"), ("Music", "Music"),
             ("Videos", "Videos"), ("Pictures", "Pictures"), ("Documents", "Documents")]
    for label, dirname in named:
        candidate = home / dirname
        if candidate.is_dir():
            shortcuts.append({"label": label, "path": str(candidate), "icon": dirname.lower()})
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


@app.post("/api/v1/queue/start")
def start_queue():
    queue_mgr.is_running = True
    queue_mgr.is_paused = False
    return {"status": "started"}


@app.post("/api/v1/queue/pause")
def pause_queue():
    queue_mgr.is_paused = True
    return {"status": "paused"}


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
