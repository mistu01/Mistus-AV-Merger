/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Settings, Cpu, HardDrive, Check, X } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  cpuProfile: 'aggressive' | 'balanced' | 'low' | 'idle';
  setCpuProfile: (profile: 'aggressive' | 'balanced' | 'low' | 'idle') => void;
  concurrency: number;
  setConcurrency: (val: number) => void;
  outputFolder: string;
  setOutputFolder: (path: string) => void;
  tempFolder: string;
  setTempFolder: (path: string) => void;
  segmentDuration: number;
  setSegmentDuration: (sec: number) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  cpuProfile,
  setCpuProfile,
  concurrency,
  setConcurrency,
  segmentDuration,
  setSegmentDuration,
}) => {
  if (!isOpen) return null;

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
                { id: 'idle', label: 'Background', desc: 'Lowest priority' },
              ] as const).map(p => (
                <button
                  key={p.id}
                  onClick={() => setCpuProfile(p.id)}
                  className={`border-[3px] border-black p-2.5 text-left nb-press ${cpuProfile === p.id ? 'bg-yellow-300' : 'bg-white hover:bg-[#f4efe7]'}`}
                >
                  <div className="font-black text-[11px]">{p.label}</div>
                  <div className="text-[10px] font-semibold text-black/50 mt-0.5">{p.desc}</div>
                </button>
              ))}
            </div>
            <p className="nb-sub">Lowers process priority so the app stays usable while renders run.</p>
          </div>

          {/* Concurrency */}
          <div className="space-y-2">
            <div className="flex justify-between font-bold">
              <span className="nb-label">Parallel Renders</span>
              <span className="font-mono border-2 border-black bg-cyan-300 px-1">{concurrency}</span>
            </div>
            <input type="range" min="1" max="4" value={concurrency}
              onChange={e => setConcurrency(parseInt(e.target.value, 10))} className="nb-range w-full" />
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
