/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface VHSPreset {
  id: string;
  name: string;
  description: string;
  filtergraph: string;
  intensity: number;
  scanlines: boolean;
  trackingNoise: boolean;
  chromaShift: boolean;
  colorGrading: string;
}

export const VHS_PRESETS: VHSPreset[] = [
  {
    "id": "none",
    "name": "Off / None",
    "description": "No VHS effects. Direct clean render.",
    "filtergraph": "",
    "intensity": 0,
    "scanlines": false,
    "trackingNoise": false,
    "chromaShift": false,
    "colorGrading": "natural"
  },
  {
    "id": "clean_vhs",
    "name": "Clean VHS (SP Mode)",
    "description": "Authentic 90s commercial SP tape with horizontal tape head softening, subtle CRT scanlines, mild chroma shift, and vintage tape warmth.",
    "filtergraph": "avgblur=sizeX=4:sizeY=1,chromashift=cbh=8:crh=-8,drawgrid=width=iw:height=4:thickness=1:color=black@0.28,drawbox=y=ih-20:color=black@0.70:width=iw:height=20:t=fill,noise=alls=24:allf=t+u,eq=contrast=1.12:saturation=1.28:brightness=0.01,curves=vintage",
    "intensity": 0.5,
    "scanlines": true,
    "trackingNoise": false,
    "chromaShift": true,
    "colorGrading": "subtle_warm"
  },
  {
    "id": "worn_tape",
    "name": "Worn Tape (LP Mode)",
    "description": "Heavy LP mode magnetic tape wear with horizontal color bleed, distinct CRT scanlines, bottom head-switching glitch bar with sync tear, and magnetic noise.",
    "filtergraph": "avgblur=sizeX=6:sizeY=1,chromashift=cbh=16:cbv=1:crh=-16:crv=-1,drawgrid=width=iw:height=4:thickness=1:color=black@0.36,drawbox=y=ih-34:color=black@0.85:width=iw:height=34:t=fill,drawbox=y=ih-38:color=white@0.55:width=iw:height=3:t=fill,noise=alls=38:allf=t+u,eq=contrast=1.22:saturation=1.35:brightness=-0.02",
    "intensity": 0.7,
    "scanlines": true,
    "trackingNoise": true,
    "chromaShift": true,
    "colorGrading": "analog_worn"
  },
  {
    "id": "tracking_errors",
    "name": "Tracking Errors",
    "description": "Severe VHS tracking misalignment: heavy chroma split, horizontal CRT scanlines, large head-switching bar, white sync tearing jitter lines, and tape static.",
    "filtergraph": "avgblur=sizeX=5:sizeY=1,chromashift=cbh=26:cbv=2:crh=-24:crv=-2,drawgrid=width=iw:height=4:thickness=1:color=black@0.42,drawbox=y=ih-46:color=black@0.92:width=iw:height=46:t=fill,drawbox=y=ih-52:color=white@0.75:width=iw:height=4:t=fill,drawbox=y=ih-30:color=white@0.40:width=iw:height=2:t=fill,noise=alls=54:allf=t+u,eq=contrast=1.28:saturation=1.22:brightness=-0.03",
    "intensity": 0.85,
    "scanlines": true,
    "trackingNoise": true,
    "chromaShift": true,
    "colorGrading": "harsh_analog"
  },
  {
    "id": "chroma_bleed",
    "name": "Chroma Bleed",
    "description": "Heavy composite RCA analog cable bleeding: bold red/cyan color halos, horizontal softening, CRT scanlines, and saturated color halos.",
    "filtergraph": "avgblur=sizeX=4:sizeY=1,chromashift=cbh=26:cbv=2:crh=-26:crv=-2,drawgrid=width=iw:height=4:thickness=1:color=black@0.32,noise=alls=26:allf=t+u,eq=saturation=1.70:contrast=1.18:brightness=0.01",
    "intensity": 0.75,
    "scanlines": true,
    "trackingNoise": false,
    "chromaShift": true,
    "colorGrading": "saturated_bleed"
  },
  {
    "id": "camcorder_90s",
    "name": "Camcorder 90s",
    "description": "Nostalgic 1990s handheld camcorder: warm incandescent color balance, vivid saturation, CRT interlace lines, lens chroma drift, and tape grain.",
    "filtergraph": "curves=red='0/0 0.5/0.60 1/1':blue='0/0 0.5/0.38 1/0.88',chromashift=cbh=8:crh=-8,drawgrid=width=iw:height=4:thickness=1:color=black@0.32,eq=saturation=1.45:contrast=1.18:brightness=0.02,noise=alls=26:allf=t+u",
    "intensity": 0.65,
    "scanlines": true,
    "trackingNoise": false,
    "chromaShift": true,
    "colorGrading": "vibrant_90s"
  },
  {
    "id": "security_cam",
    "name": "Security Cam (CCTV)",
    "description": "Authentic CCTV surveillance footage: high-contrast monochrome with subtle phosphor green tint, CRT scanlines, 12fps surveillance stutter, fisheye lens vignette, and chunky sensor noise.",
    "filtergraph": "hue=s=0,eq=contrast=1.85:brightness=-0.07,curves=all='0/0 0.5/0.44 1/0.95':green='0/0 0.5/0.58 1/1',drawgrid=width=iw:height=4:thickness=1:color=black@0.48,vignette=PI/2.8,noise=alls=48:allf=t+u,fps=12",
    "intensity": 0.95,
    "scanlines": true,
    "trackingNoise": true,
    "chromaShift": false,
    "colorGrading": "monochrome_cctv"
  },
  {
    "id": "heavy_degradation",
    "name": "Heavy Degradation",
    "description": "Total tape decay & analog generation loss: extreme horizontal blur, intense chroma displacement, dense scanlines, bottom tracking tear, and heavy static snow.",
    "filtergraph": "avgblur=sizeX=9:sizeY=2,chromashift=cbh=30:cbv=3:crh=-28:crv=-3,drawgrid=width=iw:height=3:thickness=1:color=black@0.48,drawbox=y=ih-52:color=black@0.92:width=iw:height=52:t=fill,drawbox=y=ih-58:color=white@0.65:width=iw:height=5:t=fill,noise=alls=68:allf=t+u,eq=contrast=1.38:saturation=0.70:brightness=-0.04",
    "intensity": 1.0,
    "scanlines": true,
    "trackingNoise": true,
    "chromaShift": true,
    "colorGrading": "decayed"
  }
];
