#!/usr/bin/env python3
"""
Generates mistus_av_merger/core/_build_info.py with real build metadata
(version, version code, commit, ref, UTC build date, target OS/arch and the
pinned FFmpeg version). CI runs this right after fetching FFmpeg and right
before PyInstaller so `MistusAVMerger --version` reports truthful data.

Usage (CI):
  python scripts/gen_build_info.py \
      --version 0.6.0 \
      --commit "$GITHUB_SHA" \
      --ref "$GITHUB_REF" \
      --platform linux-x64 \
      --ffmpeg-version "$(cat bin/ffmpeg.version)" \
      --ffmpeg-version-file bin/ffmpeg.version \
      --output mistus_av_merger/core/_build_info.py
"""

import argparse
import datetime
import re
import sys
from pathlib import Path

SEMVER_RE = re.compile(r"^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$")

TEMPLATE = '''"""
Build metadata POPULATED AT PACKAGING/CI TIME -- do not edit by hand.
Regenerate with: python scripts/gen_build_info.py --help
Development fallbacks are used when this file is stale or absent.
"""

BUILD_INFO = {{
    "version": "{version}",
    "version_code": {version_code},
    "prerelease": {prerelease},
    "git_commit": "{git_commit}",
    "git_ref": "{git_ref}",
    "build_date_utc": "{build_date_utc}",
    "target_os": "{target_os}",
    "target_arch": "{target_arch}",
    "ffmpeg_version": "{ffmpeg_version}",
    "ffmpeg_license": "{ffmpeg_license}",
}}
'''


def parse_platform(platform: str) -> tuple:
    mapping = {
        "win-x64": ("win", "x64"),
        "linux-x64": ("linux", "x64"),
        "macos-x64": ("macos", "x64"),
        "macos-arm64": ("macos", "arm64"),
        "win-arm64": ("win", "arm64"),
        "linux-arm64": ("linux", "arm64"),
    }
    return mapping.get(platform, ("dev", "dev"))


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate build info module")
    parser.add_argument("--version", default="", help="Release version (defaults to VERSION file)")
    parser.add_argument("--version-code", type=int, default=None,
                        help="Override the computed version code")
    parser.add_argument("--commit", default="unknown", help="Source git commit (short or full SHA)")
    parser.add_argument("--ref", default="unknown", help="Git ref the build was made from")
    parser.add_argument("--platform", default="", help="win-x64 | linux-x64 | macos-x64 | macos-arm64")
    parser.add_argument("--ffmpeg-version", default="bundled", help="Human-readable FFmpeg version string")
    parser.add_argument("--ffmpeg-version-file", default=None,
                        help="Read the FFmpeg version string from this file")
    parser.add_argument("--ffmpeg-license", default="GPLv3")
    parser.add_argument("--output", default="mistus_av_merger/core/_build_info.py")
    args = parser.parse_args()

    if args.ffmpeg_version_file:
        args.ffmpeg_version = Path(args.ffmpeg_version_file).read_text(encoding="utf-8").strip()

    version = args.version
    if not version:
        version_file = Path("VERSION")
        if not version_file.exists():
            raise SystemExit("No --version given and no VERSION file found.")
        version = version_file.read_text(encoding="utf-8").strip()

    match = SEMVER_RE.match(version)
    if not match:
        raise SystemExit(f"Invalid SemVer: '{version}'")

    major, minor, patch, prerelease = (int(match.group(1)), int(match.group(2)),
                                       int(match.group(3)), match.group(4))
    version_code = args.version_code
    if version_code is None:
        version_code = major * 10000 + minor * 100 + patch

    target_os, target_arch = parse_platform(args.platform)
    build_date = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    content = TEMPLATE.format(
        version=version,
        version_code=version_code,
        prerelease=(f'"{prerelease}"' if prerelease else "None"),
        git_commit=args.commit,
        git_ref=args.ref,
        build_date_utc=build_date,
        target_os=target_os,
        target_arch=target_arch,
        ffmpeg_version=args.ffmpeg_version,
        ffmpeg_license=args.ffmpeg_license,
    )

    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(content, encoding="utf-8")
    print(f"[gen_build_info] Wrote {out}")
    print(f"[gen_build_info] version={version} version_code={version_code} "
          f"os={target_os} arch={target_arch} ffmpeg={args.ffmpeg_version}")


if __name__ == "__main__":
    main()
