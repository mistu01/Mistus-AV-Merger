"""
Unit tests for naming pattern expansion, filename sanitization, and collision policies.
"""

from mistus_av_merger.core.naming import (
    sanitize_filename,
    expand_naming_pattern,
    resolve_container_safety,
    resolve_batch_collisions,
)


def test_sanitize_filename():
    assert sanitize_filename("track:1*special?.mp4") == "track_1_special_.mp4"
    assert sanitize_filename("CON.mp4") == "safe_CON.mp4"
    assert sanitize_filename("spaces and dots. . .mp4") == "spaces and dots.mp4"


def test_expand_naming_pattern():
    name = expand_naming_pattern(
        template="{index} - {audio_name} [{video_name}].{video_ext}",
        audio_filename="Summer Song.flac",
        video_filename="ocean_loop.mp4",
        video_ext="mp4",
        index=3,
    )
    assert name == "003 - Summer Song [ocean_loop].mp4"


def test_resolve_container_safety():
    ext, changed, reason = resolve_container_safety("mp4", audio_codec="flac", is_reencode=False)
    assert ext == "mkv"
    assert changed is True


def test_resolve_batch_collisions_suffix():
    names = ["Song.mp4", "Song.mp4", "Song.mp4"]
    resolved = resolve_batch_collisions(names, policy="suffix")
    assert resolved[0][0] == "Song.mp4"
    assert resolved[1][0] == "Song (2).mp4"
    assert resolved[2][0] == "Song (3).mp4"
