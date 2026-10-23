#!/usr/bin/env python3
"""
Downloads pinned, checksum-verified static FFmpeg/FFprobe builds into ./bin.

The platform -> build mapping lives in scripts/ffmpeg_manifest.json. Every entry
pins exact, immutable release URLs plus SHA256 checksums:

  - Windows/Linux: one archive per platform; 'entry.sha256' covers the ARCHIVE
    (per the vendor's SHASUMS / asset digest).
  - macOS: osxexperts publishes ffmpeg and ffprobe in separate zips; each file
    entry carries its own 'url' and 'sha256' covering the extracted BINARY.

A checksum mismatch aborts hard -- unverified binaries are never installed.

Usage:
  python scripts/fetch_ffmpeg.py \
      --manifest scripts/ffmpeg_manifest.json \
      --platform linux-x64 \
      --dest bin \
      --cache-dir .ffmpeg-cache

Platforms: win-x64, linux-x64, macos-x64, macos-arm64 (auto-detected if
--platform is omitted).
"""

import argparse
import hashlib
import json
import os
import shutil
import stat
import sys
import tarfile
import urllib.request
import zipfile
from pathlib import Path

CHUNK_SIZE = 1024 * 512


def detect_platform() -> str:
    import platform as _platform
    system = _platform.system().lower()
    machine = _platform.machine().lower()
    is_arm = machine in ("arm64", "aarch64")
    if system == "windows":
        return "win-arm64" if is_arm else "win-x64"
    if system == "linux":
        return "linux-arm64" if is_arm else "linux-x64"
    if system == "darwin":
        return "macos-arm64" if is_arm else "macos-x64"
    raise SystemExit(f"Unsupported OS for auto-detection: {_platform.system()}")


def sha256_of(path: Path) -> str:
    digest = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(CHUNK_SIZE), b""):
            digest.update(chunk)
    return digest.hexdigest()


def download(url: str, dest: Path) -> None:
    print(f"[ffmpeg-fetch] Downloading {url}")
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix(dest.suffix + ".part")
    seen = [0]

    def _hook(count: int, block: int, total: int) -> None:
        seen[0] = count * block
        if total > 0 and (count % 400 == 0):
            print(f"\r  {seen[0] / 1048576:6.1f} MiB", end="", flush=True)

    try:
        urllib.request.urlretrieve(url, tmp, reporthook=_hook)
    finally:
        print()
    os.replace(tmp, dest)


def obtain_archive(url: str, archive_sha: str, cache_dir: Path) -> Path:
    """Return a local path for one archive URL (downloaded or verified cache hit)."""
    filename = url.rsplit("/", 1)[-1]
    if archive_sha:
        cache_path = cache_dir / f"{archive_sha[:16]}-{filename}"
        if cache_path.is_file() and sha256_of(cache_path) == archive_sha:
            print(f"[ffmpeg-fetch] Cache hit, verified: {cache_path.name}")
            return cache_path
        if cache_path.is_file():
            cache_path.unlink()  # corrupted/stale cache entry
    else:
        # For archives with no vendor checksum (macOS), the extracted BINARY is
        # the pinned and verified thing; caching the archive is then safe.
        cache_path = cache_dir / f"noverify-{filename}"
        if cache_path.is_file():
            print(f"[ffmpeg-fetch] Cache hit: {cache_path.name} (binary hash still enforced)")
            return cache_path

    download(url, cache_path)

    if archive_sha:
        actual = sha256_of(cache_path)
        if actual != archive_sha:
            cache_path.unlink(missing_ok=True)
            raise SystemExit(
                f"SHA256 MISMATCH for {filename}\n"
                f"  expected: {archive_sha}\n"
                f"  actual:   {actual}\n"
                "Refusing to use this FFmpeg build. The upstream release may have "
                "changed; re-pin scripts/ffmpeg_manifest.json with the new digest."
            )
        print(f"[ffmpeg-fetch] Verified archive SHA256: {filename}")
    return cache_path


def _strip_exe(name: str) -> str:
    return name[:-4] if name.lower().endswith(".exe") else name


