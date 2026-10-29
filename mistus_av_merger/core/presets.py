"""
Preset catalog manager for VHS and visual effect styles.
"""

import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

DEFAULT_PRESETS: List[Dict[str, Any]] = [   {   'chroma_shift': False,
        'description': 'Authentic commercial SP tape playback: warm 90s tape color, gentle tape softness, mild luma '
                       'grain, and subtle overscan line. Clean, nostalgic analog look without harsh glitches.',
        'filtergraph': 'avgblur=sizeX=3:sizeY=1,noise=alls=15:allf=t,eq=contrast=1.06:saturation=1.20:brightness=0.02,curves=vintage,drawbox=y=ih-12:color=black@0.6:width=iw:height=12:t=fill',
        'id': 'clean_vhs',
        'intensity': 0.4,
        'name': 'Clean VHS (SP Mode)',
        'scanlines': False,
        'tracking_noise': False},
    {   'chroma_shift': False,
        'description': 'Aged family tape played hundreds of times: yellowed/aged tape color oxidation, soft magnetic '
                       'flutter, visible tape noise, and lower-third head-switching drift.',
        'filtergraph': 'colorchannelmixer=rr=1.05:rg=0.05:rb=-0.05:br=-0.1:bg=-0.05:bb=0.9,eq=contrast=1.12:saturation=0.90:brightness=-0.02,avgblur=sizeX=5:sizeY=1,drawbox=y=ih-28:color=black@0.80:width=iw:height=28:t=fill,drawbox=y=ih-32:color=white@0.4:width=iw:height=2:t=fill,noise=alls=30:allf=t+u',
        'id': 'worn_tape',
        'intensity': 0.65,
        'name': 'Worn Tape (LP Mode)',
        'scanlines': False,
        'tracking_noise': True},
    {   'chroma_shift': False,
        'description': 'Severe VCR tracking misalignment: active horizontal static tearing bands slicing through the '
                       'frame, thick head-switching glitches, sync tearing lines, and heavy static snow.',
        'filtergraph': 'avgblur=sizeX=4:sizeY=1,drawbox=y=ih-48:color=black@0.92:width=iw:height=48:t=fill,drawbox=y=ih-54:color=white@0.80:width=iw:height=4:t=fill,drawbox=y=ih-34:color=white@0.50:width=iw:height=3:t=fill,drawbox=y=ih*0.65:color=black@0.65:width=iw:height=18:t=fill:enable=lt(mod(t\\,3)\\,0.8),drawbox=y=ih*0.65+18:color=white@0.7:width=iw:height=3:t=fill:enable=lt(mod(t\\,3)\\,0.8),noise=alls=50:allf=t+u,eq=contrast=1.25:saturation=1.15:brightness=-0.03',
        'id': 'tracking_errors',
        'intensity': 0.85,
        'name': 'Tracking Errors',
        'scanlines': False,
        'tracking_noise': True},
    {   'chroma_shift': True,
        'description': 'Extreme RCA composite analog cable color misregistration: bold red/cyan halos bleeding out of '
                       'objects, hyper-saturated bleeding colors, and composite noise. No dark bars.',
        'filtergraph': 'chromashift=cbh=28:cbv=2:crh=-28:crv=-2,avgblur=sizeX=3:sizeY=1,eq=saturation=1.90:contrast=1.15:brightness=0.01,noise=alls=16:allf=t+u',
        'id': 'chroma_bleed',
        'intensity': 0.75,
        'name': 'Chroma Bleed',
        'scanlines': False,
        'tracking_noise': False},
    {   'chroma_shift': True,
        'description': 'Handheld 1990s home video camcorder: warm tungsten incandescent indoor lighting, sharp CCD '
                       'sensor edge sharpening, CRT interlace lines, and camera master vibrancy. No tracking bars.',
        'filtergraph': "curves=red='0/0 0.5/0.62 1/1':blue='0/0 0.5/0.38 "
                       "1/0.88',chromashift=cbh=6:crh=-6,drawgrid=width=iw:height=4:thickness=1:color=black@0.25,unsharp=lx=5:ly=5:la=1.2:cx=3:cy=3:ca=0.8,eq=saturation=1.45:contrast=1.18:brightness=0.02,noise=alls=20:allf=t",
        'id': 'camcorder_90s',
        'intensity': 0.6,
        'name': 'Camcorder 90s',
        'scanlines': True,
        'tracking_noise': False},
    {   'chroma_shift': False,
        'description': 'Authentic CCTV surveillance footage: jerky 12 FPS surveillance cadence, high-contrast '
                       'monochrome with eerie green phosphor monitor glow, convex security lens vignette, and CCD '
                       'sensor noise.',
        'filtergraph': "hue=s=0,eq=contrast=1.85:brightness=-0.08,curves=all='0/0 0.5/0.44 1/0.95':green='0/0 0.5/0.60 "
                       "1/1',drawgrid=width=iw:height=4:thickness=1:color=black@0.45,vignette=PI/2.6,noise=alls=42:allf=t+u,fps=12",
        'id': 'security_cam',
        'intensity': 0.95,
        'name': 'Security Cam (CCTV)',
        'scanlines': True,
        'tracking_noise': False},
    {   'chroma_shift': True,
        'description': 'Total tape decay & analog generation loss (found footage horror): extreme horizontal blur '
                       'smear, massive static snowstorm, severe tape tears, and degraded muddy luma.',
        'filtergraph': 'avgblur=sizeX=10:sizeY=2,chromashift=cbh=24:cbv=3:crh=-24:crv=-3,drawbox=y=ih-52:color=black@0.92:width=iw:height=52:t=fill,drawbox=y=ih-58:color=white@0.70:width=iw:height=5:t=fill,noise=alls=65:allf=t+u,eq=contrast=1.35:saturation=0.65:brightness=-0.04',
        'id': 'heavy_degradation',
        'intensity': 1.0,
        'name': 'Heavy Degradation',
        'scanlines': False,
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
