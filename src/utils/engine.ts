/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Mistus AV Merger - Core Engine Logic
 * Ported pure logic for client-side evaluation, simulation, and tests.
 */

export interface MediaProbe {
  filename: string;
  path: string;
  duration: number; // in seconds
  format: string;
  sizeBytes: number;
  // Audio specific
  audioCodec?: string;
  channels?: number;
  sampleRate?: number;
  // Video specific
  width?: number;
  height?: number;
  videoCodec?: string;
  fps?: number;
  hasAudio?: boolean;
}

export type PairingMode = 
  | 'match_name'
  | 'order_1_to_1'
  | 'one_for_all'
  | 'cycle'
  | 'random_seeded'
  | 'manual';

export type CollisionPolicy = 'suffix' | 'skip' | 'overwrite';

export interface RenderOptions {
  resolution: 'original' | '1080p' | '720p' | '480p';
  vhsPreset?: string;
  nightModeEnabled?: boolean;
  nightIntensity?: number; // 0..1
  noiseStaticEnabled?: boolean;
  noiseSeed?: number;
  overlayEnabled?: boolean;
  overlayPath?: string;
  overlayFolder?: string;
  overlayOpacity?: number;
  overlayTimeout?: number | 'full';
  overlayAnimation?: 'static' | 'bounce';
  encoderChoice?: string;
  crf?: number;
  sizeTarget?: 'small' | 'balanced' | 'high' | 'unlimited';
  cpuProfile?: 'aggressive' | 'balanced' | 'low' | 'idle';
}

export interface PairingResult {
  id: string;
  audio: MediaProbe;
  video: MediaProbe;
  outputName: string;
  mode: 'copy' | 'encode';
  modeReason: string;
  loopCount: number;
  confidence?: number; // 0..1 for fuzzy matches
  excluded: boolean;
  alreadyDone?: boolean;
}

export interface AutoPairPlan {
  pairings: PairingResult[];
  unmatchedAudio: MediaProbe[];
  unmatchedVideo: MediaProbe[];
  warnings: string[];
}

/**
 * Calculates monotonic Android-style integer version code.
 * Formula: MAJOR * 10000 + MINOR * 100 + PATCH
 */
export function computeVersionCode(major: number, minor: number, patch: number): number {
  if (major < 0 || minor < 0 || patch < 0) {
    throw new Error('Version numbers must be non-negative integers');
  }
  return major * 10000 + minor * 100 + patch;
}

/**
 * Parses SemVer 2.0.0 string into components and calculates version code.
 */
export function parseSemVer(versionStr: string): { major: number; minor: number; patch: number; prerelease?: string; versionCode: number } {
  const match = versionStr.trim().match(/^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/);
  if (!match) {
    throw new Error(`Invalid SemVer format: "${versionStr}"`);
  }
  const major = parseInt(match[1], 10);
  const minor = parseInt(match[2], 10);
  const patch = parseInt(match[3], 10);
  const prerelease = match[4];
  const versionCode = computeVersionCode(major, minor, patch);
  return { major, minor, patch, prerelease, versionCode };
}

/**
 * Natural / alphanumeric sort comparator (e.g. track2 comes before track10).
 * Case-insensitive, Unicode-aware.
 */
