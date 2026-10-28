"""
Hardware encoder detection and probing engine.
Performs real micro-encodes to verify hardware acceleration viability.
"""

import shutil
import subprocess
import sys
from typing import Dict, List, Optional, Tuple


def get_ffmpeg_binary() -> str:
    """Finds bundled or system FFmpeg binary (bundled ./bin wins over PATH)."""
    from mistus_av_merger.core.binaries import get_ffmpeg_path
    return str(get_ffmpeg_path())


def probe_encoder_actual(encoder_name: str, extra_args: Optional[List[str]] = None) -> bool:
    """
    Executes a micro-encode test (1 frame, 64x64, null sink) to confirm
    driver/hardware initialization succeeds.
    """
    cmd = [
        get_ffmpeg_binary(),
        "-hide_banner",
        "-loglevel", "error",
        "-f", "lavfi",
        "-i", "color=c=black:s=64x64:d=0.04",
    ]
    if extra_args:
        cmd.extend(extra_args)
    cmd.extend([
        "-c:v", encoder_name,
        "-frames:v", "1",
        "-f", "null",
        "-"
    ])

    try:
        creationflags = getattr(subprocess, "CREATE_NO_WINDOW", 0)
        res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=4, creationflags=creationflags)
        return res.returncode == 0
    except Exception:
        return False


class HardwareDetector:
    """Probes, ranks, and selects hardware encoders."""

    def __init__(self):
        self._probed = False
        self.available_encoders: Dict[str, bool] = {}
        self.recommended_encoder: str = "libx264"
        self.gpu_brand: str = "CPU (Software)"

    def probe_all(self) -> Dict[str, bool]:
        """Probes all potential hardware and software encoders.

        NOTE: encoders are probed PLAIN (no -hwaccel input flag). Hardware
        *encoding* does not require -hwaccel, and placing that flag after the
        input (as a stray output option) makes ffmpeg fail option parsing —
        which silently disabled every GPU encoder in the past.
        """
        candidates = [
            "h264_nvenc",
            "hevc_nvenc",
            "h264_qsv",
            "hevc_qsv",
            "h264_amf",
            "hevc_amf",
            "h264_videotoolbox",
            "hevc_videotoolbox",
            "h264_vaapi",
            "libx264",
            "libx265",
        ]

        results = {}
        for enc in candidates:
            success = probe_encoder_actual(enc)
            results[enc] = success

        self.available_encoders = results
        self._select_recommended()
        self._probed = True
        return results

    def _select_recommended(self):
        # Priority order: Discrete GPU (NVENC/AMF) -> Integrated (QSV/VideoToolbox/VAAPI) -> CPU libx264
        if self.available_encoders.get("h264_nvenc"):
            self.recommended_encoder = "h264_nvenc"
            self.gpu_brand = "NVIDIA NVENC (CUDA Accelerated)"
        elif self.available_encoders.get("h264_amf"):
            self.recommended_encoder = "h264_amf"
            self.gpu_brand = "AMD AMF GPU"
        elif self.available_encoders.get("h264_videotoolbox"):
            self.recommended_encoder = "h264_videotoolbox"
            self.gpu_brand = "Apple Silicon VideoToolbox"
        elif self.available_encoders.get("h264_qsv"):
            self.recommended_encoder = "h264_qsv"
            self.gpu_brand = "Intel QuickSync (QSV)"
        elif self.available_encoders.get("h264_vaapi"):
            self.recommended_encoder = "h264_vaapi"
            self.gpu_brand = "Linux VAAPI"
        else:
            self.recommended_encoder = "libx264"
            self.gpu_brand = "CPU Software (libx264)"

    def get_summary(self, block: bool = True) -> Dict[str, any]:
        """Returns the detection summary. When block=False, returns whatever
        is currently known (a background thread populates it at startup)."""
        if block and not self._probed:
            self.probe_all()
        return {
            "recommended": self.recommended_encoder,
            "gpu_brand": self.gpu_brand,
            "encoders": self.available_encoders,
            "is_hardware_accelerated": self.recommended_encoder != "libx264",
            "probed": self._probed,
        }
