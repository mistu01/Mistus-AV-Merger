"""
FFmpeg command line argument builder.
Produces safe, list-based argument arrays without shell injection risks.
"""

from pathlib import Path
from typing import Dict, List, Optional, Tuple


class FFmpegCommandBuilder:
    """Constructs robust FFmpeg command lines for stream copy or filter re-encodes."""

    def __init__(self, ffmpeg_bin: str = "ffmpeg"):
        self.ffmpeg_bin = ffmpeg_bin

    def build_stream_copy_loop(
        self,
        video_path: Path,
        audio_path: Path,
        output_path: Path,
        audio_transcode: bool = False,
        threads: Optional[int] = None,
    ) -> List[str]:
        """
        Builds lossless stream-copy command looping video to match audio length exactly.
        Video loops indefinitely (-stream_loop -1) and trims at audio termination (-shortest).
        """
        cmd = [
            self.ffmpeg_bin,
            "-y",
            "-hide_banner",
            "-loglevel", "info",
            "-stream_loop", "-1",
            "-i", str(video_path),
            "-i", str(audio_path),
            "-shortest",
            "-map", "0:v:0",
            "-map", "1:a:0",
            "-c:v", "copy",
        ]

        if audio_transcode:
            cmd.extend(["-c:a", "aac", "-b:a", "192k"])
        else:
            cmd.extend(["-c:a", "copy"])

        if threads:
            cmd.extend(["-threads", str(threads)])

        cmd.extend([
            "-movflags", "+faststart",
            "-progress", "pipe:1",
            str(output_path)
        ])
        return cmd

    def build_reencode_render(
        self,
        video_path: Path,
        audio_path: Path,
        output_path: Path,
        encoder: str = "libx264",
        resolution: str = "original",
        filtergraph: str = "",
        night_mode: bool = False,
        night_intensity: float = 0.7,
        noise_static: bool = False,
        noise_seed: int = 1994,
        overlay_path: Optional[Path] = None,
        overlay_opacity: float = 0.8,
        crf: int = 21,
        threads: Optional[int] = None,
        start_time_sec: Optional[float] = None,
        duration_sec: Optional[float] = None,
    ) -> List[str]:
        """
        Builds full re-encode command with video scaling, VHS filters, noise synthesis,
        and audio mixing.
        """
        cmd = [
            self.ffmpeg_bin,
            "-y",
            "-hide_banner",
            "-loglevel", "info",
            "-stream_loop", "-1",
            "-i", str(video_path),
            "-i", str(audio_path),
        ]

        if overlay_path and overlay_path.exists():
            cmd.extend(["-i", str(overlay_path)])

        if start_time_sec is not None:
            cmd.extend(["-ss", f"{start_time_sec:.3f}"])
        if duration_sec is not None:
            cmd.extend(["-t", f"{duration_sec:.3f}"])
        else:
            cmd.append("-shortest")

        # Assemble video filter chain
        vfilters: List[str] = []

        # 1. Resolution scaling (Lanczos + letterbox padding)
        if resolution == "1080p":
            vfilters.append("scale=1920:1080:force_original_aspect_ratio=decrease:flags=lanczos,pad=1920:1080:(ow-iw)/2:(oh-ih)/2")
        elif resolution == "720p":
            vfilters.append("scale=1280:720:force_original_aspect_ratio=decrease:flags=lanczos,pad=1280:720:(ow-iw)/2:(oh-ih)/2")
        elif resolution == "480p":
            vfilters.append("scale=854:480:force_original_aspect_ratio=decrease:flags=lanczos,pad=854:480:(ow-iw)/2:(oh-ih)/2")

        # 2. Base VHS filtergraph if specified
        if filtergraph:
            vfilters.append(filtergraph)

        # 3. Night mode grading
        if night_mode:
            vfilters.append(
                f"eq=contrast=1.12:brightness=-0.08,curves=all='0/0 0.5/0.4 1/0.95':blue='0/0 0.5/0.58 1/1',vignette=PI/4*{night_intensity:.2f}"
            )

        # 4. Noise and static synthesis
        if noise_static:
            vfilters.append(f"noise=alls=18:allf=t+u:seed={noise_seed}")

        # Combine video filters
        vf_string = ",".join(vfilters) if vfilters else "null"

        # If overlay exists, chain into overlay filter
        if overlay_path and overlay_path.exists():
            vf_string = f"[0:v]{vf_string}[base];[base][2:v]overlay=0:0:format=auto:alpha={overlay_opacity:.2f}[v_out]"
            cmd.extend(["-filter_complex", vf_string, "-map", "[v_out]"])
        else:
            cmd.extend(["-vf", vf_string, "-map", "0:v:0"])

        cmd.extend(["-map", "1:a:0"])

        # Codec and quality settings
        cmd.extend(["-c:v", encoder])
        if "nvenc" in encoder:
            cmd.extend(["-cq", str(crf), "-preset", "p4"])
        elif "qsv" in encoder:
            cmd.extend(["-global_quality", str(crf), "-preset", "medium"])
        elif "videotoolbox" in encoder:
            cmd.extend(["-q:v", str(crf * 3)])
        else:
            cmd.extend(["-crf", str(crf), "-preset", "medium"])

        # Audio encode to AAC
        cmd.extend(["-c:a", "aac", "-b:a", "192k"])

        if threads:
            cmd.extend(["-threads", str(threads)])

        cmd.extend([
            "-movflags", "+faststart",
            "-progress", "pipe:1",
            str(output_path)
        ])
        return cmd

    def build_concat_segments(self, concat_list_file: Path, output_path: Path) -> List[str]:
        """Concatenates pre-rendered segments without re-encoding."""
        return [
            self.ffmpeg_bin,
            "-y",
            "-hide_banner",
            "-loglevel", "error",
            "-f", "concat",
            "-safe", "0",
            "-i", str(concat_list_file),
            "-c", "copy",
            "-movflags", "+faststart",
            str(output_path)
        ]
