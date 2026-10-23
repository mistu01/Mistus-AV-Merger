"""
Unit tests for scanner natural sorting and probe caching.
"""

from pathlib import Path
from mistus_av_merger.core.scanner import natural_sort_key, MediaScanner


def test_natural_sort_key():
    files = ["track10.mp3", "track1.mp3", "track2.mp3", "track02.mp3", "track20.mp3"]
    sorted_files = sorted(files, key=natural_sort_key)
    assert sorted_files == ["track1.mp3", "track2.mp3", "track02.mp3", "track10.mp3", "track20.mp3"]


def test_scanner_probe_cache_key():
    scanner = MediaScanner()
    assert len(scanner._cache) == 0
