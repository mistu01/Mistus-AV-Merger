/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Play, 
  Pause, 
  Square, 
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
  RotateCcw,
  Sparkles
} from 'lucide-react';
import { RenderOptions } from '../utils/engine';

export interface RenderJob {
  id: string;
  audioName: string;
  videoName: string;
  outputName: string;
  duration: number;
  mode: 'copy' | 'encode';
  modeReason: string;
  status: 'queued' | 'rendering' | 'paused' | 'completed' | 'failed';
  progress: number; // 0..100
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
      {/* Overall Queue Header Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-semibold text-slate-100 text-sm flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-400" />
              <span>Active Job Queue & Segment Engine</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Crash-safe segment pipeline renders in continuous intervals and concatenates cleanly.
            </p>
          </div>

          {/* Queue Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {!isRendering && !isPaused ? (
              <button
                onClick={onStartAll}
                disabled={jobs.length === 0 || completedCount === jobs.length}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-semibold shadow-md transition-all cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Start Queue</span>
              </button>
            ) : isPaused ? (
              <button
                onClick={onResumeAll}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md transition-all cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Resume Queue (SIGCONT)</span>
              </button>
            ) : (
              <button
                onClick={onPauseAll}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow-md transition-all cursor-pointer"
              >
                <Pause className="w-3.5 h-3.5 fill-current" />
                <span>Pause Queue (SIGSTOP)</span>
              </button>
            )}

            <button
              onClick={onStopAfterCurrent}
              disabled={!isRendering}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 text-xs font-medium transition-colors cursor-pointer"
            >
              Stop After Current
            </button>

            <button
              onClick={onClearCompleted}
              disabled={completedCount === 0}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 text-xs font-medium transition-colors cursor-pointer"
            >
              Clear Completed
            </button>
          </div>
        </div>

        {/* Overall Progress Metrics */}
        {jobs.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-slate-800/80">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-300 font-medium">
                Overall Batch Progress:{' '}
                <strong className="text-indigo-400 font-mono">
                  {completedCount} of {jobs.length} completed
                </strong>
              </span>
              <span className="text-slate-400 font-mono">
                Total Remaining ETA: <strong className="text-slate-200">{formatTime(totalEtaSeconds)}</strong>
              </span>
            </div>
            <div className="w-full bg-slate-950 rounded-full h-3 p-0.5 border border-slate-800">
              <div
                className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${overallProgress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Jobs List */}
      <div className="space-y-4">
        {jobs.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center space-y-3">
            <Clock className="w-12 h-12 text-slate-700 mx-auto" />
            <h4 className="text-sm font-semibold text-slate-300">Queue is Empty</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Add jobs from the Single Render or Bulk Auto-Pair views to start processing.
            </p>
          </div>
        ) : (
          jobs.map((job, idx) => {
            const isSelectedForLogs = selectedJobLogsId === job.id;
            return (
              <div 
                key={job.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4 transition-all hover:border-slate-700"
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-slate-500 font-bold w-6">
                      #{idx + 1}
                    </span>

                    {/* Status Badge */}
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium uppercase tracking-wider font-mono ${
                      job.status === 'completed'
                        ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-500/30'
                        : job.status === 'rendering'
                        ? 'bg-amber-950/80 text-amber-400 border border-amber-500/30 animate-pulse'
                        : job.status === 'paused'
                        ? 'bg-blue-950/80 text-blue-400 border border-blue-500/30'
                        : job.status === 'failed'
                        ? 'bg-rose-950/80 text-rose-400 border border-rose-500/30'
                        : 'bg-slate-800 text-slate-400'
                    }`}>
                      {job.status === 'completed' && <CheckCircle2 className="w-3.5 h-3.5" />}
                      {job.status === 'rendering' && <Zap className="w-3.5 h-3.5 text-amber-400" />}
                      {job.status === 'paused' && <Pause className="w-3.5 h-3.5" />}
                      {job.status === 'failed' && <AlertCircle className="w-3.5 h-3.5" />}
                      <span>{job.status}</span>
                    </span>

                    <div>
                      <h4 className="font-semibold text-slate-200 text-sm font-mono truncate max-w-md">
                        {job.outputName}
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        {job.audioName} &bull; {job.videoName}
                      </p>
                    </div>
                  </div>

                  {/* Mode & Action Buttons */}
                  <div className="flex items-center gap-2">
                    {job.mode === 'copy' ? (
                      <span className="px-2 py-0.5 rounded bg-emerald-950/40 text-emerald-400 border border-emerald-500/20 text-[10px] font-mono">
                        Stream Copy
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded bg-amber-950/40 text-amber-400 border border-amber-500/20 text-[10px] font-mono">
                        Re-encode
                      </span>
                    )}

                    {job.status === 'rendering' && (
                      <button
                        onClick={() => onPauseJob(job.id)}
                        className="p-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 rounded-lg text-xs"
                        title="Pause Job"
                      >
                        <Pause className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {job.status === 'paused' && (
                      <button
                        onClick={() => onResumeJob(job.id)}
                        className="p-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded-lg text-xs"
                        title="Resume Job"
                      >
                        <Play className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {job.status === 'completed' && (
                      <button
                        onClick={() => onOpenOutputFolder(job.outputName)}
                        className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium cursor-pointer"
                      >
                        <FolderOpen className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Open Folder</span>
                      </button>
                    )}

                    <button
                      onClick={() => setSelectedJobLogsId(isSelectedForLogs ? null : job.id)}
                      className={`p-1.5 rounded-lg text-xs transition-colors ${
                        isSelectedForLogs ? 'bg-indigo-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                      }`}
                      title="Toggle FFmpeg Live Output"
                    >
                      <Terminal className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => onMoveJob(job.id, 'up')}
                      disabled={idx === 0 || job.status !== 'queued'}
                      className="p-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-400 rounded-lg text-xs"
                      title="Move Up"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => onMoveJob(job.id, 'down')}
                      disabled={idx === jobs.length - 1 || job.status !== 'queued'}
                      className="p-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-400 rounded-lg text-xs"
                      title="Move Down"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => onCancelJob(job.id)}
                      className="p-1.5 bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-400 rounded-lg text-xs transition-colors"
                      title="Remove Job"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Progress Bar & Real-time Telemetry */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                    <span className="flex items-center gap-2">
                      <strong className="text-slate-200">{job.progress}%</strong>
                      {job.totalSegments > 1 && (
                        <span className="text-[11px] text-indigo-400">
                          (Segment {job.currentSegment} / {job.totalSegments})
                        </span>
                      )}
                    </span>
                    {job.status === 'rendering' && (
                      <span className="flex items-center gap-3 text-[11px]">
                        <span>Speed: <strong className="text-amber-400">{job.speed || '2.8x'}</strong></span>
                        <span>FPS: <strong className="text-slate-300">{job.fps || '84'}</strong></span>
                        <span>ETA: <strong className="text-slate-300">{formatTime(job.etaSeconds)}</strong></span>
                      </span>
                    )}
                  </div>

                  <div className="w-full bg-slate-950 rounded-full h-2 border border-slate-800 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-200 ${
                        job.status === 'completed'
                          ? 'bg-emerald-500'
                          : job.status === 'paused'
                          ? 'bg-blue-500'
                          : job.status === 'failed'
                          ? 'bg-rose-500'
                          : 'bg-indigo-500'
                      }`}
                      style={{ width: `${job.progress}%` }}
                    />
                  </div>
                </div>

                {/* Live Console Output Drawer */}
                {isSelectedForLogs && (
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono text-[11px] text-slate-400 space-y-1 max-h-48 overflow-y-auto">
                    <div className="text-slate-500 text-[10px] uppercase font-bold border-b border-slate-800 pb-1 mb-1">
                      FFmpeg Process Output &bull; PID #4912
                    </div>
                    {job.logs.map((line, logIdx) => (
                      <div key={logIdx} className="leading-tight text-slate-300">
                        {line}
                      </div>
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
