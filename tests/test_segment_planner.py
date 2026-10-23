"""
Unit tests for segment planner intervals and concat manifest generation.
"""

from pathlib import Path
from mistus_av_merger.core.segment_planner import SegmentPlanner


def test_segment_planner_intervals():
    segments = SegmentPlanner.plan(total_duration_sec=250.0, segment_duration_sec=100.0)
    assert len(segments) == 3
    assert segments[0].start_time == 0.0
    assert segments[0].duration == 100.0
    assert segments[1].start_time == 100.0
    assert segments[1].duration == 100.0
    assert segments[2].start_time == 200.0
    assert segments[2].duration == 50.0


def test_generate_concat_manifest(tmp_path: Path):
    segments = SegmentPlanner.plan(total_duration_sec=90.0, segment_duration_sec=45.0)
    manifest = SegmentPlanner.generate_concat_manifest(segments, working_dir=tmp_path)

    assert manifest.exists()
    content = manifest.read_text(encoding="utf-8")
    assert "file '" in content
    assert "seg_0000.ts" in content
    assert "seg_0001.ts" in content
