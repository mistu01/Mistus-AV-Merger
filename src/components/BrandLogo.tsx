/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useId } from 'react';

interface BrandLogoProps {
  className?: string;
  size?: number | string;
  title?: string;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  className = '',
  size = 36,
  title = 'Mistus AV Merger',
}) => {
  const uid = useId().replace(/:/g, '');
  const clipId = `card-clip-${uid}`;
  const smallShadowId = `small-shadow-${uid}`;
  const elementShadowId = `element-shadow-${uid}`;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label={title}
    >
      <title>{title}</title>
      <defs>
        <clipPath id={clipId}>
          <rect x="36" y="36" width="424" height="424" rx="44" ry="44" />
        </clipPath>
        <filter id={smallShadowId} x="-15%" y="-15%" width="140%" height="140%">
          <feDropShadow dx="5" dy="5" stdDeviation="0" floodColor="#000000" floodOpacity="1" />
        </filter>
        <filter id={elementShadowId} x="-10%" y="-10%" width="130%" height="130%">
          <feDropShadow dx="8" dy="8" stdDeviation="0" floodColor="#000000" floodOpacity="1" />
        </filter>
      </defs>

      {/* Hard Neo-Brutalist Offset Shadow */}
      <rect x="54" y="54" width="424" height="424" rx="44" ry="44" fill="#000000" />

      {/* Main Card Body */}
      <g clipPath={`url(#${clipId})`}>
        {/* Top Half: Cyber Yellow */}
        <rect x="36" y="36" width="424" height="236" fill="#FDE047" />
        {/* Bottom Half: Hot Neon Pink */}
        <rect x="36" y="272" width="424" height="188" fill="#FF4F87" />

        {/* Dividing Bar */}
        <line x1="36" y1="272" x2="460" y2="272" stroke="#000000" strokeWidth="12" />

        {/* Top Label Stripe */}
        <rect
          x="68"
          y="64"
          width="360"
          height="48"
          rx="10"
          fill="#FFFFFF"
          stroke="#000000"
          strokeWidth="8"
          filter={`url(#${smallShadowId})`}
        />
        <rect x="80" y="74" width="28" height="28" rx="5" fill="#38BDF8" stroke="#000000" strokeWidth="4" />
        <rect x="116" y="74" width="28" height="28" rx="5" fill="#A3E635" stroke="#000000" strokeWidth="4" />
        <rect x="152" y="74" width="28" height="28" rx="5" fill="#FF4F87" stroke="#000000" strokeWidth="4" />

        {/* Text */}
        <text
          x="194"
          y="96"
          fontFamily="system-ui, -apple-system, sans-serif"
          fontWeight="900"
          fontSize="20"
          fill="#000000"
          letterSpacing="2"
        >
          MISTUS • AV
        </text>
        <rect x="352" y="74" width="62" height="28" rx="5" fill="#FDE047" stroke="#000000" strokeWidth="4" />
        <text
          x="362"
          y="93"
          fontFamily="monospace"
          fontWeight="900"
          fontSize="13"
          fill="#000000"
        >
          LOOP
        </text>

        {/* Cassette / Film Tape Deck */}
        <rect
          x="76"
          y="132"
          width="344"
          height="116"
          rx="20"
          fill="#18181B"
          stroke="#000000"
          strokeWidth="10"
          filter={`url(#${smallShadowId})`}
        />

        {/* Tape Window */}
        <rect x="180" y="152" width="136" height="76" rx="10" fill="#38BDF8" stroke="#000000" strokeWidth="7" />

        {/* Connecting Magnetic Tape Lines */}
        <path
          d="M 140 190 C 170 190, 180 216, 212 216 L 284 216 C 316 216, 326 190, 356 190"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="8"
          strokeDasharray="14 8"
        />

        {/* Triangle Play Symbol */}
        <polygon points="244,166 244,214 286,190" fill="#000000" />
        <polygon
          points="240,162 240,210 282,186"
          fill="#FDE047"
          stroke="#000000"
          strokeWidth="6"
          strokeLinejoin="round"
        />

        {/* Left Spool (Audio) */}
        <circle cx="140" cy="190" r="46" fill="#000000" />
        <circle cx="136" cy="186" r="46" fill="#FFFFFF" stroke="#000000" strokeWidth="9" />
        <circle cx="136" cy="186" r="32" fill="none" stroke="#000000" strokeWidth="5" strokeDasharray="8 8" />
        <circle cx="136" cy="186" r="17" fill="#FDE047" stroke="#000000" strokeWidth="6" />
        <circle cx="136" cy="186" r="6" fill="#000000" />
        <rect x="133" y="166" width="6" height="8" rx="2" fill="#000000" />
        <rect x="133" y="198" width="6" height="8" rx="2" fill="#000000" />
        <rect x="116" y="183" width="8" height="6" rx="2" fill="#000000" />
        <rect x="148" y="183" width="8" height="6" rx="2" fill="#000000" />

        {/* Right Spool (Video) */}
        <circle cx="360" cy="190" r="46" fill="#000000" />
        <circle cx="356" cy="186" r="46" fill="#FFFFFF" stroke="#000000" strokeWidth="9" />
        <circle cx="356" cy="186" r="32" fill="none" stroke="#000000" strokeWidth="6" strokeDasharray="10 10" />
        <circle cx="356" cy="186" r="17" fill="#A3E635" stroke="#000000" strokeWidth="6" />
        <circle cx="356" cy="186" r="6" fill="#000000" />
        <rect x="353" y="166" width="6" height="8" rx="2" fill="#000000" />
        <rect x="353" y="198" width="6" height="8" rx="2" fill="#000000" />
        <rect x="336" y="183" width="8" height="6" rx="2" fill="#000000" />
        <rect x="368" y="183" width="8" height="6" rx="2" fill="#000000" />

        {/* Lower Left: Audio Equalizer Waveform Box */}
        <g filter={`url(#${smallShadowId})`}>
          <rect x="76" y="304" width="156" height="114" rx="16" fill="#FFFFFF" stroke="#000000" strokeWidth="9" />
          <rect x="94" y="360" width="12" height="38" rx="4" fill="#A3E635" stroke="#000000" strokeWidth="4" />
          <rect x="114" y="336" width="12" height="62" rx="4" fill="#A3E635" stroke="#000000" strokeWidth="4" />
          <rect x="134" y="320" width="12" height="78" rx="4" fill="#FDE047" stroke="#000000" strokeWidth="4" />
          <rect x="154" y="342" width="12" height="56" rx="4" fill="#38BDF8" stroke="#000000" strokeWidth="4" />
          <rect x="174" y="328" width="12" height="70" rx="4" fill="#A3E635" stroke="#000000" strokeWidth="4" />
          <rect x="194" y="354" width="12" height="44" rx="4" fill="#A3E635" stroke="#000000" strokeWidth="4" />
          <text x="94" y="322" fontFamily="monospace" fontWeight="900" fontSize="12" fill="#000000">
            AUDIO
          </text>
        </g>

        {/* Lower Center: Merge Loop Symbol */}
        <g filter={`url(#${elementShadowId})`}>
          <circle cx="248" cy="360" r="34" fill="#FDE047" stroke="#000000" strokeWidth="9" />
          <path d="M 235 348 A 15 15 0 0 1 262 355" fill="none" stroke="#000000" strokeWidth="6" strokeLinecap="round" />
          <polygon points="266,350 262,358 254,354" fill="#000000" />
          <path d="M 261 372 A 15 15 0 0 1 234 365" fill="none" stroke="#000000" strokeWidth="6" strokeLinecap="round" />
          <polygon points="230,370 234,362 242,366" fill="#000000" />
          <circle cx="248" cy="360" r="4" fill="#FF4F87" />
        </g>

        {/* Lower Right: Video Filmstrip Box */}
        <g filter={`url(#${smallShadowId})`}>
          <rect x="264" y="304" width="156" height="114" rx="16" fill="#FFFFFF" stroke="#000000" strokeWidth="9" />
          <rect x="282" y="336" width="120" height="66" rx="8" fill="#18181B" stroke="#000000" strokeWidth="6" />
          {/* Perforations Top */}
          <rect x="286" y="340" width="8" height="8" rx="2" fill="#FFFFFF" />
          <rect x="302" y="340" width="8" height="8" rx="2" fill="#FFFFFF" />
          <rect x="318" y="340" width="8" height="8" rx="2" fill="#FFFFFF" />
          <rect x="334" y="340" width="8" height="8" rx="2" fill="#FFFFFF" />
          <rect x="350" y="340" width="8" height="8" rx="2" fill="#FFFFFF" />
          <rect x="366" y="340" width="8" height="8" rx="2" fill="#FFFFFF" />
          <rect x="382" y="340" width="8" height="8" rx="2" fill="#FFFFFF" />
          {/* Center Play Icon */}
          <polygon
            points="336,360 336,380 354,370"
            fill="#38BDF8"
            stroke="#FFFFFF"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          {/* Perforations Bottom */}
          <rect x="286" y="390" width="8" height="8" rx="2" fill="#FFFFFF" />
          <rect x="302" y="390" width="8" height="8" rx="2" fill="#FFFFFF" />
          <rect x="318" y="390" width="8" height="8" rx="2" fill="#FFFFFF" />
          <rect x="334" y="390" width="8" height="8" rx="2" fill="#FFFFFF" />
          <rect x="350" y="390" width="8" height="8" rx="2" fill="#FFFFFF" />
          <rect x="366" y="390" width="8" height="8" rx="2" fill="#FFFFFF" />
          <rect x="382" y="390" width="8" height="8" rx="2" fill="#FFFFFF" />
          <text x="282" y="322" fontFamily="monospace" fontWeight="900" fontSize="12" fill="#000000">
            VIDEO
          </text>
        </g>

        {/* Sparkle Star */}
        <path
          d="M 424 74 Q 424 94 444 94 Q 424 94 424 114 Q 424 94 404 94 Q 424 94 424 74 Z"
          fill="#A3E635"
          stroke="#000000"
          strokeWidth="5"
        />
      </g>

      {/* Main Outer Border */}
      <rect x="36" y="36" width="424" height="424" rx="44" ry="44" fill="none" stroke="#000000" strokeWidth="14" />
    </svg>
  );
};
