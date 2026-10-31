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
    assert cmd[cmd.index("-preset") + 1] == builder._NVENC_PRESET
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
        start_time_sec=3.25,
    )
    assert "-an" in cmd
    assert cmd[cmd.index("-t") + 1] == "5.000"
    assert cmd[cmd.index("-c:v") + 1] == "libx264"
    assert "avgblur=sizeX=2:sizeY=2" in cmd[cmd.index("-vf") + 1]
    assert "-ss" in cmd
    idx_ss = cmd.index("-ss")
    assert cmd[idx_ss + 1] == "3.250"
    assert idx_ss < cmd.index("-i")


def test_compute_randomized_loop_params_29s():
    from mistus_av_merger.core.ffmpeg_builder import compute_randomized_loop_params
    for _ in range(20):
        start_t, loop_d = compute_randomized_loop_params(video_dur=29.0, audio_dur=300.0)
        assert 20.0 <= loop_d <= 29.0
        assert 0.0 <= start_t <= (29.0 - loop_d + 1e-5)
        assert start_t + loop_d <= 29.001


def test_compute_randomized_loop_params_40s():
    from mistus_av_merger.core.ffmpeg_builder import compute_randomized_loop_params
    for _ in range(20):
        start_t, loop_d = compute_randomized_loop_params(video_dur=40.0, audio_dur=300.0)
        assert 25.0 <= loop_d <= 35.0
        assert 0.0 <= start_t <= (40.0 - loop_d + 1e-5)
        assert start_t + loop_d <= 40.001


def test_compute_randomized_loop_params_any_length():
    from mistus_av_merger.core.ffmpeg_builder import compute_randomized_loop_params
    for d in [3.5, 6.0, 14.2, 22.0, 29.0, 40.0, 75.0]:
        for _ in range(10):
            start_t, loop_d = compute_randomized_loop_params(video_dur=d, audio_dur=600.0)
            assert 1.0 <= loop_d <= d
            assert 0.0 <= start_t
            assert start_t + loop_d <= d + 1e-3


def test_compute_randomized_loop_params_long_video():
    from mistus_av_merger.core.ffmpeg_builder import compute_randomized_loop_params
    for _ in range(20):
        start_t, loop_d = compute_randomized_loop_params(video_dur=120.0, audio_dur=3600.0)
        assert 25.0 <= loop_d <= 35.0
        assert 0.0 <= start_t <= (120.0 - loop_d + 1e-5)
        assert start_t + loop_d <= 120.001


def test_compute_randomized_loop_params_short_audio():
    from mistus_av_merger.core.ffmpeg_builder import compute_randomized_loop_params
    start_t, loop_d = compute_randomized_loop_params(video_dur=30.0, audio_dur=15.0)
    assert loop_d <= 15.0
    assert start_t + loop_d <= 30.001


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


def test_build_reencode_render_scene_encoders():
    builder = FFmpegCommandBuilder(ffmpeg_bin="ffmpeg")
    # libx265: 10-bit CRF 20
    cmd_x265 = builder.build_reencode_render(
        video_path=Path("/media/clip.mp4"),
        audio_path=Path("/media/song.mp3"),
        output_path=Path("/renders/output.mp4"),
        encoder="libx265",
    )
    assert "-pix_fmt" in cmd_x265 and cmd_x265[cmd_x265.index("-pix_fmt") + 1] == "yuv420p10le"
    assert "-crf" in cmd_x265 and cmd_x265[cmd_x265.index("-crf") + 1] == "20"

    # libsvtav1: 10-bit CRF 24 preset 5
    cmd_av1 = builder.build_reencode_render(
        video_path=Path("/media/clip.mp4"),
        audio_path=Path("/media/song.mp3"),
        output_path=Path("/renders/output.mp4"),
        encoder="libsvtav1",
    )
    assert "-pix_fmt" in cmd_av1 and cmd_av1[cmd_av1.index("-pix_fmt") + 1] == "yuv420p10le"
    assert "-preset" in cmd_av1 and cmd_av1[cmd_av1.index("-preset") + 1] == "5"

    # h264_qsv: lookahead and global_quality 18
    cmd_qsv = builder.build_reencode_render(
        video_path=Path("/media/clip.mp4"),
        audio_path=Path("/media/song.mp3"),
        output_path=Path("/renders/output.mp4"),
        encoder="h264_qsv",
    )
    assert "-look_ahead" in cmd_qsv and cmd_qsv[cmd_qsv.index("-look_ahead") + 1] == "1"
    assert "-global_quality" in cmd_qsv and cmd_qsv[cmd_qsv.index("-global_quality") + 1] == "18"


