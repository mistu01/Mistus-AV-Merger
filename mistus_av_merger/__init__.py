"""
Mistus AV Merger - Portable Looping Audio-Video Combiner
"""

from pathlib import Path

# Read canonical SemVer from VERSION file
_version_file = Path(__file__).resolve().parent.parent / "VERSION"
if _version_file.exists():
    __version__ = _version_file.read_text(encoding="utf-8").strip()
else:
    __version__ = "0.6.0"

try:
    from mistus_av_merger.core.versioning import parse_semver, compute_version_code
    _parsed = parse_semver(__version__)
    VERSION_CODE = _parsed["version_code"]
except Exception:
    VERSION_CODE = 600

__all__ = ["__version__", "VERSION_CODE"]
