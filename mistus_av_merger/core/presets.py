"""
Preset catalog manager for VHS and visual effect styles.
"""

import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

DEFAULT_PRESETS: List[Dict[str, Any]] = [   {   'chroma_shift': True,
        'description': 'Authentic 90s commercial SP tape with horizontal tape head softening, subtle CRT scanlines, '
                       'mild chroma shift, and vintage tape warmth.',
        'filtergraph': 'avgblur=sizeX=4:sizeY=1,chromashift=cbh=8:crh=-8,drawgrid=width=iw:height=4:thickness=1:color=black@0.28,drawbox=y=ih-20:color=black@0.70:width=iw:height=20:t=fill,noise=alls=24:allf=t+u,eq=contrast=1.12:saturation=1.28:brightness=0.01,curves=vintage',
        'id': 'clean_vhs',
        'intensity': 0.5,
        'name': 'Clean VHS (SP Mode)',
        'scanlines': True,
        'tracking_noise': False},
    {   'chroma_shift': True,
        'description': 'Heavy LP mode magnetic tape wear with horizontal color bleed, distinct CRT scanlines, bottom '
                       'head-switching glitch bar with sync tear, and magnetic noise.',
        'filtergraph': 'avgblur=sizeX=6:sizeY=1,chromashift=cbh=16:cbv=1:crh=-16:crv=-1,drawgrid=width=iw:height=4:thickness=1:color=black@0.36,drawbox=y=ih-34:color=black@0.85:width=iw:height=34:t=fill,drawbox=y=ih-38:color=white@0.55:width=iw:height=3:t=fill,noise=alls=38:allf=t+u,eq=contrast=1.22:saturation=1.35:brightness=-0.02',
        'id': 'worn_tape',
        'intensity': 0.7,
        'name': 'Worn Tape (LP Mode)',
        'scanlines': True,
        'tracking_noise': True},
    {   'chroma_shift': True,
        'description': 'Severe VHS tracking misalignment: heavy chroma split, horizontal CRT scanlines, large '
                       'head-switching bar, white sync tearing jitter lines, and tape static.',
        'filtergraph': 'avgblur=sizeX=5:sizeY=1,chromashift=cbh=26:cbv=2:crh=-24:crv=-2,drawgrid=width=iw:height=4:thickness=1:color=black@0.42,drawbox=y=ih-46:color=black@0.92:width=iw:height=46:t=fill,drawbox=y=ih-52:color=white@0.75:width=iw:height=4:t=fill,drawbox=y=ih-30:color=white@0.40:width=iw:height=2:t=fill,noise=alls=54:allf=t+u,eq=contrast=1.28:saturation=1.22:brightness=-0.03',
        'id': 'tracking_errors',
        'intensity': 0.85,
        'name': 'Tracking Errors',
        'scanlines': True,
        'tracking_noise': True},
    {   'chroma_shift': True,
        'description': 'Heavy composite RCA analog cable bleeding: bold red/cyan color halos, horizontal softening, '
                       'CRT scanlines, and saturated color halos.',
        'filtergraph': 'avgblur=sizeX=4:sizeY=1,chromashift=cbh=26:cbv=2:crh=-26:crv=-2,drawgrid=width=iw:height=4:thickness=1:color=black@0.32,noise=alls=26:allf=t+u,eq=saturation=1.70:contrast=1.18:brightness=0.01',
        'id': 'chroma_bleed',
        'intensity': 0.75,
        'name': 'Chroma Bleed',
        'scanlines': True,
        'tracking_noise': False},
    {   'chroma_shift': True,
        'description': 'Nostalgic 1990s handheld camcorder: warm incandescent color balance, vivid saturation, CRT '
                       'interlace lines, lens chroma drift, and tape grain.',
        'filtergraph': "curves=red='0/0 0.5/0.60 1/1':blue='0/0 0.5/0.38 "
                       "1/0.88',chromashift=cbh=8:crh=-8,drawgrid=width=iw:height=4:thickness=1:color=black@0.32,eq=saturation=1.45:contrast=1.18:brightness=0.02,noise=alls=26:allf=t+u",
        'id': 'camcorder_90s',
        'intensity': 0.65,
        'name': 'Camcorder 90s',
        'scanlines': True,
        'tracking_noise': False},
    {   'chroma_shift': False,
        'description': 'Authentic CCTV surveillance footage: high-contrast monochrome with subtle phosphor green tint, '
                       'CRT scanlines, 12fps surveillance stutter, fisheye lens vignette, and chunky sensor noise.',
        'filtergraph': "hue=s=0,eq=contrast=1.85:brightness=-0.07,curves=all='0/0 0.5/0.44 1/0.95':green='0/0 0.5/0.58 "
                       "1/1',drawgrid=width=iw:height=4:thickness=1:color=black@0.48,vignette=PI/2.8,noise=alls=48:allf=t+u,fps=12",
        'id': 'security_cam',
        'intensity': 0.95,
        'name': 'Security Cam (CCTV)',
        'scanlines': True,
        'tracking_noise': True},
    {   'chroma_shift': True,
        'description': 'Total tape decay & analog generation loss: extreme horizontal blur, intense chroma '
                       'displacement, dense scanlines, bottom tracking tear, and heavy static snow.',
        'filtergraph': 'avgblur=sizeX=9:sizeY=2,chromashift=cbh=30:cbv=3:crh=-28:crv=-3,drawgrid=width=iw:height=3:thickness=1:color=black@0.48,drawbox=y=ih-52:color=black@0.92:width=iw:height=52:t=fill,drawbox=y=ih-58:color=white@0.65:width=iw:height=5:t=fill,noise=alls=68:allf=t+u,eq=contrast=1.38:saturation=0.70:brightness=-0.04',
        'id': 'heavy_degradation',
        'intensity': 1.0,
        'name': 'Heavy Degradation',
        'scanlines': True,
        'tracking_noise': True}]


