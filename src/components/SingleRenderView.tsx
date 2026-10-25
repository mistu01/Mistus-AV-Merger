/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  FileAudio,
  FileVideo,
  Repeat,
  Zap,
  Layers,
  CheckCircle2,
  FolderOpen,
  Play,
  PlusCircle,
  AlertCircle,
  Sliders,
  Sparkles,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';
import {
  MediaProbe,
  RenderOptions,
  computeCopyVsEncode,
  resolveContainerSafety,
  expandNamingPattern,
} from '../utils/engine';
import { VHS_PRESETS } from '../data/presets';

interface SingleRenderViewProps {
  selectedAudio: MediaProbe | null;
  selectedVideo: MediaProbe | null;
  onSelectAudioClick: () => void;
  onSelectVideoClick: () => void;
  renderOptions: RenderOptions;
  setRenderOptions: React.Dispatch<React.SetStateAction<RenderOptions>>;
  outputFolder: string;
  onSelectOutputFolderClick: () => void;
  onSelectOverlayImageClick: () => void;
  onAddToQueue: (job: {
    audio: MediaProbe;
    video: MediaProbe;
    outputName: string;
    options: RenderOptions;
    mode: 'copy' | 'encode';
    modeReason: string;
  }) => void;
  onPreview5s: () => void;
  onNavigateToRenderOptions?: () => void;
}

