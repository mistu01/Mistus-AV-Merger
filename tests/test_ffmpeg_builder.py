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


def test_build_stream_copy_loop_duration_aware():
    """Duration-aware mode: finite loop count and -t output clamp, no -shortest."""
    builder = FFmpegCommandBuilder(ffmpeg_bin="ffmpeg")
    cmd = builder.build_stream_copy_loop(
        video_path=Path("/media/clip.mp4"),
        audio_path=Path("/media/song.mp3"),
        output_path=Path("/renders/output.mp4"),
        audio_transcode=True,
        audio_duration_sec=6.0,
        video_duration_sec=2.0,
    )

    # 6s audio / 2s clip -> exactly 3 iterations (stream_loop 2)
    idx_loop = cmd.index("-stream_loop")
    assert cmd[idx_loop + 1] == "2"
    # Precise output clamp instead of keyframe-limited -shortest
    idx_t = cmd.index("-t")
    assert cmd[idx_t + 1] == "6.000"
    assert "-shortest" not in cmd
    # Loop timestamps regenerated so stream copy stays monotonic
    assert "+genpts" in cmd
    idx_cv = cmd.index("-c:v")
    assert cmd[idx_cv + 1] == "copy"
    idx_ca = cmd.index("-c:a")
    assert cmd[idx_ca + 1] == "aac"


def test_build_stream_copy_loop_partial_loop_rounds_up():
    """Fractional ratios round up: 5s audio / 2s clip -> 3 loops, clamped at 5s."""
    builder = FFmpegCommandBuilder(ffmpeg_bin="ffmpeg")
    cmd = builder.build_stream_copy_loop(
        video_path=Path("/media/clip.mp4"),
        audio_path=Path("/media/song.mp3"),
        output_path=Path("/renders/output.mp4"),
        audio_duration_sec=5.0,
        video_duration_sec=2.0,
    )
    idx_loop = cmd.index("-stream_loop")
    assert cmd[idx_loop + 1] == "2"  # ceil(5/2) = 3 -> stream_loop 2
    idx_t = cmd.index("-t")
    assert cmd[idx_t + 1] == "5.000"


def test_build_stream_copy_loop_single_play_shorter_than_audio():
    """Audio longer than one full loop always loops at least once more."""
    builder = FFmpegCommandBuilder(ffmpeg_bin="ffmpeg")
    cmd = builder.build_stream_copy_loop(
        video_path=Path("/media/clip.mp4"),
        audio_path=Path("/media/song.mp3"),
        output_path=Path("/renders/output.mp4"),
        audio_duration_sec=7.0,
        video_duration_sec=3.0,
    )
    # ceil(7/3)=3 -> stream_loop 2 (two extra loop iterations beyond the first)
    idx_loop = cmd.index("-stream_loop")
    assert cmd[idx_loop + 1] == "2"


def test_build_reencode_render_clamps_output_duration():
    """Explicit duration replaces -shortest so FFmpeg 8/9 cannot overshoot."""
    builder = FFmpegCommandBuilder(ffmpeg_bin="ffmpeg")
    cmd = builder.build_reencode_render(
        video_path=Path("/media/clip.mp4"),
        audio_path=Path("/media/song.mp3"),
        output_path=Path("/renders/output.mp4"),
        encoder="libx264",
        duration_sec=6.0,
    )
    idx_t = cmd.index("-t")
    assert cmd[idx_t + 1] == "6.000"
    assert "-shortest" not in cmd


def test_build_reencode_render_without_duration_keeps_shortest():
    builder = FFmpegCommandBuilder(ffmpeg_bin="ffmpeg")
    cmd = builder.build_reencode_render(
        video_path=Path("/media/clip.mp4"),
        audio_path=Path("/media/song.mp3"),
        output_path=Path("/renders/output.mp4"),
        encoder="libx264",
    )
    assert "-shortest" in cmd


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
    assert "all_seed=777" in vf_chain
