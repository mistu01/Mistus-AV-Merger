# Mistus AV Merger

**Mistus AV Merger** is a portable, cross-platform (Windows, Linux, macOS) application designed to combine a short video clip with a longer audio file, looping the video seamlessly to match the audio length. It supports single renders and bulk renders with an intelligent auto-pairing engine, hardware GPU acceleration, authentic VHS and Night mode visual filters, and crash-safe segment-based resuming.

It runs a local web server bound strictly to `127.0.0.1`, picks an ephemeral free port automatically, and opens the default browser on launch. Zero installation required.

---

## Key Features

1. **Seamless Looped Render**:
   - Loops video continuously to match audio length exactly, trimmed cleanly at the end.
   - Keyframe-aligned remuxing avoids seam stutter or visible glitches.
2. **Smart "Copy vs Encode" Engine**:
   - Evaluates input streams before rendering: uses blazing-fast **Stream Copy (Remux)** whenever possible (zero generation loss).
   - Automatically detects when re-encoding is mandatory (filters, scaling, non-standard codecs) and provides clear rationale in the UI.
3. **Hardware Acceleration & CPU Control**:
   - Verifies hardware encoders via real micro-encodes: NVIDIA NVENC, Intel QuickSync (QSV), AMD AMF, Apple VideoToolbox, and Linux VAAPI.
   - Discrete GPU prioritized automatically over integrated graphics.
   - OS process priority and thread profiles: Aggressive, Balanced, Low, Idle (via `psutil`).
4. **Visual Effects & VHS Presets Studio**:
   - **Night Mode**: Cool blue grading, crushed shadows, adjustable edge vignette.
   - **7 Authentic VHS Presets**: Clean VHS, Worn Tape, Tracking Errors, Chroma Bleed, Camcorder 90s, Security Cam, and Heavy Degradation.
   - **Film Grain & Static Synthesis**: Analog noise bursts, head-switching tear band, reproducible RNG seed.
   - **5-Second Sample Preview**: Instant low-res preview before committing to long renders.
5. **Bulk Scan & Auto-Pair Engine**:
   - Scans folders of audio and video with `ffprobe` verification and `mtime+size` caching.
   - 6 Auto-Pairing modes:
     1. **Match by Name**: Exact + fuzzy matching (normalizes track numbers, punctuation, spaces).
     2. **Match by Order (1:1)**: Nth audio paired with Nth video after natural alphanumeric sort.
     3. **One for All**: Single video clip looped across all audio tracks.
     4. **Cycle (Round-Robin)**: Rotates video clips evenly across audio tracks.
     5. **Random (Seeded)**: Reproducible pseudo-random distribution with immediate repeat prevention.
     6. **Manual Override**: Interactive pairing table with inline clip replacement and exclusion.
6. **Configurable Output Naming & Collision Safety**:
   - Token templates: `{audio_name}`, `{video_name}`, `{video_ext}`, `{index}`, `{date}`, `{resolution}`, `{preset}`.
   - Collision policies: `auto-suffix` (e.g. `Song (2).mp4`), `skip`, or `overwrite`.
   - Automatic container safety fallback (e.g., switches to `.mkv` when copying FLAC audio).
7. **Crash-Safe Segment Resuming**:
   - Renders in continuous time chunks (e.g., 120s segments) and stitches them using FFmpeg concat demuxer.
   - An interrupted render resumes from the last completed segment without restarting from zero.
8. **Portable & Offline**:
   - Self-contained portable mode via `portable.flag`.
   - 100% offline; zero analytics, zero external network calls.

---

## Architecture Overview

