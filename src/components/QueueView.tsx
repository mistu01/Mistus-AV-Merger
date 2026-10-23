/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Play,
  Pause,
  Trash2,
  FolderOpen,
  Terminal,
  CheckCircle2,
  AlertCircle,
  Clock,
  Zap,
  Layers,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';

export interface RenderJob {
  id: string;
  audioName: string;
  videoName: string;
  outputName: string;
  duration: number;
  mode: 'copy' | 'encode';
  modeReason: string;
  status: 'queued' | 'rendering' | 'paused' | 'completed' | 'failed';
  progress: number;
  fps: number;
  speed: string;
  etaSeconds: number;
  currentSegment: number;
  totalSegments: number;
  logs: string[];
}

interface QueueViewProps {
  jobs: RenderJob[];
  onStartAll: () => void;
  onPauseAll: () => void;
  onResumeAll: () => void;
  onStopAfterCurrent: () => void;
  onClearCompleted: () => void;
  onPauseJob: (id: string) => void;
  onResumeJob: (id: string) => void;
  onCancelJob: (id: string) => void;
  onMoveJob: (id: string, direction: 'up' | 'down') => void;
  onOpenOutputFolder: (outputName: string) => void;
}

const STATUS_STYLES: Record<RenderJob['status'], { badge: string; bar: string }> = {
  completed: { badge: 'nb-badge-lime', bar: 'bg-lime-300' },
  rendering: { badge: 'nb-badge-yellow', bar: 'bg-yellow-300' },
  paused: { badge: 'nb-badge-cyan', bar: 'bg-cyan-300' },
  failed: { badge: 'nb-badge-red', bar: 'bg-red-400' },
  queued: { badge: 'nb-badge-black', bar: 'bg-gray-300' },
};

