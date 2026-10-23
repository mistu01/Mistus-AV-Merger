/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Settings, Cpu, HardDrive, Shield, Check, X, Sliders } from 'lucide-react';

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
  outputFolder,
  setOutputFolder,
  tempFolder,
  setTempFolder,
  segmentDuration,
  setSegmentDuration,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-indigo-400" />
            <h3 className="font-semibold text-slate-100 text-sm">
              Application Settings & Hardware Tuning
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Settings Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs">
          {/* CPU Profile */}
          <div className="space-y-2">
            <label className="block font-medium text-slate-200 flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-indigo-400" />
              <span>CPU Usage Profile & OS Scheduling</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: 'aggressive', label: 'Aggressive', desc: 'All threads, normal priority' },
                { id: 'balanced', label: 'Balanced', desc: '4 threads, nice 10' },
                { id: 'low', label: 'Low', desc: '2 threads, below normal' },
                { id: 'idle', label: 'Idle', desc: '1 thread, lowest OS priority' },
              ].map(p => (
                <button
                  key={p.id}
                  onClick={() => setCpuProfile(p.id as any)}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    cpuProfile === p.id
                      ? 'bg-indigo-600/20 border-indigo-500 text-white'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="font-semibold">{p.label}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">{p.desc}</div>
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-500">
              Uses psutil to set nice levels on Linux/macOS and IDLE_PRIORITY_CLASS on Windows so you can multitask smoothly.
            </p>
          </div>

          {/* Concurrency */}
          <div className="space-y-2">
            <div className="flex justify-between text-slate-200">
              <span className="font-medium">Parallel Job Concurrency</span>
              <span className="font-mono text-indigo-400">{concurrency} concurrent job(s)</span>
            </div>
            <input
              type="range"
              min="1"
              max="4"
              value={concurrency}
              onChange={e => setConcurrency(parseInt(e.target.value, 10))}
              className="w-full accent-indigo-500"
            />
            <p className="text-[11px] text-slate-500">
              Default is 1. When hardware acceleration is available (e.g. NVENC), concurrency can be increased.
            </p>
          </div>

          {/* Crash-Safe Segment Length */}
          <div className="space-y-2">
            <div className="flex justify-between text-slate-200">
              <span className="font-medium">Crash-Safe Segment Length</span>
              <span className="font-mono text-indigo-400">{segmentDuration} seconds</span>
            </div>
            <input
              type="range"
              min="30"
              max="300"
              step="30"
              value={segmentDuration}
              onChange={e => setSegmentDuration(parseInt(e.target.value, 10))}
              className="w-full accent-indigo-500"
            />
            <p className="text-[11px] text-slate-500">
              Interrupted renders can resume from the last completed chunk without re-rendering previous segments.
            </p>
          </div>

          {/* Portable Mode Notice */}
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-slate-400">
            <div className="flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-emerald-400" />
              <span>Portable Mode Status</span>
            </div>
            <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/20 font-mono text-[10px]">
              Active (portable.flag)
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition-colors"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Save Settings</span>
          </button>
        </div>
      </div>
    </div>
  );
};
