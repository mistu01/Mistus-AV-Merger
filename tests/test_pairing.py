"""
Unit tests for all 6 auto-pairing modes, fuzzy matching, and count mismatch diagnostics.
"""

from mistus_av_merger.core.pairing import AutoPairingEngine, normalize_for_fuzzy_match, calculate_fuzzy_confidence


class DummyMedia:
    def __init__(self, filename: str):
        self.filename = filename
        self.path = f"/media/{filename}"


def test_fuzzy_name_normalization_and_confidence():
    s1 = "01 - Midnight Neon Drive.mp3"
    s2 = "midnight_neon_drive_loop.mp4"
    assert normalize_for_fuzzy_match(s1) == "midnight neon drive"
    assert normalize_for_fuzzy_match(s2) == "midnight neon drive loop"
    score = calculate_fuzzy_confidence(s1, s2)
    assert score > 0.8


def test_pairing_match_name():
    audio = [DummyMedia("01_Intro.mp3"), DummyMedia("02_Outro.mp3"), DummyMedia("Bonus.mp3")]
    video = [DummyMedia("intro.mp4"), DummyMedia("outro.mp4"), DummyMedia("random.mp4")]

    plan = AutoPairingEngine.pair(audio, video, mode="match_name")
    assert len(plan["pairings"]) == 2
    assert len(plan["unmatched_audio"]) == 1
    assert plan["unmatched_audio"][0].filename == "Bonus.mp3"
    assert len(plan["unmatched_video"]) == 1
    assert plan["unmatched_video"][0].filename == "random.mp4"


def test_pairing_order_1_to_1_mismatch():
    audio = [DummyMedia("a1.mp3"), DummyMedia("a2.mp3"), DummyMedia("a3.mp3")]
    video = [DummyMedia("v1.mp4"), DummyMedia("v2.mp4")]

    plan = AutoPairingEngine.pair(audio, video, mode="order_1_to_1")
    assert len(plan["pairings"]) == 2
    assert len(plan["unmatched_audio"]) == 1
    assert plan["unmatched_audio"][0].filename == "a3.mp3"
    assert any("More audio" in w for w in plan["warnings"])


def test_pairing_cycle_mode():
    audio = [DummyMedia(f"a{i}.mp3") for i in range(5)]
    video = [DummyMedia("v1.mp4"), DummyMedia("v2.mp4")]

    plan = AutoPairingEngine.pair(audio, video, mode="cycle")
    assert len(plan["pairings"]) == 5
    assert plan["pairings"][0]["video"].filename == "v1.mp4"
    assert plan["pairings"][1]["video"].filename == "v2.mp4"
    assert plan["pairings"][2]["video"].filename == "v1.mp4"
    assert plan["pairings"][3]["video"].filename == "v2.mp4"
    assert plan["pairings"][4]["video"].filename == "v1.mp4"


def test_pairing_random_seeded_deterministic():
    audio = [DummyMedia(f"a{i}.mp3") for i in range(4)]
    video = [DummyMedia(f"v{i}.mp4") for i in range(3)]

    plan1 = AutoPairingEngine.pair(audio, video, mode="random_seeded", seed=888)
    plan2 = AutoPairingEngine.pair(audio, video, mode="random_seeded", seed=888)

    order1 = [p["video"].filename for p in plan1["pairings"]]
    order2 = [p["video"].filename for p in plan2["pairings"]]
    assert order1 == order2

def test_pairing_order_1_to_1_single_video_loops_all():
    audio = [DummyMedia("s1.mp3"), DummyMedia("s2.mp3"), DummyMedia("s3.mp3")]
    video = [DummyMedia("loop.mp4")]

    plan = AutoPairingEngine.pair(audio, video, mode="order_1_to_1")
    assert len(plan["pairings"]) == 3
    assert len(plan["unmatched_audio"]) == 0
    assert all(p["video"].filename == "loop.mp4" for p in plan["pairings"])


def test_pairing_manual_mode_all_rows():
    audio = [DummyMedia(f"track{i}.mp3") for i in range(4)]
    video = [DummyMedia("clip.mp4")]

    plan = AutoPairingEngine.pair(audio, video, mode="manual")
    assert len(plan["pairings"]) == 4
    assert len(plan["unmatched_audio"]) == 0
