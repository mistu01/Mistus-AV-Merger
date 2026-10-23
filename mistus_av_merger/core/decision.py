"""
Copy-vs-Encode decision engine.
Analyzes media streams, visual filters, and resolution parameters to select
the fastest lossless path (stream copy) or determine why a re-encode is mandatory.
"""

from typing import Any, Dict, NamedTuple


class DecisionResult(NamedTuple):
    mode: str  # "copy" or "encode"
    reason: str
    audio_transcode: bool


def evaluate_copy_vs_encode(
    video_codec: str,
    audio_codec: str,
    target_container: str,
    resolution: str = "original",
    vhs_preset: str = "none",
    night_mode: bool = False,
    noise_static: bool = False,
    overlay_enabled: bool = False,
) -> DecisionResult:
    """Evaluates whether job qualifies for fast stream copy or requires full re-encode."""
    
    # 1. Visual filters force re-encode
    if night_mode:
        return DecisionResult(
            mode="encode",
            reason="Re-encode required: Night mode color grading curves and vignette active.",
            audio_transcode=False,
        )

    if vhs_preset and vhs_preset not in ("none", "off"):
        return DecisionResult(
            mode="encode",
            reason=f"Re-encode required: VHS aesthetic filter preset '{vhs_preset}' active.",
            audio_transcode=False,
        )

    if noise_static:
        return DecisionResult(
            mode="encode",
            reason="Re-encode required: Analog film grain and static noise synthesis filter active.",
            audio_transcode=False,
        )

    if overlay_enabled:
        return DecisionResult(
            mode="encode",
            reason="Re-encode required: Alpha image overlay composition active.",
            audio_transcode=False,
        )

    # 2. Resolution changes force scaling
    if resolution != "original":
        return DecisionResult(
            mode="encode",
            reason=f"Re-encode required: Output resolution changed to {resolution} (Lanczos scaling).",
            audio_transcode=False,
        )

    # 3. Check video codec compatibility for stream copy
    allowed_copy_codecs = {"h264", "hevc", "h265", "vp9", "av1"}
    if video_codec.lower() not in allowed_copy_codecs:
        return DecisionResult(
            mode="encode",
            reason=f"Re-encode required: Source video codec '{video_codec}' is non-standard and must be transcoded.",
            audio_transcode=False,
        )

    # 4. Check if audio codec needs remux transcoding
    audio_transcode = False
    clean_container = target_container.lower().lstrip(".")
    if clean_container == "mp4" and audio_codec.lower() in ("flac", "vorbis"):
        audio_transcode = True

    return DecisionResult(
        mode="copy",
        reason="Stream copy (fast): Native stream looping without generation loss. Blazing fast remux.",
        audio_transcode=audio_transcode,
    )
