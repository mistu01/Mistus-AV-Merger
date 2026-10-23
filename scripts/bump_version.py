#!/usr/bin/env python3
"""
Cross-platform version bumper for Mistus AV Merger (Path A in the release flow).

Bumps SemVer in VERSION, computes the monotonic version code
(MAJOR*10000 + MINOR*100 + PATCH), rolls the CHANGELOG.md [Unreleased] section
into a dated `## [X.Y.Z] - YYYY-MM-DD` section, refreshes the dev-time build
info fallback, then (optionally) commits, tags, and pushes.

Usage:
  python scripts/bump_version.py minor            # bump + edit files only
  python scripts/bump_version.py patch --no-tag   # commit without creating a tag
  python scripts/bump_version.py minor --push     # commit, tag, and push (tag push
                                                  # triggers the release workflow)
  python scripts/bump_version.py major --push --no-tag
  python scripts/bump_version.py pre --pre-tag beta.1

Two release paths (documented in CONTRIBUTING.md):
  A) `python scripts/bump_version.py minor --push` -> push to main with a changed
     VERSION file. The Push:main trigger of .github/workflows/build-release.yml
     builds the bundles and creates both the tag and the GitHub Release.
  B) push a v*.*.* tag manually (VERSION must match the tag).
"""

import argparse
import datetime
import re
import subprocess
import sys
from pathlib import Path

SEMVER_RE = re.compile(r"^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$")


def compute_version_code(major: int, minor: int, patch: int) -> int:
    if major < 0 or minor < 0 or patch < 0:
        raise ValueError("Version components must be non-negative")
    return major * 10000 + minor * 100 + patch


def parse_semver(v_str: str):
    m = SEMVER_RE.match(v_str.strip().lstrip("v"))
    if not m:
        raise ValueError(f"Invalid SemVer: '{v_str}'")
    return int(m.group(1)), int(m.group(2)), int(m.group(3)), m.group(4)


def bump_version(current: str, part: str) -> str:
    major, minor, patch, _ = parse_semver(current)
    if part == "major":
        return f"{major + 1}.0.0"
    if part == "minor":
        return f"{major}.{minor + 1}.0"
    if part == "patch":
        return f"{major}.{minor}.{patch + 1}"
    if part.startswith("pre:"):
        tag = part.split(":", 1)[1] or "rc.1"
        return f"{major}.{minor}.{patch + 1}-{tag}"
    raise ValueError(f"Unknown bump target: '{part}'")


def update_changelog(changelog_path: Path, new_version: str) -> None:
    """Moves everything under [Unreleased] into a dated section for new_version."""
    if not changelog_path.exists():
        print(f"Warning: {changelog_path} not found, skipping changelog update.")
        return

    content = changelog_path.read_text(encoding="utf-8")
    today = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d")

    # If the maintainer already prepared a dated section for new_version,
    # leave the changelog untouched (their notes are authoritative).
    if re.search(rf"^##\s*\[{re.escape(new_version)}\]", content, flags=re.MULTILINE):
        print(f"CHANGELOG already has a [{new_version}] section - leaving as written.")
        return

    pattern = r"(^##\s*\[Unreleased\]\s*\n)(.*?)(?=^---\s*\n\s*\n##\s|\Z)"
    match = re.search(pattern, content, flags=re.DOTALL | re.MULTILINE)
    if not match:
        print("Warning: [Unreleased] section not found in CHANGELOG.md")
        return

    notes = match.group(2).strip()
    if not notes:
        notes = "### Changed\n- Maintenance and version bump."

    date_section = f"## [{new_version}] - {today}\n\n{notes}\n\n"

    # Replace the [Unreleased] block (from its header up to the fenced body) with
    # an empty [Unreleased] header followed by the new dated section.
    start, end = match.span()
    replacement = "## [Unreleased]\n\n### Planned\n- (nothing yet)\n\n---\n\n" + date_section
    changelog_path.write_text(content[:start] + replacement + content[end:], encoding="utf-8")
    print(f"Updated CHANGELOG.md: rolled [Unreleased] into [{new_version}] - {today}")


