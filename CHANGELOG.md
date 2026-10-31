# Changelog

All notable changes to the "Mistus AV Merger" project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Planned
- (nothing yet)

---

## [0.6.30] - 2026-10-31

### Added
- **Dynamic Randomized Loop Durations & Offsets for YouTube Deduplication Safety**:
  - Implemented intelligent loop randomization across both visual effect pre-renders and pure stream-copy renders.
  - Automatically probes source video duration:
    - If video length is >= 30.0s: Slices a randomized loop duration between 25.0s and 30.0s (e.g. 26.8s, 28.4s), combined with a randomized starting time offset within the source clip.
    - If video length is between 15.0s and 30.0s: Dynamically randomizes the cut in the range [0.8 * video_dur, video_dur].
  - Every track in the render queue receives a unique loop cycle, unique keyframe interval, and distinct video stream signature, preventing identical video hash deduplication on YouTube.
  - Operates seamlessly with Phase 2 Fast Stream Copy: Step 1 pre-renders the random slice in ~2 seconds, and Step 2 stream-copies it across the audio track at 2000x–3000x speed (~2.5s for 1 hour).

---

## [0.6.29] - 2026-10-30

### Fixed
- **Constrained Scene VBV Rate Control (~350 MB/hr Output Budget Without Pixelation)**:
  - Eliminated file size ballooning (where renders with noise static or VHS effects previously generated 50+ Mbps and 10+ GB incomplete files).
  - Applied scene-release standard Constrained CRF (VBV mode) across all encoders:
    - Peak video bitrate is strictly capped to 950k with a 1900k VBV smoothing buffer.
    - An entire 1-hour audio render with visual effects and retro noise/static strictly stays within the target budget of ~300 MB to 370 MB total (averaging ~350 MB/hr).
    - Preserves high visual fidelity without macroblocking or pixelation through film tuning (-tune film on libx264), 10-bit color pipelines on HEVC/AV1, and hardware spatial/temporal adaptive quantization (-spatial-aq 1 -temporal-aq 1 on NVENC / lookahead on QSV).

---

## [0.6.28] - 2026-10-30

### Fixed
- **Guaranteed Fast Loop Pre-Render + Stream Copy Pipeline**:
  - Fixed an issue where video files with unprobed duration or duration longer than audio bypassed the fast 2-step loop pipeline and triggered a full-length frame-by-frame re-encode of the entire audio file (taking minutes instead of seconds).
  - The fast 2-step pipeline is now the guaranteed execution path for all visual effect renders: Step 1 pre-renders only a tight 5s to 15s loop clip in pristine visually-lossless CRF quality (taking ~1–2 seconds), and Step 2 instantly stream-copies (-c:v copy) that rendered loop across the entire audio track at 2000x+ speed (taking ~2–3 seconds for an entire 1-hour audio file).
  - Capped loop pre-render duration to 10s (or 20s for animated/bounce overlays) so long input videos are never unnecessarily re-encoded across their entire file length.
  - Fixed queue payload serialization to pass ideo_duration and ideo_duration_sec from the frontend, backed by robust fallback probing and safe duration defaults.
  - Updated Queue UI badges and process logs: when Step 2 stream-copy begins, the badge flips dynamically to ⚡ Fast Copy with dedicated stream-copy metrics.

---

## [0.6.27] - 2026-10-29

### Changed
- **Streamlined Video Quality & Encoder Controls**:
  - Removed obsolete "Resolution Scaling" and "File Size Target" controls from Visual Effects Studio, keeping the focus entirely on pristine quality and user-selected Video Encoder.
  - Fast Stream Copy vs Re-encode remains 100% automatic: when visual effects/overlays are inactive, videos remux losslessly at ~300-700x speed without touch. When effects are enabled, videos encode at native resolution in unconstrained scene CRF quality.

### Fixed
- **Pixelation & Macroblocking on Re-Encodes**:
  - Completely eliminated the artificial file-size bitrate bottleneck (`_SIZE_TIERS`) that previously capped video bitrates to ~440–718 kbps on 1080p renders, causing severe compression artifacts and pixelation.
  - All encodes now execute in pure, unconstrained visually-lossless scene CRF quality (`libx264` CRF 18, `libx265` 10-bit CRF 20, `libsvtav1` 10-bit CRF 24, NVENC CQ 18, QuickSync GQ 18), delivering crystal-clear, sharp, artifact-free video while keeping file sizes compact.

---

## [0.6.26] - 2026-10-29

### Fixed
- **Queue Stop, Clear & Restart Lifecycle**:
  - Fixed an issue where stopping an active render and clearing the queue could leave the render worker thread unresponsive or trying fallback encoders on dead processes.
  - Added `_ensure_worker_running()` thread watchdog supervisor to guarantee the render worker daemon is continuously alive and ready.
  - Wrapped `_render_worker_loop` with a top-level error shield so unhandled job or iteration exceptions can never terminate the worker loop.
  - Added immediate bailout checks (`if not queue_mgr.is_running: return`) in all encode pipelines and fallback retries, halting ffmpeg instantly and aborting sub-phases.
  - Updated `start_queue()` to automatically re-queue any `paused` or `failed` jobs and ensure the queue immediately resumes without requiring application restart.
  - Updated frontend queue action dispatchers to immediately live-sync queue state after commands (`start`, `stop`, `clear`, `pause`, `resume`).