def extract_members(specs: dict, archive: Path, archive_sha: str, dest: Path) -> dict:
    """
    Extract the wanted members from one archive into dest.
    Returns a map {member_base: found_count}.
    """
    wanted = {k.lower(): v for k, v in specs.items()}
    out_paths: dict = {}
    dest.mkdir(parents=True, exist_ok=True)

    is_zip = archive.suffix == ".zip"
    is_tarxz = archive.name.endswith(".tar.xz")
    if not (is_zip or is_tarxz):
        raise SystemExit(f"Unsupported archive format for {archive}")

    if is_zip:
        with zipfile.ZipFile(archive) as zf:
            for name in zf.namelist():
                if name.endswith("/"):
                    continue
                base = _strip_exe(os.path.basename(name)).lower()
                if base in wanted and base not in out_paths:
                    target = dest / wanted[base]["out"]
                    with zf.open(name) as source, open(target, "wb") as out:
                        shutil.copyfileobj(source, out)
                    out_paths[base] = target
    else:
        with tarfile.open(archive, mode="r:xz") as tf:
            for member in tf.getmembers():
                if not member.isfile():
                    continue
                base = _strip_exe(os.path.basename(member.name)).lower()
                if base in wanted and base not in out_paths:
                    source = tf.extractfile(member)
                    if source is None:
                        continue
                    target = dest / wanted[base]["out"]
                    with open(target, "wb") as out:
                        shutil.copyfileobj(source, out)
                    out_paths[base] = target

    missing = set(wanted) - set(out_paths)
    if missing:
        raise SystemExit(
            f"Archive {'verify failed' if archive_sha else archive.name} does not "
            f"contain: {', '.join(sorted(missing))}"
        )

    def _finish(target: Path) -> Path:
        if os.name != "nt":
            mode = target.stat().st_mode
            target.chmod(mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)
        return target

    return {base: _finish(target) for base, target in out_paths.items()}


def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch pinned checksum-verified FFmpeg/FFprobe")
    parser.add_argument("--manifest", default="scripts/ffmpeg_manifest.json")
    parser.add_argument("--platform", default=None, help="win-x64 | linux-x64 | macos-x64 | macos-arm64")
    parser.add_argument("--dest", default="bin", help="Directory to place binaries in")
    parser.add_argument("--cache-dir", default=".ffmpeg-cache")
    args = parser.parse_args()

    platform_id = args.platform or detect_platform()
    manifest = json.loads(Path(args.manifest).read_text(encoding="utf-8"))

    entry = manifest["platforms"].get(platform_id)
    if entry is None:
        raise SystemExit(f"No pinned build for platform '{platform_id}' in {args.manifest}")

    cache_dir = Path(args.cache_dir)
    dest = Path(args.dest)
    dest.mkdir(parents=True, exist_ok=True)

    entry_url = entry["url"]
    entry_sha = entry.get("sha256")

    installed: list = []
    for spec in entry["files"]:
        url = spec.get("url", entry_url)
        # Entry-level checksum applies to the entry URL's archive; file-level
        # checksums cover the extracted binary itself.
        archive_sha = entry_sha if url == entry_url else None
        archive = obtain_archive(url, archive_sha, cache_dir)
        targets = extract_members({spec["member"].lower(): spec}, archive, archive_sha, dest)
        member = spec["member"].lower()
        target = targets[member]

        expected_hash = spec.get("sha256")
        if expected_hash:
            actual = sha256_of(target)
            if actual != expected_hash:
                target.unlink(missing_ok=True)
                raise SystemExit(
                    f"SHA256 MISMATCH for extracted {member} ({target.name})\n"
                    f"  expected: {expected_hash}\n"
                    f"  actual:   {actual}"
                )
            print(f"[ffmpeg-fetch] Verified {member} SHA256: {target.name}")
        installed.append(target)

    version_path = dest / "ffmpeg.version"
    version_path.write_text(entry["ffmpeg_version"] + "\n", encoding="utf-8")
    print(f"[ffmpeg-fetch] Installed: {', '.join(str(p) for p in installed)}")
    print(f"[ffmpeg-fetch] FFmpeg version: {entry['ffmpeg_version']}")


if __name__ == "__main__":
    main()
