"""
Unit tests for hardware acceleration probing and encoder ranking.
"""

from unittest.mock import patch
from mistus_av_merger.core.hwdetect import HardwareDetector


def test_hardware_detector_discrete_gpu_priority():
    detector = HardwareDetector()

    # Simulate presence of both NVENC and libx264
    mock_encoders = {
        "h264_nvenc": True,
        "h264_qsv": True,
        "libx264": True,
    }

    with patch.object(detector, "probe_all", return_value=mock_encoders):
        detector.available_encoders = mock_encoders
        detector._select_recommended()
        assert detector.recommended_encoder == "h264_nvenc"
        assert "NVIDIA" in detector.gpu_brand


def test_hardware_detector_software_fallback():
    detector = HardwareDetector()

    # Simulate only software encoders available
    mock_encoders = {
        "h264_nvenc": False,
        "h264_qsv": False,
        "h264_amf": False,
        "h264_videotoolbox": False,
        "libx264": True,
    }

    with patch.object(detector, "probe_all", return_value=mock_encoders):
        detector.available_encoders = mock_encoders
        detector._select_recommended()
        assert detector.recommended_encoder == "libx264"
        assert "Software" in detector.gpu_brand
