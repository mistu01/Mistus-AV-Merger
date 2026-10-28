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


def test_crash_recovery_resumes_interrupted_jobs_and_preserves_completed(tmp_path, monkeypatch):
    """
    Simulates a sudden PC shutdown or crash while job 2 was actively rendering.
    Verifies that load_session() restores is_running, preserves completed jobs,
    and resets the interrupted rendering job to 'queued' so it resumes next.
    """
    session_file = tmp_path / "active_session.json"
    session_data = {
        "schema_version": 2,
        "settings": {
            "cpu_profile": "balanced",
            "concurrency": 1,
            "is_running": True,
        },
        "jobs": [
            {
                "id": "job_1",
                "audioPath": "track1.mp3",
                "videoPath": "clip1.mp4",
                "outputPath": "out1.mp4",
                "mode": "copy",
                "status": "completed",
                "duration": 120.0,
                "progress": 100.0,
                "options": {},
            },
            {
                "id": "job_2",
                "audioPath": "track2.mp3",
                "videoPath": "clip2.mp4",
                "outputPath": "out2.mp4",
                "mode": "encode",
                "status": "rendering",
                "duration": 300.0,
                "progress": 45.0,
                "options": {},
            },
            {
                "id": "job_3",
                "audioPath": "track3.mp3",
                "videoPath": "clip3.mp4",
                "outputPath": "out3.mp4",
                "mode": "copy",
                "status": "queued",
                "duration": 180.0,
                "progress": 0.0,
                "options": {},
            },
        ],
    }
    session_file.write_text(json.dumps(session_data), encoding="utf-8")

    mgr = JobQueueManager()
    monkeypatch.setattr(mgr, "session_file", session_file)
    mgr.load_session()

    # is_running restored so worker immediately continues
    assert mgr.is_running is True

    # All 3 jobs rehydrated in exact order
    assert len(mgr.jobs) == 3

    # Job 1 stays completed
    assert mgr.jobs[0].job_id == "job_1"
    assert mgr.jobs[0].status == "completed"
    assert mgr.jobs[0].progress == 100.0

    # Job 2 (interrupted mid-render) is reset to queued to resume cleanly
    assert mgr.jobs[1].job_id == "job_2"
    assert mgr.jobs[1].status == "queued"
    assert mgr.jobs[1].progress == 0.0
    assert any("Resumed after unexpected exit" in log for log in mgr.jobs[1].logs)

    # Job 3 is queued
    assert mgr.jobs[2].job_id == "job_3"
    assert mgr.jobs[2].status == "queued"


def test_is_output_file_complete_heuristics(tmp_path):
    from mistus_av_merger.core.jobs import is_output_file_complete

    # 1. Non-existent file
    assert not is_output_file_complete(tmp_path / "nonexistent.mp4", expected_duration=60.0)

    # 2. 0-byte file
    empty = tmp_path / "empty.mp4"
    empty.write_bytes(b"")
    assert not is_output_file_complete(empty, expected_duration=60.0)

    # 3. Tiny corrupt file (< 2KB)
    corrupt = tmp_path / "corrupt.mp4"
    corrupt.write_bytes(b"not a video header" * 10)
    assert not is_output_file_complete(corrupt, expected_duration=60.0)
