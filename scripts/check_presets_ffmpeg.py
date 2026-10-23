"""Preset filtergraph smoke test against the bundled FFmpeg (FFmpeg 9-era flag compatibility)."""
import json
import subprocess
import sys
from pathlib import Path

ff = Path(r"C:\Users\sajid\OneDrive\Desktop\MistusAVMerger\_internal\bin\ffmpeg.exe")
if not ff.exists():
    ff = "ffmpeg"
catalog = Path(__file__).resolve().parents[1] / "mistus_av_merger" / "presets" / "presets_v1.json"
failures = 0
for preset in json.load(open(catalog, encoding="utf-8"))["presets"]:
    result = subprocess.run(
        [str(ff), "-hide_banner", "-loglevel", "error", "-y",
         "-f", "lavfi", "-i", "color=c=gray:size=96x96:duration=1:rate=15",
         "-vf", preset["filtergraph"], "-frames:v", "5", "-f", "null", "-"],
        capture_output=True, text=True,
    )
    if result.returncode == 0:
        print(f"{preset['id']:<20} OK")
    else:
        failures += 1
        first = (result.stderr.strip().splitlines() or ["?"])[0]
        print(f"{preset['id']:<20} FAIL: {first}")
sys.exit(1 if failures else 0)
