"""
Locates the bundled (or system) FFmpeg/FFprobe binaries.

Resolution order:
  1. <app root>/bin            (repo checkout, or next to the exe in portable mode)
  2. sys._MEIPASS/bin          (frozen builds; onedir puts datas under _internal/)
  3. <package parent>/bin      (repo checkout fallback: mistus_av_merger/../bin)
  4. PATH (shutil.which)       (developer machines with system FFmpeg)

Never shells out to a name-only lookup, so the bundled binaries always win.
"""

import shutil
import sys
from pathlib import Path

from mistus_av_merger.config import get_app_root

_TOOLS = ("ffmpeg", "ffprobe")


def _candidate_dirs() -> list:
    dirs = [get_app_root() / "bin"]
    # Frozen builds: PyInstaller places bundled datas/binaries relative to
    # sys._MEIPASS (the _internal/ directory in onedir; the unpack dir in onefile).
    meipass = getattr(sys, "_MEIPASS", None)
    if meipass:
        dirs.append(Path(meipass) / "bin")
    # Package-level fallback (unfrozen repo checkout / editable install).
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