### Added
- **Manual Video Codec & Encoder Selection**:
  - Added user-selectable video encoder options across Settings modal and Visual Effects Studio (Render Options tab).
  - Defaults to `Auto` (automatically detecting and using the fastest GPU encoder on the machine).
  - Allows full user freedom to override with H.264 (`libx264`), H.265 / HEVC (`libx265`), AV1 (`libsvtav1`), H.266 / VVC (`libvvenc`), or any detected GPU hardware encoders (`h264_nvenc`, `hevc_nvenc`, `av1_nvenc`, `h264_qsv`, `hevc_qsv`, `av1_qsv`, `h264_amf`, etc.).
  - Persisted across app sessions and synced between frontend and backend.
  - Header badge dynamically displays active encoder (`AUTO: H264_QSV`, `ENCODER: LIBX265`, `ENCODER: LIBSVTAV1`, etc.).

### Improved
- **Scene-Release Bluray-Rip Encoding Quality & Compression**:
  - Re-architected encoder flags to match high-fidelity scene-release Blu-ray rip standards (sharp details, pristine gradients, zero macroblocking, compact sizes):
    - `libx264`: Slow preset with CRF 18 visually lossless standard and full motion estimation.
    - `libx265`: Medium preset with 10-bit color (`yuv420p10le`) and CRF 20, eliminating color/gradient banding in dark/night scenes.
    - `libsvtav1`: SVT-AV1 preset 5 with 10-bit color (`yuv420p10le`) and CRF 24 (`tune=0`), delivering next-gen pristine compression.
    - `libvvenc`: Fast preset with 10-bit color (`yuv420p10le`) and QP 24 for future-gen ultra efficiency.
    - Hardware Encoders (`NVENC` / `QSV` / `AMF`): Enabled deep lookahead (`-look_ahead 1 -look_ahead_depth 24`), spatial & temporal adaptive quantization (`-spatial-aq 1 -temporal-aq 1`), high quality presets (`p6` / `slow`), and 10-bit color profiles for HEVC/AV1.
  - Leverages Mistus AV Merger's fast-loop architecture: encodes the base clip once with pristine scene-release quality (~1-3 seconds) and instant stream-copies across the entire audio track duration at 50x-100x speed.

---

## [0.6.25] - 2026-10-29

### Improved
- **Distinct Visual Identities for All 7 Presets**:
  - Differentiated every preset to ensure completely unique, unmistakable visual characteristics doing true justice to their names:
    - `clean_vhs`: Standard Play (SP) commercial tape with gentle tape softening, vintage tape warmth, mild luma grain, and subtle overscan line. Clean, nostalgic analog look without harsh glitches or scanlines.
    - `worn_tape`: Aging magnetic tape with yellowed/sepia oxidation balance (`colorchannelmixer`), soft magnetic flutter, visible tape noise, and lower-third head-switching drift.
    - `tracking_errors`: Severe VCR head misalignment featuring active horizontal static tearing bands slicing through the frame, thick head-switching glitches, sync tearing jitter lines, and heavy tape static.
    - `chroma_bleed`: Extreme RCA composite analog cable color misregistration with massive red/cyan color displacement bleeding out of objects and hyper-saturated halos. No dark glitch bars.
    - `camcorder_90s`: Handheld 90s home video camcorder with warm tungsten incandescent indoor lighting, sharp CCD sensor edge sharpening, CRT interlace lines, and camera master vibrancy. No tracking bars.
    - `security_cam`: Authentic surveillance footage featuring 12 FPS surveillance cadence, high-contrast monochrome with eerie green phosphor monitor glow, convex security lens vignette, and CCD sensor noise.
    - `heavy_degradation`: Total tape decay and found footage horror featuring extreme horizontal blur smear, massive static snowstorm, severe tape tears, and degraded muddy luma.
- **Pure Darkening Night Mode**:
  - Simplified Night Mode to purely and cleanly darken footage (`eq=brightness:gamma`) without applying unwanted blue color tints, forced noise, or vignette. Preserves the natural colors of the underlying video and retro presets while smoothly darkening from subtle evening dimming to pitch darkness.
- **Studio Preview Alignment**:
  - Removed artificial blue sky and cold washes from the Visual Effects Studio canvas so previewed footage reflects true colors under Night Mode and accurately showcases each preset's unique aesthetic identity.

---

## [0.6.24] - 2026-10-29

