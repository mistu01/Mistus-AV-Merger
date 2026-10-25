"""
FFmpeg command line argument builder.
Produces safe, list-based argument arrays without shell injection risks.
"""

from math import ceil
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Union


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
        audio_duration_sec: Optional[float] = None,
        video_duration_sec: Optional[float] = None,
    ) -> List[str]:
        """
        Builds lossless stream-copy command looping video to match audio length exactly.

        Duration-aware mode (preferred when the caller knows the media durations,
        e.g. from ffprobe):
            - a finite, pre-computed -stream_loop count replaces the infinite loop,
            - an output -t clamp replaces -shortest (which, with stream copy, can
              only cut on keyframes and overshoots by whole clips on FFmpeg 8/9).
        Legacy mode (no durations): keeps the historical infinite-loop + -shortest.
        """
        duration_aware = (
            audio_duration_sec is not None
            and video_duration_sec is not None
            and video_duration_sec > 0
        )
        if duration_aware:
            loop_count = max(1, ceil(audio_duration_sec / video_duration_sec - 1e-6))
            cmd = [
                self.ffmpeg_bin,
                "-y",
                "-hide_banner",
                "-loglevel", "error",
                "-nostdin",
                "-fflags", "+genpts",
                "-stream_loop", str(loop_count - 1),
                "-i", str(video_path),
                "-i", str(audio_path),
                "-t", f"{audio_duration_sec:.3f}",
            ]
        else:
            cmd = [
                self.ffmpeg_bin,
                "-y",
                "-hide_banner",
                "-loglevel", "error",
                "-nostdin",
                "-stream_loop", "-1",
                "-i", str(video_path),
                "-i", str(audio_path),
                "-shortest",
            ]
        cmd += [
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

    # Fast encoder presets: quality-tuned defaults light enough to hit
    # multiple-x realtime on modest CPUs. veryfast keeps quality close to
    # medium at ~3x the speed; hardware encoders have their own scales.
    _X264_PRESET = "veryfast"
    _QSV_PRESET = "veryfast"

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
        overlay_timeout: Optional[Union[int, float, str]] = None,
        overlay_animation: str = "static",
        crf: int = 21,
        bitrate_kbps: Optional[int] = None,
        audio_bitrate_kbps: Optional[int] = None,
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
            # error keeps queue logs clean (ffprobe banner soup wastes cycles
            # and clutters job logs); failures still surface fully.
            "-loglevel", "error",
            "-nostdin",
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
            vfilters.append("scale=1920:1080:force_original_aspect_ratio=decrease:flags=bicubic,pad=1920:1080:(ow-iw)/2:(oh-ih)/2")
        elif resolution == "720p":
            vfilters.append("scale=1280:720:force_original_aspect_ratio=decrease:flags=bicubic,pad=1280:720:(ow-iw)/2:(oh-ih)/2")
        elif resolution == "480p":
            vfilters.append("scale=854:480:force_original_aspect_ratio=decrease:flags=bicubic,pad=854:480:(ow-iw)/2:(oh-ih)/2")

        # 2. Base VHS filtergraph if specified
        if filtergraph:
            vfilters.append(filtergraph)

        # 3. Night mode grading
        if night_mode:
            vfilters.append(
                f"eq=contrast=1.12:brightness=-0.08,curves=all='0/0 0.5/0.4 1/0.95':blue='0/0 0.5/0.58 1/1',vignette=PI/4*{night_intensity:.2f}:eval=init"
            )

        # 4. Noise and static synthesis
        # NOTE: 'seed' option was removed from vf_noise in newer FFmpeg;
        # the channel-level 'all_seed' is the supported alias.
        if noise_static and "noise=" not in filtergraph:
            vfilters.append(f"noise=alls=18:allf=t+u:all_seed={noise_seed}")

        # Combine video filters
        vf_string = ",".join(vfilters) if vfilters else "null"

        # If overlay exists, composite with the requested opacity.
        # Supports full-frame static stretch or bouncing VCD / DVD logo motion.
        if overlay_path and overlay_path.exists():
            enable_clause = ""
            if overlay_timeout is not None:
                str_timeout = str(overlay_timeout).strip().lower()
                if str_timeout not in ("full", "0", ""):
                    try:
                        t_sec = float(str_timeout)
                        if t_sec > 0:
                            enable_clause = f":enable='lte(t,{t_sec:.2f})'"
                    except ValueError:
                        pass

            if str(overlay_animation).lower() in ("bounce", "vcd", "animated"):
                vf_string = (
                    f"[0:v]{vf_string}[base];"
                    f"[2:v][base]scale2ref=w='rw*0.40':h='-1':force_original_aspect_ratio=decrease[ovrl][refw];"
                    f"[ovrl]format=rgba,colorchannelmixer=aa={overlay_opacity:.2f}[ovrlA];"
                    f"[refw][ovrlA]overlay=x='(W-w)-abs(mod(0.15*W*t\\,2*(W-w))-(W-w))':y='(H-h)-abs(mod(0.11*H*t\\,2*(H-h))-(H-h))'{enable_clause}[v_out]"
                )
            else:
                vf_string = (
                    f"[0:v]{vf_string}[base];"
                    f"[2:v][base]scale2ref=w=rw:h=rh[ovrl][refw];"
                    f"[ovrl]format=rgba,colorchannelmixer=aa={overlay_opacity:.2f}[ovrlA];"
                    f"[refw][ovrlA]overlay=0:0:format=yuv420{enable_clause}[v_out]"
                )
            cmd.extend(["-filter_complex", vf_string, "-map", "[v_out]"])
        else:
            cmd.extend(["-vf", vf_string, "-map", "0:v:0"])

        cmd.extend(["-map", "1:a:0"])

        # Codec and quality settings. When a bitrate cap is set (output size
        # target), ABR rate control replaces CRF so the file size stays
        # predictable; maxrate 2x / bufsize 4x absorb VHS noise spikes.
        cmd.extend(["-c:v", encoder])
        if bitrate_kbps:
            # Keep the per-encoder speed preset, drop the quality-mode flag.
            if "videotoolbox" in encoder:
                cmd.extend(["-b:v", f"{bitrate_kbps}k"])  # no maxrate support on vtb
            elif "libx265" in encoder:
                cmd.extend(["-b:v", f"{bitrate_kbps}k", "-preset", "fast"])
            elif "nvenc" in encoder:
                cmd.extend(["-b:v", f"{bitrate_kbps}k", "-maxrate", f"{bitrate_kbps * 2}k",
                            "-bufsize", f"{bitrate_kbps * 4}k", "-preset", "p4"])
            elif "qsv" in encoder:
                cmd.extend(["-b:v", f"{bitrate_kbps}k", "-maxrate", f"{bitrate_kbps * 2}k",
                            "-bufsize", f"{bitrate_kbps * 4}k", "-preset", self._QSV_PRESET])
            else:
                cmd.extend(["-b:v", f"{bitrate_kbps}k", "-maxrate", f"{bitrate_kbps * 2}k",
                            "-bufsize", f"{bitrate_kbps * 4}k", "-preset", self._X264_PRESET])
        elif "nvenc" in encoder:
            cmd.extend(["-cq", str(crf), "-preset", "p4"])
        elif "qsv" in encoder:
            cmd.extend(["-global_quality", str(crf), "-preset", self._QSV_PRESET])
        elif "videotoolbox" in encoder:
            cmd.extend(["-q:v", str(crf * 3)])
        elif "libx265" in encoder:
            cmd.extend(["-crf", str(crf + 3), "-preset", "fast"])
        else:
            cmd.extend(["-crf", str(crf), "-preset", self._X264_PRESET])

        # Audio encode to AAC (tiered audio bitrate rides along with the cap)
        audio_kbps = audio_bitrate_kbps or 192
        cmd.extend(["-c:a", "aac", "-b:a", f"{audio_kbps}k"])

        if threads:
            cmd.extend(["-threads", str(threads)])

        cmd.extend([
            "-movflags", "+faststart",
            "-progress", "pipe:1",
            str(output_path)
        ])
        return cmd

    def build_filtered_loop_clip(
        self,
        video_path: Path,
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
        overlay_animation: str = "static",
        loop_input: bool = False,
        crf: int = 21,
        bitrate_kbps: Optional[int] = None,
        threads: Optional[int] = None,
        duration_sec: Optional[float] = None,
    ) -> List[str]:
        """
        Builds command to render a single cycle of the filtered video loop without audio.
        This clip is then instantly stream-copied across the audio duration for 10x-50x speedup.
        """
        cmd = [
            self.ffmpeg_bin,
            "-y",
            "-hide_banner",
            "-loglevel", "error",
            "-nostdin",
        ]
        if loop_input:
            cmd.extend(["-stream_loop", "-1"])
        cmd.extend(["-i", str(video_path)])

        if overlay_path and overlay_path.exists():
            cmd.extend(["-i", str(overlay_path)])

        if duration_sec is not None:
            cmd.extend(["-t", f"{duration_sec:.3f}"])

        vfilters: List[str] = []
        if resolution == "1080p":
            vfilters.append("scale=1920:1080:force_original_aspect_ratio=decrease:flags=bicubic,pad=1920:1080:(ow-iw)/2:(oh-ih)/2")
        elif resolution == "720p":
            vfilters.append("scale=1280:720:force_original_aspect_ratio=decrease:flags=bicubic,pad=1280:720:(ow-iw)/2:(oh-ih)/2")
        elif resolution == "480p":
            vfilters.append("scale=854:480:force_original_aspect_ratio=decrease:flags=bicubic,pad=854:480:(ow-iw)/2:(oh-ih)/2")

        if filtergraph:
            vfilters.append(filtergraph)

        if night_mode:
            vfilters.append(
                f"eq=contrast=1.12:brightness=-0.08,curves=all='0/0 0.5/0.4 1/0.95':blue='0/0 0.5/0.58 1/1',vignette=PI/4*{night_intensity:.2f}:eval=init"
            )

        if noise_static and "noise=" not in filtergraph:
            vfilters.append(f"noise=alls=16:allf=t+u:all_seed={noise_seed}")

        vf_string = ",".join(vfilters) if vfilters else "null"

        if overlay_path and overlay_path.exists():
            if str(overlay_animation).lower() in ("bounce", "vcd", "animated"):
                vf_string = (
                    f"[0:v]{vf_string}[base];"
                    f"[1:v][base]scale2ref=w='rw*0.40':h='-1':force_original_aspect_ratio=decrease[ovrl][refw];"
                    f"[ovrl]format=rgba,colorchannelmixer=aa={overlay_opacity:.2f}[ovrlA];"
                    f"[refw][ovrlA]overlay=x='(W-w)-abs(mod(0.15*W*t\\,2*(W-w))-(W-w))':y='(H-h)-abs(mod(0.11*H*t\\,2*(H-h))-(H-h))'[v_out]"
                )
            else:
                vf_string = (
                    f"[0:v]{vf_string}[base];"
                    f"[1:v][base]scale2ref=w=rw:h=rh[ovrl][refw];"
                    f"[ovrl]format=rgba,colorchannelmixer=aa={overlay_opacity:.2f}[ovrlA];"
                    f"[refw][ovrlA]overlay=0:0:format=yuv420[v_out]"
                )
            cmd.extend(["-filter_complex", vf_string, "-map", "[v_out]"])
        else:
            cmd.extend(["-vf", vf_string, "-map", "0:v:0"])

        cmd.extend(["-c:v", encoder])
        if bitrate_kbps:
            if "videotoolbox" in encoder:
                cmd.extend(["-b:v", f"{bitrate_kbps}k"])
            elif "libx265" in encoder:
                cmd.extend(["-b:v", f"{bitrate_kbps}k", "-preset", "fast"])
            elif "nvenc" in encoder:
                cmd.extend(["-b:v", f"{bitrate_kbps}k", "-maxrate", f"{bitrate_kbps * 2}k",
                            "-bufsize", f"{bitrate_kbps * 4}k", "-preset", "p4"])
            elif "qsv" in encoder:
                cmd.extend(["-b:v", f"{bitrate_kbps}k", "-maxrate", f"{bitrate_kbps * 2}k",
                            "-bufsize", f"{bitrate_kbps * 4}k", "-preset", self._QSV_PRESET])
            else:
                cmd.extend(["-b:v", f"{bitrate_kbps}k", "-maxrate", f"{bitrate_kbps * 2}k",
                            "-bufsize", f"{bitrate_kbps * 4}k", "-preset", self._X264_PRESET])
        elif "nvenc" in encoder:
            cmd.extend(["-cq", str(crf), "-preset", "p4"])
        elif "qsv" in encoder:
            cmd.extend(["-global_quality", str(crf), "-preset", self._QSV_PRESET])
        elif "videotoolbox" in encoder:
            cmd.extend(["-q:v", str(crf * 3)])
        elif "libx265" in encoder:
            cmd.extend(["-crf", str(crf + 3), "-preset", "fast"])
        else:
            cmd.extend(["-crf", str(crf), "-preset", self._X264_PRESET])

        cmd.append("-an")
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

    def build_concat_and_mux_audio(
        self,
        concat_list_file: Path,
        audio_path: Path,
        output_path: Path,
        audio_transcode: bool = False,
        duration_sec: Optional[float] = None,
        threads: Optional[int] = None,
    ) -> List[str]:
        """Concatenates pre-rendered video segments via stream-copy and muxes audio."""
        cmd = [
            self.ffmpeg_bin,
            "-y",
            "-hide_banner",
            "-loglevel", "error",
            "-nostdin",
            "-f", "concat",
            "-safe", "0",
            "-i", str(concat_list_file),
            "-i", str(audio_path),
            "-map", "0:v:0",
            "-map", "1:a:0",
            "-c:v", "copy",
        ]
        if audio_transcode:
            cmd.extend(["-c:a", "aac", "-b:a", "192k"])
        else:
            cmd.extend(["-c:a", "copy"])

        if duration_sec is not None:
            cmd.extend(["-t", f"{duration_sec:.3f}"])

        if threads:
            cmd.extend(["-threads", str(threads)])

        cmd.extend([
            "-movflags", "+faststart",
            "-progress", "pipe:1",
            str(output_path)
        ])
        return cmd