```
                      +---------------------------------------+
                      |       Web UI (Browser / Port 3000)    |
                      |   React + Tailwind + Real-Time Canvas |
                      +-------------------+-------------------+
                                          |
                        HTTP / WebSocket  | (127.0.0.1 only)
                                          v
                      +---------------------------------------+
                      |        FastAPI / Uvicorn Server       |
                      +-------------------+-------------------+
                                          |
         +--------------------------------+--------------------------------+
         |                                |                                |
         v                                v                                v
+------------------+             +------------------+             +------------------+
|  Scanner & Probe |             |  Auto-Pairing &  |             |  Hardware Detect |
|  - ffprobe cache |             |  Naming Engine   |             |  - NVENC / QSV   |
|  - Natural sort  |             |  - 6 Modes       |             |  - AMF / VToolbox|
+--------+---------+             |  - Collision pol |             +--------+---------+
         |                       +--------+---------+                      |
         +--------------------------------+--------------------------------+
                                          |
                                          v
                      +---------------------------------------+
                      |       FFmpeg Pipeline Builder         |
                      |   - Stream Copy Loop (-stream_loop -1)|
                      |   - Re-encode (Lanczos + VHS + Curves)|
                      +-------------------+-------------------+
                                          |
                                          v
                      +---------------------------------------+
                      |      Job Queue & Segment Planner      |
                      |   - Crash-safe chunking & concat      |
                      |   - Process priority (psutil / nice)  |
                      +-------------------+-------------------+
                                          |
                                          v
                      +---------------------------------------+
                      |       Bundled FFmpeg / FFprobe        |
                      +---------------------------------------+
```

---

## How the Copy vs. Encode Decision Works

| Condition | Selected Mode | Reason |
| :--- | :---: | :--- |
| Native resolution, standard codec (H.264/HEVC), no visual filters | **Stream Copy (Fast)** | Zero loss, near-instant remux using `-stream_loop -1 -c:v copy`. |
| Resolution changed (e.g. to 1080p, 720p) | **Re-encode** | Scaling requires video decode and Lanczos filter interpolation. |
| VHS preset active (e.g. Clean VHS, Worn Tape) | **Re-encode** | Filtergraph (`gblur`, `chromashift`, `curves`) modifies pixels. |
| Night mode enabled | **Re-encode** | Color grading curves, blue tint, and vignette filters applied. |
| Noise / static bursts enabled | **Re-encode** | Generative film grain (`noise=alls=18:allf=t+u`) synthesized. |
| Alpha image overlay applied | **Re-encode** | Complex filter composition (`[0:v][1:v]overlay`) executed. |

---

## Bulk Pairing Modes & Examples

Given:
- **Audio tracks**: `01_Intro.mp3` (2m), `02_Chorus.mp3` (3m), `03_Outro.mp3` (1m)
- **Video clips**: `clip_neon.mp4` (20s), `clip_retro.mp4` (15s)

1. **Match by Name**:
   - Matches base filenames after stripping track numbers and symbols.
   - Example: `01 - intro.mp3` pairs with `intro_loop.mp4`.
2. **Match by Order (1:1)**:
   - `01_Intro.mp3` &rarr; `clip_neon.mp4`
   - `02_Chorus.mp3` &rarr; `clip_retro.mp4`
   - `03_Outro.mp3` &rarr; *Unmatched (Warning emitted suggesting Cycle mode)*
3. **One for All**:
   - `01_Intro.mp3` &rarr; `clip_neon.mp4`
   - `02_Chorus.mp3` &rarr; `clip_neon.mp4`
   - `03_Outro.mp3` &rarr; `clip_neon.mp4`
4. **Cycle (Round-Robin)**:
   - `01_Intro.mp3` &rarr; `clip_neon.mp4`
   - `02_Chorus.mp3` &rarr; `clip_retro.mp4`
   - `03_Outro.mp3` &rarr; `clip_neon.mp4` *(reused in rotation)*
5. **Random (Seeded)**:
   - Uses deterministic pseudo-random seed so repeating the batch with seed `42` yields the exact same pairings. Avoids consecutive duplicate clips.
6. **Manual Override**:
   - Directly swap clips or exclude individual rows inside the table before queueing.

---

## Output Naming & Safety Rules

