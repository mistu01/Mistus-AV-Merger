"""
Segment planner and crash-safe concatenation engine.
Splits long renders into deterministic chunks and stitches completed parts.
"""

from pathlib import Path
from typing import Dict, List, NamedTuple


class Segment(NamedTuple):
    index: int
    start_time: float
    duration: float
    filename: str
    completed: bool


class SegmentPlanner:
    """Plans continuous render intervals and generates FFmpeg concat files."""

    @staticmethod
    def plan(
        total_duration_sec: float,
        segment_duration_sec: float = 120.0,
        temp_dir: Optional[Path] = None,
        prefix: str = "seg",
    ) -> List[Segment]:
        if total_duration_sec <= 0:
            return []

        segments: List[Segment] = []
        current_start = 0.0
        idx = 0

        while current_start < total_duration_sec:
            dur = min(segment_duration_sec, total_duration_sec - current_start)
            fname = f"{prefix}_{idx:04d}.ts"
            segments.append(
                Segment(
                    index=idx,
                    start_time=round(current_start, 3),
                    duration=round(dur, 3),
                    filename=fname,
                    completed=False,
                )
            )
            current_start += dur
            idx += 1

        return segments

    @staticmethod
    def generate_concat_manifest(
        segments: List[Segment],
        working_dir: Path,
        manifest_filename: str = "concat_list.txt",
    ) -> Path:
        """Writes FFmpeg concat demuxer manifest file."""
        manifest_path = working_dir / manifest_filename
        with open(manifest_path, "w", encoding="utf-8") as f:
            for s in segments:
                # FFmpeg concat syntax requires 'file <filename>'
                clean_path = str(working_dir / s.filename).replace("\\", "/")
                f.write(f"file '{clean_path}'\n")
        return manifest_path
