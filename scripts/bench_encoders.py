"""Benchmarks encode variants on the bundled FFmpeg (720p, worn-Tape chain)."""
import re
import subprocess
import sys
import tempfile
import time
from pathlib import Path

FF = "ffmpeg"
TMP = Path(tempfile.mkdtemp(prefix="mistus-bench-"))

# 1. Make a realistic 20s 720p30 test clip
clip = TMP / "clip.mp4"
subprocess.run([
    FF, "-y", "-loglevel", "error",
    "-f", "lavfi", "-i", "testsrc=duration=20:size=1280x720:rate=30",
    "-f", "lavfi", "-i", "sine=frequency=440:duration=1",
    "-c:v", "libx264", "-preset", "fast", "-pix_fmt", "yuv420p", "-an",
    str(clip),
], check=True, capture_output=True)

CHAIN_WORN = "gblur=sigma=1.2,chromashift=cbh=2:crh=-2,noise=alls=16:allf=t+u,eq=contrast=1.05:saturation=1.15"
CHAIN_FAST = "boxblur=1:1,chromashift=cbh=2:crh=-2,noise=alls=16:allf=t+u,eq=contrast=1.05:saturation=1.15"
AUDIO = TMP / "tone.mp3"
subprocess.run([FF, "-y", "-loglevel", "error", "-f", "lavfi", "-i", "sine=frequency=330:duration=20", str(AUDIO)],
               check=True, capture_output=True)


def bench(label: str, extra: list[str], chain: str = CHAIN_WORN, enc: str = "libx264",
          enc_opts: list[str] | None = None, loglevel: str = "info"):
    out = TMP / "out.mp4"
    cmd = [
        FF, "-y", "-hide_banner", "-loglevel", loglevel,
        "-stream_loop", "-1", "-i", str(clip), "-i", str(AUDIO),
        "-filter_complex", f"[0:v]{chain}[v]",
        "-map", "[v]", "-map", "1:a:0",
        "-c:v", enc,
    ]
    if enc_opts:
        cmd.extend(enc_opts)
    cmd += ["-c:a", "aac", "-b:a", "192k", "-t", "20", "-movflags", "+faststart", "-progress", "pipe:1"]
    cmd.extend(extra)
    cmd.append(str(out))
    t0 = time.perf_counter()
    proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True)
    wall = time.perf_counter() - t0
    fps = 0.0
    speed = ""
    for line in (proc.stdout or "").splitlines():
        if line.startswith("fps="):
            m = re.search(r"fps=([\d.]+)", line)
            if m:
                fps = float(m.group(1))
        if line.startswith("progress=") and "fps" in proc.stdout:
            pass
    for line in (proc.stdout or "").splitlines():
        if line.startswith("speed="):
            speed = line.split("=", 1)[1]
    ok = proc.returncode == 0 and out.exists()
    print(f"{label:<46} {'OK ' if ok else 'FAIL'} fps={fps:>8.1f}  speed={speed:>7}  wall={wall:5.1f}s", flush=True)


print("== A. current app behavior (medium, no filter_threads, info) ==")
bench("A  libx264 medium", ["-crf", "21", "-preset", "medium"])

print("== B/F. preset swap (CPU) ==")
bench("B  libx264 veryfast", ["-crf", "21", "-preset", "veryfast"])
bench("C  libx264 ultrafast", ["-crf", "21", "-preset", "ultrafast"])

print("== D. filter_threads (CPU veryfast) ==")
bench("D  veryfast +filter_threads 4", ["-crf", "21", "-preset", "veryfast", "-filter_threads", "4"])

print("== E. loglevel effect ==")
bench("E  veryfast loglevel error", ["-crf", "21", "-preset", "veryfast"], loglevel="error")

print("== QSV (iGPU) ==")
bench("F  qsv medium preset", [], enc="h264_qsv", enc_opts=["-global_quality", "21", "-preset", "medium"])
bench("G  qsv veryfast + filter_threads 4", [], enc="h264_qsv",
      enc_opts=["-global_quality", "21", "-preset", "veryfast", "-filter_threads", "4"])
bench("G2 qsv veryfast, no filter_threads", [], enc="h264_qsv",
      enc_opts=["-global_quality", "21", "-preset", "veryfast"])

print("== H. cheaper blur (qsv + boxblur) ==")
bench("H  qsv veryfast boxblur chain", [], chain=CHAIN_FAST, enc="h264_qsv",
      enc_opts=["-global_quality", "21", "-preset", "veryfast"])

print("== I. heavier chains QSV vs CPU ==")
heavy_nvenc_like = "gblur=sigma=0.6,noise=alls=8:allf=t,curves=vintage,scale=1920:1080:force_original_aspect_ratio=decrease:flags=lanczos"
bench("I1 heavy+1080p libx264 veryfast+ft4", ["-crf", "21", "-preset", "veryfast", "-filter_threads", "4"], chain=heavy_nvenc_like)
bench("I2 heavy+1080p qsv veryfast", [], chain=heavy_nvenc_like, enc="h264_qsv",
      enc_opts=["-global_quality", "21", "-preset", "veryfast"])
bench("I3 heavy+1080p qsv veryfast boxblur", [], chain=heavy_nvenc_like.replace("gblur=sigma=0.6", "boxblur=0.5:1"), enc="h264_qsv",
      enc_opts=["-global_quality", "21", "-preset", "veryfast"])
