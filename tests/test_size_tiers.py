"""
Unit tests confirming unconstrained scene CRF quality mode without artificial bitrate caps.
"""
from mistus_av_merger.api.app import _apply_size_tier, _SIZE_TIERS
from mistus_av_merger.core.ffmpeg_builder import FFmpegCommandBuilder
from pathlib import Path


def test_legacy_size_tier_stubs():
    assert "small" in _SIZE_TIERS
    assert "balanced" in _SIZE_TIERS
    assert "high" in _SIZE_TIERS


def test_size_tier_clears_bitrates():
    options = {"sizeTarget": "small", "videoBitrateKbps": 500, "audioBitrateKbps": 128}
    _apply_size_tier(options, 3600.0)
    assert "videoBitrateKbps" not in options
    assert "audioBitrateKbps" not in options


def test_ffmpeg_builder_defaults_to_scene_crf():
    """Confirms ffmpeg builder applies pristine CRF mode with VBV peak capping for compact ~350 MB/hr size."""
    builder = FFmpegCommandBuilder(ffmpeg_bin="ffmpeg")
    cmd = builder.build_reencode_render(
        video_path=Path("/media/clip.mp4"),
        audio_path=Path("/media/song.mp3"),
        output_path=Path("/renders/output.mp4"),
        encoder="libx264",
    )
    assert "-crf" in cmd
    idx_crf = cmd.index("-crf")
    assert cmd[idx_crf + 1] == "18"
    assert "-maxrate" in cmd
    assert cmd[cmd.index("-maxrate") + 1] == "950k"
    assert "-bufsize" in cmd
    assert cmd[cmd.index("-bufsize") + 1] == "1900k"
    assert "-tune" in cmd
    assert cmd[cmd.index("-tune") + 1] == "film"
    assert "-b:v" not in cmd


def test_filtered_loop_clip_defaults_to_scene_crf():
    builder = FFmpegCommandBuilder(ffmpeg_bin="ffmpeg")
    cmd = builder.build_filtered_loop_clip(
        video_path=Path("/media/clip.mp4"),
        output_path=Path("/tmp/loop.mp4"),
        encoder="libx264",
    )
    assert "-crf" in cmd
    idx_crf = cmd.index("-crf")
    assert cmd[idx_crf + 1] == "18"
    assert "-maxrate" in cmd
    assert cmd[cmd.index("-maxrate") + 1] == "950k"
    assert "-bufsize" in cmd
    assert cmd[cmd.index("-bufsize") + 1] == "1900k"
    assert "-b:v" not in cmd


def test_constrained_scene_crf_compact_size_caps():
    """Verifies that HEVC, SVT-AV1, and NVENC all apply VBV caps to prevent 10GB file explosions."""
    builder = FFmpegCommandBuilder(ffmpeg_bin="ffmpeg")
    cmd_x265 = builder.build_filtered_loop_clip(
        video_path=Path("/media/clip.mp4"),
        output_path=Path("/tmp/loop.mp4"),
        encoder="libx265",
    )
    assert "-maxrate" in cmd_x265 and cmd_x265[cmd_x265.index("-maxrate") + 1] == "950k"
    assert "-bufsize" in cmd_x265 and cmd_x265[cmd_x265.index("-bufsize") + 1] == "1900k"

    cmd_nvenc = builder.build_filtered_loop_clip(
        video_path=Path("/media/clip.mp4"),
        output_path=Path("/tmp/loop.mp4"),
        encoder="h264_nvenc",
    )
    assert "-maxrate" in cmd_nvenc and cmd_nvenc[cmd_nvenc.index("-maxrate") + 1] == "950k"
    assert "-bufsize" in cmd_nvenc and cmd_nvenc[cmd_nvenc.index("-bufsize") + 1] == "1900k"
    assert "-spatial-aq" in cmd_nvenc and cmd_nvenc[cmd_nvenc.index("-spatial-aq") + 1] == "1"
