/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeVersionCode,
  parseSemVer,
  naturalSort,
  naturalSortCompare,
  normalizeForFuzzyMatch,
  calculateFuzzyConfidence,
  sanitizeFilename,
  expandNamingPattern,
  resolveContainerSafety,
  computeCopyVsEncode,
  autoPair,
  resolveCollisions,
  planSegments,
  type MediaProbe,
  type RenderOptions,
} from './engine';

test('Version Code calculation satisfies monotonic formula MAJOR*10000 + MINOR*100 + PATCH', () => {
  assert.equal(computeVersionCode(0, 1, 0), 100);
  assert.equal(computeVersionCode(0, 5, 0), 500);
  assert.equal(computeVersionCode(1, 0, 0), 10000);
  assert.equal(computeVersionCode(1, 2, 3), 10203);
  assert.throws(() => computeVersionCode(-1, 0, 0));
});

test('parseSemVer parses clean versions and pre-releases', () => {
  const v1 = parseSemVer('0.5.0');
  assert.equal(v1.major, 0);
  assert.equal(v1.minor, 5);
  assert.equal(v1.patch, 0);
  assert.equal(v1.versionCode, 500);

  const v2 = parseSemVer('v1.2.3-rc.1');
  assert.equal(v2.major, 1);
  assert.equal(v2.minor, 2);
  assert.equal(v2.patch, 3);
  assert.equal(v2.prerelease, 'rc.1');
  assert.equal(v2.versionCode, 10203);
});

test('Natural sort orders numbers within strings correctly (e.g. track2 before track10)', () => {
  const files = ['track10.mp3', 'track1.mp3', 'track20.mp3', 'track2.mp3', 'track03.mp3'];
  const sorted = naturalSort(files, f => f);
  assert.deepEqual(sorted, ['track1.mp3', 'track2.mp3', 'track03.mp3', 'track10.mp3', 'track20.mp3']);
});

test('Fuzzy matching normalizes prefixes and computes high confidence for matching titles', () => {
  const audioName = '01 - Midnight Neon Drive.mp3';
  const videoName = 'midnight_neon_drive_loop.mp4';
  const conf = calculateFuzzyConfidence(audioName, videoName);
  assert.ok(conf > 0.8, `Confidence was ${conf}, expected > 0.8`);
});

test('sanitizeFilename removes illegal chars and handles Windows reserved names', () => {
  assert.equal(sanitizeFilename('track:1*special?.mp4'), 'track_1_special_.mp4');
  assert.equal(sanitizeFilename('CON.mp4'), 'safe_CON.mp4');
  assert.equal(sanitizeFilename('trailing spaces and dots. . .mp4'), 'trailing spaces and dots.mp4');
});

test('expandNamingPattern expands all tokens correctly', () => {
  const expanded = expandNamingPattern(
    '{index} - {audio_name} [{video_name}] ({resolution}).{video_ext}',
    {
      audioName: 'Summer Breeze.flac',
      videoName: 'ocean_waves.mp4',
      videoExt: 'mp4',
      index: 1,
      resolution: '1080p',
      preset: 'Clean VHS',
    }
  );
  assert.equal(expanded, '001 - Summer Breeze [ocean_waves] (1080p).mp4');
});

test('resolveContainerSafety warns and swaps unsafe containers', () => {
  // FLAC in MP4 copy mode is unsafe -> swaps to MKV
  const flacCheck = resolveContainerSafety('mp4', 'flac', 'h264', false);
  assert.equal(flacCheck.safeExt, 'mkv');
  assert.equal(flacCheck.changed, true);

  // Standard AAC in MP4 is safe
  const aacCheck = resolveContainerSafety('mp4', 'aac', 'h264', false);
  assert.equal(aacCheck.safeExt, 'mp4');
  assert.equal(aacCheck.changed, false);
});

test('computeCopyVsEncode selects Stream Copy for native unaltered streams', () => {
  const clip: MediaProbe = {
    filename: 'clip.mp4',
    path: '/path/clip.mp4',
    duration: 30,
    format: 'mov,mp4',
    sizeBytes: 10485760,
    videoCodec: 'h264',
    width: 1920,
    height: 1080,
  };
  const audio: MediaProbe = {
    filename: 'song.mp3',
    path: '/path/song.mp3',
    duration: 180,
    format: 'mp3',
    sizeBytes: 5242880,
    audioCodec: 'mp3',
  };

  const copyResult = computeCopyVsEncode(clip, audio, { resolution: 'original' });
  assert.equal(copyResult.mode, 'copy');

  // Changing resolution forces re-encode
  const resResult = computeCopyVsEncode(clip, audio, { resolution: '720p' });
  assert.equal(resResult.mode, 'encode');
  assert.match(resResult.reason, /Resolution changed/);

  // VHS preset forces re-encode
  const vhsResult = computeCopyVsEncode(clip, audio, { resolution: 'original', vhsPreset: 'Clean VHS' });
  assert.equal(vhsResult.mode, 'encode');
  assert.match(vhsResult.reason, /VHS effect preset/);
});

