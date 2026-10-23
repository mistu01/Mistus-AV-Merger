"""
Unit tests for safe FFmpeg command line builder.
"""

from pathlib import Path
from mistus_av_merger.core.ffmpeg_builder import FFmpegCommandBuilder


def test_build_stream_copy_loop():
    builder = FFmpegCommandBuilder(ffmpeg_bin="ffmpeg")
    cmd = builder.build_stream_copy_loop(
        video_path=Path("/media/clip.mp4"),
        audio_path=Path("/media/song.mp3"),
        output_path=Path("/renders/output.mp4"),
        audio_transcode=False,
    )

    assert "-stream_loop" in cmd
    idx_loop = cmd.index("-stream_loop")
    assert cmd[idx_loop + 1] == "-1"
    assert "-shortest" in cmd
    assert "-c:v" in cmd
    idx_cv = cmd.index("-c:v")
    assert cmd[idx_cv + 1] == "copy"
    assert "-c:a" in cmd
    idx_ca = cmd.index("-c:a")
    assert cmd[idx_ca + 1] == "copy"


def test_build_reencode_render_with_filters():
    builder = FFmpegCommandBuilder(ffmpeg_bin="ffmpeg")
    cmd = builder.build_reencode_render(
        video_path=Path("/media/clip.mp4"),
        audio_path=Path("/media/song.mp3"),
        output_path=Path("/renders/output.mp4"),
        encoder="libx264",
        resolution="1080p",
        night_mode=True,
        night_intensity=0.8,
        noise_static=True,
        noise_seed=777,
    )

    assert "-c:v" in cmd
    idx_cv = cmd.index("-c:v")
    assert cmd[idx_cv + 1] == "libx264"

    # Verify filtergraph contains scaling and night grading
    idx_vf = cmd.index("-vf")
    vf_chain = cmd[idx_vf + 1]
    assert "scale=1920:1080" in vf_chain
    assert "curves=all=" in vf_chain
    assert "seed=777" in vf_chain
