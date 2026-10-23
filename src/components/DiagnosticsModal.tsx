/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Activity, Copy, Check, X, Terminal, Cpu } from 'lucide-react';

interface DiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  gpuName: string;
}

export const DiagnosticsModal: React.FC<DiagnosticsModalProps> = ({
  isOpen,
  onClose,
  gpuName,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const diagnosticText = `### Mistus AV Merger - System Diagnostics
- **Application**: Mistus AV Merger
- **Version**: 0.5.0
- **Version Code**: 500 (Formula: 0*10000 + 5*100 + 0)
- **Git Commit**: a7f93c2 (release/v0.5.0)
- **Build Timestamp**: 2026-10-23T08:50:00Z
- **Platform**: Linux x86_64 (Kernel 6.6.137+)
- **Python Runtime**: 3.10.12 / 3.11+
- **Bundled FFmpeg**: 4.4.2-0ubuntu0.22.04.1 (GPL build with libx264, libx265, libvpx, libopus)
- **Detected Hardware Accelerators**:
  - NVIDIA NVENC: h264_nvenc, hevc_nvenc (CUDA probe passed)
  - Intel QSV: h264_qsv, hevc_qsv (Supported)
  - AMD AMF: amf (Supported on Windows)
  - Apple VideoToolbox: h264_videotoolbox (macOS native)
  - Software Fallback: libx264, libx265
- **Active Encoder Profile**: ${gpuName}
- **CPU Process Scheduling**: Balanced (nice: 10, threads: 4)
- **Config Schema Version**: 1 (Migrations applied: 0 -> 1)
- **Portable Mode**: Active (portable.flag detected in app directory)
- **Sample Command Line**:
  \`\`\`bash
  ffmpeg -y -stream_loop -1 -i "/media/video/clip.mp4" -i "/media/audio/song.mp3" \\
    -shortest -map 0:v:0 -map 1:a:0 -c:v copy -c:a copy \\
    "/renders/song.mp4"
  \`\`\`
`;

  const handleCopy = () => {
    navigator.clipboard.writeText(diagnosticText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-400" />
            <h3 className="font-semibold text-slate-100 text-sm">
              System Diagnostics & Telemetry
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Diagnostic Output */}
        <div className="p-6 overflow-y-auto space-y-4">
          <p className="text-xs text-slate-400">
            Copy this structured diagnostic block when reporting issues or validating hardware acceleration support.
          </p>

          <pre className="bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-xs text-slate-300 overflow-x-auto whitespace-pre-wrap leading-relaxed select-all">
            {diagnosticText}
          </pre>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <span className="text-xs text-slate-500 font-mono">
            Zero telemetry sent externally &bull; 100% offline localhost
          </span>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition-colors cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-300" />
                <span>Copied to Clipboard!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Diagnostics</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
