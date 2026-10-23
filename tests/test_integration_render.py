"""
Integration test executing real synthetic render (1s video clip + 3s audio tone)
using bundled FFmpeg to verify looping, keyframe alignment, and output creation.
"""

import subprocess
from pathlib import Path
from mistus_av_merger.core.ffmpeg_builder import FFmpegCommandBuilder
from mistus_av_merger.core.hwdetect import get_ffmpeg_binary


def test_synthetic_render_loop(tmp_path: Path):
    ffmpeg_bin = get_ffmpeg_binary()

    video_path = tmp_path / "synthetic_clip.mp4"
    audio_path = tmp_path / "synthetic_tone.mp3"
    output_path = tmp_path / "rendered_output.mp4"

    # 1. Generate 1s test video clip
    cmd_video = [
        ffmpeg_bin, "-y",
        "-f", "lavfi", "-i", "testsrc=duration=1:size=160x120:rate=15",
        "-c:v", "libx264", "-pix_fmt", "yuv420p",
        str(video_path)
    ]
    subprocess.run(cmd_video, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)

    # 2. Generate 3s test audio tone
    cmd_audio = [
        ffmpeg_bin, "-y",
        "-f", "lavfi", "-i", "sine=frequency=440:duration=3",
        "-c:a", "libmp3lame",
        str(audio_path)
    ]
    subprocess.run(cmd_audio, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)

    assert video_path.exists()
    assert audio_path.exists()

    # 3. Build and execute stream-copy loop render (1s clip looped to 3s audio)
    builder = FFmpegCommandBuilder(ffmpeg_bin=ffmpeg_bin)
    render_cmd = builder.build_stream_copy_loop(
        video_path=video_path,
        audio_path=audio_path,
        output_path=output_path,
        audio_transcode=False,
        audio_duration_sec=3.0,
        video_duration_sec=1.0,
    )

    result = subprocess.run(render_cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    assert result.returncode == 0
    assert output_path.exists()
    assert output_path.stat().st_size > 1000

    # 4. Output duration must match the 3s audio: one 1s clip looped to 3s.
    ffprobe_path = str(Path(ffmpeg_bin).with_name(
        "ffprobe.exe" if ffmpeg_bin.endswith(".exe") else "ffprobe"))
    probe = subprocess.run(
        [ffprobe_path, "-v", "quiet", "-print_format", "json",
         "-show_format", str(output_path)],
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
    )
    assert probe.returncode == 0, probe.stderr
    import json
    duration = float(json.loads(probe.stdout)["format"]["duration"])
    # Stream copy must land on ~3s; keyframe/boundary overshoots of a whole
    # clip or runaway -shortest buffering would put this far off.
    assert 2.5 <= duration <= 3.5, f"duration {duration:.2f}s != ~3s"
