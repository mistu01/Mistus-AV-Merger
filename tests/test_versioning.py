"""
Unit tests for SemVer parsing, monotonic version code formula, and schema migrations.
"""

import json
from pathlib import Path

try:
    import pytest
except ImportError:
    class _MockPytestRaises:
        def __init__(self, exc_type):
            self.exc_type = exc_type
            self.value = None
        def __enter__(self):
            return self
        def __exit__(self, exc_type, exc_val, exc_tb):
            if exc_type is not None and issubclass(exc_type, self.exc_type):
                self.value = exc_val
                return True
            raise AssertionError(f"Expected {self.exc_type}, but got {exc_type}")

    class _MockPytest:
        @staticmethod
        def raises(exc_type):
            return _MockPytestRaises(exc_type)

    pytest = _MockPytest()

from mistus_av_merger.core.versioning import (
    compute_version_code,
    parse_semver,
    load_and_migrate_json,
    CURRENT_SCHEMA_VERSION,
)


def test_version_code_formula():
    assert compute_version_code(0, 1, 0) == 100
    assert compute_version_code(0, 5, 0) == 500
    assert compute_version_code(1, 0, 0) == 10000
    assert compute_version_code(1, 2, 3) == 10203
    with pytest.raises(ValueError):
        compute_version_code(-1, 0, 0)


def test_parse_semver():
    parsed = parse_semver("0.5.0")
    assert parsed["major"] == 0
    assert parsed["minor"] == 5
    assert parsed["patch"] == 0
    assert parsed["prerelease"] is None
    assert parsed["version_code"] == 500

    parsed_pre = parse_semver("v1.0.0-rc.2")
    assert parsed_pre["major"] == 1
    assert parsed_pre["minor"] == 0
    assert parsed_pre["patch"] == 0
    assert parsed_pre["prerelease"] == "rc.2"
    assert parsed_pre["version_code"] == 10000


def test_schema_migration_from_v0(tmp_path: Path):
    legacy_file = tmp_path / "legacy_settings.json"
    legacy_file.write_text(json.dumps({
        "last_audio_folder": "/music",
        "bulk_mode": "cycle"
    }))

    migrated = load_and_migrate_json(legacy_file, CURRENT_SCHEMA_VERSION)
    assert migrated["schema_version"] == 1
    assert migrated["pairing_mode"] == "cycle"
    assert "bulk_mode" not in migrated
    assert migrated["concurrency"] == 1


def test_future_schema_refusal_with_backup(tmp_path: Path):
    future_file = tmp_path / "future_settings.json"
    future_file.write_text(json.dumps({
        "schema_version": 999,
        "feature_future": True
    }))

    with pytest.raises(ValueError) as excinfo:
        load_and_migrate_json(future_file, CURRENT_SCHEMA_VERSION)

    assert "uses schema version 999" in str(excinfo.value)
    backup_file = tmp_path / "future_settings.unsupported_v999.bak"
    assert backup_file.exists()
