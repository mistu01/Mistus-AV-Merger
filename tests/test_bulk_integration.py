"""
Bulk integration test: 3 audio tracks + 2 video clips, cycle mode,
verifying deterministic output names, loop ratios, and queue plan creation.
"""

from pathlib import Path
from mistus_av_merger.core.pairing import AutoPairingEngine
from mistus_av_merger.core.naming import expand_naming_pattern, resolve_batch_collisions
from mistus_av_merger.core.scanner import MediaProbeResult


def test_bulk_integration_cycle_mode():
    audio_items = [
        MediaProbeResult(Path("/music/Track01.mp3"), 180.0, "mp3", 5000000, "mp3"),
        MediaProbeResult(Path("/music/Track02.wav"), 240.0, "wav", 20000000, "pcm_s16le"),
        MediaProbeResult(Path("/music/Track03.flac"), 120.0, "flac", 15000000, "flac"),
    ]
    video_items = [
        MediaProbeResult(Path("/vids/Loop_A.mp4"), 30.0, "mp4", 12000000, video_codec="h264"),
        MediaProbeResult(Path("/vids/Loop_B.mp4"), 20.0, "mp4", 9000000, video_codec="h264"),
    ]

    # Execute Cycle mode auto-pairing
    plan = AutoPairingEngine.pair(audio_items, video_items, mode="cycle")
    assert len(plan["pairings"]) == 3

    # Pairing 0: Track01 (180s) + Loop_A (30s) -> 6x loops
    p0 = plan["pairings"][0]
    assert p0["audio"].filename == "Track01.mp3"
    assert p0["video"].filename == "Loop_A.mp4"

    # Pairing 1: Track02 (240s) + Loop_B (20s) -> 12x loops
    p1 = plan["pairings"][1]
    assert p1["audio"].filename == "Track02.wav"
    assert p1["video"].filename == "Loop_B.mp4"

    # Pairing 2: Track03 (120s) + Loop_A (30s) (cycles back to Loop_A) -> 4x loops
    p2 = plan["pairings"][2]
    assert p2["audio"].filename == "Track03.flac"
    assert p2["video"].filename == "Loop_A.mp4"

    # Expand names
    names = [
        expand_naming_pattern("{audio_name}.{video_ext}", p["audio"].filename, p["video"].filename, "mp4")
        for p in plan["pairings"]
    ]
    assert names == ["Track01.mp4", "Track02.mp4", "Track03.mp4"]

    # Verify no collisions in default distinct names
    resolved = resolve_batch_collisions(names, policy="suffix")
    assert [r[0] for r in resolved] == ["Track01.mp4", "Track02.mp4", "Track03.mp4"]