### Improved
- **Authentic VHS & Surveillance Camera Aesthetic Effects**:
  - **Dynamic Periodic Static Bursts**: Fixed an issue where enabling "Periodic Tape Static Bursts" (`noise_static`) was bypassed whenever a preset already had base noise. Upgraded the static burst generator to inject realistic periodic magnetic static bursts with horizontal tracking tear glitches (`noise=alls=65:allf=t+u:enable='lt(mod(t\,4.5)\,0.35)',drawbox=y=ih-42:color=white@0.70:width=iw:height=4:t=fill:enable='lt(mod(t\,4.5)\,0.35)'`), delivering surreal, tactile tape tracking spikes every 4.5 seconds.
  - **Authentic CCTV Surveillance Footage**: Re-engineered `security_cam` with true CCTV multiplexer motion cadence (`fps=12`), phosphor green surveillance sensor curves, high-contrast shadow clipping (`eq=contrast=1.85:brightness=-0.07`), distinct CRT monitor raster scanlines (`drawgrid=width=iw:height=4:thickness=1:color=black@0.48`), wide-angle fisheye lens vignette (`vignette=PI/2.8`), and chunky low-light CCD static (`noise=alls=48:allf=t+u`).
  - **Intensified VHS Tape Presets & CRT Scanlines**:
    - `clean_vhs`: Added horizontal 240-line tape softening, composite chroma phase delay (`chromashift=cbh=8:crh=-8`), bottom head-switching bar, CRT scanlines, and vintage tape warmth.
    - `worn_tape`: Upgraded to heavy LP mode wear with distinct CRT scanlines, bottom head-switching glitch bar with white sync tear, magnetic snow (`noise=alls=38`), and analog saturation.
    - `tracking_errors`: Amplified severe tracking misalignment with double sync tearing jitter lines, thick head-switching band, CRT raster lines, and intense static snow (`noise=alls=54`).
    - `chroma_bleed`: Boosted RCA composite analog cable color displacement, horizontal softening, and saturated color halos.
    - `camcorder_90s`: Added 90s incandescent warm tungsten balance, CRT interlace lines, lens chroma drift, and camcorder sensor noise.
    - `heavy_degradation`: Maximum analog generation loss and tape decay with extreme horizontal blur (`sizeX=9:sizeY=2`), massive color offset, dense scanlines, huge bottom head-switching tear, and heavy static snow storm (`noise=alls=68`).
  - **Studio Canvas & Filtergraph Simulation**:
    - Updated Visual Effects Studio canvas simulation to render authentic CRT scanlines, dynamic static burst spikes with white sync tear jitter, and CCTV surveillance green phosphor tint with OSD camera status overlay.

---

## [0.6.23] - 2026-10-29

### Fixed
- **TypeScript Type Error in VHS Preset Definitions**:
  - Corrected property name `chroma_shift` to `chromaShift` in `tracking_errors` preset object (`src/data/presets.ts`), resolving GitHub Actions CI / Build failure `TS2561`.

---

## [0.6.22] - 2026-10-29

### Fixed
- **Built-in Fallback for Preset Catalog in Frozen Executables**:
  - Fixed an issue where `PresetManager` failed to resolve `presets_v1.json` when running inside the compiled PyInstaller executable (due to `base_library.zip` bytecode packaging), returning `None` for all VHS presets and causing all VHS options to produce identical un-filtered output.
  - Implemented multi-path candidate discovery (`sys._MEIPASS`, `exe_dir/_internal`, source package dir, and CWD) along with a compiled-in `DEFAULT_PRESETS` in-memory fallback, guaranteeing that all 7 presets always load reliably regardless of packaging environment.
- **Night Mode Intensity Scaling & Footage Visibility**:
  - Replaced the static black-crush curve with smooth, continuous parametric gamma scaling (`gamma`, `gamma_r`, `gamma_b`) that responds directly to the `night_intensity` slider.
  - Footage remains clearly visible across all intensity levels, smoothly shifting from gentle evening twilight at low values to cinematic moonlit midnight at higher values without blacking out subjects.
- **Distinct Visual Signatures Across All VHS Presets**:
  - Differentiated the 7 VHS presets with unique visual identities (tape softening, chroma shift, head-switching glitch bars, sync tear lines, incandescent color balances, and CCTV surveillance monitor effects) so each preset has a distinct look.

---

## [0.6.21] - 2026-10-29

### Improved
- **Intensified Visual Effects & Absolute Darkness Night Mode**:
  - **Atmospheric Night Mode**: Completely re-engineered night mode color grading to deliver pitch darkness. Scaled brightness down to -0.50, increased contrast to 1.60, crushed mid/low tones with nocturnal curves, desaturated into cold silvery blues, intensified the vignette (PI/2.35), and added subtle sensor gain noise. Average luminance drops from daylight levels (~94) down to genuine night levels (~19.7).
  - **Security Cam (CCTV)**: Transformed into authentic surveillance footage featuring high-contrast surveillance monochrome, subtle CRT phosphor green tint, dark horizontal scanlines (drawgrid), wide fisheye lens vignette (PI/3.0), chunky sensor grain (noise=alls=45), and a 12 FPS surveillance frame rate.
  - **VHS Presets Overhaul**:
    - **Clean VHS (SP Mode)**: Added horizontal tape head softening, analog chroma shift, subtle CRT scanlines, and vintage gamma.
    - **Worn Tape (LP Mode)**: Intensified horizontal chroma bleed, distinct CRT scanlines, bottom head-switching glitch bar, and magnetic noise.
    - **Tracking Errors**: Implemented severe chroma split, CRT scanlines, dark head-switching band, white sync jitter lines, and heavy magnetic snow.
    - **Chroma Bleed & Camcorder 90s**: Enhanced composite RCA color separation and 90s incandescent warmth with scanlines.
    - **Heavy Degradation**: Pushed generation loss to the extreme with horizontal blur, massive color displacement, thick scanlines, and intense static snow.
  - **Studio Live Preview**: Updated the interactive canvas and compiled FFmpeg filtergraph preview in Visual Effects Studio to accurately reflect the dark night mode and intense retro effects.

---

## [0.6.20] - 2026-10-29

