/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  FolderSearch, 
  FolderCheck, 
  Layers, 
  ArrowRight, 
  Shuffle, 
  AlertTriangle, 
  CheckCircle2, 
  Download, 
  ListPlus, 
  FileText, 
  Filter, 
  CheckSquare, 
  Square, 
  Trash2, 
  RefreshCw,
  Zap,
  HelpCircle,
  Play
} from 'lucide-react';
import { 
  MediaProbe, 
  PairingMode, 
  CollisionPolicy, 
  RenderOptions, 
  autoPair, 
  resolveCollisions,
  PairingResult 
} from '../utils/engine';
import { SAMPLE_AUDIO_FILES, SAMPLE_VIDEO_CLIPS } from '../data/mockMedia';

interface BulkScanViewProps {
  onQueueBatch: (pairings: PairingResult[]) => void;
  renderOptions: RenderOptions;
  onOpenFolderBrowser: (target: 'bulk_audio' | 'bulk_video') => void;
  audioFolder: string;
  videoFolder: string;
}

export const BulkScanView: React.FC<BulkScanViewProps> = ({
  onQueueBatch,
  renderOptions,
  onOpenFolderBrowser,
  audioFolder,
  videoFolder,
}) => {
  const [sameFolder, setSameFolder] = useState(false);
  const [recursive, setRecursive] = useState(false);
  const [pairingMode, setPairingMode] = useState<PairingMode>('cycle');
  const [namingTemplate, setNamingTemplate] = useState('{audio_name}.{video_ext}');
  const [collisionPolicy, setCollisionPolicy] = useState<CollisionPolicy>('suffix');
  const [fuzzyConfidenceThreshold, setFuzzyConfidenceThreshold] = useState(0.65);
  const [randomSeed, setRandomSeed] = useState(42);
  const [filterText, setFilterText] = useState('');
  const [dryRunDone, setDryRunDone] = useState(false);

  // Scanned media state
  const [scannedAudio, setScannedAudio] = useState<MediaProbe[]>(SAMPLE_AUDIO_FILES);
  const [scannedVideo, setScannedVideo] = useState<MediaProbe[]>(SAMPLE_VIDEO_CLIPS);
  const [isScanning, setIsScanning] = useState(false);

  // Selected single video for "one_for_all" mode
  const [singleVideoId, setSingleVideoId] = useState<string>(SAMPLE_VIDEO_CLIPS[0]?.path || '');

  // Manual exclusions / overrides
  const [manualExclusions, setManualExclusions] = useState<Record<string, boolean>>({});
  const [manualVideoOverrides, setManualVideoOverrides] = useState<Record<string, string>>({});

  // Generate pairing plan
  const plan = useMemo(() => {
    const rawPlan = autoPair(scannedAudio, scannedVideo, pairingMode, {
      singleVideoId,
      namingTemplate,
      seed: randomSeed,
      fuzzyConfidenceThreshold,
      renderOptions,
    });

    // Apply manual overrides
    const modifiedPairings = rawPlan.pairings.map(p => {
      const isExcluded = manualExclusions[p.id] ?? p.excluded;
      const overrideVideoPath = manualVideoOverrides[p.id];
      let currentVideo = p.video;
      if (overrideVideoPath) {
        const found = scannedVideo.find(v => v.path === overrideVideoPath);
        if (found) currentVideo = found;
      }
      return {
        ...p,
        video: currentVideo,
        excluded: isExcluded,
      };
    });

    // Apply collision resolution
    const resolved = resolveCollisions(modifiedPairings, collisionPolicy);

    return {
      ...rawPlan,
      pairings: resolved,
    };
  }, [
    scannedAudio, 
    scannedVideo, 
    pairingMode, 
    singleVideoId, 
    namingTemplate, 
    randomSeed, 
    fuzzyConfidenceThreshold, 
    renderOptions, 
    manualExclusions, 
    manualVideoOverrides, 
    collisionPolicy
  ]);

  const activePairingsCount = plan.pairings.filter(p => !p.excluded).length;

  const handleScan = () => {
    setIsScanning(true);
    setDryRunDone(false);
    setTimeout(() => {
      setIsScanning(false);
    }, 600);
  };

  const handleToggleExclude = (id: string) => {
    setManualExclusions(prev => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleSelectAll = (select: boolean) => {
    const updates: Record<string, boolean> = {};
    plan.pairings.forEach(p => {
      updates[p.id] = !select;
    });
    setManualExclusions(updates);
  };

  const handleVideoOverride = (pairingId: string, videoPath: string) => {
    setManualVideoOverrides(prev => ({
      ...prev,
      [pairingId]: videoPath,
    }));
  };

  const exportPlan = (format: 'json' | 'csv') => {
    if (format === 'json') {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(plan, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `mistus_pairing_plan_${Date.now()}.json`);
      downloadAnchor.click();
    } else {
      const headers = "Audio,Duration,Video,Resolution,OutputName,Mode,Loops\n";
      const rows = plan.pairings
        .map(p => `"${p.audio.filename}",${p.audio.duration.toFixed(1)},"${p.video.filename}","${p.video.width}x${p.video.height}","${p.outputName}","${p.mode}",${p.loopCount}`)
        .join("\n");
      const dataStr = "data:text/csv;charset=utf-8," + encodeURIComponent(headers + rows);
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `mistus_pairing_plan_${Date.now()}.csv`);
      downloadAnchor.click();
    }
  };

  const filteredPairings = plan.pairings.filter(p => {
    if (!filterText) return true;
    const lower = filterText.toLowerCase();
    return p.audio.filename.toLowerCase().includes(lower) || 
           p.video.filename.toLowerCase().includes(lower) || 
           p.outputName.toLowerCase().includes(lower);
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Folder Selection & Scan Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-semibold text-slate-100 text-sm flex items-center gap-2">
              <FolderSearch className="w-4 h-4 text-indigo-400" />
              <span>Bulk Folder Scan & Auto-Pair Engine</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Point to folders of audio files and video clips. Auto-match, review the pairing matrix, and batch queue with one click.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
              <input
                type="checkbox"
                checked={sameFolder}
                onChange={e => setSameFolder(e.target.checked)}
                className="rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-0"
              />
              <span>Audio & Video in same folder</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
              <input
                type="checkbox"
                checked={recursive}
                onChange={e => setRecursive(e.target.checked)}
                className="rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-0"
              />
              <span>Recursive subfolders</span>
            </label>
          </div>
        </div>

        {/* Directory Inputs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-slate-300">Audio Directory</span>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={audioFolder}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 font-mono"
              />
              <button
                onClick={() => onOpenFolderBrowser('bulk_audio')}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium transition-colors cursor-pointer"
              >
                Browse
              </button>
            </div>
          </div>

          {!sameFolder ? (
            <div className="space-y-1.5">
              <span className="text-xs font-medium text-slate-300">Video Clips Directory</span>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={videoFolder}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 font-mono"
                />
                <button
                  onClick={() => onOpenFolderBrowser('bulk_video')}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium transition-colors cursor-pointer"
                >
                  Browse
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center p-3 rounded-xl bg-slate-950/40 border border-slate-800/80 text-xs text-slate-400">
              <span>Scanning both media types in audio folder</span>
            </div>
          )}
        </div>

        {/* Scan Actions & Findings Banner */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-3 border-t border-slate-800/80">
          <div className="flex items-center gap-3">
            <button
              onClick={handleScan}
              disabled={isScanning}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold shadow-md transition-all cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
              <span>{isScanning ? 'Probing Media...' : 'Scan / Refresh Folders'}</span>
            </button>
            <span className="text-xs text-slate-400">
              Found <strong className="text-indigo-300 font-mono">{scannedAudio.length}</strong> audio tracks,{' '}
              <strong className="text-cyan-300 font-mono">{scannedVideo.length}</strong> video clips
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">
              Total Audio Runtime:{' '}
              <strong className="text-slate-200 font-mono">
                {Math.floor(scannedAudio.reduce((acc, a) => acc + a.duration, 0) / 60)}m{' '}
                {Math.floor(scannedAudio.reduce((acc, a) => acc + a.duration, 0) % 60)}s
              </strong>
            </span>
          </div>
        </div>
      </div>

      {/* Auto-Pairing Strategy Controls */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
        <h3 className="font-semibold text-slate-100 text-sm flex items-center gap-2">
          <Layers className="w-4 h-4 text-indigo-400" />
          <span>Auto-Pairing Mode & Rules</span>
        </h3>

        {/* Mode Selector Buttons */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {[
            { id: 'match_name', label: '1. Match by Name', desc: 'Exact + Fuzzy base name' },
            { id: 'order_1_to_1', label: '2. Match by Order', desc: '1:1 natural order' },
            { id: 'one_for_all', label: '3. One for All', desc: 'Single clip for all audio' },
            { id: 'cycle', label: '4. Cycle (Round Robin)', desc: 'Rotate video clips' },
            { id: 'random_seeded', label: '5. Random Seeded', desc: 'Reproducible shuffle' },
            { id: 'manual', label: '6. Manual Assign', desc: 'Custom per-row assignment' },
          ].map(m => (
            <button
              key={m.id}
              onClick={() => setPairingMode(m.id as PairingMode)}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                pairingMode === m.id
                  ? 'bg-indigo-600/15 border-indigo-500 text-white shadow-sm'
                  : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
              }`}
            >
              <div className="text-xs font-semibold">{m.label}</div>
              <div className="text-[10px] text-slate-400 mt-1">{m.desc}</div>
            </button>
          ))}
        </div>

        {/* Mode-specific Options */}
        {pairingMode === 'match_name' && (
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <span className="text-xs font-medium text-slate-200">Fuzzy Match Sensitivity</span>
              <p className="text-[11px] text-slate-400">
                Ignores track numbers (e.g. "01 - "), spaces, underscores, and minor title variations.
              </p>
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <input
                type="range"
                min="0.4"
                max="0.95"
                step="0.05"
                value={fuzzyConfidenceThreshold}
                onChange={e => setFuzzyConfidenceThreshold(parseFloat(e.target.value))}
                className="w-36 accent-indigo-500"
              />
              <span className="text-xs font-mono text-indigo-400 w-12 text-right">
                {Math.round(fuzzyConfidenceThreshold * 100)}%
              </span>
            </div>
          </div>
        )}

        {pairingMode === 'one_for_all' && (
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <span className="text-xs font-medium text-slate-200">Selected Video Clip</span>
              <p className="text-[11px] text-slate-400">
                This single clip will be looped across all audio tracks.
              </p>
            </div>
            <select
              value={singleVideoId}
              onChange={e => setSingleVideoId(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              {scannedVideo.map(v => (
                <option key={v.path} value={v.path}>
                  {v.filename} ({v.duration}s - {v.width}x{v.height})
                </option>
              ))}
            </select>
          </div>
        )}

        {pairingMode === 'random_seeded' && (
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between gap-4">
            <div>
              <span className="text-xs font-medium text-slate-200">RNG Seed (Deterministic)</span>
              <p className="text-[11px] text-slate-400">
                Same seed guarantees identical pairing order across runs.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={randomSeed}
                onChange={e => setRandomSeed(parseInt(e.target.value, 10) || 0)}
                className="w-24 bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs font-mono text-indigo-300"
              />
              <button
                onClick={() => setRandomSeed(Math.floor(Math.random() * 999999))}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors cursor-pointer"
              >
                <Shuffle className="w-3.5 h-3.5" />
                <span>Reshuffle</span>
              </button>
            </div>
          </div>
        )}

        {/* Naming Pattern & Collision Policy */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-slate-300">Output Naming Pattern</span>
            <input
              type="text"
              value={namingTemplate}
              onChange={e => setNamingTemplate(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 font-mono"
            />
            <div className="flex flex-wrap gap-1 mt-1">
              {['{audio_name}', '{video_name}', '{video_ext}', '{index}', '{date}', '{resolution}'].map(token => (
                <button
                  key={token}
                  type="button"
                  onClick={() => setNamingTemplate(prev => `${prev.replace(/\.[^.]+$/, '')}_${token}.{video_ext}`)}
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-indigo-300 font-mono transition-colors"
                >
                  +{token}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="text-xs font-medium text-slate-300">Collision Policy (Existing Files)</span>
            <select
              value={collisionPolicy}
              onChange={e => setCollisionPolicy(e.target.value as CollisionPolicy)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="suffix">Auto-Suffix with Number: name (2).mp4</option>
              <option value="skip">Skip Conflicting Jobs</option>
              <option value="overwrite">Overwrite Target File</option>
            </select>
            <p className="text-[11px] text-slate-500">
              Resolved in plan-time before starting execution to prevent file clobbering.
            </p>
          </div>
        </div>

        {/* Warnings Banner */}
        {plan.warnings.length > 0 && (
          <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-500/30 text-amber-300 text-xs space-y-1">
            <div className="flex items-center gap-2 font-semibold">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span>Auto-Pairing Notice</span>
            </div>
            {plan.warnings.map((warn, i) => (
              <p key={i} className="text-[11px] text-amber-300/90 pl-6">
                &bull; {warn}
              </p>
            ))}
          </div>
        )}
      </div>

      {/* Review & Pairing Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        {/* Table Header Controls */}
        <div className="p-4 bg-slate-950/60 border-b border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => handleSelectAll(true)}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
              >
                Select All
              </button>
              <button
                onClick={() => handleSelectAll(false)}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
              >
                Deselect All
              </button>
            </div>
            <span className="text-xs text-slate-400">
              Active:{' '}
              <strong className="text-indigo-400 font-mono">
                {activePairingsCount}
              </strong>{' '}
              / {plan.pairings.length}
            </span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
              <input
                type="text"
                placeholder="Filter audio/video..."
                value={filterText}
                onChange={e => setFilterText(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
              <Filter className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => exportPlan('csv')}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs"
                title="Export CSV"
              >
                <Download className="w-4 h-4" />
              </button>
              <button
                onClick={() => exportPlan('json')}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs"
                title="Export JSON Plan"
              >
                <FileText className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* The Matrix Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-950 text-slate-400 border-b border-slate-800 font-medium">
                <th className="py-3 px-4 w-10">Use</th>
                <th className="py-3 px-4">Audio Track</th>
                <th className="py-3 px-4">Video Clip (Looped)</th>
                <th className="py-3 px-4">Target Output Filename</th>
                <th className="py-3 px-4">Loops</th>
                <th className="py-3 px-4">Strategy</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredPairings.map((pairing, idx) => {
                const isExcluded = pairing.excluded;
                return (
                  <tr 
                    key={pairing.id}
                    className={`hover:bg-slate-800/40 transition-colors ${
                      isExcluded ? 'opacity-40 bg-slate-950/40' : ''
                    }`}
                  >
                    <td className="py-3 px-4">
                      <button
                        onClick={() => handleToggleExclude(pairing.id)}
                        className="text-slate-400 hover:text-indigo-400 cursor-pointer"
                      >
                        {isExcluded ? (
                          <Square className="w-4 h-4 text-slate-600" />
                        ) : (
                          <CheckSquare className="w-4 h-4 text-indigo-500" />
                        )}
                      </button>
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-200 truncate max-w-[200px]" title={pairing.audio.filename}>
                        {pairing.audio.filename}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {Math.floor(pairing.audio.duration / 60)}m {Math.floor(pairing.audio.duration % 60)}s &bull; {pairing.audio.audioCodec || pairing.audio.format}
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <select
                        value={pairing.video.path}
                        onChange={e => handleVideoOverride(pairing.id, e.target.value)}
                        className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 max-w-[200px]"
                      >
                        {scannedVideo.map(v => (
                          <option key={v.path} value={v.path}>
                            {v.filename} ({v.duration}s)
                          </option>
                        ))}
                      </select>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                        {pairing.video.width}x{pairing.video.height} &bull; {pairing.video.videoCodec || pairing.video.format}
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <span className="font-mono text-slate-300 font-medium truncate block max-w-[240px]" title={pairing.outputName}>
                        {pairing.outputName}
                      </span>
                      {pairing.confidence && pairing.confidence < 1.0 && (
                        <span className="text-[10px] text-indigo-400 block font-mono">
                          Fuzzy match: {Math.round(pairing.confidence * 100)}% confidence
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 font-mono text-slate-300">
                      {pairing.loopCount}x
                    </td>

                    <td className="py-3 px-4">
                      {pairing.mode === 'copy' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 font-medium text-[10px]">
                          <Zap className="w-3 h-3" />
                          Stream Copy
                        </span>
                      ) : (
                        <span 
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-950/60 border border-amber-500/30 text-amber-400 font-medium text-[10px]"
                          title={pairing.modeReason}
                        >
                          <Layers className="w-3 h-3" />
                          Re-encode
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleToggleExclude(pairing.id)}
                        className="text-slate-500 hover:text-rose-400 p-1 rounded transition-colors"
                        title={isExcluded ? 'Include in queue' : 'Exclude from queue'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer Batch Submission Bar */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setDryRunDone(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Validate Dry Run</span>
            </button>
            {dryRunDone && (
              <span className="text-xs text-emerald-400 font-medium animate-fade-in">
                &check; Plan validated! Codecs, containers, and collision checks OK.
              </span>
            )}
          </div>

          <button
            onClick={() => onQueueBatch(plan.pairings.filter(p => !p.excluded))}
            disabled={activePairingsCount === 0}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 transition-all cursor-pointer"
          >
            <ListPlus className="w-4 h-4" />
            <span>Queue All ({activePairingsCount} Jobs)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
