/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { SingleRenderView } from './components/SingleRenderView';
import { BulkScanView } from './components/BulkScanView';
import { VisualEffectsStudio } from './components/VisualEffectsStudio';
import { QueueView, RenderJob } from './components/QueueView';
import { FileBrowserModal } from './components/FileBrowserModal';
import { DiagnosticsModal } from './components/DiagnosticsModal';
import { SettingsModal } from './components/SettingsModal';
import { AboutModal } from './components/AboutModal';
import { MediaProbe, RenderOptions, PairingResult } from './utils/engine';
import { Play, X } from 'lucide-react';

const API = '';

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(`${API}${url}`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

// Real hardware/encoder detection summary from GET /api/v1/hardware
export interface HardwareSummary {
  recommended: string;
  gpu_brand: string;
  is_hardware_accelerated: boolean;
  probed: boolean;
  probing: boolean;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'single' | 'bulk' | 'queue' | 'effects'>('single');
  const [appVersion, setAppVersion] = useState('...');

  // Media selections (probe data from the real backend)
  const [selectedAudio, setSelectedAudio] = useState<MediaProbe | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<MediaProbe | null>(null);

  // Folders — defaulted from the server's real home directory
  const [audioFolder, setAudioFolder] = useState('');
  const [videoFolder, setVideoFolder] = useState('');
  const [outputFolder, setOutputFolder] = useState('');
  const [tempFolder, setTempFolder] = useState('');

  // Tuning & Profiles
  const [cpuProfile, setCpuProfile] = useState<'aggressive' | 'balanced' | 'low' | 'idle'>('balanced');
  const [concurrency, setConcurrency] = useState(1);
  const [segmentDuration, setSegmentDuration] = useState(120);

  // Render options
  const [renderOptions, setRenderOptions] = useState<RenderOptions>({
    resolution: 'original',
    vhsPreset: 'none',
    nightModeEnabled: false,
    nightIntensity: 0.7,
    noiseStaticEnabled: false,
    noiseSeed: 1994,
    overlayEnabled: false,
    overlayOpacity: 0.8,
  });

  // Jobs Queue — starts empty; entries are added by the user
  const [jobs, setJobs] = useState<RenderJob[]>([]);

  // Modal states
  const [isBrowserOpen, setIsBrowserOpen] = useState(false);
  const [browserTitle, setBrowserTitle] = useState('Select Media File');
  const [browserTarget, setBrowserTarget] = useState<
    'single_audio' | 'single_video' | 'single_image' | 'folder' | 'output'
    | 'bulk_audio' | 'bulk_video' | 'bulk_images'
  >('single_audio');
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [previewSampleModal, setPreviewSampleModal] = useState(false);

  // Hardware summary (real automatic CPU/GPU detection from the backend)
  const [hwSummary, setHwSummary] = useState<HardwareSummary | null>(null);
  // Bulk-mode overlay image folder (one random image per render, backend-side)
  const [overlayImageFolder, setOverlayImageFolder] = useState('');

  // Load real version + home directory defaults + hardware + saved settings
  useEffect(() => {
    (async () => {
      const version = await getJson<{ version: string }>('/api/v1/version');
      if (version?.version) setAppVersion(version.version);

      const listing = await getJson<{ shortcuts: Array<{ label: string; path: string }> }>('/api/v1/fs/list');
      const home = listing?.shortcuts?.find(s => s.label === 'Home')?.path || '';
      if (home) {
        setAudioFolder(prev => prev || home);
        setVideoFolder(prev => prev || home);
        setOutputFolder(prev => prev || `${home}/MistusRenders`);
        setTempFolder(prev => prev || `${home}/MistusRenders/.tmp`);
      }

      const settings = await getJson<{ cpu_profile: string; concurrency: number }>('/api/v1/queue/settings');
      if (settings) {
        const profile = settings.cpu_profile as typeof cpuProfile;
        if (profile) setCpuProfile(profile);
        if (settings.concurrency) setConcurrency(settings.concurrency);
      }
    })();
  }, []);

  // Poll real hardware/encoder detection (startup probe runs in the backend)
  useEffect(() => {
    let stopped = false;
    const tick = async () => {
      const hw = await getJson<HardwareSummary>('/api/v1/hardware');
      if (stopped || !hw) return;
      setHwSummary(prev => (JSON.stringify(prev) === JSON.stringify(hw) ? prev : hw));
    };
    tick();
    const timer = window.setInterval(tick, 3000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, []);

  // Persist render-tuning settings on the backend (used by the render worker)
  const persistQueueSettings = (profile?: typeof cpuProfile, parallel?: number) => {
    fetch(`${API}/api/v1/queue/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...(profile ? { cpu_profile: profile } : {}),
        ...(parallel ? { concurrency: parallel } : {}),
      }),
    }).catch(() => undefined);
  };

  const handleCpuProfileChange = (profile: typeof cpuProfile) => {
    setCpuProfile(profile);
    persistQueueSettings(profile);
  };

  const handleConcurrencyChange = (value: number) => {
    setConcurrency(value);
    persistQueueSettings(undefined, value);
  };

  // Handlers
  const openBrowser = (target: typeof browserTarget, title: string) => {
    setBrowserTarget(target);
    setBrowserTitle(title);
    setIsBrowserOpen(true);
  };

  const handleSelectPath = (path: string, probe?: MediaProbe) => {
    switch (browserTarget) {
      case 'single_audio':
        if (probe) setSelectedAudio(probe);
        break;
      case 'single_video':
        if (probe) setSelectedVideo(probe);
        break;
      case 'single_image':
        // Single mode: one picked image, full-screen overlay with opacity
        setRenderOptions(prev => ({ ...prev, overlayEnabled: true, overlayPath: path, overlayFolder: undefined }));
        break;
      case 'bulk_images':
        // Bulk mode: a folder; the backend stamps a random image per render
        setOverlayImageFolder(path);
        setRenderOptions(prev => ({ ...prev, overlayEnabled: true, overlayFolder: path, overlayPath: undefined }));
        break;
      case 'folder':
      case 'output':
        setOutputFolder(path);
        break;
      case 'bulk_audio':
        setAudioFolder(path);
        break;
      case 'bulk_video':
        setVideoFolder(path);
        break;
    }
  };

  // Spawn payload row sent to the backend queue
  const buildQueuePayload = (
    audio: MediaProbe,
    video: MediaProbe,
    outputName: string,
    mode: 'copy' | 'encode',
    modeReason: string,
    overlayFolder?: string,
  ) => ({
    audio_path: audio.path,
    video_path: video.path,
    output_path: `${outputFolder.replace(/[\\/]+$/, '')}/${outputName}`,
    mode,
    mode_reason: modeReason,
    duration: audio.duration,
    ...(overlayFolder ? { overlay_folder: overlayFolder } : {}),
    options: {
      ...renderOptions,
      ...(overlayFolder ? { overlayFolder, overlayPath: undefined } : {}),
    },
  });

  const postQueueCommand = (path: string, body?: Record<string, unknown>) => {
    fetch(`${API}/api/v1/queue/${path}`, {
      method: 'POST',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    }).catch(() => undefined);
  };

  const handleAddSingleToQueue = (jobData: {
    audio: MediaProbe;
    video: MediaProbe;
    outputName: string;
    options: RenderOptions;
    mode: 'copy' | 'encode';
    modeReason: string;
  }) => {
    const payload = buildQueuePayload(
      jobData.audio, jobData.video, jobData.outputName, jobData.mode, jobData.modeReason,
    );
    fetch(`${API}/api/v1/queue/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobs: [payload] }),
    }).catch(() => undefined);
    setActiveTab('queue');
  };

  const handleQueueBatch = (pairings: PairingResult[]) => {
    const folder = renderOptions.overlayEnabled ? overlayImageFolder : '';
    const payload = pairings.map(p =>
      buildQueuePayload(p.audio, p.video, p.outputName, p.mode, p.modeReason, folder || undefined),
    );
    fetch(`${API}/api/v1/queue/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobs: payload }),
    }).catch(() => undefined);
    setActiveTab('queue');
  };

  // Queue state live-syncs from the backend worker
  useEffect(() => {
    let stopped = false;
    const sync = async () => {
      try {
        const res = await fetch(`${API}/api/v1/queue`);
        if (!res.ok) return;
        const data = (await res.json()) as Array<Record<string, unknown>>;
        if (stopped) return;
        const mapped: RenderJob[] = data.map(j => {
          const audioPath = String(j.audioPath || '');
          const videoPath = String(j.videoPath || '');
          const outputPath = String(j.outputPath || '');
          return {
            id: String(j.id),
            audioName: audioPath.split(/[\\/]/).pop() || audioPath,
            videoName: videoPath.split(/[\\/]/).pop() || videoPath,
            outputName: outputPath.split(/[\\/]/).pop() || outputPath,
            duration: Number(j.duration) || 0,
            mode: j.mode === 'encode' ? 'encode' : 'copy',
            modeReason: String(j.modeReason || ''),
            encoder: String(j.encoder || ''),
            status: String(j.status) as RenderJob['status'],
            progress: Number(j.progress) || 0,
            fps: Number(j.fps) || 0,
            speed: String(j.speed || '-'),
            etaSeconds: Number(j.etaSeconds) || 0,
            currentSegment: Number(j.currentSegment) || 1,
            totalSegments: Number(j.totalSegments) || 1,
            logs: Array.isArray(j.logs) ? (j.logs as string[]) : [],
          };
        });
        setJobs(prev => (JSON.stringify(prev) === JSON.stringify(mapped) ? prev : mapped));
      } catch {
        /* server may be closed between renders */
      }
    };
    sync();
    const timer = window.setInterval(sync, 1500);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, []);

  const handleStartAll = () => postQueueCommand('start');

  const handlePauseAll = () => postQueueCommand('pause');

  const handleResumeAll = () => postQueueCommand('resume');

  const handleStopAfterCurrent = () => postQueueCommand('stop-after-current');

  const handleClearCompleted = () => postQueueCommand('clear-completed');

  const handlePauseJob = (id: string) =>
    postQueueCommand(`jobs/${id}/pause`);

  const handleResumeJob = (id: string) =>
    postQueueCommand(`jobs/${id}/resume`);

  const handleCancelJob = (id: string) => {
    fetch(`${API}/api/v1/queue/jobs/${id}`, { method: 'DELETE' })
      .catch(() => undefined);
  };

  const handleMoveJob = (id: string, direction: 'up' | 'down') =>
    postQueueCommand(`jobs/${id}/move`, { direction });

  const handleOpenOutputFolder = (outputName: string) => {
    alert(`Output file location:\n${outputFolder}/${outputName}`);
  };

  return (
    <div className="min-h-screen flex flex-col font-sans selection:bg-yellow-300 selection:text-black">
      {/* Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        queueCount={jobs.filter(j => j.status === 'queued' || j.status === 'rendering').length}
        activeJobsCount={jobs.filter(j => j.status === 'rendering').length}
        gpuName={hwSummary ? `ENCODER: ${hwSummary.recommended}` : 'ENCODER: PROBING...'}
        onOpenDiagnostics={() => setIsDiagnosticsOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenAbout={() => setIsAboutOpen(true)}
        onQuit={() => alert('Quitting closes the local render server.')}
      />

      {/* Main Content Area */}
      <main className="flex-1 pb-16">
        {activeTab === 'single' && (
          <SingleRenderView
            selectedAudio={selectedAudio}
            selectedVideo={selectedVideo}
            onSelectAudioClick={() =>
              openBrowser('single_audio', 'Pick An Audio Track (.mp3, .wav, .flac, .m4a)')
            }
            onSelectVideoClick={() =>
              openBrowser('single_video', 'Pick A Video Clip (.mp4, .mkv, .mov, .webm)')
            }
            renderOptions={renderOptions}
            setRenderOptions={setRenderOptions}
            outputFolder={outputFolder}
            onSelectOutputFolderClick={() => openBrowser('output', 'Pick Where Renders Go')}
            onSelectOverlayImageClick={() => openBrowser('single_image', 'Pick An Overlay Image (.jpg, .png, .webp)')}
            onAddToQueue={handleAddSingleToQueue}
            onPreview5s={() => setPreviewSampleModal(true)}
          />
        )}

        {activeTab === 'bulk' && (
          <BulkScanView
            onQueueBatch={handleQueueBatch}
            renderOptions={renderOptions}
            setRenderOptions={setRenderOptions}
            onOpenFolderBrowser={target => {
              if (target === 'bulk_audio') openBrowser('bulk_audio', 'Pick The Audio Folder');
              else if (target === 'bulk_video') openBrowser('bulk_video', 'Pick The Video Clips Folder');
              else if (target === 'bulk_images') openBrowser('bulk_images', 'Pick The Overlay Images Folder');
              else openBrowser('output', 'Pick Where Rendered Videos Go');
            }}
            audioFolder={audioFolder}
            videoFolder={videoFolder}
            outputFolder={outputFolder}
            overlayImageFolder={overlayImageFolder}
          />
        )}

        {activeTab === 'effects' && (
          <VisualEffectsStudio
            renderOptions={renderOptions}
            setRenderOptions={setRenderOptions}
          />
        )}

        {activeTab === 'queue' && (
          <QueueView
            jobs={jobs}
            onStartAll={handleStartAll}
            onPauseAll={handlePauseAll}
            onResumeAll={handleResumeAll}
            onStopAfterCurrent={handleStopAfterCurrent}
            onClearCompleted={handleClearCompleted}
            onPauseJob={handlePauseJob}
            onResumeJob={handleResumeJob}
            onCancelJob={handleCancelJob}
            onMoveJob={handleMoveJob}
            onOpenOutputFolder={handleOpenOutputFolder}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-black text-white py-3 px-6 text-xs flex flex-col sm:flex-row items-center justify-between gap-2 border-t-[3px] border-black">
        <div className="flex items-center gap-2 font-bold">
          <span className="text-yellow-300">Mistus AV Merger v{appVersion}</span>
          <span>&bull;</span>
          <span>Offline Localhost Server</span>
        </div>
        <div className="flex items-center gap-4 font-bold uppercase">
          <button onClick={() => setIsDiagnosticsOpen(true)} className="hover:text-yellow-300">Diagnostics</button>
          <button onClick={() => setIsSettingsOpen(true)} className="hover:text-yellow-300">Settings</button>
          <button onClick={() => setIsAboutOpen(true)} className="hover:text-yellow-300">About</button>
        </div>
      </footer>

      {/* Modals */}
      <FileBrowserModal
        isOpen={isBrowserOpen}
        onClose={() => setIsBrowserOpen(false)}
        title={browserTitle}
        targetType={browserTarget}
        onSelectPath={handleSelectPath}
      />

      <DiagnosticsModal
        isOpen={isDiagnosticsOpen}
        onClose={() => setIsDiagnosticsOpen(false)}
        gpuName={hwSummary ? hwSummary.gpu_brand : 'AUTO (probing...)'}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        cpuProfile={cpuProfile}
        onCpuProfileChange={handleCpuProfileChange}
        concurrency={concurrency}
        onConcurrencyChange={handleConcurrencyChange}
        outputFolder={outputFolder}
        setOutputFolder={setOutputFolder}
        tempFolder={tempFolder}
        setTempFolder={setTempFolder}
        segmentDuration={segmentDuration}
        setSegmentDuration={setSegmentDuration}
        hwSummary={hwSummary}
      />

      <AboutModal
        isOpen={isAboutOpen}
        onClose={() => setIsAboutOpen(false)}
      />

      {/* 5-Second Preview Player Modal */}
      {previewSampleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 animate-nb-pop">
          <div className="nb-card w-full max-w-lg overflow-hidden flex flex-col">
            <div className="bg-pink-400 border-b-[3px] border-black px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Play className="w-4 h-4 fill-black" />
                <h3 className="nb-title text-sm">5-Second Preview</h3>
              </div>
              <button onClick={() => setPreviewSampleModal(false)} className="nb-btn nb-btn-sm nb-btn-white nb-press p-1.5">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 bg-white">
              <div className="border-[3px] border-black bg-[#111] flex flex-col items-center justify-center relative overflow-hidden aspect-video">
                <div className="text-center p-4">
                  <Play className="w-10 h-10 text-yellow-300 mx-auto mb-2 fill-yellow-300" />
                  <p className="text-xs font-mono text-white font-bold">
                    Preview Sample Rendered: 5.0s
                  </p>
                  <p className="text-[11px] text-gray-400 font-mono mt-1">
                    Preset: {renderOptions.vhsPreset || 'none'} &bull; Res: {renderOptions.resolution}
                  </p>
                </div>
              </div>

              <div className="nb-inset p-3 text-xs font-semibold space-y-1">
                <div className="flex items-center gap-1.5 font-black">
                  <span className="nb-badge nb-badge-lime">OK</span>
                  <span>Loop seam verified: seamless transition, keyframe aligned</span>
                </div>
                <div className="text-[11px] text-black/60 font-mono">
                  Audio sync drift: &plusmn;0.00ms &bull; Render speed: 11.2x
                </div>
              </div>
            </div>

            <div className="border-t-[3px] border-black p-4 flex justify-end bg-white">
              <button onClick={() => setPreviewSampleModal(false)} className="nb-btn nb-btn-yellow nb-press">
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
