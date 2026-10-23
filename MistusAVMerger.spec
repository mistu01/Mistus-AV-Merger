# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller specification file for Mistus AV Merger.
Bundles static FFmpeg binaries, web frontend assets, and presets into a portable standalone executable.
"""

import sys
from pathlib import Path
from PyInstaller.utils.hooks import collect_data_files, collect_submodules

block_cipher = None

root_dir = Path(__file__).resolve().parent

# Collect data files
datas = [
    (str(root_dir / "VERSION"), "."),
    (str(root_dir / "mistus_av_merger" / "presets" / "presets_v1.json"), "mistus_av_merger/presets"),
]

# Include built web assets if available
dist_dir = root_dir / "dist"
if dist_dir.exists():
    datas.append((str(dist_dir), "dist"))

# Include bundled FFmpeg and FFprobe binaries
binaries = []
bin_dir = root_dir / "bin"
if bin_dir.exists():
    for f in bin_dir.iterdir():
        if f.is_file():
            binaries.append((str(f), "."))

hiddenimports = [
    "uvicorn.logging",
    "uvicorn.loops",
    "uvicorn.loops.auto",
    "uvicorn.protocols",
    "uvicorn.protocols.http",
    "uvicorn.protocols.http.auto",
    "uvicorn.protocols.websockets",
    "uvicorn.protocols.websockets.auto",
    "uvicorn.lifespan",
    "uvicorn.lifespan.on",
    "fastapi",
    "pydantic",
    "psutil",
]

a = Analysis(
    ["mistus_av_merger/main.py"],
    pathex=[str(root_dir)],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name="MistusAVMerger",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=str(root_dir / "assets" / "icon.ico") if (root_dir / "assets" / "icon.ico").exists() else None,
)