// Mock probes helper
function createProbes(names: string[], duration: number, type: 'audio' | 'video'): MediaProbe[] {
  return names.map(name => ({
    filename: name,
    path: `/media/${name}`,
    duration,
    format: type === 'audio' ? 'mp3' : 'mp4',
    sizeBytes: 5000000,
    audioCodec: type === 'audio' ? 'mp3' : undefined,
    videoCodec: type === 'video' ? 'h264' : undefined,
  }));
}

test('autoPair: Match by name matches exact and fuzzy filenames', () => {
  const audio = createProbes(['01_Intro.mp3', '02_Outro.mp3', 'Bonus.mp3'], 120, 'audio');
  const video = createProbes(['intro.mp4', 'outro.mp4', 'unrelated.mp4'], 15, 'video');

  const plan = autoPair(audio, video, 'match_name');
  assert.equal(plan.pairings.length, 2);
  assert.equal(plan.unmatchedAudio.length, 1);
  assert.equal(plan.unmatchedAudio[0].filename, 'Bonus.mp3');
  assert.equal(plan.unmatchedVideo.length, 1);
  assert.equal(plan.unmatchedVideo[0].filename, 'unrelated.mp4');
});

test('autoPair: Match by order 1:1 handles count mismatches', () => {
  const audio = createProbes(['a1.mp3', 'a2.mp3', 'a3.mp3'], 100, 'audio');
  const video = createProbes(['v1.mp4', 'v2.mp4'], 20, 'video');

  const plan = autoPair(audio, video, 'order_1_to_1');
  assert.equal(plan.pairings.length, 2);
  assert.equal(plan.unmatchedAudio.length, 1);
  assert.equal(plan.unmatchedAudio[0].filename, 'a3.mp3');
  assert.ok(plan.warnings.some(w => w.includes('More audio')));
});

test('autoPair: Cycle mode reuses videos in round-robin sequence', () => {
  const audio = createProbes(['a1.mp3', 'a2.mp3', 'a3.mp3', 'a4.mp3', 'a5.mp3'], 100, 'audio');
  const video = createProbes(['v1.mp4', 'v2.mp4'], 20, 'video');

  const plan = autoPair(audio, video, 'cycle');
  assert.equal(plan.pairings.length, 5);
  assert.equal(plan.pairings[0].video.filename, 'v1.mp4');
  assert.equal(plan.pairings[1].video.filename, 'v2.mp4');
  assert.equal(plan.pairings[2].video.filename, 'v1.mp4');
  assert.equal(plan.pairings[3].video.filename, 'v2.mp4');
  assert.equal(plan.pairings[4].video.filename, 'v1.mp4');
});

test('autoPair: Random seeded produces deterministic pairings', () => {
  const audio = createProbes(['a1.mp3', 'a2.mp3', 'a3.mp3', 'a4.mp3'], 100, 'audio');
  const video = createProbes(['v1.mp4', 'v2.mp4', 'v3.mp4'], 20, 'video');

  const plan1 = autoPair(audio, video, 'random_seeded', { seed: 12345 });
  const plan2 = autoPair(audio, video, 'random_seeded', { seed: 12345 });

  assert.deepEqual(
    plan1.pairings.map(p => p.video.filename),
    plan2.pairings.map(p => p.video.filename)
  );
});

test('resolveCollisions applies suffix and skip policies', () => {
  const audio1 = createProbes(['Song.mp3'], 100, 'audio')[0];
  const audio2 = createProbes(['Song.mp3'], 100, 'audio')[0];
  const video = createProbes(['clip.mp4'], 20, 'video')[0];

  const plan = autoPair([audio1, audio2], [video], 'one_for_all');
  // Both have outputName: 'Song.mp4'
  assert.equal(plan.pairings[0].outputName, 'Song.mp4');
  assert.equal(plan.pairings[1].outputName, 'Song.mp4');

  const suffixed = resolveCollisions(plan.pairings, 'suffix');
  assert.equal(suffixed[0].outputName, 'Song.mp4');
  assert.equal(suffixed[1].outputName, 'Song (2).mp4');

  const skipped = resolveCollisions(plan.pairings, 'skip');
  assert.equal(skipped[0].excluded, false);
  assert.equal(skipped[1].excluded, true);
});

test('planSegments cuts total duration into continuous segments', () => {
  const segments = planSegments(250, 100);
  assert.equal(segments.length, 3);
  assert.equal(segments[0].startTime, 0);
  assert.equal(segments[0].duration, 100);
  assert.equal(segments[1].startTime, 100);
  assert.equal(segments[1].duration, 100);
  assert.equal(segments[2].startTime, 200);
  assert.equal(segments[2].duration, 50);
});
