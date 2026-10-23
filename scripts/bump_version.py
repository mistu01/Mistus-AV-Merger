#!/usr/bin/env python3
"""
Cross-platform version bumper and release tagging script for Mistus AV Merger.
Bumps SemVer, updates VERSION file, generates monotonically increasing version code,
rolls CHANGELOG.md [Unreleased] section into dated release header, and outputs git tag command.
"""

import argparse
import datetime
import re
import sys
from pathlib import Path


def compute_version_code(major: int, minor: int, patch: int) -> int:
    if major < 0 or minor < 0 or patch < 0:
        raise ValueError("Version components must be non-negative")
    return major * 10000 + minor * 100 + patch


def parse_semver(v_str: str):
    v_str = v_str.strip().lstrip("v")
    m = re.match(r"^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$", v_str)
    if not m:
        raise ValueError(f"Invalid SemVer: '{v_str}'")
    major, minor, patch = int(m.group(1)), int(m.group(2)), int(m.group(3))
    prerelease = m.group(4)
    return major, minor, patch, prerelease


def bump_version(current: str, part: str) -> str:
    major, minor, patch, prerelease = parse_semver(current)
    if part == "major":
        return f"{major + 1}.0.0"
    elif part == "minor":
        return f"{major}.{minor + 1}.0"
    elif part == "patch":
        return f"{major}.{minor}.{patch + 1}"
    elif part.startswith("pre"):
        # e.g. "rc.1"
        tag = part.split(":", 1)[1] if ":" in part else "rc.1"
        return f"{major}.{minor}.{patch + 1}-{tag}"
    else:
        raise ValueError(f"Unknown bump target: '{part}'")


def update_changelog(changelog_path: Path, new_version: str):
    if not changelog_path.exists():
        print(f"Warning: {changelog_path} not found, skipping changelog update.")
        return

    content = changelog_path.read_text(encoding="utf-8")
    today = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d")

    unreleased_pattern = r"(##\s*\[Unreleased\]\s*\n)(.*?)(?=\n##\s*\[|$)"
    match = re.search(unreleased_pattern, content, flags=re.DOTALL)
    if not match:
        print("Warning: [Unreleased] section not found in CHANGELOG.md")
        return

    unreleased_header = match.group(1)
    notes = match.group(2).strip()

    if not notes:
        notes = "### Changed\n- Maintenance and version bump."

    new_section = (
        f"{unreleased_header}\n"
        f"## [{new_version}] - {today}\n"
        f"{notes}\n\n"
    )

    updated_content = content[:match.start()] + new_section + content[match.end():]
    changelog_path.write_text(updated_content, encoding="utf-8")
    print(f"Updated CHANGELOG.md for [{new_version}] - {today}")


def update_build_info(build_info_path: Path, new_version: str, version_code: int):
    today_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    content = f'''"""
Auto-generated build info file for Mistus AV Merger.
"""

BUILD_INFO = {{
    "version": "{new_version}",
    "version_code": {version_code},
    "git_commit": "HEAD",
    "git_branch": "main",
    "build_date_utc": "{today_iso}",
    "target_os": "dev",
    "target_arch": "dev",
    "ffmpeg_version": "4.4.2-static",
    "ffmpeg_license": "GPLv3",
}}
'''
    build_info_path.parent.mkdir(parents=True, exist_ok=True)
    build_info_path.write_text(content, encoding="utf-8")
    print(f"Updated {build_info_path}")


def main():
    parser = argparse.ArgumentParser(description="Mistus AV Merger Version Bumper")
    parser.add_argument("bump", choices=["major", "minor", "patch", "pre"], help="Part to bump")
    parser.add_argument("--pre-tag", default="rc.1", help="Pre-release tag suffix")
    parser.add_argument("--root", default=".", help="Project root directory")
    args = parser.parse_args()

    root = Path(args.root).resolve()
    version_file = root / "VERSION"
    changelog_file = root / "CHANGELOG.md"
    build_info_file = root / "mistus_av_merger" / "core" / "_build_info.py"

    if not version_file.exists():
        print(f"Error: {version_file} not found.", file=sys.stderr)
        sys.exit(1)

    current_version = version_file.read_text(encoding="utf-8").strip()
    bump_target = f"pre:{args.pre_tag}" if args.bump == "pre" else args.bump
    new_version = bump_version(current_version, bump_target)

    major, minor, patch, _ = parse_semver(new_version)
    vcode = compute_version_code(major, minor, patch)

    # 1. Update VERSION file
    version_file.write_text(new_version + "\n", encoding="utf-8")
    print(f"Bumping version: {current_version} -> {new_version} (versionCode: {vcode})")

    # 2. Update CHANGELOG.md
    update_changelog(changelog_file, new_version)

    # 3. Update build info
    update_build_info(build_info_file, new_version, vcode)

    print("\nNext steps:")
    print(f"  git add VERSION CHANGELOG.md mistus_av_merger/core/_build_info.py")
    print(f'  git commit -m "chore(release): bump to v{new_version}"')
    print(f'  git tag -a v{new_version} -m "Release v{new_version}"')


if __name__ == "__main__":
    main()
