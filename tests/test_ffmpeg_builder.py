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
    assert "brightness=" in vf_chain
    assert "all_seed=777" in vf_chain


def test_build_reencode_render_full_screen_overlay(tmp_path):
    """Overlay input is scaled to the full frame and composited with opacity."""
    image = tmp_path / "stamp.png"
    image.write_bytes(b"\x89PNG\r\n\x1a\nstub")
    builder = FFmpegCommandBuilder(ffmpeg_bin="ffmpeg")
    cmd = builder.build_reencode_render(
        video_path=Path("/media/clip.mp4"),
        audio_path=Path("/media/song.mp3"),
        output_path=Path("/renders/output.mp4"),
        encoder="libx264",
        overlay_path=image,
        overlay_opacity=0.65,
    )

    # The image is a third input, after video and audio
    idx_img = cmd.index(str(image))
    assert cmd[idx_img - 1] == "-i"
    idx_fc = cmd.index("-filter_complex")
    graph = cmd[idx_fc + 1]
    # scale2ref stretches the image over the whole base frame; opacity is
    # applied by scaling the alpha channel (overlay's own 'alpha' opts is a
    # pixfmt selector, not opacity).
    assert "[2:v][base]scale2ref=w=rw:h=rh" in graph
    assert "colorchannelmixer=aa=0.65" in graph
    assert "[refw][ovrlA]overlay=0:0:format=yuv420[v_out]" in graph
    assert "alpha=" not in graph


def test_build_reencode_render_missing_overlay_skips_composition(tmp_path):
    builder = FFmpegCommandBuilder(ffmpeg_bin="ffmpeg")
    cmd = builder.build_reencode_render(
        video_path=Path("/media/clip.mp4"),
        audio_path=Path("/media/song.mp3"),
        output_path=Path("/renders/output.mp4"),
        encoder="libx264",
        overlay_path=tmp_path / "ghost.png",
    )
    assert "-filter_complex" not in cmd
    assert "-vf" in cmd


def test_build_reencode_render_bitrate_cap_x264():
    """Bitrate cap swaps CRF for ABR args and tiers the audio bitrate."""
    builder = FFmpegCommandBuilder(ffmpeg_bin="ffmpeg")
    cmd = builder.build_reencode_render(
        video_path=Path("/media/clip.mp4"),
        audio_path=Path("/media/song.mp3"),
        output_path=Path("/renders/output.mp4"),
        encoder="libx264",
        bitrate_kbps=620,
        audio_bitrate_kbps=160,
    )
    idx_bv = cmd.index("-b:v")
    assert cmd[idx_bv + 1] == "620k"
    idx_mr = cmd.index("-maxrate")
    assert cmd[idx_mr + 1] == "1240k"
    idx_bs = cmd.index("-bufsize")
    assert cmd[idx_bs + 1] == "2480k"
    assert "-crf" not in cmd
    idx_ba = cmd.index("-b:a")
    assert cmd[idx_ba + 1] == "160k"


def test_build_reencode_render_bitrate_cap_qsv_keeps_preset():
    builder = FFmpegCommandBuilder(ffmpeg_bin="ffmpeg")
    cmd = builder.build_reencode_render(
        video_path=Path("/media/clip.mp4"),
        audio_path=Path("/media/song.mp3"),
        output_path=Path("/renders/output.mp4"),
        encoder="h264_qsv",
        bitrate_kbps=547,
        audio_bitrate_kbps=128,
    )
    assert cmd[cmd.index("-b:v") + 1] == "547k"
    assert "-global_quality" not in cmd
    assert cmd[cmd.index("-preset") + 1] == builder._QSV_PRESET
    assert cmd[cmd.index("-b:a") + 1] == "128k"


def test_build_reencode_render_bitrate_cap_nvenc_drops_cq():
    builder = FFmpegCommandBuilder(ffmpeg_bin="ffmpeg")
    cmd = builder.build_reencode_render(
        video_path=Path("/media/clip.mp4"),
        audio_path=Path("/media/song.mp3"),
        output_path=Path("/renders/output.mp4"),
        encoder="h264_nvenc",
        bitrate_kbps=400,
    )
    assert "-cq" not in cmd
    assert cmd[cmd.index("-preset") + 1] == "p4"
    assert cmd[cmd.index("-b:v") + 1] == "400k"
    # Default audio bitrate when no tier audio given
    assert cmd[cmd.index("-b:a") + 1] == "192k"


def test_build_filtered_loop_clip():
    builder = FFmpegCommandBuilder(ffmpeg_bin="ffmpeg")
    cmd = builder.build_filtered_loop_clip(
        video_path=Path("/media/clip.mp4"),
        output_path=Path("/tmp/loop.mp4"),
        encoder="libx264",
        duration_sec=5.0,
        filtergraph="avgblur=sizeX=2:sizeY=2",
    )
    assert "-an" in cmd
    assert cmd[cmd.index("-t") + 1] == "5.000"
    assert cmd[cmd.index("-c:v") + 1] == "libx264"
    assert "avgblur=sizeX=2:sizeY=2" in cmd[cmd.index("-vf") + 1]


def test_build_reencode_render_overlay_timeout(tmp_path):
    image = tmp_path / "stamp.png"
    image.write_bytes(b"\x89PNG\r\n\x1a\nstub")
    builder = FFmpegCommandBuilder(ffmpeg_bin="ffmpeg")
    cmd = builder.build_reencode_render(
        video_path=Path("/media/clip.mp4"),
        audio_path=Path("/media/song.mp3"),
        output_path=Path("/renders/output.mp4"),
        encoder="libx264",
        overlay_path=image,
        overlay_opacity=0.8,
        overlay_timeout=30,
    )
    idx_fc = cmd.index("-filter_complex")
    graph = cmd[idx_fc + 1]
    assert ":enable='lte(t,30.00)'" in graph
    assert "[2:v][base]scale2ref=w=rw:h=rh" in graph


def test_build_reencode_render_bouncing_vcd_logo(tmp_path):
    image = tmp_path / "vcd_logo.png"
    image.write_bytes(b"\x89PNG\r\n\x1a\nstub")
    builder = FFmpegCommandBuilder(ffmpeg_bin="ffmpeg")
    cmd = builder.build_reencode_render(
        video_path=Path("/media/clip.mp4"),
        audio_path=Path("/media/song.mp3"),
        output_path=Path("/renders/output.mp4"),
        encoder="libx264",
        overlay_path=image,
        overlay_opacity=0.85,
        overlay_animation="bounce",
        overlay_timeout=60,
    )
    idx_fc = cmd.index("-filter_complex")
    graph = cmd[idx_fc + 1]
    assert "scale2ref=w='rw*0.40':h='-1'" in graph
    assert "overlay=x='(W-w)-abs(mod(0.15*W*t" in graph
    assert ":enable='lte(t,60.00)'" in graph


def test_build_concat_and_mux_audio():
    builder = FFmpegCommandBuilder(ffmpeg_bin="ffmpeg")
    cmd = builder.build_concat_and_mux_audio(
        concat_list_file=Path("/tmp/list.txt"),
        audio_path=Path("/media/track.mp3"),
        output_path=Path("/renders/final.mp4"),
        audio_transcode=True,
        duration_sec=3600.0,
    )
    assert "-f" in cmd and cmd[cmd.index("-f") + 1] == "concat"
    assert "-c:v" in cmd and cmd[cmd.index("-c:v") + 1] == "copy"
    assert "-c:a" in cmd and cmd[cmd.index("-c:a") + 1] == "aac"
    assert cmd[cmd.index("-t") + 1] == "3600.000"

