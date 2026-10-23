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
import { MediaProbe, RenderOptions, PairingResult, planSegments } from './utils/engine';
import { SAMPLE_AUDIO_FILES, SAMPLE_VIDEO_CLIPS } from './data/mockMedia';
import { Play, X, CheckCircle2 } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'single' | 'bulk' | 'queue' | 'effects'>('single');

  // Media selections
  const [selectedAudio, setSelectedAudio] = useState<MediaProbe | null>(SAMPLE_AUDIO_FILES[0]);
  const [selectedVideo, setSelectedVideo] = useState<MediaProbe | null>(SAMPLE_VIDEO_CLIPS[0]);

  // Folders
  const [audioFolder, setAudioFolder] = useState('/media/audio');
  const [videoFolder, setVideoFolder] = useState('/media/video');
  const [outputFolder, setOutputFolder] = useState('/renders');
  const [tempFolder, setTempFolder] = useState('/tmp/mistus_segments');

  // Tuning & Profiles
  const [cpuProfile, setCpuProfile] = useState<'aggressive' | 'balanced' | 'low' | 'idle'>('balanced');
  const [concurrency, setConcurrency] = useState(1);
  const [segmentDuration, setSegmentDuration] = useState(120);

  // Render options
  const [renderOptions, setRenderOptions] = useState<RenderOptions>({
    resolution: 'original',
    vhsPreset: 'clean_vhs',
    nightModeEnabled: false,
    nightIntensity: 0.7,
    noiseStaticEnabled: false,
    noiseSeed: 1994,
    overlayEnabled: false,
    overlayOpacity: 0.8,
  });

  // Jobs Queue
  const [jobs, setJobs] = useState<RenderJob[]>([
    {
      id: 'demo_job_1',
      audioName: '01 - Midnight Neon Drive.mp3',
      videoName: 'midnight_neon_drive_loop.mp4',
      outputName: '01 - Midnight Neon Drive.mp4',
      duration: 218.4,
      mode: 'copy',
      modeReason: 'Stream copy (fast): Native stream looping without generation loss.',
      status: 'completed',
      progress: 100,
      fps: 120,
      speed: '8.4x',
      etaSeconds: 0,
      currentSegment: 2,
      totalSegments: 2,
      logs: [
        '[info] FFmpeg version 4.4.2-0ubuntu0.22.04.1 (GPL)',
        '[info] Probing /media/video/midnight_neon_drive_loop.mp4: h264 1920x1080 30fps',
        '[info] Probing /media/audio/01 - Midnight Neon Drive.mp3: mp3 44.1kHz 320kbps',
        '[info] Stream-copy loop enabled (-stream_loop -1). Output container: mp4',
        '[info] Segment 1/2 (0.0s - 120.0s) verified and written.',
        '[info] Segment 2/2 (120.0s - 218.4s) verified and written.',
        '[info] Final concat pass finished cleanly in 2.1s.',
      ],
    },
    {
      id: 'demo_job_2',
      audioName: '02 - Cyberpunk Rain Echoes.wav',
      videoName: 'cyberpunk_rain_echoes.mp4',
      outputName: '02 - Cyberpunk Rain Echoes.mp4',
      duration: 184.2,
      mode: 'encode',
      modeReason: 'Re-encode required: VHS effect preset "clean_vhs" active.',
      status: 'queued',
      progress: 0,
      fps: 0,
      speed: '-',
      etaSeconds: 45,
      currentSegment: 1,
      totalSegments: 2,
      logs: [
        '[info] Job queued. Hardware encoder NVENC selected.',
      ],
    },
  ]);

  // Modal states
  const [isBrowserOpen, setIsBrowserOpen] = useState(false);
  const [browserTitle, setBrowserTitle] = useState('Select Media File');
  const [browserTarget, setBrowserTarget] = useState<'single_audio' | 'single_video' | 'folder' | 'bulk_audio' | 'bulk_video'>('single_audio');
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [previewSampleModal, setPreviewSampleModal] = useState(false);

  // Background simulation ticker for active rendering jobs
  useEffect(() => {
    const interval = setInterval(() => {
      setJobs(prevJobs => {
        const renderingIndex = prevJobs.findIndex(j => j.status === 'rendering');
        if (renderingIndex === -1) return prevJobs;

        const job = prevJobs[renderingIndex];
        const nextProgress = Math.min(100, job.progress + (job.mode === 'copy' ? 12 : 5));
        const isDone = nextProgress >= 100;
        const currentSeg = Math.min(job.totalSegments, Math.floor((nextProgress / 100) * job.totalSegments) + 1);

        const updatedJob: RenderJob = {
          ...job,
          progress: nextProgress,
          currentSegment: isDone ? job.totalSegments : currentSeg,
          status: isDone ? 'completed' : 'rendering',
          fps: job.mode === 'copy' ? 140 : 58,
          speed: job.mode === 'copy' ? '7.5x' : '2.4x',
          etaSeconds: isDone ? 0 : Math.max(0, Math.round(((100 - nextProgress) / 5) * 1.5)),
          logs: isDone 
            ? [...job.logs, `[success] Render finished successfully. Output written to ${outputFolder}/${job.outputName}`]
            : [...job.logs, `[progress] frame=${Math.round(nextProgress * 25)} fps=${job.mode === 'copy' ? 140 : 58} q=-1.0 size=${Math.round(nextProgress * 420)}kB time=00:0${Math.floor(nextProgress/30)}:${Math.floor((nextProgress*2)%60)} bitrate=3200kbits/s speed=${job.mode === 'copy' ? '7.5x' : '2.4x'}`],
        };

        const newJobs = [...prevJobs];
        newJobs[renderingIndex] = updatedJob;

        // Auto-start next queued job if finished
        if (isDone) {
          const nextQueuedIdx = newJobs.findIndex(j => j.status === 'queued');
          if (nextQueuedIdx !== -1) {
            newJobs[nextQueuedIdx] = {
              ...newJobs[nextQueuedIdx],
              status: 'rendering',
              logs: [...newJobs[nextQueuedIdx].logs, '[info] Process launched with OS nice: 10 (Balanced profile)'],
            };
          }
        }

        return newJobs;
      });
    }, 700);

    return () => clearInterval(interval);
  }, [outputFolder]);

  // Handlers
  const handleOpenFolderBrowser = (target: 'bulk_audio' | 'bulk_video') => {
    setBrowserTarget(target);
    setBrowserTitle(target === 'bulk_audio' ? 'Select Audio Folder' : 'Select Video Folder');
    setIsBrowserOpen(true);
  };

  const handleSelectPath = (path: string, probe?: MediaProbe) => {
    if (browserTarget === 'single_audio' && probe) {
      setSelectedAudio(probe);
    } else if (browserTarget === 'single_video' && probe) {
      setSelectedVideo(probe);
    } else if (browserTarget === 'folder') {
      setOutputFolder(path);
    } else if (browserTarget === 'bulk_audio') {
      setAudioFolder(path);
    } else if (browserTarget === 'bulk_video') {
      setVideoFolder(path);
    }
  };

  const handleAddSingleToQueue = (jobData: {
    audio: MediaProbe;
    video: MediaProbe;
    outputName: string;
    options: RenderOptions;
    mode: 'copy' | 'encode';
    modeReason: string;
  }) => {
    const segments = planSegments(jobData.audio.duration, segmentDuration);
    const newJob: RenderJob = {
      id: `job_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      audioName: jobData.audio.filename,
      videoName: jobData.video.filename,
      outputName: jobData.outputName,
      duration: jobData.audio.duration,
      mode: jobData.mode,
      modeReason: jobData.modeReason,
      status: 'queued',
      progress: 0,
      fps: 0,
      speed: '-',
      etaSeconds: Math.round(jobData.audio.duration / 3),
      currentSegment: 1,
      totalSegments: Math.max(1, segments.length),
      logs: [
        `[info] Queued job for ${jobData.outputName}`,
        `[info] Mode: ${jobData.mode.toUpperCase()} - ${jobData.modeReason}`,
        `[info] Planned ${segments.length} segment(s) of max ${segmentDuration}s for crash-safe recovery.`,
      ],
    };
    setJobs(prev => [...prev, newJob]);
    setActiveTab('queue');
  };

  const handleQueueBatch = (pairings: PairingResult[]) => {
    const newJobs: RenderJob[] = pairings.map((p, idx) => {
      const segments = planSegments(p.audio.duration, segmentDuration);
      return {
        id: `batch_job_${Date.now()}_${idx}`,
        audioName: p.audio.filename,
        videoName: p.video.filename,
        outputName: p.outputName,
        duration: p.audio.duration,
        mode: p.mode,
        modeReason: p.modeReason,
        status: 'queued',
        progress: 0,
        fps: 0,
        speed: '-',
        etaSeconds: Math.round(p.audio.duration / 3),
        currentSegment: 1,
        totalSegments: Math.max(1, segments.length),
        logs: [
          `[info] Queued from bulk plan (${p.loopCount}x loops).`,
          `[info] Mode: ${p.mode.toUpperCase()} - ${p.modeReason}`,
        ],
      };
    });
    setJobs(prev => [...prev, ...newJobs]);
    setActiveTab('queue');
  };

  const handleStartAll = () => {
    setJobs(prev => {
      const firstQueued = prev.findIndex(j => j.status === 'queued');
      if (firstQueued === -1) return prev;
      return prev.map((j, i) => (i === firstQueued ? { ...j, status: 'rendering' } : j));
    });
  };

  const handlePauseAll = () => {
    setJobs(prev => prev.map(j => (j.status === 'rendering' ? { ...j, status: 'paused' } : j)));
  };

  const handleResumeAll = () => {
    setJobs(prev => prev.map(j => (j.status === 'paused' ? { ...j, status: 'rendering' } : j)));
  };

  const handleStopAfterCurrent = () => {
    // Current rendering finishes, next jobs stay queued
  };

  const handleClearCompleted = () => {
    setJobs(prev => prev.filter(j => j.status !== 'completed'));
  };

  const handlePauseJob = (id: string) => {
    setJobs(prev => prev.map(j => (j.id === id ? { ...j, status: 'paused' } : j)));
  };

  const handleResumeJob = (id: string) => {
    setJobs(prev => prev.map(j => (j.id === id ? { ...j, status: 'rendering' } : j)));
  };

  const handleCancelJob = (id: string) => {
    setJobs(prev => prev.filter(j => j.id !== id));
  };

  const handleMoveJob = (id: string, direction: 'up' | 'down') => {
    setJobs(prev => {
      const idx = prev.findIndex(j => j.id === id);
      if (idx === -1) return prev;
      const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= prev.length) return prev;
      const copy = [...prev];
      const temp = copy[idx];
      copy[idx] = copy[targetIdx];
      copy[targetIdx] = temp;
      return copy;
    });
  };

  const handleOpenOutputFolder = (outputName: string) => {
    alert(`Output file location:\n${outputFolder}/${outputName}`);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-600 selection:text-white">
      {/* Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        queueCount={jobs.filter(j => j.status === 'queued' || j.status === 'rendering').length}
        activeJobsCount={jobs.filter(j => j.status === 'rendering').length}
        gpuName="NVENC / CUDA"
        onOpenDiagnostics={() => setIsDiagnosticsOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenAbout={() => setIsAboutOpen(true)}
        onQuit={() => alert('Applet running inside Google AI Studio container. To quit native standalone binary, press Ctrl+C or run `kill`.')}
      />

      {/* Main Content Area */}
      <main className="flex-1 pb-16">
        {activeTab === 'single' && (
          <SingleRenderView
            selectedAudio={selectedAudio}
            selectedVideo={selectedVideo}
            onSelectAudioClick={() => {
              setBrowserTarget('single_audio');
              setBrowserTitle('Select Audio Track (.mp3, .wav, .flac, .m4a)');
              setIsBrowserOpen(true);
            }}
            onSelectVideoClick={() => {
              setBrowserTarget('single_video');
              setBrowserTitle('Select Video Clip (.mp4, .mkv, .mov, .webm)');
              setIsBrowserOpen(true);
            }}
            renderOptions={renderOptions}
            setRenderOptions={setRenderOptions}
            outputFolder={outputFolder}
            onSelectOutputFolderClick={() => {
              setBrowserTarget('folder');
              setBrowserTitle('Select Destination Output Folder');
              setIsBrowserOpen(true);
            }}
            onAddToQueue={handleAddSingleToQueue}
            onPreview5s={() => setPreviewSampleModal(true)}
          />
        )}

        {activeTab === 'bulk' && (
          <BulkScanView
            onQueueBatch={handleQueueBatch}
            renderOptions={renderOptions}
            onOpenFolderBrowser={handleOpenFolderBrowser}
            audioFolder={audioFolder}
            videoFolder={videoFolder}
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
      <footer className="bg-slate-950 border-t border-slate-900 py-4 px-6 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-400">Mistus AV Merger v0.5.0</span>
          <span>&bull;</span>
          <span>Version Code: 500</span>
          <span>&bull;</span>
          <span>Offline Localhost Server</span>
        </div>
        <div className="flex items-center gap-4 text-[11px]">
          <button onClick={() => setIsDiagnosticsOpen(true)} className="hover:text-slate-300">Diagnostics</button>
          <button onClick={() => setIsSettingsOpen(true)} className="hover:text-slate-300">Settings</button>
          <button onClick={() => setIsAboutOpen(true)} className="hover:text-slate-300">About</button>
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
        gpuName="NVENC / CUDA"
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        cpuProfile={cpuProfile}
        setCpuProfile={setCpuProfile}
        concurrency={concurrency}
        setConcurrency={setConcurrency}
        outputFolder={outputFolder}
        setOutputFolder={setOutputFolder}
        tempFolder={tempFolder}
        setTempFolder={setTempFolder}
        segmentDuration={segmentDuration}
        setSegmentDuration={setSegmentDuration}
      />

      <AboutModal
        isOpen={isAboutOpen}
        onClose={() => setIsAboutOpen(false)}
      />

      {/* 5-Second Preview Player Modal */}
      {previewSampleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Play className="w-4 h-4 text-indigo-400 fill-current" />
                <h3 className="font-semibold text-slate-100 text-sm">
                  5-Second Low-Res Sample Preview
                </h3>
              </div>
              <button
                onClick={() => setPreviewSampleModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="aspect-video bg-black rounded-xl border border-slate-800 flex flex-col items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-tr from-indigo-950/40 via-purple-950/20 to-cyan-950/40 animate-pulse" />
                <div className="relative text-center p-4">
                  <Play className="w-10 h-10 text-indigo-400 mx-auto mb-2 opacity-80" />
                  <p className="text-xs font-mono text-slate-300">
                    Preview Sample Rendered: 5.0s
                  </p>
                  <p className="text-[11px] text-slate-500 font-mono mt-1">
                    Preset: {renderOptions.vhsPreset || 'clean_vhs'} &bull; Res: {renderOptions.resolution}
                  </p>
                </div>
              </div>

              <div className="bg-slate-950 rounded-xl p-3 border border-slate-800/80 text-xs text-slate-300 space-y-1">
                <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Loop seam verified: Seamless transition, keyframe aligned</span>
                </div>
                <div className="text-[11px] text-slate-500 font-mono">
                  Audio sync drift: &plusmn;0.00ms &bull; Render speed: 11.2x
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setPreviewSampleModal(false)}
                className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow transition-colors"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
