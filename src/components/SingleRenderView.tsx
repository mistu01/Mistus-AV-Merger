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
  Image as ImageIcon,
  X,
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
  onSelectOverlayImageClick,
  onAddToQueue,
  onPreview5s,
}) => {
  const overlayName = renderOptions.overlayPath
    ? renderOptions.overlayPath.split(/[\\/]/).pop()
    : '';
  const [namingPattern, setNamingPattern] = useState('{audio_name}.{video_ext}');

  const formatDuration = (sec?: number) => {
    if (!sec) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const copyDecision = selectedAudio && selectedVideo
    ? computeCopyVsEncode(selectedVideo, selectedAudio, renderOptions)
    : { mode: 'copy' as const, reason: 'Select both audio and video to evaluate pipeline.' };

  const rawExt = selectedVideo?.filename.split('.').pop() || 'mp4';
  const containerSafety = selectedAudio && selectedVideo
    ? resolveContainerSafety(rawExt, selectedAudio.audioCodec, selectedVideo.videoCodec, copyDecision.mode === 'encode')
    : { safeExt: rawExt, changed: false };

  const predictedOutputName = selectedAudio && selectedVideo
    ? expandNamingPattern(namingPattern, {
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
    : '0';

  const handleQueue = () => {
    if (!selectedAudio || !selectedVideo) return;
    onAddToQueue({
      audio: selectedAudio,
      video: selectedVideo,
      outputName: predictedOutputName,
      options: { ...renderOptions },
      mode: copyDecision.mode,
      modeReason: copyDecision.reason,
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Step 1 — pick media */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="nb-stripe h-2 w-24" />
          <h3 className="nb-title text-xl">Pick Your Media</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Audio */}
          <div className="nb-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 border-[3px] border-black bg-pink-400 flex items-center justify-center">
                  <FileAudio className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="nb-title text-sm">Audio Track</h3>
                  <p className="nb-sub font-bold">The long soundtrack</p>
                </div>
              </div>
              <button onClick={onSelectAudioClick} className="nb-btn nb-btn-sm nb-btn-pink nb-press">
                <FolderOpen className="w-3.5 h-3.5" /> Browse
              </button>
            </div>

            {selectedAudio ? (
              <div className="nb-inset p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-sm font-bold truncate" title={selectedAudio.filename}>
                    {selectedAudio.filename}
                  </span>
                  <span className="nb-badge nb-badge-pink shrink-0">{selectedAudio.audioCodec || selectedAudio.format}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-2 border-t-2 border-black/10 text-[10px] font-bold">
                  <div>
                    <span className="nb-label block">Duration</span>
                    <span className="font-mono">{formatDuration(selectedAudio.duration)}</span>
                  </div>
                  <div>
                    <span className="nb-label block">Sample Rate</span>
                    <span className="font-mono">{selectedAudio.sampleRate ? `${selectedAudio.sampleRate / 1000} kHz` : '44.1 kHz'}</span>
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
                <p className="nb-sub font-semibold mt-0.5">MP3, WAV, FLAC, M4A, AAC, OGG, OPUS</p>
              </button>
            )}
          </div>

          {/* Video */}
          <div className="nb-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 border-[3px] border-black bg-cyan-300 flex items-center justify-center">
                  <FileVideo className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="nb-title text-sm">Video Clip</h3>
                  <p className="nb-sub font-bold">Loops for the whole audio</p>
                </div>
              </div>
              <button onClick={onSelectVideoClick} className="nb-btn nb-btn-sm nb-btn-cyan nb-press">
                <FolderOpen className="w-3.5 h-3.5" /> Browse
              </button>
            </div>

            {selectedVideo ? (
              <div className="nb-inset p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-sm font-bold truncate" title={selectedVideo.filename}>
                    {selectedVideo.filename}
                  </span>
                  <span className="nb-badge nb-badge-cyan shrink-0">{selectedVideo.videoCodec || selectedVideo.format}</span>
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

          <div className={`flex items-center gap-2 px-4 py-2.5 border-[3px] border-black text-xs font-black shrink-0 bg-white shadow-[3px_3px_0_#000]`}>
            {copyDecision.mode === 'copy' ? (
              <>
                <Zap className="w-4 h-4" />
                <div>
                  <span className="block uppercase">Fast Stream Copy</span>
                  <span className="text-[10px] font-bold text-black/60">No re-encode &bull; Lossless</span>
                </div>
              </>
            ) : (
              <>
                <Layers className="w-4 h-4" />
                <div>
                  <span className="block uppercase">Re-encode</span>
                  <span className="text-[10px] font-bold text-black/60 max-w-[240px] truncate block">{copyDecision.reason}</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Options + output */}
      <div className="nb-card p-6 space-y-6">
        <h3 className="nb-title text-lg flex items-center gap-2">
          <Sliders className="w-5 h-5" /> Render Options
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="space-y-2">
            <label className="nb-label">Resolution</label>
            <select
              value={renderOptions.resolution}
              onChange={e => setRenderOptions(prev => ({ ...prev, resolution: e.target.value as any }))}
              className="nb-select w-full"
            >
              <option value="original">Original (allows fast copy)</option>
              <option value="1080p">1080p (1920x1080)</option>
              <option value="720p">720p (1280x720)</option>
              <option value="480p">480p (854x480)</option>
            </select>
            <p className="nb-sub">{renderOptions.resolution === 'original' ? 'Keeps native resolution.' : 'Scales + letterboxes (forces re-encode).'}</p>
          </div>

          <div className="space-y-2">
            <label className="nb-label">Output Size</label>
            <select
              value={renderOptions.sizeTarget || 'balanced'}
              onChange={e => setRenderOptions(prev => ({ ...prev, sizeTarget: e.target.value as any }))}
              className="nb-select w-full"
            >
              <option value="small">Small ~250 MB/hr</option>
              <option value="balanced">Balanced ~325 MB/hr</option>
              <option value="high">High ~400 MB/hr</option>
              <option value="unlimited">Max Quality (no cap)</option>
            </select>
            <p className="nb-sub">
              {renderOptions.sizeTarget === 'unlimited'
                ? 'CRF 21 — best quality, bigger files.'
                : 'Caps file size per hour of audio (applies when re-encoding).'}
            </p>
          </div>

          <div className="space-y-2">
            <label className="nb-label">VHS Preset</label>
            <select
              value={renderOptions.vhsPreset || 'none'}
              onChange={e => setRenderOptions(prev => ({ ...prev, vhsPreset: e.target.value }))}
              className="nb-select w-full"
            >
              {VHS_PRESETS.map(preset => (
                <option key={preset.id} value={preset.id}>{preset.name}</option>
              ))}
            </select>
            <p className="nb-sub">Tape look, scanlines, tracking effects.</p>
          </div>

          <div className="space-y-2">
            <label className="nb-label">Toggles</label>
            <div className="space-y-2 pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold">
                <input type="checkbox" className="nb-check" checked={!!renderOptions.nightModeEnabled}
                  onChange={e => setRenderOptions(prev => ({ ...prev, nightModeEnabled: e.target.checked }))} />
                <span>Night mode (cool tint + vignette)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold">
                <input type="checkbox" className="nb-check" checked={!!renderOptions.noiseStaticEnabled}
                  onChange={e => setRenderOptions(prev => ({ ...prev, noiseStaticEnabled: e.target.checked }))} />
                <span>Film grain &amp; static bursts</span>
              </label>
            </div>
          </div>
        </div>

        {/* Image overlay */}
        <div className="pt-4 border-t-[3px] border-black/10 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-bold">
              <input
                type="checkbox"
                className="nb-check"
                checked={!!renderOptions.overlayEnabled}
                onChange={e => setRenderOptions(prev => ({ ...prev, overlayEnabled: e.target.checked }))}
              />
              <ImageIcon className="w-4 h-4" />
              <span className="font-black uppercase">Image Overlay (full screen)</span>
            </label>
            <div className="flex items-center gap-2">
              <button
                onClick={onSelectOverlayImageClick}
                disabled={!renderOptions.overlayEnabled}
                className="nb-btn nb-btn-sm nb-btn-cyan nb-press disabled:opacity-40"
              >
                <ImageIcon className="w-3.5 h-3.5" />
                {renderOptions.overlayPath ? 'Change Image' : 'Pick Image'}
              </button>
              {renderOptions.overlayPath && (
                <button
                  onClick={() => setRenderOptions(prev => ({ ...prev, overlayPath: undefined }))}
                  className="nb-btn nb-btn-sm nb-btn-white nb-press"
                  title="Remove overlay image"
                >
                  <X className="w-3.5 h-3.5" /> Remove
                </button>
              )}
            </div>
          </div>

          {renderOptions.overlayEnabled && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-nb-pop">
              <div>
                <span className="nb-label">Overlay Image</span>
                {overlayName ? (
                  <div className="nb-inset w-full px-3 py-2 text-[11px] font-mono font-bold truncate" title={renderOptions.overlayPath}>
                    <ImageIcon className="w-3.5 h-3.5 inline mr-1" /> {overlayName}
                  </div>
                ) : (
                  <div className="border-[3px] border-dashed border-black/40 bg-[#f4efe7] px-3 py-2 text-[11px] font-bold text-black/50">
                    No image picked yet — click &ldquo;Pick Image&rdquo;
                  </div>
                )}
              </div>
              <div className="space-y-1">
                <div className="flex justify-between font-bold">
                  <span className="nb-label">Overlay Opacity</span>
                  <span className="font-mono border-2 border-black bg-cyan-300 px-1">
                    {Math.round((renderOptions.overlayOpacity ?? 0.8) * 100)}%
                  </span>
                </div>
                <input
                  type="range" min="5" max="100" step="5"
                  value={Math.round((renderOptions.overlayOpacity ?? 0.8) * 100)}
                  onChange={e => setRenderOptions(prev => ({ ...prev, overlayOpacity: parseInt(e.target.value, 10) / 100 }))}
                  className="nb-range w-full"
                />
                <p className="nb-sub">Stretched over the whole video frame, blended at this opacity.</p>
              </div>
            </div>
          )}
        </div>

        {/* Output destination */}
        <div className="pt-4 border-t-[3px] border-black/10 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="nb-label">Output Folder</label>
            <div className="flex gap-2">
              <input type="text" readOnly value={outputFolder} className="nb-input nb-input-readonly w-full text-[11px]" />
              <button onClick={onSelectOutputFolderClick} className="nb-btn nb-btn-lime nb-press shrink-0">
                Change
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="nb-label">Output File Name</label>
            <input type="text" readOnly value={predictedOutputName}
              className="nb-input nb-input-readonly w-full font-mono text-[11px] font-bold" />
            {containerSafety.changed && (
              <p className="text-[11px] font-bold flex items-center gap-1 mt-1">
                <AlertCircle className="w-3 h-3" /> {containerSafety.reason}
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-4 border-t-[3px] border-black/10">
          <button onClick={onPreview5s} disabled={!selectedAudio || !selectedVideo}
            className="nb-btn nb-btn-white nb-press w-full sm:w-auto disabled:opacity-40">
            <Play className="w-3.5 h-3.5 fill-black" /> 5s Preview
          </button>

          <button onClick={handleQueue} disabled={!selectedAudio || !selectedVideo}
            className="nb-btn nb-btn-lg nb-btn-yellow nb-press w-full sm:w-auto disabled:opacity-40">
            <PlusCircle className="w-4 h-4" /> Add To Queue
          </button>
        </div>
      </div>

      {/* Blank OK note */}
      {(!selectedAudio || !selectedVideo) && (
        <p className="text-center nb-sub font-bold flex items-center justify-center gap-2">
          <CheckCircle2 className="w-3.5 h-3.5" /> Everything runs locally on your machine &mdash; nothing leaves it.
        </p>
      )}
    </div>
  );
};
