/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Folder, 
  FileAudio, 
  FileVideo, 
  HardDrive, 
  ChevronRight, 
  X, 
  Check, 
  Star, 
  Clock, 
  Search,
  CheckSquare,
  Square
} from 'lucide-react';
import { MediaProbe } from '../utils/engine';
import { SAMPLE_AUDIO_FILES, SAMPLE_VIDEO_CLIPS } from '../data/mockMedia';

interface FileBrowserModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  targetType: 'single_audio' | 'single_video' | 'folder' | 'bulk_audio' | 'bulk_video';
  onSelectPath: (path: string, probe?: MediaProbe) => void;
  onSelectMultiple?: (probes: MediaProbe[]) => void;
}

interface VirtualItem {
  name: string;
  path: string;
  isDir: boolean;
  type?: 'audio' | 'video' | 'other';
  probe?: MediaProbe;
  size?: string;
  duration?: string;
}

export const FileBrowserModal: React.FC<FileBrowserModalProps> = ({
  isOpen,
  onClose,
  title,
  targetType,
  onSelectPath,
  onSelectMultiple,
}) => {
  const [currentPath, setCurrentPath] = useState('/media/audio');
  const [selectedItems, setSelectedItems] = useState<Record<string, boolean>>({});
  const [filterType, setFilterType] = useState<'all' | 'audio' | 'video'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  if (!isOpen) return null;

  // Breadcrumbs
  const pathParts = currentPath.split('/').filter(Boolean);

  // Mock directory items
  const virtualDirectories: Record<string, VirtualItem[]> = {
    '/': [
      { name: 'media', path: '/media', isDir: true },
      { name: 'projects', path: '/projects', isDir: true },
      { name: 'renders', path: '/renders', isDir: true },
    ],
    '/media': [
      { name: 'audio', path: '/media/audio', isDir: true },
      { name: 'video', path: '/media/video', isDir: true },
      { name: 'overlays', path: '/media/overlays', isDir: true },
    ],
    '/media/audio': SAMPLE_AUDIO_FILES.map(a => ({
      name: a.filename,
      path: a.path,
      isDir: false,
      type: 'audio',
      probe: a,
      size: `${(a.sizeBytes / (1024 * 1024)).toFixed(1)} MB`,
      duration: `${Math.floor(a.duration / 60)}:${Math.floor(a.duration % 60).toString().padStart(2, '0')}`,
    })),
    '/media/video': SAMPLE_VIDEO_CLIPS.map(v => ({
      name: v.filename,
      path: v.path,
      isDir: false,
      type: 'video',
      probe: v,
      size: `${(v.sizeBytes / (1024 * 1024)).toFixed(1)} MB`,
      duration: `${v.duration}s`,
    })),
    '/renders': [
      { name: 'Summer2026_Mix.mp4', path: '/renders/Summer2026_Mix.mp4', isDir: false, type: 'video', size: '48.2 MB' },
    ],
    '/projects': [
      { name: 'album_visualizers', path: '/projects/album_visualizers', isDir: true },
    ]
  };

  const currentItems = virtualDirectories[currentPath] || [];

  const filteredItems = currentItems.filter(item => {
    if (searchTerm && !item.name.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    if (filterType === 'audio' && !item.isDir && item.type !== 'audio') return false;
    if (filterType === 'video' && !item.isDir && item.type !== 'video') return false;
    return true;
  });

  const handleItemClick = (item: VirtualItem) => {
    if (item.isDir) {
      setCurrentPath(item.path);
      setSelectedItems({});
    } else {
      if (targetType === 'folder') return;
      if (onSelectMultiple && (targetType === 'bulk_audio' || targetType === 'bulk_video')) {
        setSelectedItems(prev => ({
          ...prev,
          [item.path]: !prev[item.path],
        }));
      } else {
        onSelectPath(item.path, item.probe);
        onClose();
      }
    }
  };

  const handleSelectCurrentFolder = () => {
    onSelectPath(currentPath);
    onClose();
  };

  const handleConfirmMultiSelect = () => {
    const selectedProbes: MediaProbe[] = [];
    currentItems.forEach(i => {
      if (selectedItems[i.path] && i.probe) {
        selectedProbes.push(i.probe);
      }
    });
    if (onSelectMultiple && selectedProbes.length > 0) {
      onSelectMultiple(selectedProbes);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Modal Header */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-indigo-400" />
            <h3 className="font-semibold text-slate-100 text-sm">
              {title}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Path Navigation & Breadcrumbs */}
        <div className="p-3 bg-slate-950/60 border-b border-slate-800/80 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-1.5 overflow-x-auto py-1 font-mono text-slate-300">
            <button
              onClick={() => setCurrentPath('/')}
              className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-indigo-400"
            >
              /
            </button>
            {pathParts.map((part, idx) => {
              const fullPartPath = '/' + pathParts.slice(0, idx + 1).join('/');
              return (
                <React.Fragment key={fullPartPath}>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                  <button
                    onClick={() => setCurrentPath(fullPartPath)}
                    className="hover:underline text-slate-200 hover:text-indigo-300 px-1 py-0.5 rounded"
                  >
                    {part}
                  </button>
                </React.Fragment>
              );
            })}
          </div>

          {/* Search filter */}
          <div className="relative w-48 shrink-0">
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-7 pr-2 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2 top-2" />
          </div>
        </div>

        {/* Quick Location Shortcuts & Items List */}
        <div className="grid grid-cols-1 md:grid-cols-4 flex-1 overflow-hidden">
          {/* Sidebar shortcuts */}
          <div className="p-3 bg-slate-950/40 border-r border-slate-800/80 space-y-2 text-xs hidden md:block">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 px-2 block">
              Drives & Locations
            </span>
            <button
              onClick={() => setCurrentPath('/media/audio')}
              className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition-colors ${
                currentPath === '/media/audio' ? 'bg-indigo-600/20 text-indigo-300' : 'text-slate-400 hover:bg-slate-800'
              }`}
            >
              <FileAudio className="w-3.5 h-3.5 text-violet-400" />
              <span>Audio Samples</span>
            </button>
            <button
              onClick={() => setCurrentPath('/media/video')}
              className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition-colors ${
                currentPath === '/media/video' ? 'bg-indigo-600/20 text-indigo-300' : 'text-slate-400 hover:bg-slate-800'
              }`}
            >
              <FileVideo className="w-3.5 h-3.5 text-cyan-400" />
              <span>Video Clips</span>
            </button>
            <button
              onClick={() => setCurrentPath('/renders')}
              className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition-colors ${
                currentPath === '/renders' ? 'bg-indigo-600/20 text-indigo-300' : 'text-slate-400 hover:bg-slate-800'
              }`}
            >
              <Folder className="w-3.5 h-3.5 text-amber-400" />
              <span>Renders Folder</span>
            </button>
          </div>

          {/* File grid / list */}
          <div className="md:col-span-3 p-4 overflow-y-auto max-h-[50vh] divide-y divide-slate-800/50">
            {filteredItems.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No matching media files or directories in this folder.
              </div>
            ) : (
              filteredItems.map(item => {
                const isSelected = selectedItems[item.path];
                return (
                  <div
                    key={item.path}
                    onClick={() => handleItemClick(item)}
                    className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-indigo-600/20 text-indigo-200'
                        : 'hover:bg-slate-800/60 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-3 truncate">
                      {item.isDir ? (
                        <Folder className="w-4 h-4 text-amber-400 shrink-0" />
                      ) : item.type === 'audio' ? (
                        <FileAudio className="w-4 h-4 text-violet-400 shrink-0" />
                      ) : (
                        <FileVideo className="w-4 h-4 text-cyan-400 shrink-0" />
                      )}
                      <div>
                        <div className="font-medium text-xs truncate max-w-sm">
                          {item.name}
                        </div>
                        {item.duration && (
                          <div className="text-[10px] text-slate-500 font-mono">
                            Duration: {item.duration} &bull; Size: {item.size}
                          </div>
                        )}
                      </div>
                    </div>

                    {!item.isDir && onSelectMultiple && (targetType === 'bulk_audio' || targetType === 'bulk_video') && (
                      <div className="shrink-0 text-slate-400">
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-indigo-400" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-600" />
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <div className="text-xs text-slate-400 font-mono truncate max-w-md">
            Current: {currentPath}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
            >
              Cancel
            </button>

            {targetType === 'folder' || targetType === 'bulk_audio' || targetType === 'bulk_video' ? (
              <button
                onClick={handleSelectCurrentFolder}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow transition-colors cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Select This Folder</span>
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};