- **Default pattern**: `{audio_name}.{video_ext}`
- **Available tokens**:
  - `{audio_name}`: Base name of audio track (e.g. `Track01`)
  - `{video_name}`: Base name of video clip (e.g. `LoopA`)
  - `{video_ext}`: Extension (e.g. `mp4`, `mkv`)
  - `{index}`: 3-digit zero-padded job number (`001`, `002`)
  - `{date}`: Build timestamp (`YYYYMMDD`)
  - `{resolution}`: Target resolution (`1080p`, `original`)
  - `{preset}`: Name of applied VHS preset
- **Container Safety Fallback**:
  - If source is `.mp4` and audio is FLAC or Vorbis, stream-copying into MP4 is invalid. The engine automatically promotes the container to `.mkv`.
  - Windows reserved names (`CON`, `PRN`, `AUX`, `NUL`) and invalid characters (`<>:"/\|?*`) are sanitized.
- **Collision Policy**:
  - `auto-suffix`: `Track.mp4` &rarr; `Track (2).mp4`
  - `skip`: Omits conflicting items from queue with notice
  - `overwrite`: Replaces existing file on disk

---

## Hardware Acceleration Support Matrix

| Platform | Hardware Encoder | Driver / Framework | Auto-Detected |
| :--- | :--- | :--- | :---: |
| **Windows** | NVIDIA NVENC (`h264_nvenc`, `hevc_nvenc`) | CUDA / NVENC | &check; |
| **Windows** | AMD AMF (`h264_amf`, `hevc_amf`) | AMD Adrenalin | &check; |
| **Windows** | Intel QuickSync (`h264_qsv`) | Intel Graphics Driver | &check; |
| **Linux** | NVIDIA NVENC (`h264_nvenc`) | NVIDIA Proprietary Driver | &check; |
| **Linux** | VAAPI (`h264_vaapi`) | `/dev/dri/renderD128` | &check; |
| **macOS** | Apple VideoToolbox (`h264_videotoolbox`) | CoreMedia / Metal | &check; |
| **All OS** | CPU Software (`libx264`, `libx265`) | Multithreaded CPU Fallback | &check; |

---

## Building from Source

### Prerequisites
- Python 3.11+
- Node.js 20+ and npm
- FFmpeg 4.4+ (a checksum-verified static build can be fetched automatically, see below)

```bash
# 1. Clone repository
git clone https://github.com/mistu01/Mistus-AV-Merger.git
cd Mistus-AV-Merger

# 2. Install Python dependencies
python -m pip install -e ".[dev]"

# 3. Build Web UI
npm ci
npm run build

# 4. Fetch pinned, SHA256-verified static FFmpeg/FFprobe into ./bin
python scripts/fetch_ffmpeg.py

# 5. Run tests
pytest -v tests/
npx tsx --test src/utils/engine.test.ts

# 6. Launch local application
python -m mistus_av_merger
```

Handy CLI flags: `--version`, `--port 8080`, `--no-browser`, and
`--self-test` (offline smoke test rendering a 2s clip + 6s tone through the
bundled FFmpeg and verifying the ~6s result with the bundled ffprobe).

### Packaging Portable Standalone Executable

```bash
python scripts/fetch_ffmpeg.py              # ./bin gets verified ffmpeg/ffprobe
python scripts/gen_build_info.py            # refresh build metadata
pyinstaller --clean MistusAVMerger.spec
```

The resulting portable distribution is created in `dist/MistusAVMerger/`.
Continuous builds do exactly this plus a full smoke test; see
`.github/workflows/build-release.yml` and "Releases" below.

---

## Versioning & Release Workflow

- Follows **Semantic Versioning 2.0.0**.
- Single source of truth is the root `VERSION` file.
- Monotonic Android-style integer version code:
  $$\text{versionCode} = \text{MAJOR} \times 10000 + \text{MINOR} \times 100 + \text{PATCH}$$
  *(e.g., `0.6.0` &rarr; `600`, `1.2.3` &rarr; `10203`)*.
