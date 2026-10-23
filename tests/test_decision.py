"""
Unit tests for copy-vs-encode decision logic.
"""

from mistus_av_merger.core.decision import evaluate_copy_vs_encode


def test_copy_decision_native():
    result = evaluate_copy_vs_encode(
        video_codec="h264",
        audio_codec="mp3",
        target_container="mp4",
        resolution="original",
    )
    assert result.mode == "copy"
    assert "Stream copy" in result.reason
    assert result.audio_transcode is False


def test_encode_decision_on_filter():
    result = evaluate_copy_vs_encode(
        video_codec="h264",
        audio_codec="mp3",
        target_container="mp4",
        vhs_preset="clean_vhs",
    )
    assert result.mode == "encode"
    assert "VHS aesthetic" in result.reason


def test_encode_decision_on_resolution():
    result = evaluate_copy_vs_encode(
        video_codec="h264",
        audio_codec="mp3",
        target_container="mp4",
        resolution="720p",
    )
    assert result.mode == "encode"
    assert "resolution changed to 720p" in result.reason
