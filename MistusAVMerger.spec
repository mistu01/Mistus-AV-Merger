# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller specification for Mistus AV Merger (onedir, portable).

Bundles into a portable single-directory distribution:
  - the web frontend (npm build output, repo ./dist)  -> ./dist
  - the presets catalog                               -> ./mistus_av_merger/presets
  - the VERSION file                                  -> ./
  - pinned static FFmpeg/FFprobe                      -> ./bin

Build prerequisites:
  1. npm ci && npm run build          (produces ./dist with index.html)
  2. python scripts/fetch_ffmpeg.py   (populates ./bin with verified binaries)
  3. python scripts/gen_build_info.py (refreshes mistus_av_merger/core/_build_info.py)
  4. pyinstaller --clean MistusAVMerger.spec
"""

from pathlib import Path
from PyInstaller.utils.hooks import collect_submodules

root = Path(SPECPATH).resolve()

# ---------------- Data files ----------------
datas = [
    (str(root / "VERSION"), "."),
    (str(root / "mistus_av_merger" / "presets" / "presets_v1.json"), "mistus_av_merger/presets"),
]

# Include built web assets when they exist (CI builds them just before packaging).
dist_dir = root / "dist"
if (dist_dir / "index.html").exists():
    datas.append((str(dist_dir), "dist"))

# ---------------- Bundled FFmpeg / FFprobe (checksum-verified in CI) ----------------
binaries = []
bin_dir = root / "bin"
if bin_dir.is_dir():
    for f in sorted(bin_dir.iterdir()):
        if f.is_file():
            binaries.append((str(f), "bin"))

# ---------------- Hidden imports ----------------
# Uvicorn resolves protocol/loop/lifespan implementations dynamically at runtime,
# so every submodule that is actually installed must be collected explicitly.
hiddenimports = collect_submodules("uvicorn") + [
    "fastapi",
    "pydantic",
    "psutil",
    "mistus_av_merger.core.binaries",
]

a = Analysis(
    ["mistus_av_merger/main.py"],
    pathex=[str(root)],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
)

pyz = PYZ(a.pure)

# onedir build: EXE must exclude binaries; COLLECT places everything in dist/MistusAVMerger
exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="MistusAVMerger",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,  # UPX corrupts/invalidates signed AV binaries and macOS codesign
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,  # never universal2: separate arm64 and x64 builds
    codesign_identity=None,
    entitlements_file=None,
    icon=str(root / "assets" / "icon.ico") if (root / "assets" / "icon.ico").exists() else None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=False,
    upx_exclude=[],
    name="MistusAVMerger",
)