- To release a new version (Path A — no manual tagging needed):
  ```bash
  python scripts/bump_version.py minor --push
  ```
  This bumps `VERSION`, rolls `[Unreleased]` into a dated `CHANGELOG.md` section,
  commits, tags, and pushes. The `Build and Release` workflow then publishes the
  bundles automatically.
- Path B — push a tag (`v*.*.*`, must match `VERSION`) instead; the same workflow
  runs on tag pushes.
- GitHub Actions automatically runs CI on pushes/PRs, validates tags against
  `VERSION` and `CHANGELOG.md`, runs the multi-OS build matrix, smoke tests the
  binaries, and publishes the release assets with SHA256 sums.

---

## Releases & Downloads

Every release ships four portable bundles with a `SHA256SUMS.txt` manifest:

| Platform | Bundle | CLI executable | Notes |
| :--- | :--- | :--- | :--- |
| Windows 10+ (x64) | `MistusAVMerger-v*-win-x64.zip` | `MistusAVMerger.exe` | SmartScreen prompt on first run is expected |
| Linux x86_64 | `MistusAVMerger-v*-linux-x64.tar.gz` | `MistusAVMerger` | glibc baseline: built on Ubuntu 22.04+ |
| macOS Intel (x64) | `MistusAVMerger-v*-macos-x64.tar.gz` | `MistusAVMerger` | macOS 10.15+ |
| macOS Apple Silicon (arm64) | `MistusAVMerger-v*-macos-arm64.tar.gz` | `MistusAVMerger` | macOS 11+, ad-hoc signed |

Run it:

```bash
unzip MistusAVMerger-v0.6.0-win-x64.zip -d MistusAVMerger   # Windows
./MistusAVMerger/MistusAVMerger.exe

tar xzf MistusAVMerger-v0.6.0-linux-x64.tar.gz               # Linux / macOS
./MistusAVMerger/MistusAVMerger --port 8080                  # optional fixed port
```

### How releases happen automatically

1. A matching **dated section must exist in `CHANGELOG.md`** (see Releasing in CONTRIBUTING.md).
2. Either:
   - **Path A (no manual tagging):** a push to `main` that changes the `VERSION` file
     (e.g. via `python scripts/bump_version.py minor --push`) makes
     `.github/workflows/build-release.yml` test, build all four bundles, smoke test
     each binary, and create both the tag and the GitHub Release; or
   - **Path B:** push a `v*.*.*` tag (the tag must exactly match `VERSION`).
3. Bundled FFmpeg/FFprobe are pinned, SHA256-verified static builds
   (`scripts/ffmpeg_manifest.json`); the release notes list each bundle's FFmpeg
   version and license flavor.

### macOS Gatekeeper / SmartScreen

macOS binaries are **ad-hoc signed** (no paid Developer ID certificate), so
Gatekeeper quarantines them on first launch. Unblock the whole bundle:

```bash
xattr -cr /path/to/MistusAVMerger
./MistusAVMerger/MistusAVMerger
```

On Windows, click **"More info" → "Run anyway"** at the SmartScreen prompt.

---

## Troubleshooting

- **macOS Gatekeeper / Quarantine**:
  ```bash
  xattr -cr /path/to/MistusAVMerger        # clear quarantine for the whole bundle
  codesign -v -v MistusAVMerger            # ad-hoc signature self-check
  ```
- **Windows SmartScreen**:
  Click "More Info" &rarr; "Run Anyway". Portable executables built without expensive commercial code-signing certificates will trigger standard SmartScreen prompts on first launch.
- **Port Conflicts**:
  Mistus AV Merger selects an available ephemeral port on `127.0.0.1` automatically. If you wish to bind to a fixed port:
  ```bash
  ./MistusAVMerger --port 8080
  ```
- **Diagnostics**:
  Click the Activity Pulse icon in the UI header to generate a markdown diagnostic snapshot with your full hardware, FFmpeg, and driver state.

---

## License

Mistus AV Merger is licensed under the Apache 2.0 License. Bundled static FFmpeg builds are licensed under GPLv3 / LGPLv3 according to compiled codec flags.
