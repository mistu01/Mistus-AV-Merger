/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { MediaProbe } from '../utils/engine';

export const SAMPLE_AUDIO_FILES: MediaProbe[] = [
  {
    filename: '01 - Midnight Neon Drive.mp3',
    path: '/media/audio/01 - Midnight Neon Drive.mp3',
    duration: 218.4, // 3m 38s
    format: 'mp3',
    sizeBytes: 8736000,
    audioCodec: 'mp3',
    channels: 2,
    sampleRate: 44100,
  },
  {
    filename: '02 - Cyberpunk Rain Echoes.wav',
    path: '/media/audio/02 - Cyberpunk Rain Echoes.wav',
    duration: 184.2, // 3m 04s
    format: 'wav',
    sizeBytes: 32512000,
    audioCodec: 'pcm_s16le',
    channels: 2,
    sampleRate: 48000,
  },
  {
    filename: '03 - Synthwave Sunset Horizon.flac',
    path: '/media/audio/03 - Synthwave Sunset Horizon.flac',
    duration: 245.0, // 4m 05s
    format: 'flac',
    sizeBytes: 24500000,
    audioCodec: 'flac',
    channels: 2,
    sampleRate: 48000,
  },
  {
    filename: '04 - Tokyo Alleyway Lo-Fi.m4a',
    path: '/media/audio/04 - Tokyo Alleyway Lo-Fi.m4a',
    duration: 162.7, // 2m 42s
    format: 'm4a',
    sizeBytes: 5206400,
    audioCodec: 'aac',
    channels: 2,
    sampleRate: 44100,
  },
  {
    filename: '05 - Astral Drift Memories.mp3',
    path: '/media/audio/05 - Astral Drift Memories.mp3',
    duration: 275.5, // 4m 35s
    format: 'mp3',
    sizeBytes: 11020000,
    audioCodec: 'mp3',
    channels: 2,
    sampleRate: 44100,
  },
  {
    filename: '06 - Deep Space Station Ambient.ogg',
    path: '/media/audio/06 - Deep Space Station Ambient.ogg',
    duration: 310.0, // 5m 10s
    format: 'ogg',
    sizeBytes: 9920000,
    audioCodec: 'vorbis',
    channels: 2,
    sampleRate: 48000,
  },
];

export const SAMPLE_VIDEO_CLIPS: MediaProbe[] = [
  {
    filename: 'midnight_neon_drive_loop.mp4',
    path: '/media/video/midnight_neon_drive_loop.mp4',
    duration: 18.5,
    format: 'mp4',
    sizeBytes: 24200000,
    videoCodec: 'h264',
    width: 1920,
    height: 1080,
    fps: 30,
    hasAudio: false,
  },
  {
    filename: 'cyberpunk_rain_echoes.mp4',
    path: '/media/video/cyberpunk_rain_echoes.mp4',
    duration: 24.0,
    format: 'mp4',
    sizeBytes: 31400000,
    videoCodec: 'h264',
    width: 1920,
    height: 1080,
    fps: 60,
    hasAudio: false,
  },
  {
    filename: 'retro_grid_wireframe.mp4',
    path: '/media/video/retro_grid_wireframe.mp4',
    duration: 15.0,
    format: 'mp4',
    sizeBytes: 18900000,
    videoCodec: 'h264',
    width: 1920,
    height: 1080,
    fps: 30,
    hasAudio: false,
  },
  {
    filename: 'tokyo_neon_alley.mkv',
    path: '/media/video/tokyo_neon_alley.mkv',
    duration: 30.0,
    format: 'mkv',
    sizeBytes: 42100000,
    videoCodec: 'hevc',
    width: 2560,
    height: 1440,
    fps: 24,
    hasAudio: false,
  },
];
