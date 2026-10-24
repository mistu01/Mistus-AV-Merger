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
  Power,
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

const TABS: Array<{ id: HeaderProps['activeTab']; label: string; icon: React.ReactNode; color: string }> = [
  { id: 'single', label: 'Single', icon: <Film className="w-4 h-4" />, color: 'bg-yellow-300' },
  { id: 'bulk', label: 'Bulk Auto-Pair', icon: <Sliders className="w-4 h-4" />, color: 'bg-pink-400' },
  { id: 'effects', label: 'Render Options', icon: <Sparkles className="w-4 h-4" />, color: 'bg-lime-300' },
  { id: 'queue', label: 'Queue', icon: <ListOrdered className="w-4 h-4" />, color: 'bg-cyan-300' },
];

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
    <header className="bg-white border-b-[3px] border-black select-none">
      {/* Marquee stripe */}
      <div className="nb-stripe h-2 animate-nb-marquee" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-10 h-10 border-[3px] border-black bg-yellow-300 flex items-center justify-center shadow-[3px_3px_0_#000]">
              <Film className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="nb-title text-base">Mistus AV Merger</span>
              </div>
              <p className="nb-sub font-bold hidden sm:block">Loop Audio + Video, Fast</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-stretch gap-0 border-[3px] border-black divide-x-[3px] divide-black overflow-hidden">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-2 px-3.5 py-2.5 text-xs font-black uppercase transition-colors ${
                  activeTab === tab.id ? tab.color : 'bg-white hover:bg-[#f4efe7]'
                }`}
              >
                {tab.icon}
                <span className="hidden md:inline">{tab.label}</span>
                {tab.id === 'queue' && queueCount > 0 && (
                  <span
                    className={`absolute -top-2 -right-2 text-[10px] font-black px-1.5 py-0 border-2 border-black ${
                      activeJobsCount > 0 ? 'bg-red-400 animate-pulse' : 'bg-black text-white'
                    }`}
                  >
                    {queueCount}
                  </span>
                )}
              </button>
            ))}
          </nav>

          {/* Hardware & System Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <div
              onClick={onOpenSettings}
              className="hidden lg:flex items-center gap-1.5 nb-badge nb-badge-lime cursor-pointer"
              title="Click to configure hardware encoders"
            >
              <Cpu className="w-3.5 h-3.5" />
              <span className="truncate max-w-[140px] font-mono">{gpuName}</span>
            </div>

            <button onClick={onOpenDiagnostics} title="Copy Diagnostics" aria-label="Open Diagnostics"
              className="nb-btn nb-btn-sm nb-btn-white nb-press p-2">
              <Activity className="w-4 h-4" />
            </button>

            <button onClick={onOpenSettings} title="Application Settings" aria-label="Open Settings"
              className="nb-btn nb-btn-sm nb-btn-white nb-press p-2">
              <SettingsIcon className="w-4 h-4" />
            </button>

            <button onClick={onOpenAbout} title="About Mistus AV Merger" aria-label="About"
              className="nb-btn nb-btn-sm nb-btn-white nb-press p-2">
              <Info className="w-4 h-4" />
            </button>

            <button onClick={onQuit} title="Quit Application Server" aria-label="Quit"
              className="nb-btn nb-btn-sm nb-press p-2 bg-red-400 text-black">
              <Power className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
