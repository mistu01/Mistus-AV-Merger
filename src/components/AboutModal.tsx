/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Film, CheckCircle2, Github, Heart, X } from 'lucide-react';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AboutModal: React.FC<AboutModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Film className="w-4 h-4 text-indigo-400" />
            <h3 className="font-semibold text-slate-100 text-sm">
              About Mistus AV Merger
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 text-center space-y-4 text-xs">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 mx-auto flex items-center justify-center shadow-xl shadow-indigo-500/20 ring-1 ring-white/20">
            <Film className="w-7 h-7 text-white" />
          </div>

          <div>
            <h2 className="text-base font-bold text-white">Mistus AV Merger</h2>
            <p className="text-indigo-400 font-mono text-xs font-semibold mt-0.5">v0.5.0 (Build 500)</p>
          </div>

          <p className="text-slate-400 leading-relaxed text-xs">
            A portable, cross-platform application that combines short video clips with longer audio soundtracks, looping seamlessly with smart copy-vs-encode strategy and bulk auto-pairing.
          </p>

          <div className="bg-slate-950/80 rounded-xl p-3 border border-slate-800/80 text-left space-y-1.5 text-[11px] text-slate-300">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Smart Stream-Copy Looping (Lossless & Fast)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>6 Bulk Auto-Pairing Modes & Collision Handling</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Crash-Safe Segment Resuming (SIGSTOP/SIGCONT)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>7 VHS Presets, Night Mode & Noise Synthesis</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>100% Offline, Zero Telemetry, Portability</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500">
          <span>License: Apache-2.0 / LGPL</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