def _find_catalog_path(explicit: Optional[Path] = None) -> Optional[Path]:
    if explicit and explicit.exists() and explicit.is_file():
        return explicit

    candidates = []
    # 1. PyInstaller MEIPASS
    meipass = getattr(sys, "_MEIPASS", None)
    if meipass:
        candidates.append(Path(meipass) / "mistus_av_merger" / "presets" / "presets_v1.json")
        candidates.append(Path(meipass) / "presets" / "presets_v1.json")

    # 2. Executable parent directory
    if getattr(sys, "frozen", False):
        exe_dir = Path(sys.executable).resolve().parent
        candidates.append(exe_dir / "_internal" / "mistus_av_merger" / "presets" / "presets_v1.json")
        candidates.append(exe_dir / "mistus_av_merger" / "presets" / "presets_v1.json")
        candidates.append(exe_dir / "presets" / "presets_v1.json")

    # 3. Source package directory
    pkg_dir = Path(__file__).resolve().parent.parent / "presets" / "presets_v1.json"
    candidates.append(pkg_dir)

    # 4. Current working directory
    candidates.append(Path.cwd() / "mistus_av_merger" / "presets" / "presets_v1.json")

    for c in candidates:
        try:
            if c.exists() and c.is_file():
                return c
        except Exception:
            pass
    return None


class PresetManager:
    """Loads, registers, and serializes versioned presets with compiled-in fallback."""

    def __init__(self, catalog_path: Optional[Path] = None):
        self.catalog_path = _find_catalog_path(catalog_path)
        self.presets: List[Dict[str, Any]] = []
        self.load()

    def load(self):
        loaded = False
        if self.catalog_path and self.catalog_path.exists():
            try:
                with open(self.catalog_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    self.presets = data.get("presets", [])
                    if self.presets:
                        loaded = True
            except Exception:
                loaded = False

        if not loaded:
            self.presets = [dict(p) for p in DEFAULT_PRESETS]

    def get_preset(self, preset_id: str) -> Optional[Dict[str, Any]]:
        for p in self.presets:
            if p.get("id") == preset_id:
                return p
        return None

    def list_all(self) -> List[Dict[str, Any]]:
        return list(self.presets)