export const SingleRenderView: React.FC<SingleRenderViewProps> = ({
  selectedAudio,
  selectedVideo,
  onSelectAudioClick,
  onSelectVideoClick,
  renderOptions,
  setRenderOptions,
  outputFolder,
  onSelectOutputFolderClick,
  onAddToQueue,
  onPreview5s,
  onNavigateToRenderOptions,
}) => {
  const [namingTemplate] = useState('{audio_name}.{video_ext}');

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const copyDecision = selectedAudio && selectedVideo
    ? computeCopyVsEncode(selectedVideo, selectedAudio, renderOptions)
    : { mode: 'copy' as const, reason: 'Waiting for files' };

  const rawExt = selectedVideo ? selectedVideo.filename.split('.').pop() || 'mp4' : 'mp4';
  const containerSafety = selectedAudio && selectedVideo
    ? resolveContainerSafety(
        rawExt,
        selectedAudio.audioCodec,
        selectedVideo.videoCodec,
        copyDecision.mode === 'encode'
      )
    : { safeExt: rawExt, changed: false, reason: '' };

  const predictedOutputName = selectedAudio && selectedVideo
    ? expandNamingPattern(namingTemplate, {
        audioName: selectedAudio.filename,
        videoName: selectedVideo.filename,
        videoExt: containerSafety.safeExt,
        index: 1,
        resolution: renderOptions.resolution,
        preset: renderOptions.vhsPreset,
      })
    : 'output.mp4';

  const loopCount = selectedAudio && selectedVideo && selectedVideo.duration > 0
    ? (selectedAudio.duration / selectedVideo.duration).toFixed(1)
    : '1.0';

  const hasEffects = Boolean(
    (renderOptions.resolution && renderOptions.resolution !== 'original') ||
    (renderOptions.vhsPreset && renderOptions.vhsPreset !== 'none' && renderOptions.vhsPreset !== 'off') ||
    renderOptions.nightModeEnabled ||
    renderOptions.noiseStaticEnabled ||
    (renderOptions.overlayEnabled && (renderOptions.overlayPath || renderOptions.overlayFolder))
  );

  const activePreset = VHS_PRESETS.find(p => p.id === renderOptions.vhsPreset) || VHS_PRESETS[0];

  const handleQueue = () => {
    if (!selectedAudio || !selectedVideo) return;
    onAddToQueue({
      audio: selectedAudio,
      video: selectedVideo,
      outputName: predictedOutputName,
      options: renderOptions,
      mode: hasEffects ? 'encode' : copyDecision.mode,
      modeReason: hasEffects ? 'Visual effects active (re-encode required)' : copyDecision.reason,
    });
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Visual Effects & Mode Warning Banner */}
      {hasEffects ? (
        <div className="border-[3px] border-black bg-lime-200 p-4 shadow-[4px_4px_0_#000] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-nb-fade">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-black shrink-0" />
              <h4 className="text-xs font-black uppercase tracking-wider text-black">
                ✨ Visual Effects Active &mdash; Re-Encode Mode
              </h4>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono font-bold">
              {renderOptions.resolution !== 'original' && (
                <span className="nb-badge nb-badge-yellow">Scale: {renderOptions.resolution}</span>
              )}
              {renderOptions.sizeTarget && renderOptions.sizeTarget !== 'balanced' && (
                <span className="nb-badge">Target: {renderOptions.sizeTarget}</span>
              )}
              {renderOptions.vhsPreset && renderOptions.vhsPreset !== 'none' && renderOptions.vhsPreset !== 'off' && (
                <span className="nb-badge nb-badge-cyan">VHS: {activePreset.name}</span>
              )}
              {renderOptions.nightModeEnabled && (
                <span className="nb-badge nb-badge-lime">Night Mode</span>
              )}
              {renderOptions.noiseStaticEnabled && (
                <span className="nb-badge">Noise &amp; Static</span>
              )}
              {renderOptions.overlayEnabled && (
                <span className="nb-badge nb-badge-pink">
                  Overlay ({renderOptions.overlayAnimation === 'bounce' ? 'Bouncing Logo' : 'Full Frame'})
                </span>
              )}
            </div>
          </div>

          {onNavigateToRenderOptions && (
            <button
              onClick={onNavigateToRenderOptions}
              className="nb-btn nb-btn-sm nb-btn-white nb-press shrink-0 flex items-center gap-1.5 text-xs font-black"
            >
              <Sliders className="w-3.5 h-3.5" /> Edit Render Options <ArrowRight className="w-3 h-3 ml-0.5" />
            </button>
          )}
        </div>
      ) : (
        <div className="border-[3px] border-black bg-amber-200 p-4 shadow-[4px_4px_0_#000] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-nb-fade">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-black shrink-0" />
              <h4 className="text-xs font-black uppercase tracking-wider text-black">
                ⚠️ No visual effects enabled &mdash; Fast Stream Copy Mode
              </h4>
            </div>
            <p className="text-xs font-semibold text-black/80">
              Will render via lossless, instant stream copy (~300-700x). To apply VHS tape effects, noise, resolution scaling, or image overlays, enable them in the <strong>Render Options</strong> tab.
            </p>
          </div>

          {onNavigateToRenderOptions && (
            <button
              onClick={onNavigateToRenderOptions}
              className="nb-btn nb-btn-sm nb-btn-yellow nb-press shrink-0 flex items-center gap-1.5 text-xs font-black"
            >
              <Sliders className="w-3.5 h-3.5" /> Open Render Options <ArrowRight className="w-3 h-3 ml-0.5" />
            </button>
          )}
        </div>
      )}

      {/* Pickers: Audio + Video */}
      <div className="nb-card p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b-[3px] border-black/10 pb-4">
          <div>
            <span className="nb-label">Step 1</span>
            <h3 className="nb-title text-xl">Pick The Audio &amp; Video File</h3>
          </div>
          <span className="nb-sub font-bold text-xs">Pick one audio track and one video clip to merge</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Audio slot */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="nb-label flex items-center gap-1.5">
                <FileAudio className="w-4 h-4" /> 1. Audio File (Master Duration)
              </span>
              {selectedAudio && (
                <button
                  onClick={onSelectAudioClick}
                  className="nb-btn nb-btn-sm nb-btn-white nb-press text-xs"
                >
                  Change
                </button>
              )}
            </div>

            {selectedAudio ? (
              <div className="border-[3px] border-black p-4 space-y-2 bg-[#f4efe7]">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-mono text-xs font-black truncate max-w-[280px]" title={selectedAudio.filename}>
                    {selectedAudio.filename}
                  </div>
                  <span className="nb-badge nb-badge-yellow">{selectedAudio.audioCodec?.toUpperCase()}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-2 border-t-2 border-black/10 text-[10px] font-bold">
                  <div>
                    <span className="nb-label block">Duration</span>
                    <span className="font-mono">{formatDuration(selectedAudio.duration)}</span>
                  </div>
                  <div>
                    <span className="nb-label block">Channels</span>
                    <span className="font-mono">{selectedAudio.channels} ch</span>
                  </div>
                  <div>
                    <span className="nb-label block">Size</span>
                    <span className="font-mono">{(selectedAudio.sizeBytes / (1024 * 1024)).toFixed(1)} MB</span>
                  </div>
                </div>
              </div>
            ) : (
              <button
                onClick={onSelectAudioClick}
                className="w-full border-[3px] border-dashed border-black/50 hover:bg-yellow-100 p-6 text-center cursor-pointer"
              >
                <FileAudio className="w-8 h-8 mx-auto mb-2 text-black/30" />
                <p className="text-xs font-black">Click to pick an audio file</p>
                <p className="nb-sub font-semibold mt-0.5">MP3, WAV, FLAC, M4A, AAC, OGG</p>
              </button>
            )}
          </div>

          {/* Video slot */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="nb-label flex items-center gap-1.5">
                <FileVideo className="w-4 h-4" /> 2. Video Clip (Loops To Fill)
              </span>
              {selectedVideo && (
                <button
                  onClick={onSelectVideoClick}
                  className="nb-btn nb-btn-sm nb-btn-white nb-press text-xs"
                >
                  Change
                </button>
              )}
            </div>

            {selectedVideo ? (
              <div className="border-[3px] border-black p-4 space-y-2 bg-[#f4efe7]">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-mono text-xs font-black truncate max-w-[280px]" title={selectedVideo.filename}>
                    {selectedVideo.filename}
                  </div>
                  <span className="nb-badge nb-badge-cyan">{selectedVideo.videoCodec?.toUpperCase()}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-2 border-t-2 border-black/10 text-[10px] font-bold">
                  <div>
                    <span className="nb-label block">Duration</span>
                    <span className="font-mono">{formatDuration(selectedVideo.duration)}</span>
                  </div>
                  <div>
                    <span className="nb-label block">Resolution</span>
                    <span className="font-mono">{selectedVideo.width}x{selectedVideo.height}</span>
                  </div>
                  <div>
                    <span className="nb-label block">Size</span>
                    <span className="font-mono">{(selectedVideo.sizeBytes / (1024 * 1024)).toFixed(1)} MB</span>
                  </div>
                </div>
              </div>
            ) : (
              <button
                onClick={onSelectVideoClick}
                className="w-full border-[3px] border-dashed border-black/50 hover:bg-lime-100 p-6 text-center cursor-pointer"
              >
                <FileVideo className="w-8 h-8 mx-auto mb-2 text-black/30" />
                <p className="text-xs font-black">Click to pick a video clip</p>
                <p className="nb-sub font-semibold mt-0.5">MP4, MKV, MOV, WEBM, TS, AVI</p>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Looping summary */}
      {selectedAudio && selectedVideo && (
        <div className="nb-card bg-yellow-300 p-5 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 border-[3px] border-black bg-white shadow-[3px_3px_0_#000] flex items-center justify-center shrink-0">
              <Repeat className="w-6 h-6" />
            </div>
            <div>
              <h4 className="nb-title text-sm">
                Loops: {loopCount}x &mdash; this clip repeats until the audio ends
              </h4>
              <p className="text-xs font-bold mt-0.5">
                {selectedVideo.duration.toFixed(1)}s clip &rarr; {formatDuration(selectedAudio.duration)} audio. Tail trimmed cleanly at a keyframe.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 px-4 py-2.5 border-[3px] border-black text-xs font-black shrink-0 bg-white shadow-[3px_3px_0_#000]">
            {copyDecision.mode === 'copy' && !hasEffects ? (
              <>
                <Zap className="w-4 h-4 text-black" />
                <div>
                  <span className="block uppercase">Fast Stream Copy</span>
                  <span className="text-[10px] font-bold text-black/60">No re-encode &bull; Lossless</span>
                </div>
              </>
            ) : (
              <>
                <Layers className="w-4 h-4 text-black" />
                <div>
                  <span className="block uppercase">Re-encode Mode</span>
                  <span className="text-[10px] font-bold text-black/60 max-w-[240px] truncate block">
                    {hasEffects ? 'Visual effects active' : copyDecision.reason}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Output Destination & Render Action */}
      <div className="nb-card p-6 space-y-6">
        <div className="flex items-center justify-between border-b-[3px] border-black/10 pb-4">
          <div>
            <span className="nb-label">Step 2</span>
            <h3 className="nb-title text-lg flex items-center gap-2">
              <FolderOpen className="w-5 h-5" /> Output Destination &amp; Queue
            </h3>
          </div>
        </div>

        {/* Output destination */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="nb-label">Output Folder</label>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={outputFolder}
                className="nb-input nb-input-readonly w-full text-[11px]"
              />
              <button onClick={onSelectOutputFolderClick} className="nb-btn nb-btn-lime nb-press shrink-0">
                Change
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="nb-label">Output File Name</label>
            <input
              type="text"
              readOnly
              value={predictedOutputName}
              className="nb-input nb-input-readonly w-full font-mono text-[11px] font-bold"
            />
            {containerSafety.changed && (
              <p className="text-[11px] font-bold flex items-center gap-1 mt-1 text-black/70">
                <AlertCircle className="w-3 h-3 text-amber-600 shrink-0" /> {containerSafety.reason}
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-4 border-t-[3px] border-black/10">
          <button
            onClick={onPreview5s}
            disabled={!selectedAudio || !selectedVideo}
            className="nb-btn nb-btn-white nb-press w-full sm:w-auto disabled:opacity-40"
          >
            <Play className="w-3.5 h-3.5 fill-black" /> 5s Preview
          </button>

          <button
            onClick={handleQueue}
            disabled={!selectedAudio || !selectedVideo}
            className="nb-btn nb-btn-lg nb-btn-yellow nb-press w-full sm:w-auto disabled:opacity-40"
          >
            <PlusCircle className="w-4 h-4" /> Add To Queue
          </button>
        </div>
      </div>

      {/* Blank OK note */}
      {(!selectedAudio || !selectedVideo) && (
        <p className="text-center nb-sub font-bold flex items-center justify-center gap-2">
          <CheckCircle2 className="w-3.5 h-3.5 text-black/60" /> Everything runs locally on your machine &mdash; nothing leaves it.
        </p>
      )}
    </div>
  );
};
