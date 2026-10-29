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
    id: 'none',
    name: 'Off / None',
    description: 'No VHS effects. Direct clean render.',
    filtergraph: '',
    intensity: 0,
    scanlines: false,
    trackingNoise: false,
    chromaShift: false,
    colorGrading: 'natural',
  },
  {
    id: 'clean_vhs',
    name: 'Clean VHS (SP Mode)',
    description: 'Authentic 90s commercial SP tape with noticeable horizontal softening, vintage color warmth, and gentle tape noise.',
    filtergraph: 'avgblur=sizeX=3:sizeY=1,noise=alls=14:allf=t,eq=contrast=1.08:saturation=1.2:brightness=0.01,curves=vintage',
    intensity: 0.4,
    scanlines: false,
    trackingNoise: false,
    chromaShift: false,
    colorGrading: 'subtle_warm',
  },
  {
    id: 'worn_tape',
    name: 'Worn Tape (LP Mode)',
    description: 'Heavy LP mode magnetic tape wear with horizontal color bleed, bottom head-switching glitch bar, and magnetic noise.',
    filtergraph: 'avgblur=sizeX=5:sizeY=1,chromashift=cbh=12:crh=-12,drawbox=y=ih-28:color=black@0.7:width=iw:height=28:t=fill,noise=alls=28:allf=t+u,eq=contrast=1.18:saturation=1.3',
    intensity: 0.65,
    scanlines: false,
    trackingNoise: true,
    chromaShift: true,
    colorGrading: 'analog_worn',
  },
  {
    id: 'tracking_errors',
    name: 'Tracking Errors',
    description: 'Severe VHS tracking misalignment: heavy chroma split, large head-switching bar, white sync tears, and tape static.',
    filtergraph: 'chromashift=cbh=20:cbv=1:crh=-18:crv=-1,drawbox=y=ih-36:color=black@0.85:width=iw:height=36:t=fill,drawbox=y=ih-40:color=white@0.6:width=iw:height=3:t=fill,noise=alls=42:allf=t+u,eq=contrast=1.22:saturation=1.15',
    intensity: 0.8,
    scanlines: false,
    trackingNoise: true,
    chroma_shift: true,
    colorGrading: 'harsh_analog',
  },
  {
    id: 'chroma_bleed',
    name: 'Chroma Bleed',
    description: 'Heavy composite RCA analog cable bleeding: bold red/cyan color halos and saturated color bleed.',
    filtergraph: 'chromashift=cbh=24:cbv=2:crh=-24:crv=-2,noise=alls=18:allf=t+u,eq=saturation=1.65:contrast=1.12',
    intensity: 0.75,
    scanlines: false,
    trackingNoise: false,
    chromaShift: true,
    colorGrading: 'saturated_bleed',
  },
  {
    id: 'camcorder_90s',
    name: 'Camcorder 90s',
    description: 'Nostalgic 1990s handheld camcorder: warm incandescent color balance, vivid saturation, and tape grain.',
    filtergraph: 'curves=red=\'0/0 0.5/0.58 1/1\':blue=\'0/0 0.5/0.40 1/0.9\',eq=saturation=1.4:contrast=1.15:brightness=0.03,noise=alls=16:allf=t',
    intensity: 0.6,
    scanlines: false,
    trackingNoise: false,
    chromaShift: false,
    colorGrading: 'vibrant_90s',
  },
  {
    id: 'security_cam',
    name: 'Security Cam (CCTV)',
    description: 'Authentic CCTV surveillance footage: high-contrast monochrome with subtle phosphor green tint, CRT scanlines, 12fps surveillance stutter, fisheye lens vignette, and chunky sensor noise.',
    filtergraph: 'hue=s=0,eq=contrast=1.65:brightness=-0.05,curves=all=\'0/0 0.5/0.46 1/0.95\':green=\'0/0 0.5/0.54 1/1\',drawgrid=width=iw:height=4:thickness=1:color=black@0.40,vignette=PI/3.2,noise=alls=35:allf=t+u,fps=12',
    intensity: 0.95,
    scanlines: true,
    trackingNoise: true,
    chromaShift: false,
    colorGrading: 'monochrome_cctv',
  },
  {
    id: 'heavy_degradation',
    name: 'Heavy Degradation',
    description: 'Total tape decay & analog generation loss: extreme horizontal blur, intense chroma displacement, bottom tracking tear, and heavy static snow.',
    filtergraph: 'avgblur=sizeX=7:sizeY=2,chromashift=cbh=26:cbv=2:crh=-24:crv=-2,drawbox=y=ih-44:color=black@0.85:width=iw:height=44:t=fill,noise=alls=55:allf=t+u,eq=contrast=1.3:saturation=0.75:brightness=-0.03',
    intensity: 1.0,
    scanlines: false,
    trackingNoise: true,
    chromaShift: true,
    colorGrading: 'decayed',
  },
];
