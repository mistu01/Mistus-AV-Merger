"""
Locates the bundled (or system) FFmpeg/FFprobe binaries.

Resolution order:
  1. <app root>/bin            (repo checkout, or next to the exe in portable mode)
  2. <package parent>/bin      (PyInstaller onedir: the _internal directory)
  3. PATH (shutil.which)       (developer machines with system FFmpeg)

Never shells out to a name-only lookup, so the bundled binaries always win.
"""

import shutil
from pathlib import Path
from typing import Optional, Union

from mistus_av_merger.config import get_app_root

_TOOLS = ("ffmpeg", "ffprobe")


def _candidate_dirs() -> list:
    dirs = [get_app_root() / "bin"]
    # Package-level fallback: in frozen onedir builds modules live in _internal/.
    pkg_parent = Path(__file__).resolve().parent.parent  # mistus_av_merger/ -> project root
    dirs.append(pkg_parent / "bin")
    return dirs


def get_tool_path(name: str) -> Path:
    """Resolves an absolute path for 'ffmpeg' or 'ffprobe' (bundled wins over PATH)."""
    if name not in _TOOLS:
        raise ValueError(f"Unknown tool: {name}")
    for base in _candidate_dirs():
        for candidate in (base / name, base / f"{name}.exe"):
            if candidate.is_file():
                return candidate
    found = shutil.which(name)
    if found:
        return Path(found)
    # Fall through to the bare name so a clear 'command not found' surfaces.
    return Path(name)


def get_ffmpeg_path() -> Path:
    return get_tool_path("ffmpeg")


def get_ffprobe_path() -> Path:
    return get_tool_path("ffprobe")


__all__ = ["get_ffmpeg_path", "get_ffprobe_path", "get_tool_path"]
