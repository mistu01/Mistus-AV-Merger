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
