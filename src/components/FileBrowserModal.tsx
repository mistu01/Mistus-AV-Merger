/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Real filesystem browser backed by /api/v1/fs/list and /api/v1/fs/probe.
 * Lists the actual drives, shortcuts, folders and media files of the host
 * computer — no mock data.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Folder,
  FolderOpen,
  Home,
  Download,
  Music,
  Video,
  Image,
  FileText,
  HardDrive,
  FileAudio,
  FileVideo,
  ArrowUp,
  ChevronRight,
  X,
  Check,
  Search,
  Loader2,
} from 'lucide-react';
import { MediaProbe } from '../utils/engine';

interface FileBrowserModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  initialPath?: string;
  targetType:
    | 'single_audio'
    | 'single_video'
    | 'single_image'
    | 'folder'
    | 'output'
    | 'bulk_audio'
    | 'bulk_video'
    | 'bulk_images';
  onSelectPath: (path: string, probe?: MediaProbe) => void;
  onSelectMultiple?: (probes: MediaProbe[]) => void;
}

interface FsEntry {
  name: string;
  path: string;
  isDir: boolean;
  kind: 'dir' | 'audio' | 'video' | 'image' | 'other';
  sizeBytes?: number | null;
}

interface FsListing {
  path: string | null;
  parent: string | null;
  isRoot: boolean;
  drives: Array<{ label: string; path: string }>;
  shortcuts: Array<{ label: string; path: string; icon: string }>;
  entries: FsEntry[];
}

const SHORTCUT_ICONS: Record<string, React.ReactNode> = {
  home: <Home className="w-3.5 h-3.5" />,
  desktop: <Folder className="w-3.5 h-3.5" />,
  downloads: <Download className="w-3.5 h-3.5" />,
  music: <Music className="w-3.5 h-3.5" />,
  videos: <Video className="w-3.5 h-3.5" />,
  pictures: <Image className="w-3.5 h-3.5" />,
  documents: <FileText className="w-3.5 h-3.5" />,
};

const API = '';

async function fetchListing(path?: string): Promise<FsListing> {
  const url = path
    ? `${API}/api/v1/fs/list?path=${encodeURIComponent(path)}`
    : `${API}/api/v1/fs/list`;
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail || `Folder listing failed (${res.status})`);
  }
  return res.json();
}

