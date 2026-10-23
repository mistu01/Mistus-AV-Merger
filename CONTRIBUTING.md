# Contributing to Mistus AV Merger

Thanks for helping! This document covers local development, testing, and the
release process.

---

## Local Development

Prerequisites: Python **3.11+**, Node.js 20+, and (optionally) a system FFmpeg —
a pinned static build is fetched automatically for packaging and smoke tests.

```bash
python -m pip install -e ".[dev]"
npm ci && npm run build
python scripts/fetch_ffmpeg.py        # -> ./bin/{ffmpeg,ffprobe}, SHA256-verified
python -m mistus_av_merger            # http://127.0.0.1:<free port>
python -m mistus_av_merger --self-test  # offline bundled-FFmpeg smoke test
```

### Tests

```bash
pytest -v tests/                       # Python unit + render integration tests
npx tsx --test src/utils/engine.test.ts  # frontend engine tests
npm run lint                           # TypeScript type check
```

The integration render tests pick up `./bin/ffmpeg` (bundled) first, then fall
back to `PATH`.

---

## Versioning

- Single source of truth: the root `VERSION` file (SemVer `MAJOR.MINOR.PATCH[-suffix]`).
- Integer version code = `MAJOR*10000 + MINOR*100 + PATCH` (e.g. `0.6.0` → `600`).
- Changelog follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/); every
  release **must** have a `## [X.Y.Z] - YYYY-MM-DD` section, because the release
  job extracts the release notes from it.

## Releasing

There are two supported release paths. Both are automated by
`.github/workflows/build-release.yml`, which tests the code, builds
`win-x64`, `linux-x64`, `macos-x64`, `macos-arm64` bundles, smoke tests every
binary (version flag, `/api/v1/health`, a real looped render), and publishes a
GitHub Release with `SHA256SUMS.txt`.

### Path A — push to `main` (recommended, no manual tagging)

1. Land all release changes so `CHANGELOG.md`'s `[Unreleased]` section holds
   the release notes.
2. Run the bumper; it rolls `[Unreleased]` into a dated section, bumps
   `VERSION`, commits, tags, and pushes:

   ```bash
   python scripts/bump_version.py minor --push     # or patch / major / pre --pre-tag beta.1
   ```

   The `VERSION` change on `main` is the release trigger. The release job
   creates the tag itself (`gh release create vX.Y.Z --target <sha>`), since
   tags created with the default `GITHUB_TOKEN` cannot trigger other workflows.
   Options:
   - `--no-tag`: do not create a local annotated tag (Path A creates the tag
     server-side; a pre-existing local/world tag would abort the run with
     "nothing to do").
   - without `--push`: files are bumped but you run `git add/commit/tag/push`
     yourself.

3. Watch the run at **Actions → Build and Release**. Green run ⇒ the Release
   and four bundles (`zip` for Windows, `tar.gz` elsewhere) are live.

### Path B — tag push

If you prefer explicit tags:

```bash
# VERSION must already equal the tag name, and CHANGELOG.md must have the section
python scripts/bump_version.py patch          # bumps files, you commit yourself
git add VERSION CHANGELOG.md mistus_av_merger/core/_build_info.py
git commit -m "chore(release): bump to v0.6.1"
git tag -a v0.6.1 -m "Release v0.6.1"
git push origin main v0.6.1
```

Tag must exactly match `VERSION` (including pre-release suffixes like
`v0.2.0-beta.1`); a mismatch fails the `prepare` job hard.

### Dry run (no release)

Run the workflows' build matrix **without publishing**: go to
**Actions → Build and Release → Run workflow**, leave `publish = false`.
Artifacts (`bundle-win-x64`, `bundle-linux-x64`, `bundle-macos-x64`,
`bundle-macos-arm64`) appear on the run page for download; nothing is released.

### Upgrading the pinned FFmpeg builds

`scripts/ffmpeg_manifest.json` pins exact immutable URLs + SHA256 hashes
(BtbN builds for Windows/Linux, osxexperts static builds for macOS). To
upgrade: pick the new pinned release, update `url` and `sha256` (and the
macOS binary hashes), run `python scripts/fetch_ffmpeg.py --platform <p>` for
each platform, and run the smoke test. The CI cache key is derived from the
manifest, so a manifest edit invalidates the cache automatically.

---

## Repository Hygiene

- Keep workflows' `permissions:` minimal; only the `release` job holds
  `contents: write`.
- Never interpolate raw `github.ref_name`/inputs into `run:` scripts — pass
  them through `env:` (as `build-release.yml` does).
- FFmpeg binaries and the download cache (`bin/`, `.ffmpeg-cache/`) are git-ignored.
