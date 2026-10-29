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
  RotateCcw, 
  Code2,
  Zap,
  CheckCircle2,
  AlertTriangle,
  X,
  Layers,
  ArrowRight
} from 'lucide-react';
import { RenderOptions } from '../utils/engine';
import { VHS_PRESETS } from '../data/presets';
import type { HardwareSummary } from '../App';

interface VisualEffectsStudioProps {
  renderOptions: RenderOptions;
  setRenderOptions: React.Dispatch<React.SetStateAction<RenderOptions>>;
  overlayImageFolder?: string;
  onClearSingleOverlay?: () => void;
  onClearOverlayFolder?: () => void;
  onOpenBrowser?: (target: 'single_image' | 'bulk_images') => void;
  onNavigateToTab?: (tab: 'single' | 'bulk' | 'queue') => void;
  selectedEncoder?: string;
  onSelectedEncoderChange?: (encoder: string) => void;
  hwSummary?: HardwareSummary | null;
}

export const VisualEffectsStudio: React.FC<VisualEffectsStudioProps> = ({
  renderOptions,
  setRenderOptions,
  overlayImageFolder = '',
  onClearSingleOverlay,
  onClearOverlayFolder,
  onOpenBrowser,
  onNavigateToTab,
  selectedEncoder = 'auto',
  onSelectedEncoderChange,
  hwSummary,
}) => {
  // Direct options bindings
  const vhsPreset = renderOptions.vhsPreset || 'none';
  const nightMode = !!renderOptions.nightModeEnabled;
  const nightIntensity = renderOptions.nightIntensity ?? 0.7;
  const staticBursts = !!renderOptions.noiseStaticEnabled;
  const noiseSeed = renderOptions.noiseSeed ?? 1994;
  const overlayEnabled = !!renderOptions.overlayEnabled;
  const overlayOpacity = renderOptions.overlayOpacity ?? 0.8;
  const overlayTimeout = renderOptions.overlayTimeout ?? 'full';
  const overlayAnimation = renderOptions.overlayAnimation || 'static';

  // Local grain slider for canvas visual feedback
  const [noiseGrain, setNoiseGrain] = useState<number>(20);

  // Canvas ref for real-time visual simulation
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const activePreset = VHS_PRESETS.find(p => p.id === vhsPreset) || VHS_PRESETS[0];

  const singleOverlayName = renderOptions.overlayPath
    ? renderOptions.overlayPath.split(/[/\\]/).pop() || renderOptions.overlayPath
    : '';
  const effectiveBulkFolder = renderOptions.overlayFolder || overlayImageFolder;
  const bulkOverlayFolderName = effectiveBulkFolder
    ? effectiveBulkFolder.split(/[/\\]/).pop() || effectiveBulkFolder
    : '';

  // Has effects flag
  const hasEffects = Boolean(
    (vhsPreset && vhsPreset !== 'none' && vhsPreset !== 'off') ||
    nightMode ||
    staticBursts ||
    (overlayEnabled && (renderOptions.overlayPath || overlayImageFolder || renderOptions.overlayFolder))
  );

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

      // Draw gradient sunset / sky (natural synthwave colors, independent of night mode)
      const grad = ctx.createLinearGradient(0, 0, 0, h * 0.7);
      grad.addColorStop(0, '#18022b');
      grad.addColorStop(0.5, '#4c0519');
      grad.addColorStop(1, '#9a3412');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h * 0.7);

      // Draw neon retro sun
      const sunY = h * 0.45;
      const sunGrad = ctx.createRadialGradient(w / 2, sunY, 10, w / 2, sunY, 70);
      sunGrad.addColorStop(0, '#fde047');
      sunGrad.addColorStop(1, '#e11d48');
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
      ctx.strokeStyle = '#ec4899';
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
        const shiftX = Math.sin(frame * 0.12) * (activePreset.id === 'heavy_degradation' ? 5 : 3.5);
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.fillStyle = 'rgba(255, 0, 50, 0.22)';
        ctx.fillRect(shiftX, 0, w, h);
        ctx.fillStyle = 'rgba(0, 220, 255, 0.22)';
        ctx.fillRect(-shiftX, 0, w, h);
        ctx.restore();
      }

      // 3. Scanlines (CRT raster)
      if (activePreset.scanlines) {
        ctx.fillStyle = activePreset.id === 'security_cam' ? 'rgba(0, 0, 0, 0.40)' : 'rgba(0, 0, 0, 0.28)';
        for (let y = 0; y < h; y += 3) {
          ctx.fillRect(0, y, w, 1);
        }
      }

      // 4. Tracking noise band & static burst (bottom head-switching glitch + periodic static bursts)
      const isBurst = staticBursts && (frame % 60 < 8);
      if (activePreset.trackingNoise || isBurst) {
        const bandH = isBurst ? 32 : 22;
        const bandY = h - bandH - 4 + Math.sin(frame * 0.25) * 4;
        ctx.fillStyle = isBurst ? 'rgba(255, 255, 255, 0.55)' : 'rgba(255, 255, 255, 0.30)';
        ctx.fillRect(0, bandY, w, bandH);
        // Add random snow inside band
        const imgData = ctx.getImageData(0, Math.max(0, Math.floor(bandY)), w, Math.min(bandH, h - Math.floor(bandY)));
        for (let i = 0; i < imgData.data.length; i += 4) {
          if (Math.random() > 0.3) {
            const val = Math.random() * 255;
            imgData.data[i] = val;
            imgData.data[i + 1] = val;
            imgData.data[i + 2] = val;
          }
        }
        ctx.putImageData(imgData, 0, Math.max(0, Math.floor(bandY)));

        // White sync jitter tear lines
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.fillRect(0, bandY - 3, w, 2);
        if (isBurst) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.60)';
          ctx.fillRect(0, bandY - 8, w, 1);
        }
      }

      // 4b. Security Cam (CCTV) phosphor green monitor and surveillance OSD
      if (activePreset.id === 'security_cam') {
        ctx.save();
        ctx.globalCompositeOperation = 'color';
        ctx.fillStyle = 'rgba(60, 150, 75, 0.85)';
        ctx.fillRect(0, 0, w, h);
        ctx.restore();

        // Surveillance vignette
        const cctvVig = ctx.createRadialGradient(w / 2, h / 2, w * 0.20, w / 2, h / 2, w * 0.60);
        cctvVig.addColorStop(0, 'rgba(0,0,0,0)');
        cctvVig.addColorStop(1, 'rgba(0,0,0,0.65)');
        ctx.fillStyle = cctvVig;
        ctx.fillRect(0, 0, w, h);

        // CCTV OSD (Rec indicator, camera label, timestamp)
        ctx.font = 'bold 10px monospace';
        ctx.fillStyle = (frame % 30 < 15) ? '#ef4444' : '#7f1d1d';
        ctx.beginPath();
        ctx.arc(14, 16, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#4ade80';
        ctx.fillText('REC  CAM-04 [SECURITY SECTOR B]', 24, 20);
        ctx.fillText('12 FPS CCTV', w - 90, 20);
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

      // 6. Night mode darkening - purely dims footage into darkness (no blue tint, no noise)
      if (nightMode) {
        ctx.save();
        ctx.fillStyle = `rgba(0, 0, 0, ${Math.min(0.92, 0.15 + nightIntensity * 0.75)})`;
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
      }

      // 7. Graphic Overlay (Watermark / OSD / Bouncing VCD Logo)
      if (overlayEnabled) {
        ctx.save();
        ctx.globalAlpha = overlayOpacity;

        if (overlayAnimation === 'bounce') {
          // Bouncing VCD / DVD screensaver diagonal motion (40% width)
          const logoW = Math.max(140, Math.floor(w * 0.40));
          const logoH = Math.max(70, Math.floor(h * 0.35));
          const boundX = w - logoW;
          const boundY = h - logoH;
          const posX = boundX > 0 ? (boundX - Math.abs(((frame * 2.8) % (2 * boundX)) - boundX)) : 0;
          const posY = boundY > 0 ? (boundY - Math.abs(((frame * 2.1) % (2 * boundY)) - boundY)) : 0;

          // Draw retro bouncing VCD badge
          ctx.fillStyle = '#0f172a';
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          if (typeof ctx.roundRect === 'function') {
            ctx.roundRect(posX, posY, logoW, logoH, 6);
          } else {
            ctx.rect(posX, posY, logoW, logoH);
          }
          ctx.fill();
          ctx.stroke();

          // Logo badge text
          ctx.font = 'bold 11px monospace';
          ctx.fillStyle = '#fde047';
          const text = singleOverlayName
            ? (singleOverlayName.length > 11 ? singleOverlayName.slice(0, 10) + '…' : singleOverlayName)
            : bulkOverlayFolderName
            ? `[${bulkOverlayFolderName.slice(0, 8)}]`
            : 'VCD VIDEO';
          ctx.fillText(text, posX + 8, posY + 20);
          ctx.font = 'bold 9px sans-serif';
          ctx.fillStyle = '#38bdf8';
          ctx.fillText('BOUNCING LOGO', posX + 8, posY + 36);
        } else {
          // Static full-frame border and watermark
          ctx.strokeStyle = '#fde047';
          ctx.lineWidth = 2;
          ctx.strokeRect(10, 10, w - 20, h - 20);
          ctx.font = 'bold 12px monospace';
          ctx.fillStyle = '#fde047';
          const label = singleOverlayName
            ? `OVERLAY: ${singleOverlayName}`
            : bulkOverlayFolderName
            ? `OVERLAY: [${bulkOverlayFolderName}]`
            : 'PLAY \u25BA 00:01:24:18';
          ctx.fillText(label, 20, 32);
          if (overlayTimeout !== 'full') {
            ctx.fillText(`DURATION: ${overlayTimeout}s`, 20, 50);
          }
        }
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
  }, [nightMode, nightIntensity, activePreset, noiseGrain, staticBursts, overlayEnabled, overlayOpacity, overlayTimeout, overlayAnimation, singleOverlayName, bulkOverlayFolderName]);

  const handleResetAll = () => {
    setRenderOptions({
      resolution: 'original',
      sizeTarget: 'unlimited',
      vhsPreset: 'none',
      nightModeEnabled: false,
      nightIntensity: 0.7,
      noiseStaticEnabled: false,
      noiseSeed: 1994,
      overlayEnabled: false,
      overlayOpacity: 0.8,
      overlayTimeout: 'full',
      overlayAnimation: 'static',
      overlayPath: undefined,
      overlayFolder: undefined,
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-nb-fade">
      {/* Intro Header */}
      <div className="nb-card p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="nb-stripe h-2 w-28 mb-2" />
          <h3 className="nb-title text-2xl flex items-center gap-2">
            <Sliders className="w-6 h-6 text-black" />
            Render Options &amp; Visual FX Studio
          </h3>
          <p className="nb-sub font-semibold mt-1">
            Centralized settings for both Single and Bulk rendering. Configure effects, scaling, quality targets, and image overlays.
          </p>
        </div>

        <button
          onClick={handleResetAll}
          className="nb-btn nb-btn-pink nb-press shrink-0"
          title="Reset all effects and options to standard stream copy defaults"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Reset All to Defaults
        </button>
      </div>

      {/* Mode Status Banner: Warn if no effects or confirm active effects */}
      {hasEffects ? (
        <div className="border-[3px] border-black bg-lime-200 p-5 shadow-[4px_4px_0_#000] space-y-3">
          <div className="flex items-center gap-3">
            <Sparkles className="w-6 h-6 text-black shrink-0" />
            <div>
              <h4 className="text-sm font-black uppercase tracking-wider text-black">
                ✨ Visual Effects Active &mdash; Re-Encode Mode Required
              </h4>
              <p className="text-xs font-bold text-black/80 mt-0.5">
                Renders will re-encode using your CPU profile with hardware/software acceleration to apply the filters below.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t-[2px] border-black/20 text-[11px] font-mono font-bold">
            <span className="nb-badge nb-badge-lime font-mono">Encoder: {selectedEncoder.toUpperCase()}</span>
            {vhsPreset && vhsPreset !== 'none' && vhsPreset !== 'off' && (
              <span className="nb-badge nb-badge-cyan">VHS: {activePreset.name}</span>
            )}
            {nightMode && (
              <span className="nb-badge nb-badge-yellow">Night FX ({Math.round(nightIntensity * 100)}%)</span>
            )}
            {staticBursts && (
              <span className="nb-badge">Noise &amp; Static</span>
            )}
            {overlayEnabled && (
              <span className="nb-badge nb-badge-pink">
                Overlay ({overlayAnimation === 'bounce' ? 'Bouncing Logo' : 'Full Frame'}, {singleOverlayName ? 'Single' : bulkOverlayFolderName ? 'Bulk' : 'Active'}, {Math.round(overlayOpacity * 100)}%, {overlayTimeout === 'full' ? 'Fulltime' : `${overlayTimeout}s`})
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className="border-[3px] border-black bg-amber-200 p-5 shadow-[4px_4px_0_#000] space-y-2">
          <div className="flex items-start sm:items-center gap-3">
            <Zap className="w-6 h-6 text-black shrink-0" />
            <div className="flex-1">
              <h4 className="text-sm font-black uppercase tracking-wider text-black">
                ⚡ Fast Stream Copy Mode (Lossless, Instant ~300-700x)
              </h4>
              <p className="text-xs font-semibold text-black/80 mt-0.5">
                No visual effects or image overlays are active. Video packets will remux directly without re-encoding, preserving 100% original quality and finishing in seconds.
              </p>
              <p className="text-[11px] font-bold text-black/70 mt-1">
                👉 To apply VHS tape looks, night mode, film grain, or image overlays, enable any option below.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main Grid: Left Monitor + Right Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Live Canvas Monitor & Filtergraph Preview */}
        <div className="lg:col-span-5 space-y-6">
          <div className="nb-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="nb-label flex items-center gap-1.5">
                <Tv className="w-4 h-4" /> Realtime Filter Simulation
              </span>
              <span className="nb-badge nb-badge-lime font-mono text-[10px]">60 FPS</span>
            </div>

            <div className="border-[3px] border-black bg-black flex items-center justify-center overflow-hidden aspect-video">
              <canvas
                ref={canvasRef}
                width={560}
                height={315}
                className="w-full h-full object-cover"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono font-bold">
              <span className="nb-badge nb-badge-yellow">Preset: {activePreset.name}</span>
              <span className={`nb-badge ${nightMode ? 'nb-badge-cyan' : ''}`}>Night: {nightMode ? 'ON' : 'OFF'}</span>
              <span className="nb-badge nb-badge-lime font-mono">Encoder: {selectedEncoder.toUpperCase()}</span>
              <span className="nb-badge">Seed: #{noiseSeed}</span>
            </div>
          </div>

          {/* Compiled Filtergraph Inspector */}
          <div className="nb-card p-5 space-y-2">
            <div className="nb-label flex items-center gap-2">
              <Code2 className="w-4 h-4" /> Compiled FFmpeg -vf Filtergraph
            </div>
            <div className="bg-[#111] text-yellow-300 border-[3px] border-black p-3 font-mono text-[11px] break-all select-all">
              {activePreset.filtergraph || (!hasEffects ? 'No filter — stream copy enabled (-c:v copy)' : '')}
              {nightMode && `${activePreset.filtergraph ? ',' : ''}eq=brightness=${(-0.05 - 0.45 * nightIntensity).toFixed(2)}:gamma=${(1.0 - 0.65 * nightIntensity).toFixed(2)}`}
              {staticBursts && `${(activePreset.filtergraph || nightMode) ? ',' : ''}noise=alls=65:allf=t+u:all_seed=${noiseSeed}:enable=\'lt(mod(t,4.5),0.35)\',drawbox=y=ih-42:color=white@0.70:width=iw:height=4:t=fill:enable=\'lt(mod(t,4.5),0.35)\'`}
              {overlayEnabled && (overlayAnimation === 'bounce'
                ? `${(activePreset.filtergraph || nightMode || staticBursts) ? ',' : ''}[1:v]scale=rw*0.40:-1[ov];[0:v][ov]overlay=x='(W-w)-abs(mod(0.15*W*t,2*(W-w))-(W-w))':y='(H-h)-abs(mod(0.11*H*t,2*(H-h))-(H-h))'${overlayTimeout !== 'full' ? `:enable='lte(t,${overlayTimeout})'` : ''}`
                : `${(activePreset.filtergraph || nightMode || staticBursts) ? ',' : ''}[1:v]scale=iw:ih[ov];[0:v][ov]overlay=0:0${overlayTimeout !== 'full' ? `:enable='lte(t,${overlayTimeout})'` : ''}`)}
            </div>
          </div>

          {/* Navigation Shortcuts */}
          {onNavigateToTab && (
            <div className="nb-card p-4 space-y-2">
              <span className="nb-label">Ready to render?</span>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  onClick={() => onNavigateToTab('single')}
                  className="nb-btn nb-btn-white nb-press text-xs justify-center"
                >
                  Single Render <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </button>
                <button
                  onClick={() => onNavigateToTab('bulk')}
                  className="nb-btn nb-btn-yellow nb-press text-xs justify-center"
                >
                  Bulk Scan &amp; Render <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: All Settings Controls */}
        <div className="lg:col-span-7 space-y-6">
          {/* 1. Video Codec & Encoder Engine */}
          <div className="nb-card p-6 space-y-4">
            <h4 className="nb-title text-sm flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Sliders className="w-4 h-4" /> Video Codec / Encoder
              </span>
              <span className="nb-badge nb-badge-lime font-mono text-[10px]">
                {selectedEncoder === 'auto' ? `AUTO (${hwSummary?.recommended || 'GPU'})` : selectedEncoder.toUpperCase()}
              </span>
            </h4>

            <div className="space-y-2">
              <label className="nb-label">Encoder Engine (Hardware GPU or Scene-Standard CPU)</label>
              <select
                value={selectedEncoder}
                onChange={e => {
                  if (onSelectedEncoderChange) onSelectedEncoderChange(e.target.value);
                }}
                className="nb-select w-full font-bold text-xs"
              >
                <option value="auto">
                  Auto-Select: {hwSummary?.recommended ? `${hwSummary.recommended} (${hwSummary.gpu_brand})` : 'Fastest Hardware GPU'}
                </option>
                <optgroup label="Hardware GPU Encoders">
                  {hwSummary?.encoders?.h264_nvenc && <option value="h264_nvenc">NVIDIA NVENC H.264 (CUDA)</option>}
                  {hwSummary?.encoders?.hevc_nvenc && <option value="hevc_nvenc">NVIDIA NVENC HEVC / H.265 (CUDA)</option>}
                  {hwSummary?.encoders?.av1_nvenc && <option value="av1_nvenc">NVIDIA NVENC AV1 (RTX 40-series+)</option>}
                  {hwSummary?.encoders?.h264_qsv && <option value="h264_qsv">Intel QuickSync H.264 (QSV)</option>}
                  {hwSummary?.encoders?.hevc_qsv && <option value="hevc_qsv">Intel QuickSync HEVC / H.265 (QSV)</option>}
                  {hwSummary?.encoders?.av1_qsv && <option value="av1_qsv">Intel QuickSync AV1 (QSV)</option>}
                  {hwSummary?.encoders?.h264_amf && <option value="h264_amf">AMD AMF H.264 (Radeon)</option>}
                  {hwSummary?.encoders?.hevc_amf && <option value="hevc_amf">AMD AMF HEVC / H.265 (Radeon)</option>}
                  {hwSummary?.encoders?.h264_videotoolbox && <option value="h264_videotoolbox">Apple VideoToolbox H.264</option>}
                  {hwSummary?.encoders?.hevc_videotoolbox && <option value="hevc_videotoolbox">Apple VideoToolbox HEVC</option>}
                </optgroup>
                <optgroup label="High-Fidelity CPU Encoders (Universal Scene Standards)">
                  <option value="libx264">H.264 / AVC (libx264) - Maximum Universal Compatibility (Slow CRF 18)</option>
                  <option value="libx265">H.265 / HEVC (libx265) - 10-Bit Pristine Compression (CRF 20)</option>
                  <option value="libsvtav1">AV1 (libsvtav1) - Next-Gen Ultra Efficiency (10-Bit Preset 5)</option>
                  {hwSummary?.encoders?.libvvenc && (
                    <option value="libvvenc">H.266 / VVC (libvvenc) - Future-Gen Compact (10-Bit Fast QP 24)</option>
                  )}
                </optgroup>
              </select>
              <p className="nb-sub">
                Uses unconstrained visually-lossless quality (CRF 18 / 20 / 24). Preserves 100% native resolution, renders the base clip once in pristine quality, and stream-copies at 50x–100x speed across the entire audio duration.
              </p>
            </div>
          </div>

          {/* 2. Image Overlay Section (Universal for Single and Bulk) */}
          <div className="nb-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="nb-title text-sm flex items-center gap-2">
                <ImageIcon className="w-4 h-4" /> Image Overlay (Full Frame Fit)
              </h4>
              <input
                type="checkbox"
                className="nb-check"
                checked={overlayEnabled}
                onChange={e => setRenderOptions(prev => ({ ...prev, overlayEnabled: e.target.checked }))}
                aria-label="Enable Image Overlay"
              />
            </div>

            <p className="nb-sub">
              Stamps artwork or watermarks over video. Automatically scaled and centered to cover the frame regardless of image resolution.
            </p>

            {overlayEnabled && (
              <div className="pt-3 border-t-[2px] border-black/10 space-y-4 animate-nb-pop">
                {/* Image source selectors for Single & Bulk modes */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Single Mode Overlay Source */}
                  <div className="space-y-2">
                    <span className="nb-label flex items-center justify-between">
                      <span>Single Mode Image</span>
                      {renderOptions.overlayPath && (
                        <button
                          onClick={() => {
                            if (onClearSingleOverlay) onClearSingleOverlay();
                            else setRenderOptions(prev => ({ ...prev, overlayPath: undefined }));
                          }}
                          className="text-[10px] text-red-600 hover:underline flex items-center gap-0.5"
                        >
                          <X className="w-3 h-3" /> Clear
                        </button>
                      )}
                    </span>
                    <div className="flex gap-2">
                      <div className="nb-inset flex-1 px-3 py-2 text-[11px] font-mono font-bold truncate bg-white" title={renderOptions.overlayPath || 'No image picked'}>
                        {singleOverlayName || 'No image picked'}
                      </div>
                      {onOpenBrowser && (
                        <button
                          onClick={() => onOpenBrowser('single_image')}
                          className="nb-btn nb-btn-sm nb-btn-cyan nb-press shrink-0"
                        >
                          Pick File
                        </button>
                      )}
                    </div>
                    <p className="text-[10px] font-semibold text-black/50">Used when rendering from Single mode.</p>
                  </div>

                  {/* Bulk Mode Overlay Folder Source */}
                  <div className="space-y-2">
                    <span className="nb-label flex items-center justify-between">
                      <span>Bulk Mode Folder</span>
                      {effectiveBulkFolder && (
                        <button
                          onClick={() => {
                            if (onClearOverlayFolder) onClearOverlayFolder();
                            else setRenderOptions(prev => ({ ...prev, overlayFolder: undefined }));
                          }}
                          className="text-[10px] text-red-600 hover:underline flex items-center gap-0.5"
                        >
                          <X className="w-3 h-3" /> Clear
                        </button>
                      )}
                    </span>
                    <div className="flex gap-2">
                      <div className="nb-inset flex-1 px-3 py-2 text-[11px] font-mono font-bold truncate bg-white" title={effectiveBulkFolder || 'No folder picked'}>
                        {bulkOverlayFolderName || 'No folder picked'}
                      </div>
                      {onOpenBrowser && (
                        <button
                          onClick={() => onOpenBrowser('bulk_images')}
                          className="nb-btn nb-btn-sm nb-btn-cyan nb-press shrink-0"
                        >
                          Pick Folder
                        </button>
                      )}
                    </div>
                    <p className="text-[10px] font-semibold text-black/50">Stamps one random image per render in bulk mode.</p>
                  </div>
                </div>

                {/* Opacity & Duration / Timeout */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t-[2px] border-black/10">
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="nb-label">Overlay Opacity</span>
                      <span className="font-mono border-2 border-black bg-pink-300 px-1">
                        {Math.round(overlayOpacity * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="5"
                      max="100"
                      step="5"
                      value={Math.round(overlayOpacity * 100)}
                      onChange={e => setRenderOptions(prev => ({ ...prev, overlayOpacity: parseInt(e.target.value, 10) / 100 }))}
                      className="nb-range w-full"
                    />
                    <p className="nb-sub">Blend transparency level.</p>
                  </div>

                  <div className="space-y-1.5">
                    <span className="nb-label">Overlay Duration / Timeout</span>
                    <select
                      value={overlayTimeout}
                      onChange={e => {
                        const val = e.target.value === 'full' ? 'full' : Number(e.target.value);
                        setRenderOptions(prev => ({ ...prev, overlayTimeout: val }));
                      }}
                      className="nb-select w-full"
                    >
                      <option value="full">Fulltime (Entire Video)</option>
                      <option value="30">First 30 Seconds</option>
                      <option value="60">First 1 Minute</option>
                      <option value="120">First 2 Minutes</option>
                      <option value="300">First 5 Minutes</option>
                    </select>
                    <p className="nb-sub">Overlay fades/disappears after selected time.</p>
                  </div>
                </div>

                {/* Motion / Animation Option */}
                <div className="pt-3 border-t-[2px] border-black/10 space-y-2">
                  <span className="nb-label">Overlay Placement &amp; Motion Style</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setRenderOptions(prev => ({ ...prev, overlayAnimation: 'static' }))}
                      className={`border-[3px] border-black p-3 text-left nb-press transition-colors ${
                        (overlayAnimation !== 'bounce') ? 'bg-yellow-300' : 'bg-white hover:bg-lime-100'
                      }`}
                    >
                      <div className="text-xs font-black">Static Full Frame (Edge-to-Edge)</div>
                      <div className="text-[10px] font-semibold text-black/60 mt-1">
                        Stretches and fills the entire screen frame without moving.
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setRenderOptions(prev => ({ ...prev, overlayAnimation: 'bounce' }))}
                      className={`border-[3px] border-black p-3 text-left nb-press transition-colors ${
                        (overlayAnimation === 'bounce') ? 'bg-yellow-300' : 'bg-white hover:bg-lime-100'
                      }`}
                    >
                      <div className="text-xs font-black">Bouncing VCD Logo (Animated Motion)</div>
                      <div className="text-[10px] font-semibold text-black/60 mt-1">
                        Watermark logo bounces diagonally off screen edges like a retro VCD / DVD player screensaver.
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 3. VHS Style Presets */}
          <div className="nb-card p-6 space-y-4">
            <h4 className="nb-title text-sm flex items-center gap-2">
              <Tv className="w-4 h-4" /> VHS Tape Presets
            </h4>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {VHS_PRESETS.map(preset => {
                const isSelected = vhsPreset === preset.id;
                return (
                  <button
                    key={preset.id}
                    onClick={() => setRenderOptions(prev => ({ ...prev, vhsPreset: preset.id }))}
                    className={`border-[3px] border-black p-3 text-left nb-press transition-colors ${
                      isSelected ? 'bg-yellow-300' : 'bg-white hover:bg-lime-100'
                    }`}
                  >
                    <div className="text-xs font-black">{preset.name}</div>
                    <div className="text-[10px] font-semibold text-black/60 mt-1 line-clamp-2">
                      {preset.description}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. Atmospheric Night Mode */}
          <div className="nb-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="nb-title text-sm flex items-center gap-2">
                <Moon className="w-4 h-4" /> Night Mode Color Grading &amp; Vignette
              </h4>
              <input
                type="checkbox"
                className="nb-check"
                checked={nightMode}
                onChange={e => setRenderOptions(prev => ({ ...prev, nightModeEnabled: e.target.checked }))}
                aria-label="Night mode"
              />
            </div>

            {nightMode && (
              <div className="space-y-1.5 pt-2 animate-nb-pop">
                <div className="flex justify-between text-xs font-bold">
                  <span>Color Wash &amp; Vignette Intensity</span>
                  <span className="font-mono border-2 border-black bg-cyan-300 px-1">
                    {Math.round(nightIntensity * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={nightIntensity}
                  onChange={e => setRenderOptions(prev => ({ ...prev, nightIntensity: parseFloat(e.target.value) }))}
                  className="nb-range w-full"
                />
                <p className="nb-sub">Applies cinematic cool midnight grade and dark radial edge vignette.</p>
              </div>
            )}
          </div>

          {/* 5. Noise & Static Synthesis */}
          <div className="nb-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="nb-title text-sm flex items-center gap-2">
                <Activity className="w-4 h-4" /> Film Grain &amp; Static Snow Bursts
              </h4>
              <input
                type="checkbox"
                className="nb-check"
                checked={staticBursts}
                onChange={e => setRenderOptions(prev => ({ ...prev, noiseStaticEnabled: e.target.checked }))}
                aria-label="Static snow bursts"
              />
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-bold">
                  <span>Simulation Film Grain</span>
                  <span className="font-mono border-2 border-black bg-yellow-300 px-1">{noiseGrain}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="60"
                  value={noiseGrain}
                  onChange={e => setNoiseGrain(parseInt(e.target.value, 10))}
                  className="nb-range w-full"
                />
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold">
                  <input
                    type="checkbox"
                    className="nb-check"
                    checked={staticBursts}
                    onChange={e => setRenderOptions(prev => ({ ...prev, noiseStaticEnabled: e.target.checked }))}
                  />
                  <span>FFmpeg static snow synthesis (-vf noise)</span>
                </label>

                <div className="flex items-center gap-2">
                  <span className="nb-label">Noise Seed</span>
                  <input
                    type="number"
                    value={noiseSeed}
                    onChange={e => setRenderOptions(prev => ({ ...prev, noiseSeed: parseInt(e.target.value, 10) || 0 }))}
                    className="nb-input w-24 font-mono text-xs"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
