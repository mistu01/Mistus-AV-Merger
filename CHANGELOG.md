# Changelog

All notable changes to the "Mistus AV Merger" project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Planned
- Hardware decoding for AV1 inputs via NVDEC / QuickSync.
- Multi-clip timeline sequencing before looping.

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