def test_generate_random_loop_playlist(tmp_path):
    from mistus_av_merger.core.ffmpeg_builder import generate_random_loop_playlist
    slices = [
        (tmp_path / "var_0.mp4", 23.5),
        (tmp_path / "var_1.mp4", 26.8),
        (tmp_path / "var_2.mp4", 29.2),
    ]
    pl = tmp_path / "playlist.txt"
    generate_random_loop_playlist(slices, audio_dur=120.0, playlist_path=pl)

    assert pl.exists()
    content = pl.read_text(encoding="utf-8")
    lines = [line.strip() for line in content.splitlines() if line.strip()]
    assert lines[0] == "ffconcat version 1.0"
    file_lines = lines[1:]
    assert len(file_lines) >= 4  # At least 120s / 29.2s ~ 4 loops

    # Verify all 3 slices are represented
    assert any("var_0.mp4" in line for line in file_lines)
    assert any("var_1.mp4" in line for line in file_lines)
    assert any("var_2.mp4" in line for line in file_lines)

    # Verify consecutive lines don't repeat the exact same slice
    for i in range(len(file_lines) - 1):
        assert file_lines[i] != file_lines[i + 1]


def test_generate_random_loop_playlist_empty():
    from mistus_av_merger.core.ffmpeg_builder import generate_random_loop_playlist
    import pytest
    with pytest.raises(ValueError):
        generate_random_loop_playlist([], 60.0, Path("/tmp/empty.txt"))


def test_build_randomized_concat_mux():
    builder = FFmpegCommandBuilder(ffmpeg_bin="ffmpeg")
    pl = Path("/tmp/playlist.txt")
    audio = Path("/media/audio.mp3")
    out = Path("/renders/output.mp4")

    # Audio transcode = False (stream copy audio)
    cmd = builder.build_randomized_concat_mux(
        playlist_path=pl,
        audio_path=audio,
        output_path=out,
        audio_transcode=False,
        threads=4,
        duration_sec=3600.0,
    )
    assert "-f" in cmd and cmd[cmd.index("-f") + 1] == "concat"
    assert "-safe" in cmd and cmd[cmd.index("-safe") + 1] == "0"
    assert "-i" in cmd and cmd[cmd.index("-i") + 1] == str(pl)
    assert cmd[cmd.index("-i", cmd.index("-i") + 1) + 1] == str(audio)
    assert "-c:v" in cmd and cmd[cmd.index("-c:v") + 1] == "copy"
    assert "-c:a" in cmd and cmd[cmd.index("-c:a") + 1] == "copy"
    assert "-t" in cmd and cmd[cmd.index("-t") + 1] == "3600.000"
    assert "-threads" in cmd and cmd[cmd.index("-threads") + 1] == "4"
    assert "-movflags" in cmd and cmd[cmd.index("-movflags") + 1] == "+faststart"
    assert "-dn" in cmd
    assert "-avoid_negative_ts" in cmd and cmd[cmd.index("-avoid_negative_ts") + 1] == "make_non_negative"
    assert "-fflags" in cmd and cmd[cmd.index("-fflags") + 1] == "+genpts"

    # Audio transcode = True
    cmd_trans = builder.build_randomized_concat_mux(
        playlist_path=pl,
        audio_path=audio,
        output_path=out,
        audio_transcode=True,
        duration_sec=180.0,
    )
    assert "-c:a" in cmd_trans and cmd_trans[cmd_trans.index("-c:a") + 1] == "aac"
    assert "-b:a" in cmd_trans and cmd_trans[cmd_trans.index("-b:a") + 1] == "192k"
    assert "-t" in cmd_trans and cmd_trans[cmd_trans.index("-t") + 1] == "180.000"


