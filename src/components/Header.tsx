/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  Film, 
  Cpu, 
  ListOrdered, 
  Sliders, 
  Sparkles, 
  Activity, 
  Settings as SettingsIcon, 
  Info, 
  Power 
} from 'lucide-react';

interface HeaderProps {
  activeTab: 'single' | 'bulk' | 'queue' | 'effects';
  setActiveTab: (tab: 'single' | 'bulk' | 'queue' | 'effects') => void;
  queueCount: number;
  activeJobsCount: number;
  gpuName: string;
  onOpenDiagnostics: () => void;
  onOpenSettings: () => void;
  onOpenAbout: () => void;
  onQuit: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  queueCount,
  activeJobsCount,
  gpuName,
  onOpenDiagnostics,
  onOpenSettings,
  onOpenAbout,
  onQuit,
}) => {
  return (
    <header className="bg-slate-900 border-b border-slate-800 text-slate-100 select-none">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 ring-1 ring-white/20">
              <Film className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">
                  Mistus AV Merger
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  v0.5.0
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Portable Looping Audio-Video Combiner
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800/80">
            <button
              onClick={() => setActiveTab('single')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'single'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Film className="w-4 h-4" />
              <span>Single Render</span>
            </button>

            <button
              onClick={() => setActiveTab('bulk')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'bulk'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Sliders className="w-4 h-4" />
              <span>Bulk Auto-Pair</span>
            </button>

            <button
              onClick={() => setActiveTab('effects')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'effects'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>VHS & Night FX</span>
            </button>

            <button
              onClick={() => setActiveTab('queue')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all relative ${
                activeTab === 'queue'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <ListOrdered className="w-4 h-4" />
              <span>Job Queue</span>
              {queueCount > 0 && (
                <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                  activeJobsCount > 0 ? 'bg-amber-500 text-black animate-pulse' : 'bg-slate-700 text-slate-200'
                }`}>
                  {queueCount}
                </span>
              )}
            </button>
          </nav>

          {/* Hardware & System Actions */}
          <div className="flex items-center gap-2">
            {/* GPU Badge */}
            <div 
              onClick={onOpenSettings}
              className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-950/40 border border-emerald-500/20 text-emerald-400 text-xs font-mono cursor-pointer hover:bg-emerald-900/30 transition-colors"
              title="Click to configure hardware encoders"
            >
              <Cpu className="w-3.5 h-3.5 text-emerald-400" />
              <span className="truncate max-w-[140px]">{gpuName}</span>
            </div>

            <button
              onClick={onOpenDiagnostics}
              title="Copy Diagnostics"
              className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
              aria-label="Open Diagnostics"
            >
              <Activity className="w-4 h-4" />
            </button>

            <button
              onClick={onOpenSettings}
              title="Application Settings"
              className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
              aria-label="Open Settings"
            >
              <SettingsIcon className="w-4 h-4" />
            </button>

            <button
              onClick={onOpenAbout}
              title="About Mistus AV Merger"
              className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
              aria-label="About Application"
            >
              <Info className="w-4 h-4" />
            </button>

            <button
              onClick={onQuit}
              title="Quit Application Server"
              className="p-2 text-rose-400 hover:text-rose-200 hover:bg-rose-950/40 rounded-lg transition-colors border border-transparent hover:border-rose-900/50"
              aria-label="Quit App"
            >
              <Power className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
