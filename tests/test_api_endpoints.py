from pathlib import Path
from mistus_av_merger.api.app import (
    get_app_settings,
    set_app_settings,
    stop_queue_immediately,
    clear_all_jobs,
    add_jobs,
    queue_mgr,
    SettingsUpdateRequest,
    QueueAddRequest,
)

def test_settings_endpoints():
    data = get_app_settings()
    assert "last_audio_folder" in data

    update_res = set_app_settings(SettingsUpdateRequest(last_audio_folder="/custom/music", last_bulk_mode="random_seeded"))
    assert update_res["last_audio_folder"] == "/custom/music"
    assert update_res["last_bulk_mode"] == "random_seeded"

def test_queue_stop_endpoint():
    res = stop_queue_immediately()
    assert res["status"] == "stopped"

def test_queue_add_does_not_auto_start(tmp_path):
    audio = tmp_path / "song.mp3"
    audio.write_bytes(b"\x00" * 100)
    video = tmp_path / "clip.mp4"
    video.write_bytes(b"\x00" * 100)
    out = tmp_path / "out.mp4"

    res = add_jobs(QueueAddRequest(
        jobs=[{
            "audio_path": str(audio),
            "video_path": str(video),
            "output_path": str(out),
            "mode": "copy",
            "duration": 10.0,
        }],
        auto_start=False,
    ))
    assert len(res["added"]) == 1
    # Auto-start must NOT be triggered
    assert queue_mgr.is_running is False


def test_queue_clear_endpoint():
    res = clear_all_jobs()
    assert res["status"] == "cleared"
    assert len(queue_mgr.jobs) == 0


def test_queue_add_updates_existing_job_options(tmp_path):
    clear_all_jobs()
    audio = tmp_path / "track.mp3"
    audio.write_bytes(b"\x00" * 100)
    video = tmp_path / "background.mp4"
    video.write_bytes(b"\x00" * 100)
    out = tmp_path / "out_updated.mp4"
    img = tmp_path / "logo.png"
    img.write_bytes(b"\x00" * 100)

    # 1. Add job with default copy mode and no effects
    res1 = add_jobs(QueueAddRequest(
        jobs=[{
            "audio_path": str(audio),
            "video_path": str(video),
            "output_path": str(out),
            "mode": "copy",
            "duration": 60.0,
            "options": {"vhsPreset": "none", "overlayEnabled": False},
        }],
        auto_start=False,
    ))
    assert len(res1["added"]) == 1
    job = queue_mgr.jobs[0]
    assert job.mode == "copy"
    assert job.options.get("vhsPreset") == "none"
    assert "overlayPath" not in job.options

    # 2. User modifies Render Options (enables VHS preset & image overlay) and re-adds to queue
    res2 = add_jobs(QueueAddRequest(
        jobs=[{
            "audio_path": str(audio),
            "video_path": str(video),
            "output_path": str(out),
            "mode": "copy",
            "duration": 60.0,
            "options": {
                "vhsPreset": "clean_vhs",
                "overlayEnabled": True,
                "overlayPath": str(img),
                "overlayAnimation": "bounce",
            },
        }],
        auto_start=False,
    ))
    # Must update existing job in place
    assert len(res2["added"]) == 1
    assert len(queue_mgr.jobs) == 1
    updated_job = queue_mgr.jobs[0]
    assert updated_job.mode == "encode"
    assert updated_job.options.get("vhsPreset") == "clean_vhs"
    assert updated_job.options.get("overlayPath") == str(img)
    assert updated_job.options.get("overlayAnimation") == "bounce"


def test_queue_stop_clear_readd_start_lifecycle(tmp_path):
    from mistus_av_merger.api.app import start_queue
    clear_all_jobs()
    audio = tmp_path / "song.mp3"
    audio.write_bytes(b"\x00" * 100)
    video = tmp_path / "clip.mp4"
    video.write_bytes(b"\x00" * 100)
    out = tmp_path / "out.mp4"

    # 1. Add job & start
    add_jobs(QueueAddRequest(
        jobs=[{"audio_path": str(audio), "video_path": str(video), "output_path": str(out), "mode": "copy", "duration": 10.0}],
        auto_start=False,
    ))
    assert len(queue_mgr.jobs) == 1
    start_queue()
    assert queue_mgr.is_running is True

    # 2. Stop queue
    stop_queue_immediately()
    assert queue_mgr.is_running is False

    # 3. Clear queue
    clear_all_jobs()
    assert len(queue_mgr.jobs) == 0

    # 4. Re-add jobs
    add_jobs(QueueAddRequest(
        jobs=[{"audio_path": str(audio), "video_path": str(video), "output_path": str(out), "mode": "copy", "duration": 10.0}],
        auto_start=False,
    ))
    assert len(queue_mgr.jobs) == 1
    assert queue_mgr.jobs[0].status == "queued"

    # 5. Start queue again
    start_res = start_queue()
    assert queue_mgr.is_running is True
    assert start_res["status"] == "started"
    assert queue_mgr.jobs[0].status == "queued"