def update_build_info(build_info_path: Path, new_version: str, version_code: int) -> None:
    """Refreshes the development-time fallback build info (CI regenerates this)."""
    today_iso = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    build_info_path.parent.mkdir(parents=True, exist_ok=True)
    build_info_path.write_text(
        '"""\nBuild metadata POPULATED AT PACKAGING/CI TIME -- do not edit by hand.\n'
        "Regenerate with: python scripts/gen_build_info.py --help\n"
        '"""\n\nBUILD_INFO = {\n'
        f'    "version": "{new_version}",\n'
        f'    "version_code": {version_code},\n'
        '    "prerelease": None,\n'
        '    "git_commit": "dev",\n'
        '    "git_ref": "main",\n'
        f'    "build_date_utc": "{today_iso}",\n'
        '    "target_os": "dev",\n'
        '    "target_arch": "dev",\n'
        '    "ffmpeg_version": "bundled",\n'
        '    "ffmpeg_license": "GPLv3",\n'
        "}\n",
        encoding="utf-8",
    )
    print(f"Updated {build_info_path}")


def run_git(args: list) -> None:
    subprocess.run(["git"] + args, check=True)


def main() -> None:
    parser = argparse.ArgumentParser(description="Mistus AV Merger version bumper")
    parser.add_argument("bump", choices=["major", "minor", "patch", "pre"], help="Part to bump")
    parser.add_argument("--pre-tag", default="rc.1", help="Pre-release tag suffix (default: rc.1)")
    parser.add_argument("--root", default=".", help="Project root directory")
    parser.add_argument("--push", action="store_true",
                        help="Commit AND push the bump commit (and the tag unless --no-tag)")
    parser.add_argument("--no-tag", action="store_true",
                        help="Do not create an annotated tag (release via the VERSION push path)")
    args = parser.parse_args()

    root = Path(args.root).resolve()
    version_file = root / "VERSION"
    changelog_file = root / "CHANGELOG.md"
    build_info_file = root / "mistus_av_merger" / "core" / "_build_info.py"

    if not version_file.exists():
        print(f"Error: {version_file} not found.", file=sys.stderr)
        sys.exit(1)

    current = version_file.read_text(encoding="utf-8").strip()
    bump_target = f"pre:{args.pre_tag}" if args.bump == "pre" else args.bump
    new_version = bump_version(current, bump_target)

    major, minor, patch, _ = parse_semver(new_version)
    vcode = compute_version_code(major, minor, patch)
    tag = f"v{new_version}"

    # 1. VERSION
    version_file.write_text(new_version + "\n", encoding="utf-8")
    print(f"Bumping version: {current} -> {new_version} (versionCode: {vcode})")

    # 2. CHANGELOG
    update_changelog(changelog_file, new_version)

    # 3. Dev fallback build info
    update_build_info(build_info_file, new_version, vcode)

    # 4. Git wiring
    rel_files = [str(version_file.relative_to(root)),
                 str(changelog_file.relative_to(root)),
                 str(build_info_file.relative_to(root))]

    if shutil_which("git") is None:
        print("Warning: git not found on PATH -- printing manual steps instead.", file=sys.stderr)
        _print_next_steps(rel_files, tag, args)
        return

    if args.push or not args.no_tag:
        run_git(["add"] + rel_files)

    if args.no_tag:
        if args.push:
            run_git(["commit", "-m", f"chore(release): bump to {tag}"])
            run_git(["push", "origin", "HEAD"])
        else:
            _print_next_steps(rel_files, tag, args, committed=True)
        return

    run_git(["commit", "-m", f"chore(release): bump to {tag}"])
    run_git(["tag", "-a", tag, "-m", f"Release {tag}"])
    if args.push:
        run_git(["push", "origin", "HEAD"])
        run_git(["push", "origin", tag])
        print(f"\nPushed {tag}. The 'Build and Release' workflow will build and publish the release.")
    else:
        _print_next_steps(rel_files, tag, args, committed=True)


def shutil_which(binary: str):
    import shutil
    return shutil.which(binary)


def _print_next_steps(rel_files: list, tag: str, args, committed: bool = False) -> None:
    print("\nNext steps:")
    if not committed:
        print("  git add " + " ".join(rel_files))
        print(f'  git commit -m "chore(release): bump to {tag}"')
        if not args.no_tag:
            print(f'  git tag -a {tag} -m "Release {tag}"')
    suffix = "" if args.no_tag else f" {tag}"
    print(f"  git push origin HEAD{suffix}")
    print("  or reconcile cleanly by re-running: python scripts/bump_version.py "
          + args.bump + " --push")


if __name__ == "__main__":
    main()
