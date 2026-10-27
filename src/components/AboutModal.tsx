/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { CheckCircle2, X } from 'lucide-react';
import { BrandLogo } from './BrandLogo';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AboutModal: React.FC<AboutModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 animate-nb-pop">
      <div className="nb-card w-full max-w-md overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-yellow-300 border-b-[3px] border-black px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BrandLogo size={20} className="shrink-0" />
            <h3 className="nb-title text-sm">About</h3>
          </div>
          <button onClick={onClose} className="nb-btn nb-btn-sm nb-btn-white nb-press p-1.5">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 text-center space-y-4 text-xs bg-white">
          <div className="flex justify-center">
            <BrandLogo size={72} />
          </div>

          <div>
            <h2 className="nb-title text-lg">Mistus AV Merger</h2>
            <p className="font-mono text-xs font-bold mt-0.5 bg-cyan-300 border-2 border-black inline-block px-2 py-0.5">
              {"Loop it. Ship it."}
            </p>
          </div>

          <p className="text-black/70 leading-relaxed font-semibold">
            A portable, cross-platform application that combines short video clips with longer
            audio soundtracks, looping seamlessly with smart copy-vs-encode strategy and bulk
            1:1 auto-pairing.
          </p>

          <div className="text-left space-y-1.5 text-[11px] font-bold">
            {(
              <>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> <span>Smart stream-copy looping (fast, lossless)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> <span>Real file &amp; folder browser + 1:1 auto-pairing</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> <span>Crash-safe segment resuming</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> <span>7 VHS presets, night mode &amp; noise synthesis</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> <span>100% offline, zero telemetry</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t-[3px] border-black p-4 flex items-center justify-between bg-white text-xs">
          <span className="font-bold text-black/50">Apache-2.0 / LGPL bundles</span>
          <button onClick={onClose} className="nb-btn nb-btn-sm nb-btn-yellow nb-press">Close</button>
        </div>
      </div>
    </div>
  );
};
