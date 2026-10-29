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

    # Fast encoder presets: quality-tuned defaults. With loop pre-rendering,
    # we only encode a short 5-25s loop clip once, so scene-release presets
    # (x264 slow, QSV slow lookahead, NVENC p6 with spatial/temporal AQ) provide
    # pristine unpixelated quality with zero macroblocking at negligible cost.
    _X264_PRESET = "slow"
    _QSV_PRESET = "slow"
    _NVENC_PRESET = "p6"

    def _apply_video_encoder_flags(
        self,
        cmd: List[str],
        encoder: str,
        crf: int = 18,
        bitrate_kbps: Optional[int] = None,
    ):
        """
        Applies scene-release high-fidelity compression flags for the specified encoder.
        Uses 10-bit color for HEVC/AV1/VVC to eliminate gradient banding, deep lookahead
        and spatial/temporal AQ for hardware encoders, and slow/medium presets for pristine,
        unpixelated video output with minimal file sizes.
        """
        enc = encoder.lower()
        if bitrate_kbps:
            # Constrained Bitrate / Target Size Mode (maxrate 2x / bufsize 4x absorb noise spikes)
            max_rate = int(bitrate_kbps * 2)
            buf_size = int(bitrate_kbps * 4)
            if "nvenc" in enc:
                pix = "p010le" if ("hevc" in enc or "av1" in enc) else "yuv420p"
                cmd.extend([
                    "-c:v", encoder,
                    "-b:v", f"{bitrate_kbps}k",
                    "-maxrate", f"{max_rate}k",
                    "-bufsize", f"{buf_size}k",
                    "-preset", self._NVENC_PRESET,
                    "-spatial-aq", "1",
                    "-temporal-aq", "1",
                    "-pix_fmt", pix,
                ])
            elif "qsv" in enc:
                pix = "p010le" if ("hevc" in enc or "av1" in enc) else "yuv420p"
                cmd.extend([
                    "-c:v", encoder,
                    "-b:v", f"{bitrate_kbps}k",
                    "-maxrate", f"{max_rate}k",
                    "-bufsize", f"{buf_size}k",
                    "-preset", self._QSV_PRESET,
                    "-look_ahead", "1",
                    "-look_ahead_depth", "24",
                    "-pix_fmt", pix,
                ])
            elif "amf" in enc:
                pix = "p010le" if "hevc" in enc else "yuv420p"
                cmd.extend([
                    "-c:v", encoder,
                    "-b:v", f"{bitrate_kbps}k",
                    "-maxrate", f"{max_rate}k",
                    "-bufsize", f"{buf_size}k",
                    "-quality", "quality",
                    "-rc", "vbr_latency",
                    "-pix_fmt", pix,
                ])
            elif "videotoolbox" in enc:
                cmd.extend([
                    "-c:v", encoder,
                    "-b:v", f"{bitrate_kbps}k",
                    "-pix_fmt", "yuv420p",
                ])
            elif "libsvtav1" in enc:
                cmd.extend([
                    "-c:v", "libsvtav1",
                    "-b:v", f"{bitrate_kbps}k",
                    "-preset", "5",
                    "-pix_fmt", "yuv420p10le",
                ])
            elif "libvvenc" in enc:
                cmd.extend([
                    "-c:v", "libvvenc",
                    "-b:v", f"{bitrate_kbps}k",
                    "-preset", "fast",
                    "-pix_fmt", "yuv420p10le",
                ])
            elif "libx265" in enc or "hevc" in enc:
                cmd.extend([
                    "-c:v", "libx265",
                    "-b:v", f"{bitrate_kbps}k",
                    "-maxrate", f"{max_rate}k",
                    "-bufsize", f"{buf_size}k",
                    "-preset", "medium",
                    "-pix_fmt", "yuv420p10le",
                ])
            else:
                cmd.extend([
                    "-c:v", "libx264",
                    "-b:v", f"{bitrate_kbps}k",
                    "-maxrate", f"{max_rate}k",
                    "-bufsize", f"{buf_size}k",
                    "-preset", self._X264_PRESET,
                    "-pix_fmt", "yuv420p",
                ])
        else:
            # CRF / Visual Quality Mode (Bluray Scene standard: crisp, no macroblocks)
            if "nvenc" in enc:
                target_cq = 18 if "h264" in enc else (20 if "hevc" in enc else 22)
                pix = "p010le" if ("hevc" in enc or "av1" in enc) else "yuv420p"
                cmd.extend([
                    "-c:v", encoder,
                    "-preset", self._NVENC_PRESET,
                    "-rc:v", "vbr",
                    "-cq:v", str(target_cq),
                    "-b:v", "0",
                    "-spatial-aq", "1",
                    "-temporal-aq", "1",
                    "-pix_fmt", pix,
                ])
            elif "qsv" in enc:
                target_gq = 18 if "h264" in enc else (20 if "hevc" in enc else 22)
                pix = "p010le" if ("hevc" in enc or "av1" in enc) else "yuv420p"
                cmd.extend([
                    "-c:v", encoder,
                    "-preset", self._QSV_PRESET,
                    "-global_quality", str(target_gq),
                    "-look_ahead", "1",
                    "-look_ahead_depth", "24",
                    "-pix_fmt", pix,
                ])
            elif "amf" in enc:
                qp_i = 18 if "h264" in enc else 20
                pix = "p010le" if "hevc" in enc else "yuv420p"
                cmd.extend([
                    "-c:v", encoder,
                    "-quality", "quality",
                    "-rc", "cqp",
                    "-qp_i", str(qp_i),
                    "-qp_p", str(qp_i + 2),
                    "-qp_b", str(qp_i + 4),
                    "-pix_fmt", pix,
                ])
            elif "videotoolbox" in enc:
                cmd.extend([
                    "-c:v", encoder,
                    "-q:v", "65",
                    "-pix_fmt", "yuv420p",
                ])
            elif "libsvtav1" in enc:
                # SVT-AV1 CRF 24 preset 5: visually indistinguishable from source, ultra compact
                cmd.extend([
                    "-c:v", "libsvtav1",
                    "-crf", str(crf if crf and crf != 21 else 24),
                    "-preset", "5",
                    "-svtav1-params", "tune=0",
                    "-pix_fmt", "yuv420p10le",
                ])
            elif "libvvenc" in enc:
                # H.266 / VVC QP 24
                cmd.extend([
                    "-c:v", "libvvenc",
                    "-qp", str(crf if crf and crf != 21 else 24),
                    "-preset", "fast",
                    "-pix_fmt", "yuv420p10le",
                ])
            elif "libx265" in enc or "hevc" in enc:
                # x265 10-bit CRF 20 medium: scene standard
                cmd.extend([
                    "-c:v", "libx265",
                    "-crf", str(crf if crf and crf != 21 else 20),
                    "-preset", "medium",
                    "-pix_fmt", "yuv420p10le",
                ])
            else:
                # libx264 slow CRF 18: sharp details, zero blocking, universal compatibility
                cmd.extend([
                    "-c:v", "libx264",
                    "-crf", str(crf if crf and crf != 21 else 18),
                    "-preset", self._X264_PRESET,
                    "-pix_fmt", "yuv420p",
                ])

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

        overlay_p = Path(str(overlay_path).strip('"\'')) if overlay_path else None
        if overlay_p and overlay_p.exists() and overlay_p.is_file():
            cmd.extend(["-i", str(overlay_p)])

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

        # 3. Night mode - purely darkens footage smoothly with night_intensity slider (no color tinting, no noise)
        if night_mode:
            n_int = max(0.05, min(1.0, float(night_intensity)))
            b_val = -0.05 - (0.45 * n_int)
            g_val = 1.0 - (0.65 * n_int)
            vfilters.append(f"eq=brightness={b_val:.2f}:gamma={g_val:.2f}")

        # 4. Noise and static synthesis:
        # Periodic tape static burst with tracking tear glitch every 4.5s
        if noise_static:
            vfilters.append(
                f"noise=alls=65:allf=t+u:all_seed={noise_seed}:enable='lt(mod(t\\,4.5)\\,0.35)',"
                f"drawbox=y=ih-42:color=white@0.70:width=iw:height=4:t=fill:enable='lt(mod(t\\,4.5)\\,0.35)'"
            )

        # Combine video filters
        vf_string = ",".join(vfilters) if vfilters else "null"

        # If overlay exists, composite with the requested opacity.
        # Supports full-frame static stretch or bouncing VCD / DVD logo motion.
        if overlay_p and overlay_p.exists() and overlay_p.is_file():
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

        # Codec and quality settings: scene-release high fidelity
        self._apply_video_encoder_flags(cmd, encoder, crf=crf, bitrate_kbps=bitrate_kbps)

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

        overlay_p = Path(str(overlay_path).strip('"\'')) if overlay_path else None
        if overlay_p and overlay_p.exists() and overlay_p.is_file():
            cmd.extend(["-i", str(overlay_p)])

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
            n_int = max(0.05, min(1.0, float(night_intensity)))
            b_val = -0.05 - (0.45 * n_int)
            g_val = 1.0 - (0.65 * n_int)
            vfilters.append(f"eq=brightness={b_val:.2f}:gamma={g_val:.2f}")

        if noise_static:
            vfilters.append(
                f"noise=alls=65:allf=t+u:all_seed={noise_seed}:enable='lt(mod(t\\,4.5)\\,0.35)',"
                f"drawbox=y=ih-42:color=white@0.70:width=iw:height=4:t=fill:enable='lt(mod(t\\,4.5)\\,0.35)'"
            )

        vf_string = ",".join(vfilters) if vfilters else "null"

        if overlay_p and overlay_p.exists() and overlay_p.is_file():
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

        # Codec and quality settings: scene-release high fidelity
        self._apply_video_encoder_flags(cmd, encoder, crf=crf, bitrate_kbps=bitrate_kbps)

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