### Fixed
- **Visual Effects & Image Overlay Propagation**:
  - Fixed an issue where re-queuing or adding jobs after tweaking visual effects or overlay settings failed to update existing jobs in the queue, causing them to render with stale options and bypass effects.
  - Fixed single-image overlays being wiped out when bulk-queuing (`buildQueuePayload` was nullifying `overlayPath` if an overlay folder was present in state). Single-image overlays now cleanly apply across bulk renders if no separate bulk image folder is provided.
  - Fixed bulk overlay folder "Clear" button in Visual Effects Studio failing to clear state in `App.tsx`, which prevented users from resetting their bulk folder.
  - Added full `localStorage` persistence for `renderOptions` so VHS presets, night mode, noise settings, overlay opacity, timeouts, and animation styles persist across application reloads.
  - Fixed duration parsing in `scanner.py` to gracefully handle `"N/A"` or container-level null values by checking individual video/audio streams and `DURATION` tags.
  - Added robust string path normalization in `FFmpegCommandBuilder` and `app.py` to handle paths wrapped in quotes.
  - Fixed clean loop generation in timed overlay fast loop pipeline by ensuring `loop_input=(video_dur < clean_loop_dur)` is passed.

---

## [0.6.19] - 2026-10-29

### Fixed
- **Queue Remaining & Queue All Execution**:
  - Fixed an issue where clicking "Queue Remaining" failed to queue scanned items due to missing output directory paths defaulting to root, unhandled asynchronous network requests, and hardcoded `skip_existing: true`.
  - Added safe fallback to `[AudioFolder]/MistusRenders` so output paths are always valid directories.
  - Added immediate local queue state synchronization from server response upon clicking "Queue Remaining" or "Queue All", eliminating UI latency.
  - Added a dedicated "Queue All" button alongside "Queue Remaining" in the Bulk Scan view, enabling one-click queuing of all scanned pairs.
  - Added an inline "Re-render All" toggle to the resume scan banner to allow re-rendering existing files without manual checkbox toggles.
  - Fixed backend `_resolve_job_overlay` to safely bypass image checks when overlay is disabled, preventing 400 errors from blocking entire job batches.
  - Stabilized pairing IDs to deterministic keys so row exclusions and video overrides persist cleanly across React re-renders.

---

## [0.6.18] - 2026-10-29

### Fixed
- **Same-Folder Scanning & Pairing**: Fixed an issue where scanning media when audio and video files reside in the same folder (either via "Audio & video in the same folder" checkbox or setting both folder paths to the same directory) caused video clips to be discarded (`scannedVideo = []`), resulting in 0 pairs and preventing queue starts.
- **Single Video Loop in Order 1:1 Mode**: When a single video clip is present alongside multiple audio tracks in `order_1_to_1` mode, the engine now loops that clip across all audio tracks instead of stranding remaining tracks as unmatched.
- **Manual Mode Full-List Coverage**: `manual` pairing mode now creates rows for all scanned audio tracks so users can customize video dropdowns per row without dropped tracks.
- **Source Video Overwrite Prevention**: Output naming now guards against collisions with input video clips, appending `_merged` if the output file would share the exact filename of a source video.
- **Interactive Pairing Rule Fallback UI**: Step 3 now shows detailed diagnostics and 1-click rule switcher buttons (Switch to 1:1, Switch to Cycle, Switch to One for All) when a pairing mode (like By Name) finds no matching filenames, preventing confusion.

---

## [0.6.17] - 2026-10-28

### Fixed
- **Scanner & Hardware Probe NameError**: Resolved `NameError: name 'sys' is not defined` in `scanner.py` and `hwdetect.py`, restoring directory scanning, audio/video file probing, and hardware GPU encoder detection.
- **Queue Start & Re-run Capability**:
  - Fixed Start Queue button being permanently disabled when all queue items were marked completed. The button now displays "Restart Queue" and stays clickable whenever jobs exist.
  - Calling `start_queue` when all jobs are completed resets them to `queued`, allowing the queue to run a 2nd or 3rd time while rapidly skipping files that already exist complete on disk.
  - Re-queuing jobs in `add_jobs` now properly reactivates completed jobs if their output file was removed or needs re-rendering.

---

## [0.6.16] - 2026-10-28

### Fixed
- **CLI Standard Output & Smoke Test Pipe Compatibility**:
  - Restored console subsystem (`console=True`) in PyInstaller spec so CLI flags (`--version`, `--help`, `--self-test`) write directly to standard output and shell pipes (`$("$EXE" --version)`), resolving CI smoke test failures.
  - Maintained runtime Windows console hiding (`ShowWindow(hwnd, 0)`) so launching the desktop application directly hides the console window without a floating terminal lingering on screen.

---

## [0.6.15] - 2026-10-28

### Fixed
- **Queue Count Badge Cut-off**: Fixed navigation bar queue count badge clipping caused by `overflow-hidden` on `<nav>` by positioning the neo-brutalist badge inline inside the button, ensuring counts (e.g. 203+) never get cut off.
- **Hidden Terminal Window**: Removed floating console window on Windows. `MistusAVMerger.spec` now builds as a windowed application (`console=False`), and `main.py` hides any attached console window automatically on launch while safely handling stdio streams and allowing explicit `--console` for debugging.
- **Child Process Console Flashing**: Added `CREATE_NO_WINDOW` flags to all `scanner.py`, `hwdetect.py`, and `main.py` subprocess calls.

