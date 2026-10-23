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
  Clock, 
  CheckCircle2, 
  Sparkles, 
  FolderOpen, 
  Play, 
  PlusCircle, 
  AlertCircle,
  Sliders
} from 'lucide-react';
import { 
  MediaProbe, 
  RenderOptions, 
  computeCopyVsEncode, 
  resolveContainerSafety, 
  expandNamingPattern 
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
  onAddToQueue,
  onPreview5s,
}) => {
  const [namingPattern, setNamingPattern] = useState('{audio_name}.{video_ext}');
  const [aspectPolicy, setAspectPolicy] = useState<'letterbox' | 'crop'>('letterbox');

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

  const handleQueue = (startImmediately: boolean = false) => {
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
      {/* Top Media Input Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Audio Input Card */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-sm hover:border-slate-700 transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-violet-950/60 border border-violet-500/30 flex items-center justify-center text-violet-400">
                  <FileAudio className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-100 text-sm">Audio Source Track</h3>
                  <p className="text-xs text-slate-400">Longer master audio soundtrack</p>
                </div>
              </div>
              <button
                onClick={onSelectAudioClick}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 text-xs font-medium border border-violet-500/30 transition-all cursor-pointer"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                <span>Browse File</span>
              </button>
            </div>

            {selectedAudio ? (
              <div className="bg-slate-950/70 rounded-xl p-4 border border-slate-800/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm text-slate-200 font-medium truncate max-w-[280px]">
                    {selectedAudio.filename}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded bg-violet-900/50 text-violet-300 font-mono uppercase">
                    {selectedAudio.audioCodec || selectedAudio.format}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800/60 text-xs text-slate-400">
                  <div>
                    <span className="block text-[10px] uppercase text-slate-500">Duration</span>
                    <span className="font-mono text-slate-300">{formatDuration(selectedAudio.duration)} ({selectedAudio.duration.toFixed(1)}s)</span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase text-slate-500">Sample Rate</span>
                    <span className="font-mono text-slate-300">{selectedAudio.sampleRate ? `${selectedAudio.sampleRate / 1000} kHz` : '44.1 kHz'}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase text-slate-500">File Size</span>
                    <span className="font-mono text-slate-300">{(selectedAudio.sizeBytes / (1024 * 1024)).toFixed(1)} MB</span>
                  </div>
                </div>
              </div>
            ) : (
              <div 
                onClick={onSelectAudioClick}
                className="border-2 border-dashed border-slate-800 hover:border-violet-500/40 rounded-xl p-6 text-center cursor-pointer transition-colors bg-slate-950/30"
              >
                <FileAudio className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-xs text-slate-300 font-medium">Click to select audio file</p>
                <p className="text-[11px] text-slate-500 mt-1">Supports MP3, WAV, FLAC, M4A, AAC, OGG, OPUS</p>
              </div>
            )}
          </div>
        </div>

        {/* Video Clip Input Card */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-sm hover:border-slate-700 transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-950/60 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                  <FileVideo className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-100 text-sm">Video Clip (Looped)</h3>
                  <p className="text-xs text-slate-400">Short video clip to repeat seamlessly</p>
                </div>
              </div>
              <button
                onClick={onSelectVideoClick}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 text-xs font-medium border border-cyan-500/30 transition-all cursor-pointer"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                <span>Browse File</span>
              </button>
            </div>

            {selectedVideo ? (
              <div className="bg-slate-950/70 rounded-xl p-4 border border-slate-800/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm text-slate-200 font-medium truncate max-w-[280px]">
                    {selectedVideo.filename}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded bg-cyan-900/50 text-cyan-300 font-mono uppercase">
                    {selectedVideo.videoCodec || selectedVideo.format}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800/60 text-xs text-slate-400">
                  <div>
                    <span className="block text-[10px] uppercase text-slate-500">Duration</span>
                    <span className="font-mono text-slate-300">{formatDuration(selectedVideo.duration)} ({selectedVideo.duration.toFixed(1)}s)</span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase text-slate-500">Resolution</span>
                    <span className="font-mono text-slate-300">{selectedVideo.width}x{selectedVideo.height} @ {selectedVideo.fps || 30}fps</span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase text-slate-500">File Size</span>
                    <span className="font-mono text-slate-300">{(selectedVideo.sizeBytes / (1024 * 1024)).toFixed(1)} MB</span>
                  </div>
                </div>
              </div>
            ) : (
              <div 
                onClick={onSelectVideoClick}
                className="border-2 border-dashed border-slate-800 hover:border-cyan-500/40 rounded-xl p-6 text-center cursor-pointer transition-colors bg-slate-950/30"
              >
                <FileVideo className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-xs text-slate-300 font-medium">Click to select video clip</p>
                <p className="text-[11px] text-slate-500 mt-1">Supports MP4, MKV, MOV, WEBM, TS, AVI</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Looping & Strategy Banner */}
      {selectedAudio && selectedVideo && (
        <div className="bg-gradient-to-r from-slate-900 via-slate-900/90 to-indigo-950/40 border border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
                <Repeat className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-slate-200 text-sm">
                    Looping Summary: {loopCount}x repetitions
                  </h4>
                  <span className="text-xs text-slate-400">
                    ({selectedVideo.duration.toFixed(1)}s clip &rarr; {formatDuration(selectedAudio.duration)} audio)
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  The video clip loops continuously to match the audio length exactly. Tail-end trimmed seamlessly at keyframe boundary.
                </p>
              </div>
            </div>

            {/* Copy vs Encode Badge */}
            <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-medium shrink-0 ${
              copyDecision.mode === 'copy'
                ? 'bg-emerald-950/50 border-emerald-500/30 text-emerald-300'
                : 'bg-amber-950/50 border-amber-500/30 text-amber-300'
            }`}>
              {copyDecision.mode === 'copy' ? (
                <>
                  <Zap className="w-4 h-4 text-emerald-400" />
                  <div>
                    <span className="font-semibold block">Stream Copy (Fast / Remux)</span>
                    <span className="text-[10px] text-emerald-400/80">Zero re-encoding loss &bull; Instant speed</span>
                  </div>
                </>
              ) : (
                <>
                  <Layers className="w-4 h-4 text-amber-400" />
                  <div>
                    <span className="font-semibold block">Full Re-encode Required</span>
                    <span className="text-[10px] text-amber-400/80 max-w-[240px] truncate block">
                      {copyDecision.reason}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Render Configuration Panel */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
        <h3 className="font-semibold text-slate-100 text-sm flex items-center gap-2">
          <Sliders className="w-4 h-4 text-indigo-400" />
          <span>Render Pipeline & Options</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Resolution Option */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-slate-300">
              Output Resolution
            </label>
            <select
              value={renderOptions.resolution}
              onChange={e => setRenderOptions(prev => ({ ...prev, resolution: e.target.value as any }))}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="original">Original / Native (Allows Stream Copy)</option>
              <option value="1080p">1080p Full HD (1920x1080)</option>
              <option value="720p">720p HD (1280x720)</option>
              <option value="480p">480p SD (854x480)</option>
            </select>
            <p className="text-[11px] text-slate-500">
              {renderOptions.resolution === 'original' 
                ? 'Preserves native resolution without scaling.' 
                : 'Forces Lanczos scaling with letterbox aspect ratio preservation.'}
            </p>
          </div>

          {/* VHS Preset Quick Selector */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-slate-300">
              VHS Aesthetic Preset
            </label>
            <select
              value={renderOptions.vhsPreset || 'none'}
              onChange={e => setRenderOptions(prev => ({ ...prev, vhsPreset: e.target.value }))}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              {VHS_PRESETS.map(preset => (
                <option key={preset.id} value={preset.id}>
                  {preset.name}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-500">
              Simulates tape degradation, scanlines, and tracking phase.
            </p>
          </div>

          {/* Quick Effect Toggles */}
          <div className="space-y-3">
            <label className="block text-xs font-medium text-slate-300">
              Visual Toggles
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={!!renderOptions.nightModeEnabled}
                  onChange={e => setRenderOptions(prev => ({ ...prev, nightModeEnabled: e.target.checked }))}
                  className="rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-0"
                />
                <span>Night Mode (cool blue tint + vignette)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={!!renderOptions.noiseStaticEnabled}
                  onChange={e => setRenderOptions(prev => ({ ...prev, noiseStaticEnabled: e.target.checked }))}
                  className="rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-0"
                />
                <span>Film Grain & Static Bursts</span>
              </label>
            </div>
          </div>
        </div>

        {/* Output Destination & Filename */}
        <div className="pt-4 border-t border-slate-800/80 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-300">
                Output Folder
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={outputFolder}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 font-mono"
                />
                <button
                  onClick={onSelectOutputFolderClick}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium transition-colors"
                >
                  Change
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-300">
                Target Output Filename
              </label>
              <input
                type="text"
                readOnly
                value={predictedOutputName}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-indigo-300 font-mono font-medium"
              />
              {containerSafety.changed && (
                <p className="text-[11px] text-amber-400 flex items-center gap-1 mt-1">
                  <AlertCircle className="w-3 h-3" />
                  <span>{containerSafety.reason}</span>
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-4 border-t border-slate-800/80">
          <button
            onClick={onPreview5s}
            disabled={!selectedAudio || !selectedVideo}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 text-slate-200 text-xs font-medium transition-all cursor-pointer"
          >
            <Play className="w-3.5 h-3.5" />
            <span>Generate 5s Sample Preview</span>
          </button>

          <button
            onClick={() => handleQueue(false)}
            disabled={!selectedAudio || !selectedVideo}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 transition-all cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Add Job to Queue</span>
          </button>
        </div>
      </div>
    </div>
  );
};
