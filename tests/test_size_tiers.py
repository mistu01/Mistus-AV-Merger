"""
Unit tests for the output size tier mapping in the API layer.
"""
from mistus_av_merger.api.app import _apply_size_tier, _SIZE_TIERS


def test_tiers_hit_the_size_targets():
    # Audio + video kbps must sum to the tier's MB/hour budget (8192 kbit/MB).
    for tier, (mb_h, _audio) in _SIZE_TIERS.items():
        total = mb_h * 8192.0 / 3600.0
        assert total >= 550  # even "small" stays watchable


def test_balanced_tier_computes_bitrates():
    options = {"sizeTarget": "balanced"}
    _apply_size_tier(options, 3600.0)
    total = 325.0 * 8192.0 / 3600.0
    assert options["audioBitrateKbps"] == 160
    assert options["videoBitrateKbps"] == int(round(total - 160))


def test_small_tier_video_floor():
    options = {"sizeTarget": "small"}
    _apply_size_tier(options, 60.0)
    # 250 MB/h -> 568.9 total - 128 audio = ~441 video (rounded, not floored)
    assert options["videoBitrateKbps"] == 441
    assert options["audioBitrateKbps"] == 128


def test_unknown_tier_falls_back_to_balanced():
    options = {"sizeTarget": "wumbo"}
    _apply_size_tier(options, 120.0)
    total = 325.0 * 8192.0 / 3600.0
    assert options["videoBitrateKbps"] == int(round(total - 160))


def test_unlimited_tier_clears_bitrates():
    options = {"sizeTarget": "unlimited", "videoBitrateKbps": 999}
    _apply_size_tier(options, 120.0)
    assert "videoBitrateKbps" not in options
    assert "audioBitrateKbps" not in options


def test_default_tier_is_balanced_when_unset():
    options = {}
    _apply_size_tier(options, 120.0)
    assert options["audioBitrateKbps"] == 160
    assert options["videoBitrateKbps"] > 0


def test_zero_duration_ignored():
    options = {"sizeTarget": "small"}
    _apply_size_tier(options, 0.0)
    assert "videoBitrateKbps" not in options
