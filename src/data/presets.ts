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
    description: 'Subtle 90s commercial tape softness, mild luma noise, calibrated gamma.',
    filtergraph: 'avgblur=sizeX=2:sizeY=2,noise=alls=8:allf=t,curves=vintage',
    intensity: 0.35,
    scanlines: true,
    trackingNoise: false,
    chromaShift: false,
    colorGrading: 'subtle_warm',
  },
  {
    id: 'worn_tape',
    name: 'Worn Tape (LP Mode)',
    description: 'Noticeable magnetic tape wear, horizontal jitter, slight chromashift.',
    filtergraph: 'avgblur=sizeX=3:sizeY=2,chromashift=cbh=2:crh=-2,noise=alls=16:allf=t+u,eq=contrast=1.05:saturation=1.15',
    intensity: 0.6,
    scanlines: true,
    trackingNoise: true,
    chromaShift: true,
    colorGrading: 'analog_worn',
  },
  {
    id: 'tracking_errors',
    name: 'Tracking Errors',
    description: 'Bottom head-switching noise band, horizontal tear glitches, phase misregistration.',
    filtergraph: 'chromashift=cbh=4:crh=-3,noise=alls=24:allf=t+u,drawbox=y=ih-28:color=black@0.4:width=iw:height=28:t=fill',
    intensity: 0.75,
    scanlines: true,
    trackingNoise: true,
    chromaShift: true,
    colorGrading: 'harsh_analog',
  },
  {
    id: 'chroma_bleed',
    name: 'Chroma Bleed',
    description: 'Color misregistration, heavy red/cyan bleed characteristic of composite RCA cables.',
    filtergraph: 'split[v1][v2];[v1]chromashift=cbh=6:cbv=1:crh=-6:crv=-1[c];[v2][c]blend=all_mode=addition:all_opacity=0.85',
    intensity: 0.8,
    scanlines: true,
    trackingNoise: false,
    chromaShift: true,
    colorGrading: 'saturated_bleed',
  },
  {
    id: 'camcorder_90s',
    name: 'Camcorder 90s',
    description: 'High saturation, warm white-balance, sharp interlace lines, nostalgic vibe.',
    filtergraph: 'eq=saturation=1.35:contrast=1.1:brightness=0.03,hue=s=1.2:h=3,noise=alls=12:allf=t',
    intensity: 0.65,
    scanlines: true,
    trackingNoise: false,
    chromaShift: false,
    colorGrading: 'vibrant_90s',
  },
  {
    id: 'security_cam',
    name: 'Security Cam (CCTV)',
    description: 'Monochrome high-contrast surveillance look with scanline interference.',
    filtergraph: 'hue=s=0,eq=contrast=1.45:brightness=-0.05,noise=alls=30:allf=t,fps=15',
    intensity: 0.9,
    scanlines: true,
    trackingNoise: true,
    chromaShift: false,
    colorGrading: 'monochrome_cctv',
  },
  {
    id: 'heavy_degradation',
    name: 'Heavy Degradation',
    description: 'Severe analog generation loss, static snow bursts, tracking tears, magnetic decay.',
    filtergraph: 'avgblur=sizeX=4:sizeY=2,chromashift=cbh=8:crh=-8,noise=alls=45:allf=t+u,eq=contrast=1.2:saturation=0.8',
    intensity: 1.0,
    scanlines: true,
    trackingNoise: true,
    chromaShift: true,
    colorGrading: 'decayed',
  },
];
