"""
Preset catalog manager for VHS and visual effect styles.
"""

import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

DEFAULT_PRESETS: List[Dict[str, Any]] = [
    {
        "id": "clean_vhs",
        "name": "Clean VHS (SP Mode)",
        "description": "Authentic 90s commercial SP tape with noticeable horizontal softening, vintage color warmth, and gentle tape noise.",
        "filtergraph": "avgblur=sizeX=3:sizeY=1,noise=alls=14:allf=t,eq=contrast=1.08:saturation=1.2:brightness=0.01,curves=vintage",
        "intensity": 0.40,
        "scanlines": False,
        "tracking_noise": False,
        "chroma_shift": False,
    },
    {
        "id": "worn_tape",
        "name": "Worn Tape (LP Mode)",
        "description": "Heavy LP mode magnetic tape wear with horizontal color bleed, bottom head-switching glitch bar, and magnetic noise.",
        "filtergraph": "avgblur=sizeX=5:sizeY=1,chromashift=cbh=12:crh=-12,drawbox=y=ih-28:color=black@0.7:width=iw:height=28:t=fill,noise=alls=28:allf=t+u,eq=contrast=1.18:saturation=1.3",
        "intensity": 0.65,
        "scanlines": False,
        "tracking_noise": True,
        "chroma_shift": True,
    },
    {
        "id": "tracking_errors",
        "name": "Tracking Errors",
        "description": "Severe VHS tracking misalignment: heavy chroma split, large head-switching bar, white sync tears, and tape static.",
        "filtergraph": "chromashift=cbh=20:cbv=1:crh=-18:crv=-1,drawbox=y=ih-36:color=black@0.85:width=iw:height=36:t=fill,drawbox=y=ih-40:color=white@0.6:width=iw:height=3:t=fill,noise=alls=42:allf=t+u,eq=contrast=1.22:saturation=1.15",
        "intensity": 0.80,
        "scanlines": False,
        "tracking_noise": True,
        "chroma_shift": True,
    },
    {
        "id": "chroma_bleed",
        "name": "Chroma Bleed",
        "description": "Heavy composite RCA analog cable bleeding: bold red/cyan color halos and saturated color bleed.",
        "filtergraph": "chromashift=cbh=24:cbv=2:crh=-24:crv=-2,noise=alls=18:allf=t+u,eq=saturation=1.65:contrast=1.12",
        "intensity": 0.75,
        "scanlines": False,
        "tracking_noise": False,
        "chroma_shift": True,
    },
    {
        "id": "camcorder_90s",
        "name": "Camcorder 90s",
        "description": "Nostalgic 1990s handheld camcorder: warm incandescent color balance, vivid saturation, and tape grain.",
        "filtergraph": "curves=red='0/0 0.5/0.58 1/1':blue='0/0 0.5/0.40 1/0.9',eq=saturation=1.4:contrast=1.15:brightness=0.03,noise=alls=16:allf=t",
        "intensity": 0.60,
        "scanlines": False,
        "tracking_noise": False,
        "chroma_shift": False,
    },
    {
        "id": "security_cam",
        "name": "Security Cam (CCTV)",
        "description": "Authentic CCTV surveillance footage: high-contrast monochrome with subtle phosphor green tint, CRT scanlines, 12fps surveillance stutter, fisheye lens vignette, and chunky sensor noise.",
        "filtergraph": "hue=s=0,eq=contrast=1.65:brightness=-0.05,curves=all='0/0 0.5/0.46 1/0.95':green='0/0 0.5/0.54 1/1',drawgrid=width=iw:height=4:thickness=1:color=black@0.40,vignette=PI/3.2,noise=alls=35:allf=t+u,fps=12",
        "intensity": 0.95,
        "scanlines": True,
        "tracking_noise": True,
        "chroma_shift": False,
    },
    {
        "id": "heavy_degradation",
        "name": "Heavy Degradation",
        "description": "Total tape decay & analog generation loss: extreme horizontal blur, intense chroma displacement, bottom tracking tear, and heavy static snow.",
        "filtergraph": "avgblur=sizeX=7:sizeY=2,chromashift=cbh=26:cbv=2:crh=-24:crv=-2,drawbox=y=ih-44:color=black@0.85:width=iw:height=44:t=fill,noise=alls=55:allf=t+u,eq=contrast=1.3:saturation=0.75:brightness=-0.03",
        "intensity": 1.00,
        "scanlines": False,
        "tracking_noise": True,
        "chroma_shift": True,
    },
]


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