export function naturalSortCompare(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

export function naturalSort<T>(items: T[], keyFn: (item: T) => string): T[] {
  return [...items].sort((a, b) => naturalSortCompare(keyFn(a), keyFn(b)));
}

/**
 * Normalizes a base filename for fuzzy matching:
 * Lowercases, strips punctuation, normalizes spaces and underscores,
 * and strips common track numbering prefixes (e.g., "01 - ", "1. ", "track_01_").
 */
export function normalizeForFuzzyMatch(filename: string): string {
  // Strip extension
  const base = filename.replace(/\.[^/.]+$/, '');
  return base
    .toLowerCase()
    .replace(/^(?:track\s*[-_]?\s*|\d+[\s._-]+)+/i, '') // strip leading track numbers
    .replace(/[._\-+()\[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Levenshtein-based string similarity confidence (0.0 to 1.0).
 */
export function calculateFuzzyConfidence(s1: string, s2: string): number {
  const n1 = normalizeForFuzzyMatch(s1);
  const n2 = normalizeForFuzzyMatch(s2);
  if (n1 === n2) return 1.0;
  if (!n1.length || !n2.length) return 0.0;

  // Simple token overlap + character distance
  const tokens1 = new Set(n1.split(' ').filter(Boolean));
  const tokens2 = new Set(n2.split(' ').filter(Boolean));
  let intersection = 0;
  tokens1.forEach(t => { if (tokens2.has(t)) intersection++; });
  const union = new Set([...tokens1, ...tokens2]).size;
  const jaccard = union > 0 ? intersection / union : 0;

  // Substring check
  if (n1.includes(n2) || n2.includes(n1)) {
    return Math.max(jaccard, 0.85);
  }

  return jaccard;
}

/**
 * Cross-platform filename sanitizer.
 * Cleans reserved characters, strips trailing spaces/dots, checks Windows reserved devices.
 */
export function sanitizeFilename(filename: string, osType: 'windows' | 'linux' | 'darwin' = 'linux'): string {
  if (!filename || filename.trim() === '') {
    return 'unnamed_output.mp4';
  }

  const sanitized = filename.trim();

  // Separate base and extension
  const extMatch = sanitized.match(/\.[^.]+$/);
  let ext = extMatch ? extMatch[0] : '';
  let base = extMatch ? sanitized.slice(0, -ext.length) : sanitized;

  // Strip invalid characters: Windows / POSIX safety
  base = base.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
  ext = ext.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');

  // Strip trailing periods or spaces from base name (invalid on Windows)
  base = base.replace(/[. ]+$/, '').trim();

  // Check reserved names on Windows
  const reservedPattern = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i;
  if (reservedPattern.test(base)) {
    base = `safe_${base}`;
  }

  // Length clamping (keep extension intact)
  if ((base + ext).length > 220) {
    base = base.slice(0, 220 - ext.length);
  }

  return `${base || 'output'}${ext}`;
}

/**
 * Expands naming pattern tokens:
 * {audio_name}, {video_name}, {video_ext}, {index}, {date}, {resolution}, {preset}
 */
export function expandNamingPattern(
  template: string,
  vars: {
    audioName: string;
    videoName: string;
    videoExt: string;
    index: number;
    dateStr?: string;
    resolution?: string;
    preset?: string;
  }
): string {
  const padIndex = (n: number) => n.toString().padStart(3, '0');
  const dateStr = vars.dateStr || new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const resolution = vars.resolution || 'original';
  const preset = vars.preset || 'default';

  // Extract base names without extensions
  const audioBase = vars.audioName.replace(/\.[^/.]+$/, '');
  const videoBase = vars.videoName.replace(/\.[^/.]+$/, '');
  const cleanExt = vars.videoExt.replace(/^\./, '');

  let result = template
    .replace(/\{audio_name\}/g, audioBase)
    .replace(/\{video_name\}/g, videoBase)
    .replace(/\{video_ext\}/g, cleanExt)
    .replace(/\{index\}/g, padIndex(vars.index))
    .replace(/\{date\}/g, dateStr)
    .replace(/\{resolution\}/g, resolution)
    .replace(/\{preset\}/g, preset);

  // If pattern didn't contain an extension, append the video extension
  if (!/\.[a-zA-Z0-9]+$/.test(result)) {
    result = `${result}.${cleanExt}`;
  }

  return sanitizeFilename(result);
}

/**
 * Checks container and codec safety.
 * Returns safe extension and whether a container swap happened.
 */
export function resolveContainerSafety(
  requestedExt: string,
  audioCodec?: string,
  videoCodec?: string,
  isReencode: boolean = false
): { safeExt: string; changed: boolean; reason?: string } {
  const ext = requestedExt.toLowerCase().replace(/^\./, '');

  // Containers that support most modern streams
  if (ext === 'mp4' || ext === 'mkv' || ext === 'mov') {
    // If FLAC or Vorbis audio is stream-copied, MP4 standard can sometimes reject, but MKV handles all
    if (ext === 'mp4' && !isReencode && (audioCodec === 'flac' || audioCodec === 'vorbis')) {
      return {
        safeExt: 'mkv',
        changed: true,
        reason: `Stream-copying ${audioCodec.toUpperCase()} audio is unsafe in MP4 container. Switched to MKV for full codec safety.`
      };
    }
    return { safeExt: ext, changed: false };
  }

  // Legacy or restrictive containers: .avi, .ts, .wmv, .webm
  if (isReencode) {
    // When re-encoding to modern H.264/AAC, standardize on MP4
    return {
      safeExt: 'mp4',
      changed: true,
      reason: `Re-encoding to modern H.264/AAC is optimized for MP4 container rather than legacy .${ext}.`
    };
  }

  // If source is webm with vp8/vp9 and opus/vorbis, webm is fine, otherwise fallback to mkv
  if (ext === 'webm') {
    if (videoCodec === 'vp8' || videoCodec === 'vp9' || videoCodec === 'av1') {
      return { safeExt: 'webm', changed: false };
    }
    return {
      safeExt: 'mkv',
      changed: true,
      reason: 'WebM requires VP8/VP9/AV1 video codec. Switched to MKV container.'
    };
  }

  // Default fallback for other containers
  return {
    safeExt: 'mp4',
    changed: true,
    reason: `Container .${ext} has limited modern compatibility. Defaulted to standard .mp4.`
  };
}

/**
 * Smart "Copy vs Encode" analyzer:
 * Determines if a render job can use stream-copy or must re-encode, with explicit reasons.
 */
export function computeCopyVsEncode(
  clip: MediaProbe,
  audio: MediaProbe,
  options: RenderOptions
): { mode: 'copy' | 'encode'; reason: string } {
  // 1. Video filters force re-encode
  if (options.nightModeEnabled) {
    return {
      mode: 'encode',
      reason: 'Re-encode required: Night mode color grading and vignette filter active.'
    };
  }

  if (options.vhsPreset && options.vhsPreset !== 'none' && options.vhsPreset !== 'off') {
    return {
      mode: 'encode',
      reason: `Re-encode required: VHS effect preset "${options.vhsPreset}" active.`
    };
  }

  if (options.noiseStaticEnabled) {
    return {
      mode: 'encode',
      reason: 'Re-encode required: Film grain & static burst synthesis filter active.'
    };
  }

  if (options.overlayEnabled && (options.overlayPath || options.overlayFolder)) {
    const animType = options.overlayAnimation === 'bounce' ? 'bouncing VCD logo' : 'full-frame';
    return {
      mode: 'encode',
      reason: options.overlayPath
        ? `Re-encode required: Graphic overlay composition active (${animType}).`
        : `Re-encode required: Graphic overlay folder active (${animType}, random image stamped per render).`
    };
  }

  // 2. Resolution changes force scaling and re-encode
  if (options.resolution && options.resolution !== 'original') {
    return {
      mode: 'encode',
      reason: `Re-encode required: Resolution changed to ${options.resolution} (Lanczos scale & letterboxing).`
    };
  }

  // 3. Check video codec compatibility for stream-copy
  const allowedCopyVideoCodecs = ['h264', 'hevc', 'h265', 'vp9', 'av1'];
  if (clip.videoCodec && !allowedCopyVideoCodecs.includes(clip.videoCodec.toLowerCase())) {
    return {
      mode: 'encode',
      reason: `Re-encode required: Source video codec "${clip.videoCodec}" requires transcode to H.264.`
    };
  }

  // 4. Default fast path: Stream copy!
  return {
    mode: 'copy',
    reason: 'Stream copy (fast): Native video resolution, standard codec, and no visual filters. Video will remux and loop with zero generation loss.'
  };
}

/**
 * Core Auto-Pairing Engine supporting all 6 modes:
 * 1. Match by name (with exact + fuzzy fallback)
 * 2. Match by order (1:1)
 * 3. One video for all audio
 * 4. Cycle / round-robin
 * 5. Random (seeded)
 * 6. Manual
 */
export function autoPair(
  audioFiles: MediaProbe[],
  videoFiles: MediaProbe[],
  mode: PairingMode,
  options: {
    singleVideoId?: string;
    namingTemplate?: string;
    seed?: number;
    fuzzyConfidenceThreshold?: number;
    renderOptions?: RenderOptions;
  } = {}
): AutoPairPlan {
  const namingTemplate = options.namingTemplate || '{audio_name}.{video_ext}';
  const renderOptions = options.renderOptions || { resolution: 'original' };
  const fuzzyThreshold = options.fuzzyConfidenceThreshold ?? 0.65;
  const seed = options.seed ?? 42;

  const pairings: PairingResult[] = [];
  const unmatchedAudio: MediaProbe[] = [];
  const unmatchedVideo: MediaProbe[] = [];
  const warnings: string[] = [];

  if (audioFiles.length === 0) {
    warnings.push('No audio files found to pair.');
    return { pairings, unmatchedAudio, unmatchedVideo: [...videoFiles], warnings };
  }
  if (videoFiles.length === 0) {
    warnings.push('No video clips found to pair.');
    return { pairings, unmatchedAudio: [...audioFiles], unmatchedVideo, warnings };
  }

  // Natural sort files first for deterministic order
  const sortedAudio = naturalSort(audioFiles, a => a.filename);
  const sortedVideo = naturalSort(videoFiles, v => v.filename);

  const createPairing = (
    audio: MediaProbe,
    video: MediaProbe,
    index: number,
    confidence?: number
  ): PairingResult => {
    const rawExt = video.filename.split('.').pop() || 'mp4';
    const copyDecision = computeCopyVsEncode(video, audio, renderOptions);
    const containerSafety = resolveContainerSafety(rawExt, audio.audioCodec, video.videoCodec, copyDecision.mode === 'encode');

    let outputName = expandNamingPattern(namingTemplate, {
      audioName: audio.filename,
      videoName: video.filename,
      videoExt: containerSafety.safeExt,
      index: index + 1,
      resolution: renderOptions.resolution,
      preset: renderOptions.vhsPreset
    });

    // Never overwrite source video clip if output name matches input video filename
    if (outputName.toLowerCase() === video.filename.toLowerCase()) {
      const extMatch = outputName.match(/\.[^.]+$/);
      const ext = extMatch ? extMatch[0] : '';
      const base = outputName.replace(/\.[^.]+$/, '');
      outputName = `${base}_merged${ext}`;
    }

    const loopCount = video.duration > 0 ? parseFloat((audio.duration / video.duration).toFixed(2)) : 1;

    const safeAudioKey = audio.filename.replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeVideoKey = video.filename.replace(/[^a-zA-Z0-9_-]/g, '_');
    const stableId = `pair_${index}_${safeAudioKey}_${safeVideoKey}`;

    return {
      id: stableId,
      audio,
      video,
      outputName,
      mode: copyDecision.mode,
      modeReason: copyDecision.reason,
      loopCount,
      confidence,
      excluded: false,
    };
  };

  switch (mode) {
    case 'match_name': {
      const usedVideoIndices = new Set<number>();

      sortedAudio.forEach((audio, aIdx) => {
        const audioNorm = normalizeForFuzzyMatch(audio.filename);
        let bestMatchIdx = -1;
        let bestScore = 0;

        // 1. Exact match check first
        for (let vIdx = 0; vIdx < sortedVideo.length; vIdx++) {
          if (usedVideoIndices.has(vIdx)) continue;
          const videoNorm = normalizeForFuzzyMatch(sortedVideo[vIdx].filename);
          if (audioNorm === videoNorm) {
            bestMatchIdx = vIdx;
            bestScore = 1.0;
            break;
          }
        }

        // 2. Fuzzy match if no exact match
        if (bestMatchIdx === -1) {
          for (let vIdx = 0; vIdx < sortedVideo.length; vIdx++) {
            if (usedVideoIndices.has(vIdx)) continue;
            const score = calculateFuzzyConfidence(audio.filename, sortedVideo[vIdx].filename);
            if (score > bestScore && score >= fuzzyThreshold) {
              bestScore = score;
              bestMatchIdx = vIdx;
            }
          }
        }

        if (bestMatchIdx !== -1) {
          usedVideoIndices.add(bestMatchIdx);
          pairings.push(createPairing(audio, sortedVideo[bestMatchIdx], pairings.length, bestScore));
        } else {
          unmatchedAudio.push(audio);
        }
      });

      // Collect unused videos
      sortedVideo.forEach((video, vIdx) => {
        if (!usedVideoIndices.has(vIdx)) {
          unmatchedVideo.push(video);
        }
      });

      if (unmatchedAudio.length > 0) {
        warnings.push(`${unmatchedAudio.length} audio file(s) had no matching video clip by name.`);
      }
      if (unmatchedVideo.length > 0) {
        warnings.push(`${unmatchedVideo.length} video clip(s) were not matched by any audio file.`);
      }
      break;
    }

    case 'order_1_to_1': {
      if (sortedVideo.length === 1) {
        // Single video clip loops for all audio tracks
        sortedAudio.forEach((audio, idx) => {
          pairings.push(createPairing(audio, sortedVideo[0], idx, 1.0));
        });
        break;
      }
      const minLen = Math.min(sortedAudio.length, sortedVideo.length);
      for (let i = 0; i < minLen; i++) {
        pairings.push(createPairing(sortedAudio[i], sortedVideo[i], i, 1.0));
      }
      for (let i = minLen; i < sortedAudio.length; i++) {
        unmatchedAudio.push(sortedAudio[i]);
      }
      for (let i = minLen; i < sortedVideo.length; i++) {
        unmatchedVideo.push(sortedVideo[i]);
      }
      if (sortedAudio.length > sortedVideo.length) {
        warnings.push(`More audio (${sortedAudio.length}) than video (${sortedVideo.length}). Last ${unmatchedAudio.length} audio file(s) remain unmatched in 1:1 mode. Consider "Cycle" mode.`);
      } else if (sortedVideo.length > sortedAudio.length) {
        warnings.push(`More video (${sortedVideo.length}) than audio (${sortedAudio.length}). ${unmatchedVideo.length} video clip(s) remain unused.`);
      }
      break;
    }

    case 'one_for_all': {
      let selectedVideo = sortedVideo[0];
      if (options.singleVideoId) {
        const found = sortedVideo.find(v => v.path === options.singleVideoId || v.filename === options.singleVideoId);
        if (found) selectedVideo = found;
      }
      sortedAudio.forEach((audio, idx) => {
        pairings.push(createPairing(audio, selectedVideo, idx, 1.0));
      });
      // All other videos are unused
      sortedVideo.forEach(v => {
        if (v.path !== selectedVideo.path) unmatchedVideo.push(v);
      });
      break;
    }

    case 'cycle': {
      sortedAudio.forEach((audio, idx) => {
        const video = sortedVideo[idx % sortedVideo.length];
        pairings.push(createPairing(audio, video, idx, 1.0));
      });
      if (sortedVideo.length > sortedAudio.length) {
        const unused = sortedVideo.slice(sortedAudio.length);
        unmatchedVideo.push(...unused);
        warnings.push(`${unused.length} video clip(s) were not reached in the cycle because audio count is smaller.`);
      }
      break;
    }

    case 'random_seeded': {
      // Deterministic PRNG using LCG
      let currentSeed = seed;
      const nextRand = () => {
        currentSeed = (currentSeed * 1664525 + 1013904223) % 4294967296;
        return currentSeed / 4294967296;
      };

      let lastVideoIdx = -1;
      sortedAudio.forEach((audio, idx) => {
        let videoIdx = Math.floor(nextRand() * sortedVideo.length);
        // Avoid immediate repeat if more than 1 video available
        if (sortedVideo.length > 1 && videoIdx === lastVideoIdx) {
          videoIdx = (videoIdx + 1) % sortedVideo.length;
        }
        lastVideoIdx = videoIdx;
        pairings.push(createPairing(audio, sortedVideo[videoIdx], idx, 1.0));
      });
      break;
    }

    case 'manual': {
      // In manual mode, create a row for each audio track so the user can customize each row
      sortedAudio.forEach((audio, idx) => {
        const video = sortedVideo[idx % sortedVideo.length];
        pairings.push(createPairing(audio, video, idx, 1.0));
      });
      break;
    }

    default: {
      const minLen = Math.min(sortedAudio.length, sortedVideo.length);
      for (let i = 0; i < minLen; i++) {
        pairings.push(createPairing(sortedAudio[i], sortedVideo[i], i, 1.0));
      }
      for (let i = minLen; i < sortedAudio.length; i++) {
        unmatchedAudio.push(sortedAudio[i]);
      }
      for (let i = minLen; i < sortedVideo.length; i++) {
        unmatchedVideo.push(sortedVideo[i]);
      }
      break;
    }
  }

  return { pairings, unmatchedAudio, unmatchedVideo, warnings };
}

/**
 * Collision handling:
 * Resolves duplicate output filenames in a batch according to policy.
 */
export function resolveCollisions(
  pairings: PairingResult[],
  policy: CollisionPolicy = 'suffix',
  existingDiskFiles: Set<string> = new Set()
): PairingResult[] {
  const seenNames = new Map<string, number>();
  const results: PairingResult[] = [];

  for (const item of pairings) {
    if (item.excluded) {
      results.push(item);
      continue;
    }

    let targetName = item.outputName;
    const count = seenNames.get(targetName) || (existingDiskFiles.has(targetName) ? 1 : 0);

    if (count > 0) {
      if (policy === 'skip') {
        results.push({
          ...item,
          excluded: true,
          modeReason: `Skipped: Output name "${targetName}" conflicts with another job or existing file.`
        });
        continue;
      } else if (policy === 'suffix') {
        const extMatch = targetName.match(/\.[^.]+$/);
        const ext = extMatch ? extMatch[0] : '';
        const base = targetName.replace(/\.[^.]+$/, '');
        let suffixCount = count + 1;
        let candidate = `${base} (${suffixCount})${ext}`;
        while (seenNames.has(candidate) || existingDiskFiles.has(candidate)) {
          suffixCount++;
          candidate = `${base} (${suffixCount})${ext}`;
        }
        seenNames.set(targetName, count + 1);
        seenNames.set(candidate, 1);
        results.push({ ...item, outputName: candidate });
        continue;
      } else {
        // overwrite policy: keep name as is
        seenNames.set(targetName, count + 1);
        results.push(item);
        continue;
      }
    }

    seenNames.set(targetName, 1);
    results.push(item);
  }

  return results;
}

/**
 * Segment planner for crash-safe resume:
 * Breaks total render duration into continuous chunks (e.g. 120s segments).
 */
export interface RenderSegment {
  index: number;
  startTime: number;
  duration: number;
  tempFilename: string;
  completed: boolean;
}

export function planSegments(
  totalDurationSec: number,
  segmentLengthSec: number = 120,
  tempPrefix: string = 'seg'
): RenderSegment[] {
  if (totalDurationSec <= 0) return [];
  const segments: RenderSegment[] = [];
  let currentStart = 0;
  let idx = 0;

  while (currentStart < totalDurationSec) {
    const dur = Math.min(segmentLengthSec, totalDurationSec - currentStart);
    segments.push({
      index: idx,
      startTime: parseFloat(currentStart.toFixed(3)),
      duration: parseFloat(dur.toFixed(3)),
      tempFilename: `${tempPrefix}_${idx.toString().padStart(4, '0')}.ts`,
      completed: false,
    });
    currentStart += dur;
    idx++;
  }

  return segments;
}
