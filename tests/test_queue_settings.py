"""
Unit tests for queue-level settings (CPU profile -> ffmpeg threads) and
session persistence of those settings plus job options (overlay, presets).
"""
import json
import os

from mistus_av_merger.core.jobs import JobQueueManager


def test_threads_for_profile_mapping():
    mgr = JobQueueManager()
    mgr.cpu_profile = "aggressive"
    assert mgr.threads_for_profile() is None
    mgr.cpu_profile = "balanced"
    assert mgr.threads_for_profile() == max(2, (os.cpu_count() or 4) // 2)
    mgr.cpu_profile = "low"
    assert mgr.threads_for_profile() == 2
    mgr.cpu_profile = "idle"
    assert mgr.threads_for_profile() == 1
    mgr.cpu_profile = "bogus"
    assert mgr.threads_for_profile() is None


def test_settings_roundtrip_in_session(tmp_path, monkeypatch):
    mgr = JobQueueManager()
    monkeypatch.setattr(mgr, "session_file", tmp_path / "active_session.json")
    mgr.cpu_profile = "idle"
    mgr.concurrency = 1
    mgr.save_session()
    data = json.loads((tmp_path / "active_session.json").read_text(encoding="utf-8"))
    assert data["settings"]["cpu_profile"] == "idle"
    assert data["schema_version"] == 2
    # A fresh manager restores the persisted profile
    other = JobQueueManager()
    monkeypatch.setattr(other, "session_file", tmp_path / "active_session.json")
    other.load_session()
    assert other.cpu_profile == "idle"
    assert other.concurrency == 1