### Added
- **Crash-Safe Queue Persistence & Seamless Auto-Resume**:
  - Interrupted renders from PC shutdowns or force-closes are recovered automatically from `active_session.json` and reset to `queued` to resume exactly where they exited.
  - Active running state (`is_running`) is persisted and restored, allowing queues to pick up immediately without user intervention.
  - Session file writes are now atomic via temporary file swap to eliminate session file corruption risks during sudden power cuts.
- **Intelligent Existing File Skipping**:
  - Implemented `is_output_file_complete` verification using `ffprobe` to ensure already rendered output files in target directories are safely skipped on 2nd or 3rd queue starts.
  - Incomplete or corrupted partial files from aborts/crashes are detected and cleaned up before fresh re-renders.
  - Duplicate queue entries for the same output target or audio-video pairs are automatically prevented.
- **Silent Windows Launcher**: Added `run_hidden.vbs` to launch Mistus AV Merger silently without flashing a command prompt window.

---

## [0.6.14] - 2026-10-27

### Added
- **Custom Neo-Brutalist App Icon & Branding**:
  - Designed bespoke vector Neo-Brutalist icon featuring retro cassette tape spools (dual Audio equalizer spoke reel and Video film reel), magnetic loop tape, center play triangle, audio waveform equalizer card, video filmstrip preview screen, infinity merge loop badge, and 4-point acid-lime brutalist sparkle star.
  - Palette matches the app's high-voltage Neo-Brutalist aesthetic: Cyber Yellow (#FDE047), Hot Neon Pink (#FF4F87), Sky Cyan (#38BDF8), and Acid Lime (#A3E635) with bold black strokes and pitch-black drop shadows.
  - Added multi-resolution web & desktop assets: public/icon.svg, public/favicon.svg, public/favicon.ico (16x16 up to 256x256), and public/icon-512.png (512x512 PWA / Apple Touch icon).
  - Created reusable <BrandLogo /> React SVG component and integrated it into the app Header and AboutModal.
  - Updated index.html with vector and fallback favicon and apple-touch-icon links.

---

## [0.6.13] - 2026-10-25

### Changed
- **Bouncing VCD Logo Scale**: Increased bouncing logo scale from 22% to **40% of frame width** for enhanced visibility while maintaining source aspect ratio and retro screensaver bounce physics.

---

## [0.6.12] - 2026-10-25

### Added
- **Bouncing VCD / DVD Logo Animated Motion**:
  - Added new Overlay Placement & Motion Style option in the centralized Render Options studio:
    - **Static Full Frame (Edge-to-Edge)** (default): Fills and stretches across the entire frame.
    - **Bouncing VCD Logo (Animated)**: Scales the image to a crisp watermark logo (22% of frame width) and animates it drifting diagonally and bouncing off the video edges like a classic retro VCD / DVD screensaver.
  - Interactive 60 FPS real-time Canvas preview in Render Options studio simulating the bouncing VCD logo with live physics.
  - Dynamically updates the compiled FFmpeg `-vf` filtergraph inspector.

- **Universal Magical Speed for Timed Overlays**:
  - Implemented high-performance multi-segment loop pipeline for timed image overlays (30s, 1m, 2m, 5m).
  - Encodes only the initial timed segment (`t_overlay`) with the overlay (static or bouncing motion), pre-renders a single cycle of the clean video loop, stream-copy loops the remaining duration, and joins them via stream-copy concatenation (`-f concat -c copy`).
  - Renders with timed overlays now complete in **seconds** at **100x-700x+ realtime speed** even for 1-hour+ audio tracks, eliminating full-length re-encoding bottlenecks.

---

## [0.6.11] - 2026-10-24

### Added
- **Centralized Render Options Tab**:
  - Renamed 'VHS & Night FX' tab to **'Render Options'**, serving as the single unified control center for all render settings across Single and Bulk modes.
  - Consolidated Resolution scaling (`original`, `1080p`, `720p`, `480p`) and Output Size / Bitrate targets (`small`, `balanced`, `high`, `unlimited`) into this tab.
  - Consolidated Image Overlay configuration (Single file picker, Bulk folder picker, opacity slider, timeout/duration dropdown) with edge-to-edge frame fitting.
  - Added live 60 FPS filtergraph simulation canvas and compiled FFmpeg `-vf` filter chain inspector.
  - Added quick navigation buttons to jump directly back to Single Render or Bulk Scan.
- **Dedicated Clear Queue Action**:
  - Added 'Clear Queue' button in Queue view to immediately wipe all queued jobs and terminate any active background render.
  - Added `POST /api/v1/queue/clear` and `POST /api/v1/queue/clear-all` endpoints that clean up partial output files, clear the queue manager, and persist the empty session.
- **Pre-Render Effect Warning Banners**:
  - Added prominent Neo-Brutalist warning banners in Single Render and Bulk Scan modes.
  - Clearly alerts users when no visual effects are active, indicating that renders will use Fast Stream Copy (lossless, instant ~300-700x).
  - Prompts users with a direct "Open Render Options" shortcut button to configure effects before choosing media or scanning.
  - Displays active effect tags and "Re-Encode Mode" confirmation when visual filters, resolution scaling, or overlays are enabled.