export const QueueView: React.FC<QueueViewProps> = ({
  jobs,
  onStartAll,
  onPauseAll,
  onResumeAll,
  onStopAfterCurrent,
  onClearCompleted,
  onPauseJob,
  onResumeJob,
  onCancelJob,
  onMoveJob,
  onOpenOutputFolder,
}) => {
  const [selectedJobLogsId, setSelectedJobLogsId] = useState<string | null>(null);

  const completedCount = jobs.filter(j => j.status === 'completed').length;
  const isRendering = jobs.some(j => j.status === 'rendering');
  const isPaused = jobs.some(j => j.status === 'paused');

  const overallProgress = jobs.length > 0
    ? Math.round(jobs.reduce((acc, j) => acc + (j.status === 'completed' ? 100 : j.progress), 0) / jobs.length)
    : 0;

  const totalEtaSeconds = jobs
    .filter(j => j.status === 'queued' || j.status === 'rendering')
    .reduce((acc, j) => acc + (j.etaSeconds || 30), 0);

  const formatTime = (sec: number) => {
    if (sec <= 0) return '0s';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    if (m === 0) return `${s}s`;
    return `${m}m ${s}s`;
  };

  const activeJobWithLogs = jobs.find(j => j.id === selectedJobLogsId);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header card */}
      <div className="nb-card p-6 space-y-6">
        <div className="nb-stripe h-2 w-28" />
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="nb-title text-xl flex items-center gap-2">
              <Clock className="w-5 h-5" /> Job Queue
            </h3>
            <p className="nb-sub font-semibold mt-1">
              Crash-safe segment pipeline renders and concatenates cleanly.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!isRendering && !isPaused ? (
              <button onClick={onStartAll} disabled={jobs.length === 0 || completedCount === jobs.length}
                className="nb-btn nb-btn-lime nb-press disabled:opacity-40" title="Start Queue">
                <Play className="w-3.5 h-3.5 fill-black" /> Start Queue
              </button>
            ) : isPaused ? (
              <button onClick={onResumeAll} className="nb-btn nb-btn-lime nb-press">
                <Play className="w-3.5 h-3.5 fill-black" /> Resume
              </button>
            ) : (
              <button onClick={onPauseAll} className="nb-btn nb-btn-yellow nb-press">
                <Pause className="w-3.5 h-3.5 fill-black" /> Pause
              </button>
            )}

            <button onClick={onStopAfterCurrent} disabled={!isRendering}
              className="nb-btn nb-btn-white nb-press disabled:opacity-40">
              Stop After Current
            </button>

            <button onClick={onClearCompleted} disabled={completedCount === 0}
              className="nb-btn nb-btn-white nb-press disabled:opacity-40">
              Clear Completed
            </button>
          </div>
        </div>

        {jobs.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold">
              <span>
                Progress: <span className="font-mono">{completedCount} of {jobs.length} done</span>
              </span>
              <span className="font-mono">
                ETA remaining: <span className="font-black bg-yellow-300 border-2 border-black px-1">{formatTime(totalEtaSeconds)}</span>
              </span>
            </div>
            <div className="nb-progress-track">
              <div className="nb-progress-fill" style={{ width: `${overallProgress}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* Jobs */}
      <div className="space-y-5">
        {jobs.length === 0 ? (
          <div className="nb-card p-12 text-center space-y-3">
            <Clock className="w-12 h-12 mx-auto text-black/20" />
            <h4 className="nb-title text-lg">Nothing Queued</h4>
            <p className="nb-sub font-semibold max-w-sm mx-auto">
              Add jobs from the Single tab or scan folders in Bulk Auto-Pair.
            </p>
          </div>
        ) : (
          jobs.map((job, idx) => {
            const isSelectedForLogs = selectedJobLogsId === job.id;
            const st = STATUS_STYLES[job.status];
            return (
              <div key={job.id} className="nb-card p-5 space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-mono text-xs font-black w-6 bg-black text-white text-center py-0.5 border-2 border-black">
                      {idx + 1}
                    </span>

                    <span className={`nb-badge ${st.badge}`}>
                      {job.status === 'completed' && <CheckCircle2 className="w-3 h-3" />}
                      {job.status === 'rendering' && <Zap className="w-3 h-3" />}
                      {job.status === 'paused' && <Pause className="w-3 h-3" />}
                      {job.status === 'failed' && <AlertCircle className="w-3 h-3" />}
                      <span>{job.status}</span>
                    </span>

                    <div className="min-w-0">
                      <h4 className="font-mono font-black text-sm truncate max-w-md" title={job.outputName}>
                        {job.outputName}
                      </h4>
                      <p className="text-[11px] font-semibold text-black/50 truncate max-w-md">
                        {job.audioName} &bull; {job.videoName}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                    {job.mode === 'copy' ? (
                      <span className="nb-badge nb-badge-lime"><Zap className="w-3 h-3" /> Copy</span>
                    ) : (
                      <span className="nb-badge nb-badge-yellow"><Layers className="w-3 h-3" /> Encode</span>
                    )}

                    {job.status === 'rendering' && (
                      <button onClick={() => onPauseJob(job.id)} className="nb-btn nb-btn-sm nb-btn-white nb-press p-1.5" title="Pause Job">
                        <Pause className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {job.status === 'paused' && (
                      <button onClick={() => onResumeJob(job.id)} className="nb-btn nb-btn-sm nb-btn-white nb-press p-1.5" title="Resume Job">
                        <Play className="w-3.5 h-3.5 fill-black" />
                      </button>
                    )}

                    {job.status === 'completed' && (
                      <button onClick={() => onOpenOutputFolder(job.outputName)}
                        className="nb-btn nb-btn-sm nb-btn-cyan nb-press">
                        <FolderOpen className="w-3.5 h-3.5" /> Open
                      </button>
                    )}

                    <button onClick={() => setSelectedJobLogsId(isSelectedForLogs ? null : job.id)}
                      className={`nb-btn nb-btn-sm nb-press p-1.5 ${isSelectedForLogs ? 'nb-btn-black' : 'nb-btn-white'}`}
                      title="Toggle FFmpeg Live Output">
                      <Terminal className="w-3.5 h-3.5" />
                    </button>

                    <button onClick={() => onMoveJob(job.id, 'up')} disabled={idx === 0 || job.status !== 'queued'}
                      className="nb-btn nb-btn-sm nb-btn-white nb-press p-1.5 disabled:opacity-30" title="Move Up">
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>

                    <button onClick={() => onMoveJob(job.id, 'down')} disabled={idx === jobs.length - 1 || job.status !== 'queued'}
                      className="nb-btn nb-btn-sm nb-btn-white nb-press p-1.5 disabled:opacity-30" title="Move Down">
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>

                    <button onClick={() => onCancelJob(job.id)}
                      className="nb-btn nb-btn-sm nb-press p-1.5 bg-red-400" title="Remove Job">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Progress + telemetry */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-bold font-mono">
                    <span className="flex items-center gap-2">
                      <span className="bg-black text-white px-1.5">{job.progress}%</span>
                      {job.totalSegments > 1 && (
                        <span className="text-[11px]">Segment {job.currentSegment}/{job.totalSegments}</span>
                      )}
                    </span>
                    {job.status === 'rendering' && (
                      <span className="flex items-center gap-3 text-[11px]">
                        <span>Speed: <span className="bg-yellow-300 border-2 border-black px-1">{job.speed || '2.8x'}</span></span>
                        <span>FPS: {job.fps || 84}</span>
                        <span>ETA: {formatTime(job.etaSeconds)}</span>
                      </span>
                    )}
                  </div>

                  <div className="nb-progress-track h-3">
                    <div className={`h-full transition-all ${st.bar}`} style={{ width: `${job.progress}%`, borderRight: '2px solid #000' }} />
                  </div>
                </div>

                {/* Logs drawer */}
                {isSelectedForLogs && (
                  <div className="bg-black text-gray-100 border-[3px] border-black p-3 font-mono text-[11px] space-y-1 max-h-48 overflow-y-auto">
                    <div className="text-[10px] uppercase font-black text-yellow-300 border-b border-gray-700 pb-1 mb-1">
                      FFmpeg Process Output
                    </div>
                    {(activeJobWithLogs?.logs || []).map((line, logIdx) => (
                      <div key={logIdx} className="leading-tight">{line}</div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
