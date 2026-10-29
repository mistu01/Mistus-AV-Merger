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
    "description": "Authentic commercial SP tape playback: warm 90s tape color, gentle tape softness, mild luma grain, and subtle overscan line. Clean, nostalgic analog look without harsh glitches.",
    "filtergraph": "avgblur=sizeX=3:sizeY=1,noise=alls=15:allf=t,eq=contrast=1.06:saturation=1.20:brightness=0.02,curves=vintage,drawbox=y=ih-12:color=black@0.6:width=iw:height=12:t=fill",
    "intensity": 0.4,
    "scanlines": false,
    "trackingNoise": false,
    "chromaShift": false,
    "colorGrading": "subtle_warm"
  },
  {
    "id": "worn_tape",
    "name": "Worn Tape (LP Mode)",
    "description": "Aged family tape played hundreds of times: yellowed/aged tape color oxidation, soft magnetic flutter, visible tape noise, and lower-third head-switching drift.",
    "filtergraph": "colorchannelmixer=rr=1.05:rg=0.05:rb=-0.05:br=-0.1:bg=-0.05:bb=0.9,eq=contrast=1.12:saturation=0.90:brightness=-0.02,avgblur=sizeX=5:sizeY=1,drawbox=y=ih-28:color=black@0.80:width=iw:height=28:t=fill,drawbox=y=ih-32:color=white@0.4:width=iw:height=2:t=fill,noise=alls=30:allf=t+u",
    "intensity": 0.65,
    "scanlines": false,
    "trackingNoise": true,
    "chromaShift": false,
    "colorGrading": "aged_magnetic"
  },
  {
    "id": "tracking_errors",
    "name": "Tracking Errors",
    "description": "Severe VCR tracking misalignment: active horizontal static tearing bands slicing through the frame, thick head-switching glitches, sync tearing lines, and heavy static snow.",
    "filtergraph": "avgblur=sizeX=4:sizeY=1,drawbox=y=ih-48:color=black@0.92:width=iw:height=48:t=fill,drawbox=y=ih-54:color=white@0.80:width=iw:height=4:t=fill,drawbox=y=ih-34:color=white@0.50:width=iw:height=3:t=fill,drawbox=y=ih*0.65:color=black@0.65:width=iw:height=18:t=fill:enable=lt(mod(t\\,3)\\,0.8),drawbox=y=ih*0.65+18:color=white@0.7:width=iw:height=3:t=fill:enable=lt(mod(t\\,3)\\,0.8),noise=alls=50:allf=t+u,eq=contrast=1.25:saturation=1.15:brightness=-0.03",
    "intensity": 0.85,
    "scanlines": false,
    "trackingNoise": true,
    "chromaShift": false,
    "colorGrading": "tracking_misaligned"
  },
  {
    "id": "chroma_bleed",
    "name": "Chroma Bleed",
    "description": "Extreme RCA composite analog cable color misregistration: bold red/cyan halos bleeding out of objects, hyper-saturated bleeding colors, and composite noise. No dark bars.",
    "filtergraph": "chromashift=cbh=28:cbv=2:crh=-28:crv=-2,avgblur=sizeX=3:sizeY=1,eq=saturation=1.90:contrast=1.15:brightness=0.01,noise=alls=16:allf=t+u",
    "intensity": 0.75,
    "scanlines": false,
    "trackingNoise": false,
    "chromaShift": true,
    "colorGrading": "composite_bleed"
  },
  {
    "id": "camcorder_90s",
    "name": "Camcorder 90s",
    "description": "Handheld 1990s home video camcorder: warm tungsten incandescent indoor lighting, sharp CCD sensor edge sharpening, CRT interlace lines, and camera master vibrancy. No tracking bars.",
    "filtergraph": "curves=red='0/0 0.5/0.62 1/1':blue='0/0 0.5/0.38 1/0.88',chromashift=cbh=6:crh=-6,drawgrid=width=iw:height=4:thickness=1:color=black@0.25,unsharp=lx=5:ly=5:la=1.2:cx=3:cy=3:ca=0.8,eq=saturation=1.45:contrast=1.18:brightness=0.02,noise=alls=20:allf=t",
    "intensity": 0.6,
    "scanlines": true,
    "trackingNoise": false,
    "chromaShift": true,
    "colorGrading": "warm_camcorder"
  },
  {
    "id": "security_cam",
    "name": "Security Cam (CCTV)",
    "description": "Authentic CCTV surveillance footage: jerky 12 FPS surveillance cadence, high-contrast monochrome with eerie green phosphor monitor glow, convex security lens vignette, and CCD sensor noise.",
    "filtergraph": "hue=s=0,eq=contrast=1.85:brightness=-0.08,curves=all='0/0 0.5/0.44 1/0.95':green='0/0 0.5/0.60 1/1',drawgrid=width=iw:height=4:thickness=1:color=black@0.45,vignette=PI/2.6,noise=alls=42:allf=t+u,fps=12",
    "intensity": 0.95,
    "scanlines": true,
    "trackingNoise": false,
    "chromaShift": false,
    "colorGrading": "cctv_phosphor"
  },
  {
    "id": "heavy_degradation",
    "name": "Heavy Degradation",
    "description": "Total tape decay & analog generation loss (found footage horror): extreme horizontal blur smear, massive static snowstorm, severe tape tears, and degraded muddy luma.",
    "filtergraph": "avgblur=sizeX=10:sizeY=2,chromashift=cbh=24:cbv=3:crh=-24:crv=-3,drawbox=y=ih-52:color=black@0.92:width=iw:height=52:t=fill,drawbox=y=ih-58:color=white@0.70:width=iw:height=5:t=fill,noise=alls=65:allf=t+u,eq=contrast=1.35:saturation=0.65:brightness=-0.04",
    "intensity": 1.0,
    "scanlines": false,
    "trackingNoise": true,
    "chromaShift": true,
    "colorGrading": "total_decay"
  }
];