### Fixed
- **Queue Effects Passing & Mode Desync**:
  - Fixed issue where Bulk Scan displayed `RE-ENCODE` while Queue mode executed jobs with `COPY` without applying visual effects.
  - Automatically promote queued jobs to `mode: "encode"` whenever visual effects, VHS presets, night mode, noise, resolution scaling, or image overlays are present.
  - Resolved session persistence race condition in active queue state.

---

## [0.6.10] - 2026-10-24

### Added
- **Image Overlay Timeout Options**: Choose display duration for image overlays (`First 30 Seconds`, `First 1 Minute`, `First 2 Minutes`, `First 5 Minutes`, or `Fulltime`). Timed overlays automatically disappear after the specified duration, returning to the video.

### Fixed
- **Full-Frame Image Overlay Scaling**: Fixed image overlay scaling from `scale2ref=w=main_w:h=main_h` to `scale2ref=w=rw:h=rh`. Overlays now stretch and fit the entire video frame from edge to edge regardless of image dimensions or aspect ratio.

---

## [0.6.9] - 2026-10-24

### Added
- **Universal Encode Speedup & Loop-Aware Engine**:
  - Implemented single-cycle pre-rendering for looping video clips combined with stream-copy (`-c:v copy`) multiplexing across the full audio duration.
  - Renders with all visual effects, static noise, and image overlays active now hit **7.7x to 50x+** realtime speed on 4-core CPUs and scale even higher on multi-core systems.
- **Location Memory**:
  - Persistent settings endpoint `GET/POST /api/v1/settings` and client synchronization.
  - Automatically remembers last used directories across app restarts for audio, video, output destination, and overlay image folders.
  - File picker modal opens directly at the last navigated directory.
- **Bulk Render Resume & Duplicate Skip**:
  - Automatically scans output destination folder during bulk scans.
  - Detects already completed non-empty output files, tags them with `✓ Done`, and skips them by default (`alreadyDone: true`).
  - Added 'Skip Already Done' toggle and 'Resume Scan' banner displaying remaining render counts.
- **Immediate Stop & Queue Safety**:
  - Added dedicated red 'Stop Immediately' control in Queue View that terminates active FFmpeg processes via process tree traversal, cleans up partial files, and pauses queue safely.
  - Fixed involuntary auto-start when adding jobs so renders only begin when explicitly started.

### Changed
- **Filtergraph Optimizations**:
  - Replaced floating-point `gblur` with SIMD-vectorized `avgblur` across VHS presets (`clean_vhs`, `worn_tape`, `heavy_degradation`).
  - Vignette filter optimized with `:eval=init` to evaluate geometry once at clip start rather than every frame.
  - Overlay filter pipeline updated to `format=yuv420` eliminating software pixel format conversion overhead.
  - Deduplicated redundant noise passes when VHS presets already include tape noise.

---

## [0.6.8] - 2026-10-24

### Added
- **Output Size cap** — a new "Output Size" selector in Render Options targets a concrete file size per hour of audio when re-encoding with effects:
  - Small ≈ 250 MB/hr (128 kbps AAC)
  - Balanced ≈ 325 MB/hr (160 kbps AAC) — **default**, so renders stay predictable
  - High ≈ 400 MB/hr (192 kbps AAC)
  - Max Quality (no cap) — the old CRF 21 path, unchanged
- Party trick for the math nerds: the tier converts to `video_kbps = MB/hr × 8192 / 3600 − audio_kbps` per job and rides as ABR (`-b:v/-maxrate/-bufsize`) on every encoder family (x264, x265, QSV, NVENC, VideoToolbox); CRF branches are skipped when capped.

### Changed
- Render Options grid is now four columns (Resolution / Output Size / VHS Preset / Toggles).

### Measured (same bench box, QSV + worn-tape chain, 120 s render)
- Balanced tier came out at ~295 MB/hr equivalent (ABR undershoots slightly on looped content — inside the 250–400 window).
- Unlimited tier on the same clip: ~12 GB/hr equivalent, i.e. the cap really clamps.

---

## [0.6.7] - 2026-10-24

### Fixed
- fix(hwdetect): **hardware encoders were never detected** — the encoder probe injected `-hwaccel` after the input, which ffmpeg rejects as an output option, so every GPU (NVENC, AMF, QuickSync, VideoToolbox) probed false and renders silently fell back to software x264. Probes are now plain micro-encodes, which is all hardware *encoding* needs. Verified on a machine whose QuickSync immediately became the recommended encoder.
- perf(ffmpeg): default x264 preset bumped from `medium` to `veryfast` (near-identical quality at CRF 21, ~3x the encode speed on a 4-core i5); x265 presets `fast`; QSV presets `veryfast`.
- perf(ffmpeg): render commands run at `-loglevel error` with `-nostdin` — banner/lyrics-tag spam no longer floods the progress pipe and job logs.
- feat(api): **encode auto-fallback** — if a hardware encoder fails mid-render (odd dimensions, driver quirks), the job retries once with libx264 instead of failing.

### Changed
- feat(ui): the queue's Encode badge shows the actual encoder used per job (e.g. `Encode · h264_qsv`).
- ci: added `scripts/bench_encoders.py` (encoder/preset/filter-chain benchmarks against the bundled FFmpeg).