async function probeFile(path: string): Promise<MediaProbe> {
  const res = await fetch(`${API}/api/v1/fs/probe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail || `File probe failed (${res.status})`);
  }
  return res.json();
}

/** Splits a windows/unix path into breadcrumb parts (drive kept). */
function pathBreadcrumbs(path: string): Array<{ label: string; target: string }> {
  const parts = path.split(/[\\/]+/).filter(Boolean);
  const crumbs: Array<{ label: string; target: string }> = [];
  if (/^[A-Za-z]:$/.test(parts[0] || '')) {
    crumbs.push({ label: `${parts[0]}\\`, target: `${parts[0]}\\` });
  } else if (parts[0]) {
    crumbs.push({ label: '/', target: '/' });
  } else {
    return crumbs;
  }
  if (crumbs[0].target === path) return crumbs;
  const sep = /^[A-Za-z]:$/.test(parts[0]) ? '\\' : '/';
  let acc = crumbs[0].target;
  for (let i = 1; i < parts.length; i++) {
    acc = acc.endsWith('\\') || acc.endsWith('/') ? acc : `${acc}${sep}`;
    acc += parts[i];
    crumbs.push({ label: parts[i], target: acc });
  }
  return crumbs;
}

export const FileBrowserModal: React.FC<FileBrowserModalProps> = ({
  isOpen,
  onClose,
  title,
  initialPath,
  targetType,
  onSelectPath,
}) => {
  const [listing, setListing] = useState<FsListing | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'audio' | 'video' | 'image'>(
    targetType === 'single_audio' || targetType === 'bulk_audio' ? 'audio'
    : targetType === 'single_image' ? 'image'
    : 'all'
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [probingPath, setProbingPath] = useState<string | null>(null);

  const load = useCallback(async (path?: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchListing(path);
      setListing(data);
    } catch (e: any) {
      setError(e.message || 'Could not read this folder');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      setSearchTerm('');
      load(initialPath || undefined);
    }
  }, [isOpen, initialPath, load]);

  if (!isOpen) return null;

  const entries = (listing?.entries || []).filter(item => {
    if (searchTerm && !item.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    if (filterType === 'audio' && !item.isDir && item.kind !== 'audio') return false;
    if (filterType === 'video' && !item.isDir && item.kind !== 'video') return false;
    if (filterType === 'image' && !item.isDir && item.kind !== 'image') return false;
    return true;
  });

  const isFolderSelect = targetType === 'folder' || targetType === 'output' ||
    targetType === 'bulk_audio' || targetType === 'bulk_video' || targetType === 'bulk_images';

  const handleItemClick = async (item: FsEntry) => {
    if (item.isDir) {
      load(item.path);
      return;
    }
    if (targetType === 'single_audio' || targetType === 'single_video') {
      setProbingPath(item.path);
      try {
        const probe = await probeFile(item.path);
        onSelectPath(item.path, probe);
        onClose();
      } catch (e: any) {
        setError(e.message || 'Could not read this file');
      } finally {
        setProbingPath(null);
      }
    } else if (targetType === 'single_image') {
      // Images need no media probe — pass the path straight through
      onSelectPath(item.path);
      onClose();
    } else if (isFolderSelect) {
      // For folder targets, clicking a folder navigates; files do nothing.
      return;
    }
  };

  const handleConfirmFolder = () => {
    if (listing?.path) {
      onSelectPath(listing.path);
      onClose();
    }
  };

  const crumbs = listing?.path ? pathBreadcrumbs(listing.path) : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 animate-nb-pop">
      <div className="nb-card w-full max-w-3xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="bg-yellow-300 border-b-[3px] border-black px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HardDrive className="w-4 h-4" />
            <h3 className="nb-title text-sm">{title}</h3>
          </div>
          <button onClick={onClose} className="nb-btn nb-btn-sm nb-btn-white nb-press p-1.5">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Breadcrumbs + search */}
        <div className="px-4 py-2.5 border-b-[3px] border-black bg-white flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-1 overflow-x-auto py-1 font-mono font-semibold">
            <button
              onClick={() => load(undefined)}
              className="nb-btn nb-btn-sm nb-btn-white nb-press px-1.5 py-0.5"
              title="Drives"
            >
              <HardDrive className="w-3 h-3" />
            </button>
            {crumbs.map((c, idx) => (
              <React.Fragment key={c.target + idx}>
                <ChevronRight className="w-3 h-3 text-black/50 shrink-0" />
                <button
                  onClick={() => load(c.target)}
                  className={`px-1 py-0.5 font-mono hover:underline ${idx === crumbs.length - 1 ? 'font-black underline' : ''}`}
                  title={c.target}
                >
                  {c.label}
                </button>
              </React.Fragment>
            ))}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="flex border-[3px] border-black divide-x-[3px] divide-black">
              {(['all', 'audio', 'video', 'image'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilterType(f)}
                  className={`px-2 py-1 text-[10px] font-black uppercase ${
                    filterType === f ? 'bg-black text-white' : 'bg-white hover:bg-yellow-200'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
            <div className="relative w-40">
              <input
                type="text"
                placeholder="Filter..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="nb-input w-full pl-7 py-1"
              />
              <Search className="w-3.5 h-3.5 absolute left-2 top-2 text-black" />
            </div>
          </div>
        </div>

        {/* Sidebar + list */}
        <div className="grid grid-cols-1 md:grid-cols-4 flex-1 overflow-hidden bg-white">
          <div className="p-3 space-y-1 text-xs bg-[#f4efe7] border-r-[3px] border-black overflow-y-auto max-h-64 md:max-h-none">
            <span className="nb-label block px-2 pb-1">Places</span>
            {(listing?.shortcuts || []).map(sc => (
              <button
                key={sc.path}
                onClick={() => load(sc.path)}
                className="w-full flex items-center gap-2 px-2 py-1.5 border-2 border-transparent hover:border-black hover:bg-yellow-200 font-bold text-left"
                title={sc.path}
              >
                <span className="shrink-0">{SHORTCUT_ICONS[sc.icon] || <Folder className="w-3.5 h-3.5" />}</span>
                <span className="truncate">{sc.label}</span>
              </button>
            ))}
            {(listing?.drives || []).length > 0 && (
              <>
                <span className="nb-label block px-2 pt-2 pb-1">Drives</span>
                {(listing?.drives || []).map(d => (
                  <button
                    key={d.path}
                    onClick={() => load(d.path)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 border-2 border-transparent hover:border-black hover:bg-cyan-200 font-bold text-left"
                  >
                    <HardDrive className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{d.label}</span>
                  </button>
                ))}
              </>
            )}
          </div>

          <div className="md:col-span-3 overflow-y-auto max-h-[50vh]">
            {loading ? (
              <div className="p-8 flex items-center justify-center gap-2 text-xs font-bold">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Reading folder...</span>
              </div>
            ) : error ? (
              <div className="p-6 text-center">
                <div className="nb-badge nb-badge-red inline-block mb-2">Error</div>
                <p className="text-xs font-semibold">{error}</p>
                <button onClick={() => load(listing?.parent || undefined)} className="nb-btn nb-btn-sm nb-btn-yellow nb-press mt-3">
                  <ArrowUp className="w-3 h-3" /> Go up / retry
                </button>
              </div>
            ) : entries.length === 0 ? (
              <div className="p-8 text-center text-xs font-semibold text-black/60">
                No matching media files or folders here.
              </div>
            ) : (
              entries.map(item => (
                <button
                  key={item.path}
                  onClick={() => handleItemClick(item)}
                  className={`w-full flex items-center justify-between px-4 py-2.5 border-b-2 border-black/10 text-left hover:bg-yellow-100 group ${
                    item.isDir ? '' : 'hover:bg-lime-100'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {item.isDir ? (
                      listing?.parent === undefined ? (
                        <FolderOpen className="w-4 h-4 shrink-0" />
                      ) : (
                        <Folder className="w-4 h-4 shrink-0" />
                      )
                    ) : item.kind === 'audio' ? (
                      <FileAudio className="w-4 h-4 shrink-0" />
                    ) : item.kind === 'image' ? (
                      <Image className="w-4 h-4 shrink-0" />
                    ) : item.kind === 'video' ? (
                      <FileVideo className="w-4 h-4 shrink-0" />
                    ) : (
                      <FileText className="w-4 h-4 shrink-0" />
                    )}
                    <span className={`truncate max-w-[380px] text-xs font-bold ${item.isDir ? '' : 'font-mono'}`}>
                      {item.name}
                    </span>
                    {probingPath === item.path && (
                      <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {item.isDir ? (
                      <span className="nb-badge nb-badge-cyan opacity-70 group-hover:opacity-100">open</span>
                    ) : (
                      <span className="text-[10px] font-mono font-bold text-black/60">
                        {item.sizeBytes ? `${(item.sizeBytes / (1024 * 1024)).toFixed(1)} MB` : ''}
                      </span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-black text-white px-4 py-3 flex items-center justify-between gap-3">
          <div className="text-xs font-mono truncate max-w-md" title={listing?.path || 'Drives & Places'}>
            {listing?.path ? `Current: ${listing.path}` : 'Pick a drive or place to browse'}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {listing?.parent && (
              <button onClick={() => load(listing.parent!)} className="nb-btn nb-btn-sm nb-btn-white nb-press">
                <ArrowUp className="w-3.5 h-3.5" /> Up
              </button>
            )}
            <button onClick={onClose} className="nb-btn nb-btn-sm nb-btn-pink nb-press">
              <X className="w-3.5 h-3.5" /> Cancel
            </button>
            {isFolderSelect && listing?.path && (
              <button onClick={handleConfirmFolder} className="nb-btn nb-btn-sm nb-btn-lime nb-press">
                <Check className="w-3.5 h-3.5" /> Select This Folder
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
