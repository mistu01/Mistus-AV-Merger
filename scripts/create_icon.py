from pathlib import Path

svg_content = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <defs>
    <!-- Card clip path for rounded corners -->
    <clipPath id="card-clip">
      <rect x="36" y="36" width="424" height="424" rx="44" ry="44" />
    </clipPath>
    <!-- Drop shadow filter for brutalist pop -->
    <filter id="brutal-shadow" x="-5%" y="-5%" width="120%" height="120%">
      <feDropShadow dx="16" dy="16" stdDeviation="0" flood-color="#000000" flood-opacity="1" />
    </filter>
    <filter id="element-shadow" x="-10%" y="-10%" width="130%" height="130%">
      <feDropShadow dx="8" dy="8" stdDeviation="0" flood-color="#000000" flood-opacity="1" />
    </filter>
    <filter id="small-shadow" x="-15%" y="-15%" width="140%" height="140%">
      <feDropShadow dx="5" dy="5" stdDeviation="0" flood-color="#000000" flood-opacity="1" />
    </filter>
  </defs>

  <!-- Hard Neo-Brutalist Offset Shadow of Main Card -->
  <rect x="54" y="54" width="424" height="424" rx="44" ry="44" fill="#000000" />

  <!-- Main Card Body -->
  <g clip-path="url(#card-clip)">
    <!-- Top Half: Cyber Yellow -->
    <rect x="36" y="36" width="424" height="236" fill="#FDE047" />
    <!-- Bottom Half: Hot Neon Pink -->
    <rect x="36" y="272" width="424" height="188" fill="#FF4F87" />

    <!-- Neo-brutalist horizontal dividing bar -->
    <line x1="36" y1="272" x2="460" y2="272" stroke="#000000" stroke-width="12" />

    <!-- Top Status / Label Stripe -->
    <rect x="68" y="64" width="360" height="48" rx="10" fill="#FFFFFF" stroke="#000000" stroke-width="8" filter="url(#small-shadow)" />
    <!-- Mini accent color bars in label -->
    <rect x="80" y="74" width="28" height="28" rx="5" fill="#38BDF8" stroke="#000000" stroke-width="4" />
    <rect x="116" y="74" width="28" height="28" rx="5" fill="#A3E635" stroke="#000000" stroke-width="4" />
    <rect x="152" y="74" width="28" height="28" rx="5" fill="#FF4F87" stroke="#000000" stroke-width="4" />

    <!-- Text: MISTUS AV -->
    <text x="194" y="96" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="20" fill="#000000" letter-spacing="2">MISTUS • AV</text>
    <!-- Right side mini badge -->
    <rect x="352" y="74" width="62" height="28" rx="5" fill="#FDE047" stroke="#000000" stroke-width="4" />
    <text x="362" y="93" font-family="monospace" font-weight="900" font-size="13" fill="#000000">LOOP</text>

    <!-- Cassette / Film Tape Bridge Deck Background -->
    <rect x="76" y="132" width="344" height="116" rx="20" fill="#18181B" stroke="#000000" stroke-width="10" filter="url(#small-shadow)" />

    <!-- Tape Window (Center Cutout) -->
    <rect x="180" y="152" width="136" height="76" rx="10" fill="#38BDF8" stroke="#000000" stroke-width="7" />

    <!-- Connecting Looping Magnetic Tape Lines -->
    <path d="M 140 190 C 170 190, 180 216, 212 216 L 284 216 C 316 216, 326 190, 356 190" fill="none" stroke="#FFFFFF" stroke-width="8" stroke-dasharray="14 8" />

    <!-- Central Fast Play / Loop Triangle Symbol inside Window -->
    <!-- Triangle shadow -->
    <polygon points="244,166 244,214 286,190" fill="#000000" />
    <!-- Triangle front -->
    <polygon points="240,162 240,210 282,186" fill="#FDE047" stroke="#000000" stroke-width="6" stroke-linejoin="round" />

    <!-- Left Spool / Audio Reel -->
    <!-- Outer reel shadow -->
    <circle cx="140" cy="190" r="46" fill="#000000" />
    <!-- Outer reel body -->
    <circle cx="136" cy="186" r="46" fill="#FFFFFF" stroke="#000000" stroke-width="9" />
    <!-- Reel spokes / grooves -->
    <circle cx="136" cy="186" r="32" fill="none" stroke="#000000" stroke-width="5" stroke-dasharray="8 8" />
    <!-- Inner hub -->
    <circle cx="136" cy="186" r="17" fill="#FDE047" stroke="#000000" stroke-width="6" />
    <circle cx="136" cy="186" r="6" fill="#000000" />
    <!-- Gear notches -->
    <rect x="133" y="166" width="6" height="8" rx="2" fill="#000000" />
    <rect x="133" y="198" width="6" height="8" rx="2" fill="#000000" />
    <rect x="116" y="183" width="8" height="6" rx="2" fill="#000000" />
    <rect x="148" y="183" width="8" height="6" rx="2" fill="#000000" />

    <!-- Right Spool / Video Film Reel -->
    <!-- Outer reel shadow -->
    <circle cx="360" cy="190" r="46" fill="#000000" />
    <!-- Outer reel body -->
    <circle cx="356" cy="186" r="46" fill="#FFFFFF" stroke="#000000" stroke-width="9" />
    <!-- Film sprocket tick holes around outer edge -->
    <circle cx="356" cy="186" r="32" fill="none" stroke="#000000" stroke-width="6" stroke-dasharray="10 10" />
    <!-- Inner hub -->
    <circle cx="356" cy="186" r="17" fill="#A3E635" stroke="#000000" stroke-width="6" />
    <circle cx="356" cy="186" r="6" fill="#000000" />
    <!-- Film Perforations -->
    <rect x="353" y="166" width="6" height="8" rx="2" fill="#000000" />
    <rect x="353" y="198" width="6" height="8" rx="2" fill="#000000" />
    <rect x="336" y="183" width="8" height="6" rx="2" fill="#000000" />
    <rect x="368" y="183" width="8" height="6" rx="2" fill="#000000" />

    <!-- LOWER SECTION: AUDIO SOUNDWAVE & VIDEO LOOP MERGE BADGES -->
    <!-- Left: Audio Wave Graphic Box -->
    <g filter="url(#small-shadow)">
      <rect x="76" y="304" width="156" height="114" rx="16" fill="#FFFFFF" stroke="#000000" stroke-width="9" />
      <!-- Wave bars (Equalizer style) in Lime Green -->
      <rect x="94"  y="360" width="12" height="38" rx="4" fill="#A3E635" stroke="#000000" stroke-width="4" />
      <rect x="114" y="336" width="12" height="62" rx="4" fill="#A3E635" stroke="#000000" stroke-width="4" />
      <rect x="134" y="320" width="12" height="78" rx="4" fill="#FDE047" stroke="#000000" stroke-width="4" />
      <rect x="154" y="342" width="12" height="56" rx="4" fill="#38BDF8" stroke="#000000" stroke-width="4" />
      <rect x="174" y="328" width="12" height="70" rx="4" fill="#A3E635" stroke="#000000" stroke-width="4" />
      <rect x="194" y="354" width="12" height="44" rx="4" fill="#A3E635" stroke="#000000" stroke-width="4" />
      <!-- Label -->
      <text x="94" y="322" font-family="monospace" font-weight="900" font-size="12" fill="#000000">AUDIO</text>
    </g>

    <!-- Center Merge / Infinity Loop Icon Circle -->
    <g filter="url(#element-shadow)">
      <!-- Central circle badge -->
      <circle cx="248" cy="360" r="34" fill="#FDE047" stroke="#000000" stroke-width="9" />
      <!-- Repeating / Loop Arrows in Bold Black -->
      <path d="M 235 348 A 15 15 0 0 1 262 355" fill="none" stroke="#000000" stroke-width="6" stroke-linecap="round" />
      <polygon points="266,350 262,358 254,354" fill="#000000" />
      <path d="M 261 372 A 15 15 0 0 1 234 365" fill="none" stroke="#000000" stroke-width="6" stroke-linecap="round" />
      <polygon points="230,370 234,362 242,366" fill="#000000" />
      <!-- Center energy bolt -->
      <circle cx="248" cy="360" r="4" fill="#FF4F87" />
    </g>

    <!-- Right: Video Frame / Filmstrip Box -->
    <g filter="url(#small-shadow)">
      <rect x="264" y="304" width="156" height="114" rx="16" fill="#FFFFFF" stroke="#000000" stroke-width="9" />
      <!-- Filmstrip frame cutout -->
      <rect x="282" y="336" width="120" height="66" rx="8" fill="#18181B" stroke="#000000" stroke-width="6" />
      <!-- Filmstrip sprocket holes along top & bottom -->
      <rect x="286" y="340" width="8" height="8" rx="2" fill="#FFFFFF" />
      <rect x="302" y="340" width="8" height="8" rx="2" fill="#FFFFFF" />
      <rect x="318" y="340" width="8" height="8" rx="2" fill="#FFFFFF" />
      <rect x="334" y="340" width="8" height="8" rx="2" fill="#FFFFFF" />
      <rect x="350" y="340" width="8" height="8" rx="2" fill="#FFFFFF" />
      <rect x="366" y="340" width="8" height="8" rx="2" fill="#FFFFFF" />
      <rect x="382" y="340" width="8" height="8" rx="2" fill="#FFFFFF" />

      <!-- Center play icon inside film screen -->
      <polygon points="336,360 336,380 354,370" fill="#38BDF8" stroke="#FFFFFF" stroke-width="3" stroke-linejoin="round" />

      <rect x="286" y="390" width="8" height="8" rx="2" fill="#FFFFFF" />
      <rect x="302" y="390" width="8" height="8" rx="2" fill="#FFFFFF" />
      <rect x="318" y="390" width="8" height="8" rx="2" fill="#FFFFFF" />
      <rect x="334" y="390" width="8" height="8" rx="2" fill="#FFFFFF" />
      <rect x="350" y="390" width="8" height="8" rx="2" fill="#FFFFFF" />
      <rect x="366" y="390" width="8" height="8" rx="2" fill="#FFFFFF" />
      <rect x="382" y="390" width="8" height="8" rx="2" fill="#FFFFFF" />
      <!-- Label -->
      <text x="282" y="322" font-family="monospace" font-weight="900" font-size="12" fill="#000000">VIDEO</text>
    </g>

    <!-- Top Right Sparkle Star (Neo-Brutalist 4-Point Star) -->
    <path d="M 424 74 Q 424 94 444 94 Q 424 94 424 114 Q 424 94 404 94 Q 424 94 424 74 Z" fill="#A3E635" stroke="#000000" stroke-width="5" />

  </g>

  <!-- Heavy Outer Border Around Main Card -->
  <rect x="36" y="36" width="424" height="424" rx="44" ry="44" fill="none" stroke="#000000" stroke-width="14" />
</svg>'''

Path("public").mkdir(exist_ok=True)
Path("public/icon.svg").write_text(svg_content, encoding="utf-8")
Path("public/favicon.svg").write_text(svg_content, encoding="utf-8")
print("Wrote public/icon.svg and public/favicon.svg")
