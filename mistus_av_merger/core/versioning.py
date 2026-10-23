"""
Versioning and schema migration engine for Mistus AV Merger.
"""

import json
import re
import shutil
from pathlib import Path
from typing import Any, Callable, Dict, Tuple


def compute_version_code(major: int, minor: int, patch: int) -> int:
    """
    Computes a strictly monotonic integer version code.
    Formula: MAJOR*10000 + MINOR*100 + PATCH (e.g. 1.2.3 -> 10203).
    """
    if major < 0 or minor < 0 or patch < 0:
        raise ValueError("Version components must be non-negative integers")
    return major * 10000 + minor * 100 + patch


def parse_semver(version_str: str) -> Dict[str, Any]:
    """
    Parses a SemVer 2.0.0 string into major, minor, patch, pre-release, and version code.
    """
    cleaned = version_str.strip().lstrip("v")
    pattern = r"^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$"
    match = re.match(pattern, cleaned)
    if not match:
        raise ValueError(f"Invalid SemVer string: '{version_str}'")

    major = int(match.group(1))
    minor = int(match.group(2))
    patch = int(match.group(3))
    prerelease = match.group(4)
    version_code = compute_version_code(major, minor, patch)

    return {
        "major": major,
        "minor": minor,
        "patch": patch,
        "prerelease": prerelease,
        "version_code": version_code,
        "canonical": f"{major}.{minor}.{patch}" + (f"-{prerelease}" if prerelease else ""),
    }


CURRENT_SCHEMA_VERSION = 1

# Registry of migrations: schema_version N -> N+1
_MIGRATIONS: Dict[int, Callable[[Dict[str, Any]], Dict[str, Any]]] = {}


def register_migration(from_version: int):
    def decorator(fn: Callable[[Dict[str, Any]], Dict[str, Any]]):
        _MIGRATIONS[from_version] = fn
        return fn
    return decorator


@register_migration(0)
def migrate_v0_to_v1(data: Dict[str, Any]) -> Dict[str, Any]:
    """Migrates legacy v0 unversioned schema to v1."""
    migrated = dict(data)
    migrated["schema_version"] = 1
    if "bulk_mode" in migrated and "pairing_mode" not in migrated:
        migrated["pairing_mode"] = migrated.pop("bulk_mode")
    if "concurrency" not in migrated:
        migrated["concurrency"] = 1
    if "cpu_profile" not in migrated:
        migrated["cpu_profile"] = "balanced"
    return migrated


def load_and_migrate_json(file_path: Path, current_schema: int = CURRENT_SCHEMA_VERSION) -> Dict[str, Any]:
    """
    Loads a versioned JSON file, performs migrations up to current_schema,
    or gracefully refuses with backup if from a future unsupported schema.
    """
    if not file_path.exists():
        return {}

    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    if not isinstance(data, dict):
        return data

    doc_schema = data.get("schema_version", 0)

    if doc_schema > current_schema:
        # Create safety backup
        backup_path = file_path.with_suffix(f".unsupported_v{doc_schema}.bak")
        shutil.copy2(file_path, backup_path)
        raise ValueError(
            f"File '{file_path.name}' uses schema version {doc_schema}, but this application "
            f"only supports up to version {current_schema}. A backup has been saved to '{backup_path.name}'. "
            f"Please update Mistus AV Merger to open this file."
        )

    # Apply sequential migrations
    current_data = dict(data)
    while doc_schema < current_schema:
        if doc_schema in _MIGRATIONS:
            current_data = _MIGRATIONS[doc_schema](current_data)
            doc_schema = current_data.get("schema_version", doc_schema + 1)
        else:
            current_data["schema_version"] = doc_schema + 1
            doc_schema += 1

    return current_data
