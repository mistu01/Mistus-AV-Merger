/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  FolderSearch,
  Layers,
  Shuffle,
  AlertTriangle,
  Download,
  ListPlus,
  RefreshCw,
  Zap,
  Sliders,
  CheckSquare,
  Square,
  Film,
  ChevronDown,
  Loader2,
  Image as ImageIcon,
} from 'lucide-react';
import {
  MediaProbe,
  PairingMode,
  CollisionPolicy,
  RenderOptions,
  autoPair,
  resolveCollisions,
  PairingResult,
} from '../utils/engine';

interface BulkScanViewProps {
  onQueueBatch: (pairings: PairingResult[]) => void;
  renderOptions: RenderOptions;
  setRenderOptions: React.Dispatch<React.SetStateAction<RenderOptions>>;
  onOpenFolderBrowser: (target: 'bulk_audio' | 'bulk_video' | 'bulk_images' | 'output') => void;
  audioFolder: string;
  videoFolder: string;
  outputFolder: string;
  overlayImageFolder: string;
}

const API = '';

async function scanFolder(folderPath: string, recursive: boolean): Promise<{
  audio: MediaProbe[];
  video: MediaProbe[];
}> {
  const res = await fetch(`${API}/api/v1/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ folder_path: folderPath, recursive }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail || `Scan failed (${res.status})`);
  }
  return res.json();
}

const MODE_INFO: Partial<Record<PairingMode, string>> = {
  order_1_to_1: 'Each audio track is assigned one video clip (in order). The clip loops for the whole audio.',
  match_name: 'Matches clip to audio by name (exact then fuzzy).',
  one_for_all: 'One single clip loops across every audio track.',
  cycle: 'Rotates through the clips round-robin.',
  random_seeded: 'Reproducible random assignment.',
  manual: '1:1 order; change clips per row below.',
};

export const BulkScanView: React.FC<BulkScanViewProps> = ({
  onQueueBatch,
  renderOptions,
  setRenderOptions,
  onOpenFolderBrowser,
  audioFolder,
  videoFolder,
  outputFolder,
  overlayImageFolder,
}) => {
  const [sameFolder, setSameFolder] = useState(false);
  const [recursive, setRecursive] = useState(false);
  const [pairingMode, setPairingMode] = useState<PairingMode>('order_1_to_1');
  const [namingTemplate, setNamingTemplate] = useState('{audio_name}.{video_ext}');
  const [collisionPolicy, setCollisionPolicy] = useState<CollisionPolicy>('suffix');
  const [fuzzyConfidenceThreshold, setFuzzyConfidenceThreshold] = useState(0.65);
  const [randomSeed, setRandomSeed] = useState(42);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [scannedAudio, setScannedAudio] = useState<MediaProbe[]>([]);
  const [scannedVideo, setScannedVideo] = useState<MediaProbe[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  const [singleVideoId, setSingleVideoId] = useState<string>('');
  const [manualExclusions, setManualExclusions] = useState<Record<string, boolean>>({});
  const [manualVideoOverrides, setManualVideoOverrides] = useState<Record<string, string>>({});

  const handleScan = async () => {
    setIsScanning(true);
    setScanError(null);
    setManualExclusions({});
    setManualVideoOverrides({});
    try {
      if (sameFolder && audioFolder) {
        const result = await scanFolder(audioFolder, recursive);
        setScannedAudio(result.audio);
        setScannedVideo(result.video);
      } else {
        const jobs: Array<Promise<{ folder: string; result: { audio: MediaProbe[]; video: MediaProbe[] } }>> = [];
        if (audioFolder) {
          jobs.push(scanFolder(audioFolder, recursive).then(r => ({ folder: 'audio', result: r })));
        }
        if (videoFolder && !sameFolder && videoFolder !== audioFolder) {
          jobs.push(scanFolder(videoFolder, recursive).then(r => ({ folder: 'video', result: r })));
        }
        const results = await Promise.all(jobs);
        let audio: MediaProbe[] = [];
        let video: MediaProbe[] = [];
        for (const { folder, result } of results) {
          if (folder === 'audio') audio = [...audio, ...result.audio];
          else video = [...video, ...result.video];
        }
        setScannedAudio(audio);
        setScannedVideo(video);
      }
      setSingleVideoId('');
    } catch (e: any) {
      setScanError(e.message || 'Scan failed');
      setScannedAudio([]);
      setScannedVideo([]);
    } finally {
      setIsScanning(false);
    }
  };

  // Generate pairing plan (client engine, same logic used by tests)
  const plan = useMemo(() => {
    const rawPlan = autoPair(scannedAudio, scannedVideo, pairingMode, {
      singleVideoId: singleVideoId || undefined,
      namingTemplate,
      seed: randomSeed,
      fuzzyConfidenceThreshold,
      renderOptions,
    });

    const modifiedPairings = rawPlan.pairings.map(p => {
      const isExcluded = manualExclusions[p.id] ?? p.excluded;
      const overrideVideoPath = manualVideoOverrides[p.id];
      let currentVideo = p.video;
      if (overrideVideoPath) {
        const found = scannedVideo.find(v => v.path === overrideVideoPath);
        if (found) currentVideo = found;
      }
      return { ...p, video: currentVideo, excluded: isExcluded };
    });

    const resolved = resolveCollisions(modifiedPairings, collisionPolicy);
    return { ...rawPlan, pairings: resolved };
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
    collisionPolicy,
  ]);

  const activePairingsCount = plan.pairings.filter(p => !p.excluded).length;

  const handleToggleExclude = (id: string) =>
    setManualExclusions(prev => ({ ...prev, [id]: !prev[id] }));

  const handleSelectAll = (select: boolean) => {
    const updates: Record<string, boolean> = {};
    plan.pairings.forEach(p => { updates[p.id] = !select; });
    setManualExclusions(updates);
  };

  const exportPlan = (format: 'json' | 'csv') => {
    if (format === 'json') {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(plan, null, 2));
      const a = document.createElement('a');
      a.setAttribute("href", dataStr);
      a.setAttribute("download", `mistus_pairing_plan_${Date.now()}.json`);
      a.click();
    } else {
      const headers = "Audio,Duration,Video,Resolution,OutputName,Mode,Loops\n";
      const rows = plan.pairings
        .map(p => `"${p.audio.filename}",${p.audio.duration.toFixed(1)},"${p.video.filename}","${p.video.width}x${p.video.height}","${p.outputName}","${p.mode}",${p.loopCount}`)
        .join("\n");
      const dataStr = "data:text/csv;charset=utf-8," + encodeURIComponent(headers + rows);
      const a = document.createElement('a');
      a.setAttribute("href", dataStr);
      a.setAttribute("download", `mistus_pairing_plan_${Date.now()}.csv`);
      a.click();
    }
  };

  const totalAudioSeconds = scannedAudio.reduce((acc, a) => acc + a.duration, 0);
  const fmtTime = (s: number) => `${Math.floor(s / 60)}m ${Math.floor(s % 60)}s`;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* STEP 1 — Folders */}
      <div className="nb-card p-6 space-y-5">
        <div className="nb-stripe h-2 w-24" />
        <h3 className="nb-title text-xl">Step 1 &mdash; Point At Your Folders</h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <span className="nb-label">Audio Folder</span>
            <div className="flex gap-2">
              <input type="text" readOnly value={audioFolder} className="nb-input nb-input-readonly w-full text-[11px]" />
              <button onClick={() => onOpenFolderBrowser('bulk_audio')} className="nb-btn nb-btn-cyan nb-press shrink-0">
                Browse
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="nb-label">Video Clips Folder</span>
            <div className="flex gap-2">
              {!sameFolder ? (
                <>
                  <input type="text" readOnly value={videoFolder} className="nb-input nb-input-readonly w-full text-[11px]" />
                  <button onClick={() => onOpenFolderBrowser('bulk_video')} className="nb-btn nb-btn-purple nb-press shrink-0">
                    Browse
                  </button>
                </>
              ) : (
                <div className="nb-inset w-full px-3 py-2 text-[11px] font-bold">
                  Video auto-detected inside the audio folder
                </div>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="nb-label">Rendered Videos Go To</span>
            <div className="flex gap-2">
              <input type="text" readOnly value={outputFolder} className="nb-input nb-input-readonly w-full text-[11px]" />
              <button onClick={() => onOpenFolderBrowser('output')} className="nb-btn nb-btn-lime nb-press shrink-0">
                Browse
              </button>
            </div>
          </div>
        </div>

        {/* Overlay image folder (optional, random pick per render) */}
        <div className="border-[3px] border-black p-4 space-y-3 bg-[#f4efe7]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-bold">
              <input
                type="checkbox"
                className="nb-check"
                checked={!!renderOptions.overlayEnabled}
                onChange={e => setRenderOptions(prev => ({ ...prev, overlayEnabled: e.target.checked }))}
              />
              <ImageIcon className="w-4 h-4" />
              <span className="font-black uppercase">Image Overlay — Random From Folder</span>
            </label>
            <button
              onClick={() => onOpenFolderBrowser('bulk_images')}
              disabled={!renderOptions.overlayEnabled}
              className="nb-btn nb-btn-sm nb-btn-cyan nb-press disabled:opacity-40"
            >
              <ImageIcon className="w-3.5 h-3.5" />
              {overlayImageFolder ? 'Change Folder' : 'Pick Image Folder'}
            </button>
          </div>
          {renderOptions.overlayEnabled && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-nb-pop">
              <div>
                <span className="nb-label">Overlay Images Folder</span>
                {overlayImageFolder ? (
                  <div className="nb-inset w-full px-3 py-2 text-[11px] font-mono font-bold truncate" title={overlayImageFolder}>
                    <ImageIcon className="w-3.5 h-3.5 inline mr-1" /> {overlayImageFolder.split(/[\\/]/).pop() || overlayImageFolder}
                  </div>
                ) : (
                  <div className="border-[3px] border-dashed border-black/40 bg-white px-3 py-2 text-[11px] font-bold text-black/50">
                    No folder picked — one random image from it stamps each render.
                  </div>
                )}
                <p className="text-[10px] font-semibold text-black/50 mt-1">
                  JPG, PNG, WEBP, BMP, GIF &bull; picked randomly, per render, on the server.
                </p>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between font-bold">
                  <span className="nb-label">Overlay Opacity</span>
                  <span className="font-mono border-2 border-black bg-cyan-300 px-1">
                    {Math.round((renderOptions.overlayOpacity ?? 0.8) * 100)}%
                  </span>
                </div>
                <input
                  type="range" min="5" max="100" step="5"
                  value={Math.round((renderOptions.overlayOpacity ?? 0.8) * 100)}
                  onChange={e => setRenderOptions(prev => ({ ...prev, overlayOpacity: parseInt(e.target.value, 10) / 100 }))}
                  className="nb-range w-full"
                />
                <p className="nb-sub">Stretched over the whole video frame, blended at this opacity.</p>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 flex-wrap">
          <label className="flex items-center gap-2 cursor-pointer text-xs font-bold">
            <input type="checkbox" className="nb-check" checked={sameFolder} onChange={e => setSameFolder(e.target.checked)} />
            <span>&ldquo;Audio &amp; video in the same folder&rdquo;</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-xs font-bold">
            <input type="checkbox" className="nb-check" checked={recursive} onChange={e => setRecursive(e.target.checked)} />
            <span>Include subfolders</span>
          </label>

          <button onClick={handleScan} disabled={isScanning || (!audioFolder && !videoFolder)} className="nb-btn nb-btn-yellow nb-btn-lg nb-press ml-auto">
            {isScanning
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <RefreshCw className="w-4 h-4" />}
            <span>{isScanning ? 'Scanning & Probing...' : 'Scan Folders'}</span>
          </button>
        </div>

        {scanError && (
          <div className="p-3 border-[3px] border-black bg-red-300 text-xs font-bold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            <span>{scanError}</span>
          </div>
        )}

        {(scannedAudio.length > 0 || scannedVideo.length > 0) && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="nb-badge nb-badge-cyan">{scannedAudio.length} audio</span>
            <span className="nb-badge nb-badge-purple">{scannedVideo.length} video</span>
            {scannedVideo.length > 0 && (
              <span className="nb-badge">auto-pair: {pairingMode === 'order_1_to_1' ? '1 clip per audio' : pairingMode}</span>
            )}
            <span className="nb-badge nb-badge-yellow">total runtime {fmtTime(totalAudioSeconds)}</span>
          </div>
        )}
      </div>

      {/* STEP 2 — Auto-pair (simple by default) */}
      <div className="nb-card p-6 space-y-5">
        <div className="nb-stripe h-2 w-24" />
        <h3 className="nb-title text-xl">Step 2 &mdash; Auto Pair</h3>

        {/* Simple summary of the current mode */}
        <div className="p-4 bg-yellow-200 border-[3px] border-black shadow-[4px_4px_0_#000]">
          <div className="flex items-start gap-3">
            <Layers className="w-6 h-6 shrink-0" />
            <div>
              <p className="text-sm font-black uppercase">
                {pairingMode === 'order_1_to_1'
                  ? '1 clip for every audio track'
                  : MODE_INFO[pairingMode] || pairingMode}
              </p>
              <p className="text-xs font-semibold mt-0.5">
                {pairingMode === 'order_1_to_1'
                  ? 'Each clip repeats (loops) over and over until its audio finishes. That\'s it — press "Queue All" below.'
                  : MODE_INFO[pairingMode]}
              </p>
            </div>
          </div>
        </div>

        {/* Advanced rules collapsible */}
        <button
          onClick={() => setShowAdvanced(prev => !prev)}
          className="nb-btn nb-btn-white nb-press w-full justify-between"
        >
          <span className="flex items-center gap-2">
            <Sliders className="w-4 h-4" /> Advanced pairing rules {!showAdvanced && '(change how clips are matched)'}
          </span>
          <ChevronDown className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
        </button>

        {showAdvanced && (
          <div className="space-y-4 animate-nb-pop">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {([
                { id: 'order_1_to_1', label: '1 - 1 (Simple)', desc: 'One clip per audio' },
                { id: 'match_name', label: 'By Name', desc: 'Exact + fuzzy name' },
                { id: 'one_for_all', label: 'One for All', desc: 'Use a single clip' },
                { id: 'cycle', label: 'Cycle', desc: 'Rotate clips' },
                { id: 'random_seeded', label: 'Random', desc: 'Seeded shuffle' },
                { id: 'manual', label: 'Manual', desc: 'Set per row below' },
              ] as Array<{ id: PairingMode; label: string; desc: string }>).map(m => (
                <button
                  key={m.id}
                  onClick={() => setPairingMode(m.id)}
                  className={`nb-card-flat p-3 text-left nb-press ${pairingMode === m.id ? 'bg-yellow-300' : 'bg-white hover:bg-lime-100'}`}
                >
                  <div className="text-xs font-black">{m.label}</div>
                  <div className="text-[10px] font-semibold text-black/60 mt-1">{m.desc}</div>
                </button>
              ))}
            </div>

            {pairingMode === 'match_name' && (
              <div className="nb-card-flat p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <span className="nb-label">Match Sensitivity</span>
                  <p className="nb-sub">Ignores track numbers ("01 - "), spaces, underscores, minor variations.</p>
                </div>
                <div className="flex items-center gap-3">
                  <input type="range" min="0.4" max="0.95" step="0.05" value={fuzzyConfidenceThreshold}
                    onChange={e => setFuzzyConfidenceThreshold(parseFloat(e.target.value))} className="nb-range w-36" />
                  <span className="text-xs font-mono font-black w-12 text-right bg-cyan-300 border-2 border-black px-1">
                    {Math.round(fuzzyConfidenceThreshold * 100)}%
                  </span>
                </div>
              </div>
            )}

            {pairingMode === 'one_for_all' && (
              <div className="nb-card-flat p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <span className="nb-label">The One Clip</span>
                  <p className="nb-sub">This single clip loops across all audio tracks.</p>
                </div>
                <select
                  value={singleVideoId || scannedVideo[0]?.path || ''}
                  onChange={e => setSingleVideoId(e.target.value)}
                  className="nb-select max-w-xs"
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
              <div className="nb-card-flat p-4 flex items-center justify-between gap-4">
                <div>
                  <span className="nb-label">Seed</span>
                  <p className="nb-sub">Same seed = same shuffle every run.</p>
                </div>
                <div className="flex items-center gap-2">
                  <input type="number" value={randomSeed} onChange={e => setRandomSeed(parseInt(e.target.value, 10) || 0)}
                    className="nb-input w-24 font-mono" />
                  <button onClick={() => setRandomSeed(Math.floor(Math.random() * 999999))}
                    className="nb-btn nb-btn-sm nb-btn-purple nb-press">
                    <Shuffle className="w-3.5 h-3.5" /> Reshuffle
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="space-y-1.5">
                <span className="nb-label">Output File Name Pattern</span>
                <input type="text" value={namingTemplate} onChange={e => setNamingTemplate(e.target.value)}
                  className={"nb-input w-full font-mono"} />
                <div className="flex flex-wrap gap-1 mt-1">
                  {['{audio_name}', '{video_name}', '{video_ext}', '{index}', '{date}', '{resolution}'].map(token => (
                    <button key={token} type="button"
                      onClick={() => setNamingTemplate(prev => `${prev.replace(/\.[^.]+$/, '')}_${token}.{video_ext}`)}
                      className="nb-badge nb-badge-cyan hover:bg-cyan-200">
                      +{token}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="nb-label">If The Output File Already Exists</span>
                <select value={collisionPolicy} onChange={e => setCollisionPolicy(e.target.value as CollisionPolicy)} className="nb-select w-full">
                  <option value="suffix">Rename: name (2).mp4</option>
                  <option value="skip">Skip that job</option>
                  <option value="overwrite">Overwrite the old file</option>
                </select>
                <p className="nb-sub">Decided before the queue starts so nothing is clobbered by accident.</p>
              </div>
            </div>
          </div>
        )}

        {/* Warnings */}
        {plan.warnings.length > 0 && (
          <div className="p-4 bg-yellow-200 border-[3px] border-black">
            <div className="flex items-center gap-2 font-black text-xs uppercase">
              <AlertTriangle className="w-4 h-4" /> Heads up
            </div>
            {plan.warnings.map((warn, i) => (
              <p key={i} className="text-[11px] font-semibold pl-6">&bull; {warn}</p>
            ))}
          </div>
        )}
      </div>

      {/* STEP 3 — Pairing table */}
      <div className="nb-card overflow-hidden">
        <div className="bg-pink-400 border-b-[3px] border-black p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Film className="w-5 h-5" />
            <h3 className="nb-title text-lg">Step 3 &mdash; Check The Pairs</h3>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => handleSelectAll(true)} className="nb-btn nb-btn-sm nb-btn-white nb-press">Check All</button>
            <button onClick={() => handleSelectAll(false)} className="nb-btn nb-btn-sm nb-btn-white nb-press">Uncheck All</button>
            <span className="nb-badge nb-badge-black">{activePairingsCount}/{plan.pairings.length} active</span>
          </div>
        </div>

        {plan.pairings.length === 0 ? (
          <div className="p-10 text-center bg-white">
            <FolderSearch className="w-10 h-10 mx-auto mb-2 text-black/30" />
            <p className="text-sm font-black">No pairs yet</p>
            <p className="nb-sub mt-1">Scan folders in Step 1 first — you'll see every audio-to-clip pair here before anything renders.</p>
          </div>
        ) : (
          <div className="overflow-x-auto bg-white">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-black text-white uppercase text-[10px] tracking-wider">
                  <th className="py-2.5 px-4 w-12">Go</th>
                  <th className="py-2.5 px-4">Audio Track</th>
                  <th className="py-2.5 px-4">Video Clip (loops)</th>
                  <th className="py-2.5 px-4">Output File</th>
                  <th className="py-2.5 px-4">Loops</th>
                  <th className="py-2.5 px-4">Speed</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-black/10">
                {plan.pairings.map(pairing => {
                  const isExcluded = pairing.excluded;
                  return (
                    <tr key={pairing.id} className={`transition-colors ${isExcluded ? 'opacity-40 bg-black/5' : 'hover:bg-yellow-50'}`}>
                      <td className="py-2.5 px-4">
                        <input type="checkbox" className="nb-check" checked={!isExcluded}
                          onChange={() => handleToggleExclude(pairing.id)} title={isExcluded ? 'Include this pair' : 'Exclude this pair'} />
                      </td>

                      <td className="py-2.5 px-4 max-w-[220px]">
                        <div className={`font-bold truncate ${isExcluded ? '' : ''}`} title={pairing.audio.filename}>
                          {pairing.audio.filename}
                        </div>
                        <div className="text-[10px] font-mono font-semibold text-black/50">
                          {Math.floor(pairing.audio.duration / 60)}m {Math.floor(pairing.audio.duration % 60)}s &bull; {pairing.audio.audioCodec || pairing.audio.format}
                        </div>
                      </td>

                      <td className="py-2.5 px-4 max-w-[220px]">
                        <select
                          value={pairing.video.path}
                          onChange={e => setManualVideoOverrides(prev => ({ ...prev, [pairing.id]: e.target.value }))}
                          className="nb-select py-1 text-[11px] max-w-[200px]"
                        >
                          {scannedVideo.map(v => (
                            <option key={v.path} value={v.path}>
                              {v.filename} ({v.duration}s)
                            </option>
                          ))}
                        </select>
                        <div className="text-[10px] font-mono font-semibold text-black/50 mt-0.5">
                          {pairing.video.width}x{pairing.video.height} &bull; {pairing.video.videoCodec || pairing.video.format}
                        </div>
                      </td>

                      <td className="py-2.5 px-4 max-w-[240px]">
                        <span className="font-mono font-bold truncate block" title={pairing.outputName}>
                          {pairing.outputName}
                        </span>
                        {pairing.confidence !== undefined && pairing.confidence < 1.0 && (
                          <span className="text-[10px] font-bold text-fuchsia-700 block font-mono">
                            name match {Math.round(pairing.confidence * 100)}%
                          </span>
                        )}
                      </td>

                      <td className="py-2.5 px-4 font-mono font-black">
                        {pairing.loopCount}x
                      </td>

                      <td className="py-2.5 px-4">
                        {pairing.mode === 'copy' ? (
                          <span className="nb-badge nb-badge-lime" title={pairing.modeReason}>
                            <Zap className="w-3 h-3" /> Fast copy
                          </span>
                        ) : (
                          <span className="nb-badge nb-badge-yellow" title={pairing.modeReason}>
                            <Layers className="w-3 h-3" /> Re-encode
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer bar */}
        <div className="bg-black text-white p-4 border-t-[3px] border-black flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button onClick={() => exportPlan('csv')} className="nb-btn nb-btn-sm nb-btn-white nb-press" title="Export CSV">
              <Download className="w-3.5 h-3.5" /> CSV
            </button>
            <button onClick={() => exportPlan('json')} className="nb-btn nb-btn-sm nb-btn-white nb-press" title="Export JSON plan">
              <Download className="w-3.5 h-3.5" /> JSON
            </button>
            <span className="text-[11px] font-bold hidden sm:inline">
              {activePairingsCount} pair{activePairingsCount === 1 ? '' : 's'} &rarr; {outputFolder}
            </span>
          </div>

          <button
            onClick={() => onQueueBatch(plan.pairings.filter(p => !p.excluded))}
            disabled={activePairingsCount === 0}
            className="nb-btn nb-btn-lg nb-btn-yellow nb-press w-full sm:w-auto"
          >
            <ListPlus className="w-4 h-4" />
            <span>Queue All ({activePairingsCount} Jobs)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
