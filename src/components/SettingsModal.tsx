/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Settings, Cpu, HardDrive, Check, X, Zap } from 'lucide-react';
import type { HardwareSummary } from '../App';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  cpuProfile: 'aggressive' | 'balanced' | 'low' | 'idle';
  onCpuProfileChange: (profile: 'aggressive' | 'balanced' | 'low' | 'idle') => void;
  concurrency: number;
  onConcurrencyChange: (val: number) => void;
  outputFolder: string;
  setOutputFolder: (path: string) => void;
  tempFolder: string;
  setTempFolder: (path: string) => void;
  segmentDuration: number;
  setSegmentDuration: (sec: number) => void;
  hwSummary: HardwareSummary | null;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  cpuProfile,
  onCpuProfileChange,
  concurrency,
  onConcurrencyChange,
  segmentDuration,
  setSegmentDuration,
  hwSummary,
}) => {
  if (!isOpen) return null;

  const hwLine = hwSummary
    ? hwSummary.probing
      ? 'Detecting encoder (micro-encode test running)...'
      : `${hwSummary.recommended} — ${hwSummary.gpu_brand}`
    : 'Detecting encoder...';

  const profileMeta = hardwareThreads(cpuProfile);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 animate-nb-pop">
      <div className="nb-card w-full max-w-xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="bg-lime-300 border-b-[3px] border-black px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            <h3 className="nb-title text-sm">Settings</h3>
          </div>
          <button onClick={onClose} className="nb-btn nb-btn-sm nb-btn-white nb-press p-1.5">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs bg-white">
          {/* Detected hardware */}
          <div className="nb-inset p-3 space-y-1.5">
            <div className="flex items-center justify-between font-black">
              <span className="flex items-center gap-2">
                <Zap className="w-4 h-4" /> Detected Encoder
              </span>
              {hwSummary && !hwSummary.probing && (
                <span className={`nb-badge ${hwSummary.is_hardware_accelerated ? 'nb-badge-lime' : 'nb-badge-cyan'}`}>
                  {hwSummary.is_hardware_accelerated ? 'GPU ACCELERATED' : 'CPU SOFTWARE'}
                </span>
              )}
            </div>
            <p className="font-mono text-[11px] font-bold break-all">{hwLine}</p>
            <p className="text-[10px] font-semibold text-black/50">
              Encodes automatically use the best GPU encoder found (NVENC / AMF / QuickSync), falling back to CPU x264.
            </p>
          </div>

          {/* CPU profile */}
          <div className="space-y-2">
            <label className="nb-label flex items-center gap-1.5">
              <Cpu className="w-4 h-4" /> Speed While Rendering
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {([
                { id: 'aggressive', label: 'Full Speed', desc: 'All threads' },
                { id: 'balanced', label: 'Balanced', desc: 'You can still work' },
                { id: 'low', label: 'Gentle', desc: '2 threads' },
                { id: 'idle', label: 'Background', desc: '1 thread, lowest priority' },
              ] as const).map(p => (
                <button
                  key={p.id}
                  onClick={() => onCpuProfileChange(p.id)}
                  className={`border-[3px] border-black p-2.5 text-left nb-press ${cpuProfile === p.id ? 'bg-yellow-300' : 'bg-white hover:bg-[#f4efe7]'}`}
                >
                  <div className="font-black text-[11px]">{p.label}</div>
                  <div className="text-[10px] font-semibold text-black/50 mt-0.5">{p.desc}</div>
                </button>
              ))}
            </div>
            <p className="nb-sub">{profileMeta}</p>
          </div>

          {/* Concurrency */}
          <div className="space-y-2">
            <div className="flex justify-between font-bold">
              <span className="nb-label">Parallel Renders</span>
              <span className="font-mono border-2 border-black bg-cyan-300 px-1">{concurrency}</span>
            </div>
            <input type="range" min="1" max="4" value={concurrency}
              onChange={e => onConcurrencyChange(parseInt(e.target.value, 10))} className="nb-range w-full" />
            <p className="nb-sub">1 is safest. Increase only with hardware encoders.</p>
          </div>

          {/* Segments */}
          <div className="space-y-2">
            <div className="flex justify-between font-bold">
              <span className="nb-label">Resume Chunk Size</span>
              <span className="font-mono border-2 border-black bg-yellow-300 px-1">{segmentDuration}s</span>
            </div>
            <input type="range" min="30" max="300" step="30" value={segmentDuration}
              onChange={e => setSegmentDuration(parseInt(e.target.value, 10))} className="nb-range w-full" />
            <p className="nb-sub">Interrupted renders resume from the last chunk instead of restarting.</p>
          </div>

          {/* Portable notice */}
          <div className="nb-inset p-3 flex items-center justify-between">
            <div className="flex items-center gap-2 font-black">
              <HardDrive className="w-4 h-4" />
              <span>Portable Mode</span>
            </div>
            <span className="nb-badge nb-badge-lime">Detected</span>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t-[3px] border-black p-4 flex justify-end bg-white">
          <button onClick={onClose} className="nb-btn nb-btn-yellow nb-press">
            <Check className="w-3.5 h-3.5" /> Done
          </button>
        </div>
      </div>
    </div>
  );
};

function hardwareThreads(profile: string): string {
  switch (profile) {
    case 'aggressive':
      return 'FFmpeg runs with all CPU threads and normal OS priority — fastest encodes.';
    case 'balanced':
      return 'Half of your CPU cores plus a lowered priority so the PC stays responsive.';
    case 'low':
      return 'Only 2 FFmpeg threads at lowered priority — light multitasking is fine.';
    case 'idle':
      return 'A single FFmpeg thread at the lowest priority — renders hide away in the background.';
    default:
      return '';
  }
}
