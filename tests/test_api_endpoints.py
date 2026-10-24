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