### Measured (i5-4570, 4C/4T, 720p worn-tape chain, 120s render)
- before: 46.8 fps (1.56x realtime), libx264 medium
- after: 106.8 fps (3.6x realtime) via detected QuickSync; libx264 veryfast fallback ~1.9x; stream copy ~24x

---

## [0.6.6] - 2026-10-24

### Added
- feat(ui)+feat(api): **image overlay** — single mode stamps one picked image over the whole video frame with an adjustable opacity slider; bulk mode takes an overlay image *folder* and the backend randomly picks one image per render job (stamped into the job's options so it survives restarts). The file browser gained image targets (JPG/PNG/WEBP/BMP/GIF) and an image filter.
- fix(ffmpeg): overlay opacity actually blends now — the overlay filter's `alpha` option is a pixel-format selector, not opacity; opacity is applied via `colorchannelmixer=aa` and the image is stretched full-screen with `scale2ref` (verified numerically: 35% red over testsrc → exact expected blend).
- feat(api): **real CPU profile wiring** — aggressive (all cores), balanced (half the cores), low (2 threads), idle (1 thread) now set both ffmpeg `-threads` and OS process priority; new `GET/POST /api/v1/queue/settings` persists the profile and parallel-renders setting across restarts.
- feat(api): **automatic CPU/GPU detection without blocking** — the encoder micro-encode probe runs on a background thread at startup; `GET /api/v1/hardware` returns immediately while probing, and renders use the best detected GPU encoder (NVENC / AMF / QuickSync) as soon as the probe lands.

### Changed
- feat(ui): header shows the real detected encoder instead of a fake "AUTO"; Settings shows the GPU/CPU detection summary and applies CPU-profile changes to the backend instantly.
- fix(api): queue/add force-bumps copy→encode when an overlay is present (stream copy cannot compose) and validates overlay paths/folders.

---

## [0.6.5] - 2026-10-24

### Fixed
- fix(ffmpeg): static-burst noise filter used the removed `seed` option — FFmpeg 8/9 rejects it ("Error applying option 'seed' to filter 'noise'"), which failed every encode with static bursts enabled. Replaced with the supported `all_seed` channel option; all 7 VHS preset filtergraphs validated against the bundled FFmpeg build.
- ci: added `scripts/check_presets_ffmpeg.py` preset × FFmpeg compatibility smoke test.

---

## [0.6.4] - 2026-10-24

### Added
- feat(api): **real render worker wired to the queue** — jobs queued in the Web UI now actually render. New `POST /api/v1/queue/add` endpoint, a background worker that executes FFmpeg sequentially, live progress parsing (`out_time` / `fps` / `speed` streamed from ffmpeg into job status), pause/resume of the running process, per-job cancel, reorder, clear-completed and stop-after-current controls.
- feat(api): stream-copy jobs use the duration-aware finite loop; encode jobs clamp output with an explicit `-t` so FFmpeg 8/9 cannot overshoot the audio length (previously ~2s overhang via `-shortest`).
- feat(api): output folder is created on demand; queue state persists to `active_session.json` and unfinished jobs are restored at startup.

### Changed
- feat(ui): the Queue tab live-syncs from the backend every 1.5s and is now the single source of truth — fabricated client-side jobs and simulated statuses removed; Start / Pause / Resume / Stop After Current / Clear all hit real endpoints.
- fix(ui): session save no longer resurrects completed jobs on restart.

---

## [0.6.3] - 2026-10-24

### Fixed
- fix(api): "Places" shortcuts now resolve real Windows known folders via `SHGetKnownFolderPath`, following OneDrive folder-backup redirection — previously Desktop / Documents etc. pointed at the bare profile folder, which is empty when OneDrive backup redirects them, so the file browser showed "No matching media files or folders here".

---

## [0.6.2] - 2026-10-24

### Added
- feat(api): real filesystem browsing endpoints — `GET /api/v1/fs/list` lists the actual drives, user shortcuts (Home / Desktop / Downloads / Music / Videos / Documents) and folder contents of the host computer; `POST /api/v1/fs/probe` ffprobes a single picked media file for the UI.
- feat(ui): the file picker now browses your real computer — the previous browser rendered hardcoded mock paths and could not reach any real folder.
- feat(ui): output folder selector in the Bulk Auto-Pair view ("Rendered Videos Go To"), with a real `{home}/MistusRenders` default filled from the server.
- feat(ui): bulk scan is wired to the real backend scan endpoint (`POST /api/v1/scan`) instead of a fake timer.

### Changed
- feat(ui): full neobrutalist redesign of the entire interface — thick black borders, hard offset shadows, saturated color blocks, chunky uppercase headings, press-in buttons and animated marquee stripe; applied to the Single, Bulk Auto-Pair, Queue, FX Studio, Settings, About, Diagnostics and file picker views.
- feat(ui): bulk auto-pairing is now simple by default: "1 clip for every audio track — each clip loops until its audio finishes" (`order_1_to_1`). The other pairing modes moved into a collapsed Advanced section.
- feat(ui): the job queue starts genuinely empty; demo placeholder jobs and the simulated progress ticker are gone.
- feat(ui): Diagnostics now reports live server data (version, build info, hardware accelerators) instead of hardcoded numbers.
- fix(ui): stale page title "v0.5.0" replaced with "Mistus AV Merger".

---

## [0.6.1] - 2026-10-24

### Fixed
- fix(ui): bundled web frontend now resolves correctly in frozen (PyInstaller onedir) builds — `_internal/dist` was missed by one path level, so Windows/Linux/macOS bundles launched to `{"detail":"Not Found"}` instead of the UI.
- chore(repo): stop tracking `__pycache__` bytecode files; ignore them in `.gitignore`.

---

## [0.6.0] - 2026-10-23

### Added
- feat(build): full multi-platform release automation — `build-release.yml` builds signed, checksum-verified portable bundles for `win-x64`, `linux-x64`, `macos-x64` and `macos-arm64` on every `v*.*.*` tag, every `main` push that bumps `VERSION`, and on manual dispatch (`publish=false` for artifact-only dry runs).
- build(scripts): `scripts/fetch_ffmpeg.py` + pinned `scripts/ffmpeg_manifest.json` download static FFmpeg/FFprobe builds and hard-fail on SHA256 mismatch (cached via `actions/cache`).
- build(scripts): `scripts/gen_build_info.py` stamps version, version code, commit, ref, build date, OS/arch and FFmpeg flavor into `mistus_av_merger/core/_build_info.py` at packaging time.
- ci(build): binary smoke tests on every platform — `--version` output, server `/api/v1/health` version check with `--no-browser`, and a looped render self-test (`--self-test`: 2s synthetic clip + 6s tone → ~6s output verified with the bundled ffprobe).
- feat(cli): `--self-test` offline render smoke test flag; bundled FFmpeg/FFprobe are now resolved from the application directory first (`core/binaries.py`) instead of `PATH`.
- build(spec): PyInstaller spec rewritten as a proper onedir `COLLECT` bundle; frontend assets, presets, and `VERSION` are bundled as data files; UPX disabled so macOS codesign stays valid.
- fix(portable): static web frontend is now mounted correctly in frozen (onedir) builds, in addition to dev/portable layouts.

### Changed
- ci(CI): dropped Python 3.10 (project requires 3.11+); matrix is now 3.11/3.12/3.13; all actions bumped to Node.js 24 majors (`checkout@v7`, `setup-python@v6`, `setup-node@v6`, `upload-artifact@v7`, `download-artifact@v8`, `cache@v5`); pip/npm caching via `cache: pip|npm`; concurrency groups cancel superseded runs.
- build(scripts): `scripts/bump_version.py` gained `--push` and `--no-tag` and performs commit/tag wiring itself; documents release path A (VERSION push) and B (tag push).

---

## [0.5.0] - 2026-10-23

### Added
- feat(portable): `portable.flag` detection to store configuration, logs, and temp segments locally.
- feat(diagnostics): comprehensive system diagnostics modal with one-click copyable markdown report.
- feat(ci): full GitHub Actions release workflow with multi-platform matrix (win-x64, linux-x64, macos-x64, macos-arm64) and SHA256 verification.
- feat(security): origin verification middleware enforcing strict localhost access.

### Fixed
- fix(naming): proper separation of file base and extension to preserve valid formatting during sanitization.
- fix(resume): automatic recovery of unfinished sessions after application restart.

---

## [0.4.0] - 2026-09-15

### Added
- feat(bulk): asynchronous folder scanning with ffprobe confirmation and mtime+size caching.
- feat(pairing): 6 deterministic auto-pairing modes (match by name with fuzzy confidence, 1:1 order, one for all, cycle round-robin, random seeded, and manual override).
- feat(naming): configurable token template engine (`{audio_name}`, `{video_name}`, `{video_ext}`, `{index}`, `{date}`, `{resolution}`, `{preset}`).
- feat(collision): plan-time collision resolution policies (`auto-suffix`, `skip`, `overwrite`).
- feat(segments): crash-safe segment planner rendering in continuous chunks with automatic concat manifest.
- feat(queue): interactive job queue with SIGSTOP/NtSuspendProcess pause/resume and process nice tuning.

### Changed
- refactor(engine): unified domain engine decoupled from UI components.

---

## [0.3.0] - 2026-08-01

### Added
- feat(effects): 7 authentic VHS presets with exact FFmpeg filtergraphs (Clean VHS, Worn Tape, Tracking Errors, Chroma Bleed, Camcorder 90s, Security Cam, Heavy Degradation).
- feat(night): Night mode color grading with blue tint wash and adjustable vignette.
- feat(noise): deterministic analog film grain and periodic static burst synthesis.
- feat(preview): interactive 5-second low-resolution sample preview generator.

---

## [0.2.0] - 2026-06-20

### Added
- feat(hw): hardware acceleration detector with real micro-encode probes for NVENC, QSV, AMF, VAAPI, and VideoToolbox.
- feat(cpu): CPU usage profile selector (Aggressive, Balanced, Low, Idle) adjusting thread limits and process scheduling.
- feat(scale): resolution selector (Original, 1080p, 720p, 480p) with Lanczos scaling and letterbox padding.

---

## [0.1.0] - 2026-05-10

### Added
- feat(core): initial MVP release of Mistus AV Merger.
- feat(loop): lossless stream-copy video looping using `-stream_loop -1` and `-shortest`.
- feat(decision): smart copy-vs-encode analyzer predicting pipeline before rendering.
- feat(web): lightweight local web server with automatic browser launch on 127.0.0.1.
