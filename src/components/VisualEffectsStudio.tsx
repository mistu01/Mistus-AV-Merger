/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, 
  Moon, 
  Tv, 
  Activity, 
  Image as ImageIcon, 
  Sliders, 
  Play, 
  RotateCcw, 
  Download, 
  Code2 
} from 'lucide-react';
import { RenderOptions } from '../utils/engine';
import { VHS_PRESETS, VHSPreset } from '../data/presets';

interface VisualEffectsStudioProps {
  renderOptions: RenderOptions;
  setRenderOptions: React.Dispatch<React.SetStateAction<RenderOptions>>;
}

export const VisualEffectsStudio: React.FC<VisualEffectsStudioProps> = ({
  renderOptions,
  setRenderOptions,
}) => {
  const [selectedPresetId, setSelectedPresetId] = useState<string>(renderOptions.vhsPreset || 'clean_vhs');
  const [nightMode, setNightMode] = useState<boolean>(!!renderOptions.nightModeEnabled);
  const [nightIntensity, setNightIntensity] = useState<number>(renderOptions.nightIntensity ?? 0.7);
  const [noiseGrain, setNoiseGrain] = useState<number>(20);
  const [staticBursts, setStaticBursts] = useState<boolean>(!!renderOptions.noiseStaticEnabled);
  const [noiseSeed, setNoiseSeed] = useState<number>(renderOptions.noiseSeed ?? 1994);

  // Overlay settings
  const [overlayEnabled, setOverlayEnabled] = useState<boolean>(!!renderOptions.overlayEnabled);
  const [overlayOpacity, setOverlayOpacity] = useState<number>(renderOptions.overlayOpacity ?? 0.8);
  const [overlayBlend, setOverlayBlend] = useState<'screen' | 'overlay' | 'multiply'>('screen');

  // Canvas ref for real-time visual simulation
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const activePreset = VHS_PRESETS.find(p => p.id === selectedPresetId) || VHS_PRESETS[1];

  // Sync back to renderOptions
  useEffect(() => {
    setRenderOptions(prev => ({
      ...prev,
      vhsPreset: selectedPresetId,
      nightModeEnabled: nightMode,
      nightIntensity,
      noiseStaticEnabled: staticBursts,
      noiseSeed,
      overlayEnabled,
      overlayOpacity,
    }));
  }, [selectedPresetId, nightMode, nightIntensity, staticBursts, noiseSeed, overlayEnabled, overlayOpacity]);

  // Real-time canvas simulation animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let frame = 0;

    const render = () => {
      frame++;
      const w = canvas.width;
      const h = canvas.height;

      // 1. Base Synthwave / Cityscape Background
      ctx.fillStyle = '#0a0a14';
      ctx.fillRect(0, 0, w, h);

      // Draw gradient sunset / sky
      const grad = ctx.createLinearGradient(0, 0, 0, h * 0.7);
      if (nightMode) {
        grad.addColorStop(0, '#020617');
        grad.addColorStop(0.5, '#0f172a');
        grad.addColorStop(1, '#1e1b4b');
      } else {
        grad.addColorStop(0, '#18022b');
        grad.addColorStop(0.5, '#4c0519');
        grad.addColorStop(1, '#9a3412');
      }
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h * 0.7);

      // Draw neon retro sun
      const sunY = h * 0.45;
      const sunGrad = ctx.createRadialGradient(w / 2, sunY, 10, w / 2, sunY, 70);
      sunGrad.addColorStop(0, nightMode ? '#38bdf8' : '#fde047');
      sunGrad.addColorStop(1, nightMode ? '#1e3a8a' : '#e11d48');
      ctx.fillStyle = sunGrad;
      ctx.beginPath();
      ctx.arc(w / 2, sunY, 60, 0, Math.PI * 2);
      ctx.fill();

      // Sun horizontal blinds cut lines
      ctx.fillStyle = '#0a0a14';
      for (let i = 0; i < 7; i++) {
        const lineY = sunY - 10 + i * 11;
        const lineH = 1 + i * 1.5;
        ctx.fillRect(w / 2 - 60, lineY, 120, lineH);
      }

      // Draw 3D wireframe perspective grid at bottom
      const gridTop = h * 0.7;
      ctx.strokeStyle = nightMode ? '#0284c7' : '#ec4899';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let x = -w * 0.5; x <= w * 1.5; x += 35) {
        ctx.moveTo(w / 2, gridTop - 20);
        ctx.lineTo(x + (frame % 30), h);
      }
      for (let y = gridTop; y < h; y += 14 + (y - gridTop) * 0.3) {
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
      }
      ctx.stroke();

      // 2. Chromatic aberration / Color Shift (VHS)
      if (activePreset.chromaShift) {
        const shiftX = Math.sin(frame * 0.1) * 3;
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.fillStyle = 'rgba(255, 0, 50, 0.15)';
        ctx.fillRect(shiftX, 0, w, h);
        ctx.fillStyle = 'rgba(0, 200, 255, 0.15)';
        ctx.fillRect(-shiftX, 0, w, h);
        ctx.restore();
      }

      // 3. Scanlines
      if (activePreset.scanlines) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        for (let y = 0; y < h; y += 3) {
          ctx.fillRect(0, y, w, 1);
        }
      }

      // 4. Tracking noise band (bottom head-switching glitch)
      if (activePreset.trackingNoise || (staticBursts && frame % 45 < 6)) {
        const bandY = h - 24 + Math.sin(frame * 0.2) * 4;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.fillRect(0, bandY, w, 16);
        // Add random snow inside band
        const imgData = ctx.getImageData(0, Math.floor(bandY), w, 16);
        for (let i = 0; i < imgData.data.length; i += 4) {
          if (Math.random() > 0.4) {
            const val = Math.random() * 255;
            imgData.data[i] = val;
            imgData.data[i + 1] = val;
            imgData.data[i + 2] = val;
          }
        }
        ctx.putImageData(imgData, 0, Math.floor(bandY));
      }

      // 5. Film grain / static noise
      if (noiseGrain > 0) {
        const noiseCount = Math.floor(w * h * (noiseGrain / 1000));
        ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
        for (let i = 0; i < noiseCount; i++) {
          const nx = Math.random() * w;
          const ny = Math.random() * h;
          ctx.fillRect(nx, ny, 1, 1);
        }
      }

      // 6. Night mode tint & vignette
      if (nightMode) {
        ctx.save();
        ctx.globalCompositeOperation = 'color-burn';
        ctx.fillStyle = `rgba(15, 23, 42, ${nightIntensity * 0.6})`;
        ctx.fillRect(0, 0, w, h);
        ctx.restore();

        // Cool blue wash
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.fillStyle = `rgba(30, 58, 138, ${nightIntensity * 0.25})`;
        ctx.fillRect(0, 0, w, h);
        ctx.restore();

        // Edge vignette
        const vigGrad = ctx.createRadialGradient(w / 2, h / 2, w * 0.35, w / 2, h / 2, w * 0.6);
        vigGrad.addColorStop(0, 'rgba(0,0,0,0)');
        vigGrad.addColorStop(1, `rgba(0,0,0,${nightIntensity * 0.85})`);
        ctx.fillStyle = vigGrad;
        ctx.fillRect(0, 0, w, h);
      }

      // 7. Graphic Overlay (Watermark / OSD)
      if (overlayEnabled) {
        ctx.save();
        ctx.globalAlpha = overlayOpacity;
        ctx.font = 'bold 12px monospace';
        ctx.fillStyle = '#fde047';
        ctx.fillText('PLAY \u25BA 00:01:24:18', 20, 32);
        ctx.fillText('SP 1994-OCT-23', 20, 50);
        ctx.restore();
      }

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [nightMode, nightIntensity, activePreset, noiseGrain, staticBursts, overlayEnabled, overlayOpacity]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Intro Header */}
      <div className="nb-card p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="nb-stripe h-2 w-24 mb-2" />
          <h3 className="nb-title text-xl">Visual FX &amp; VHS Studio</h3>
          <p className="nb-sub font-semibold mt-1">
            Built entirely with FFmpeg filters (noise, chromashift, gblur, curves, vignette, scanlines).
          </p>
        </div>

        <button
          onClick={() => {
            setSelectedPresetId('none');
            setNightMode(false);
            setStaticBursts(false);
            setOverlayEnabled(false);
          }}
          className="nb-btn nb-btn-pink nb-press"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Reset All
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Live Canvas Monitor */}
        <div className="lg:col-span-6 space-y-4">
          <div className="nb-card p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="nb-label flex items-center gap-1.5">
                <Tv className="w-4 h-4" /> Simulated Output
              </span>
              <span className="nb-badge nb-badge-lime">Canvas 60fps</span>
            </div>

            <div className="border-[3px] border-black bg-black flex items-center justify-center overflow-hidden">
              <canvas
                ref={canvasRef}
                width={560}
                height={315}
                className="w-full h-full object-cover"
              />
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-mono font-bold">
              <span className="nb-badge nb-badge-yellow">Preset: {activePreset.name}</span>
              <span className={`nb-badge ${nightMode ? 'nb-badge-cyan' : ''}`}>Night: {nightMode ? 'ON' : 'OFF'}</span>
              <span className="nb-badge">Seed: #{noiseSeed}</span>
            </div>
          </div>

          {/* Filtergraph Inspector */}
          <div className="nb-card p-5 space-y-2">
            <div className="nb-label flex items-center gap-2">
              <Code2 className="w-4 h-4" /> Compiled FFmpeg -vf Filtergraph
            </div>
            <div className="bg-[#111] text-yellow-300 border-[3px] border-black p-3 font-mono text-[11px] break-all select-all">
              {activePreset.filtergraph || 'No filter (stream copy candidate)'}
              {nightMode && ',eq=contrast=1.1:brightness=-0.08,curves=all=\'0/0 0.5/0.4 1/0.95\':blue=\'0/0 0.5/0.58 1/1\',vignette=PI/4'}
              {staticBursts && `,noise=alls=15:allf=t+u:seed=${noiseSeed}`}
            </div>
          </div>
        </div>

        {/* Right: Controls */}
        <div className="lg:col-span-6 space-y-6">
          {/* Presets */}
          <div className="nb-card p-6 space-y-4">
            <h4 className="nb-title text-sm flex items-center gap-2">
              <Tv className="w-4 h-4" /> VHS Style Presets
            </h4>

            <div className="grid grid-cols-2 gap-2">
              {VHS_PRESETS.map(preset => (
                <button
                  key={preset.id}
                  onClick={() => setSelectedPresetId(preset.id)}
                  className={`border-[3px] border-black p-3 text-left nb-press ${
                    selectedPresetId === preset.id ? 'bg-yellow-300' : 'bg-white hover:bg-lime-100'
                  }`}
                >
                  <div className="text-xs font-black">{preset.name}</div>
                  <div className="text-[10px] font-semibold text-black/60 mt-1 line-clamp-2">{preset.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Night Mode */}
          <div className="nb-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="nb-title text-sm flex items-center gap-2">
                <Moon className="w-4 h-4" /> Night Mode
              </h4>
              <input
                type="checkbox"
                className="nb-check"
                checked={nightMode}
                onChange={e => setNightMode(e.target.checked)}
                aria-label="Night mode"
              />
            </div>

            {nightMode && (
              <div className="space-y-1.5 pt-2">
                <div className="flex justify-between text-xs font-bold">
                  <span>Intensity</span>
                  <span className="font-mono border-2 border-black bg-cyan-300 px-1">{Math.round(nightIntensity * 100)}%</span>
                </div>
                <input
                  type="range" min="0.1" max="1.0" step="0.05" value={nightIntensity}
                  onChange={e => setNightIntensity(parseFloat(e.target.value))}
                  className="nb-range w-full"
                />
              </div>
            )}
          </div>

          {/* Noise & Static */}
          <div className="nb-card p-6 space-y-4">
            <h4 className="nb-title text-sm flex items-center gap-2">
              <Activity className="w-4 h-4" /> Noise &amp; Static
            </h4>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-bold">
                  <span>Film Grain</span>
                  <span className="font-mono border-2 border-black bg-yellow-300 px-1">{noiseGrain}%</span>
                </div>
                <input
                  type="range" min="0" max="60" value={noiseGrain}
                  onChange={e => setNoiseGrain(parseInt(e.target.value, 10))}
                  className="nb-range w-full"
                />
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold">
                  <input type="checkbox" className="nb-check" checked={staticBursts}
                    onChange={e => setStaticBursts(e.target.checked)} />
                  <span>Static snow bursts</span>
                </label>

                <div className="flex items-center gap-2">
                  <span className="nb-label">Seed</span>
                  <input
                    type="number" value={noiseSeed}
                    onChange={e => setNoiseSeed(parseInt(e.target.value, 10) || 0)}
                    className="nb-input w-20 font-mono"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* OSD Overlay */}
          <div className="nb-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="nb-title text-sm flex items-center gap-2">
                <ImageIcon className="w-4 h-4" /> VCR On-Screen Display
              </h4>
              <input
                type="checkbox" className="nb-check" checked={overlayEnabled}
                onChange={e => setOverlayEnabled(e.target.checked)}
                aria-label="Overlay"
              />
            </div>

            {overlayEnabled && (
              <div className="space-y-1.5 pt-2">
                <div className="flex justify-between text-xs font-bold">
                  <span>Opacity</span>
                  <span className="font-mono border-2 border-black bg-pink-300 px-1">{Math.round(overlayOpacity * 100)}%</span>
                </div>
                <input
                  type="range" min="0.1" max="1.0" step="0.05" value={overlayOpacity}
                  onChange={e => setOverlayOpacity(parseFloat(e.target.value))}
                  className="nb-range w-full"
                />
                <p className="nb-sub font-semibold">Simulates a 1990s VCR timestamp overlay.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
