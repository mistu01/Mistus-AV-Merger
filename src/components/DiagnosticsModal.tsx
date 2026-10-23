/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Activity, Check, X, Loader2 } from 'lucide-react';
import { RenderOptions } from '../utils/engine';

interface DiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  gpuName: string;
}

interface VersionInfo {
  version: string;
  version_code: number;
  build_info: Record<string, string>;
  portable_mode: boolean;
}

interface HardwareInfo {
  cpu?: string;
  accelerators?: Array<{ name: string; codecs?: string[]; available?: boolean }>;
  platform?: string;
  python?: string;
}

export const DiagnosticsModal: React.FC<DiagnosticsModalProps> = ({ isOpen, onClose, gpuName }) => {
  const [copied, setCopied] = useState(false);
  const [version, setVersion] = useState<VersionInfo | null>(null);
  const [hardware, setHardware] = useState<HardwareInfo | null>(null);
  const [options, setOptions] = useState<RenderOptions | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    (async () => {
      try {
        const [v, h, o] = await Promise.all([
          fetch('/api/v1/version').then(r => (r.ok ? r.json() : null)).catch(() => null),
          fetch('/api/v1/hardware').then(r => (r.ok ? r.json() : null)).catch(() => null),
          Promise.resolve(null),
        ]);
        setVersion(v);
        setHardware(h);
        setOptions(o);
      } catch {
        /* diagnostics stay best-effort */
      }
    })();
  }, [isOpen]);

  if (!isOpen) return null;

  const build = version?.build_info || {};
  const accelerators = hardware?.accelerators || [];

  const diagnosticText = `### Mistus AV Merger — System Diagnostics
- Application: Mistus AV Merger
- Version: ${version?.version || 'unknown'}
- Version Code: ${version?.version_code ?? 'unknown'}
- Git Commit: ${build.git_commit || 'unknown'}
- Build Timestamp: ${build.build_date || 'unknown'}
- Platform: ${hardware?.platform || build.os_arch || 'unknown'}
- Python: ${hardware?.python || 'unknown'}
- Portable Mode: ${version?.portable_mode ? 'Active' : 'No'}
- Hardware Accelerators: ${accelerators.length ? '' : 'probe pending'}
${accelerators.map(a => `  - ${a.name}${a.codecs?.length ? `: ${a.codecs.join(', ')}` : ''}${a.available ? '' : ' (probing...)'}`).join('\n')}
- Active Encoder Profile: ${gpuName}
- 100% offline localhost server — nothing is sent anywhere.
`;

  const handleCopy = () => {
    navigator.clipboard.writeText(diagnosticText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 animate-nb-pop">
      <div className="nb-card w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="bg-cyan-300 border-b-[3px] border-black px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4" />
            <h3 className="nb-title text-sm">System Diagnostics</h3>
          </div>
          <button onClick={onClose} className="nb-btn nb-btn-sm nb-btn-white nb-press p-1.5">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-4 bg-white">
          <p className="nb-sub font-semibold">
            Copy this block when reporting an issue — it comes from the live server.
          </p>

          {!version ? (
            <div className="p-8 flex items-center justify-center gap-2 text-xs font-bold">
              <Loader2 className="w-4 h-4 animate-spin" /> Reading live system info...
            </div>
          ) : (
            <pre className="border-[3px] border-black bg-[#111] text-lime-300 p-4 font-mono text-xs overflow-x-auto whitespace-pre-wrap leading-relaxed select-all">
              {diagnosticText}
            </pre>
          )}
        </div>

        {/* Footer */}
        <div className="border-t-[3px] border-black p-4 flex items-center justify-between bg-white">
          <span className="nb-sub font-bold">Zero telemetry &bull; fully offline</span>
          <button onClick={handleCopy} disabled={!version}
            className={`nb-btn nb-press ${copied ? 'nb-btn-lime' : 'nb-btn-yellow'}`}>
            {copied ? <Check className="w-3.5 h-3.5" /> : <Activity className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied!' : 'Copy Diagnostics'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
