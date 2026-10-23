"""
Main entry point for Mistus AV Merger application.
Finds a free port, starts Uvicorn bound to 127.0.0.1, opens default browser, and handles clean shutdown.
"""

import argparse
import shutil
import socket
import sys
import threading
import time
import webbrowser
from pathlib import Path
from typing import Optional

from mistus_av_merger import __version__, VERSION_CODE
from mistus_av_merger.core._build_info import BUILD_INFO


def find_free_port() -> int:
    """Finds an unused ephemeral port on 127.0.0.1."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def open_browser_delayed(url: str, delay: float = 1.0):
    def _open():
        time.sleep(delay)
        try:
            webbrowser.open(url)
        except Exception as e:
            print(f"[Info] Please open {url} in your browser: {e}")
    threading.Thread(target=_open, daemon=True).start()


def run_self_test() -> int:
    """
    End-to-end self test using only the bundled FFmpeg/FFprobe:
    generates a 2-second synthetic video clip and a 6-second sine tone,
    performs a tiny looped render through FFmpegCommandBuilder (stream copy loop),
    then verifies the output duration with the bundled ffprobe (~6 seconds).
    """
    import subprocess
    import tempfile

    from mistus_av_merger.core.binaries import get_ffmpeg_path, get_ffprobe_path
    from mistus_av_merger.core.ffmpeg_builder import FFmpegCommandBuilder

    ffmpeg = str(get_ffmpeg_path())
    ffprobe = str(get_ffprobe_path())
    print(f"[SelfTest] FFmpeg: {ffmpeg}")
    print(f"[SelfTest] FFprobe: {ffprobe}")
    print(f"[SelfTest] FFmpeg version: {subprocess.run([ffmpeg, '-version'], capture_output=True, text=True).stdout.splitlines()[0]}")

    tmp = Path(tempfile.mkdtemp(prefix="mistus-selftest-"))
    try:
        clip = tmp / "clip.mp4"
        tone = tmp / "tone.m4a"
        output = tmp / "selftest_output.mp4"

        # 2-second synthetic clip (H.264, 320x240).
        r1 = subprocess.run([
            ffmpeg, "-y", "-hide_banner", "-loglevel", "error",
            "-f", "lavfi", "-i", "testsrc2=size=320x240:rate=30",
            "-t", "2", "-pix_fmt", "yuv420p", "-c:v", "libx264", "-preset", "ultrafast",
            str(clip),
        ], capture_output=True, text=True, timeout=120)

        # 6-second 440 Hz sine tone (AAC).
        r2 = subprocess.run([
            ffmpeg, "-y", "-hide_banner", "-loglevel", "error",
            "-f", "lavfi", "-i", "sine=frequency=440:duration=6",
            "-c:a", "aac", "-b:a", "64k",
            str(tone),
        ], capture_output=True, text=True, timeout=120)

        if r1.returncode != 0 or r2.returncode != 0:
            print(r1.stderr, r2.stderr, file=sys.stderr)
            print("[SelfTest] FAIL: synthetic media generation failed.", file=sys.stderr)
            return 1

        # Tiny looped render: 2s video looped to fill the 6s audio (stream copy).
        # Duration-aware mode: finite loop count + -t output clamp, which is the
        # only reliably-top-bounded variant on FFmpeg 8/9 (see ffmpeg_builder).
        builder = FFmpegCommandBuilder(ffmpeg_bin=ffmpeg)
        cmd = builder.build_stream_copy_loop(
            clip, tone, output, audio_transcode=True, threads=1,
            audio_duration_sec=6.0, video_duration_sec=2.0,
        )
        r3 = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
        if r3.returncode != 0:
            print(r3.stderr[-2000:] if r3.stderr else "", file=sys.stderr)
            print("[SelfTest] FAIL: looped render failed.", file=sys.stderr)
            return 1

        # Verify duration with the bundled ffprobe.
        r4 = subprocess.run([
            ffprobe, "-v", "quiet", "-print_format", "json", "-show_format", str(output),
        ], capture_output=True, text=True, timeout=60)
        if r4.returncode != 0:
            print("[SelfTest] FAIL: ffprobe could not read the rendered output.", file=sys.stderr)
            return 1

        import json
        fmt = json.loads(r4.stdout).get("format", {})
        duration = float(fmt.get("duration", 0.0))
        print(f"[SelfTest] Rendered duration: {duration:.2f}s (expected ~6s)")

        if not (5.25 <= duration <= 6.75):
            print("[SelfTest] FAIL: output duration is not ~6 seconds.", file=sys.stderr)
            return 1

        print("[SelfTest] PASS: looped render produced ~6.0s video with bundled FFmpeg.")
        return 0
    finally:
        try:
            shutil.rmtree(tmp, ignore_errors=True)
        except Exception:
            pass


def main():
    parser = argparse.ArgumentParser(
        prog="MistusAVMerger",
        description="Mistus AV Merger - Portable Looping Audio-Video Combiner",
    )
    parser.add_argument("--version", action="store_true", help="Print version info and exit")
    parser.add_argument("--port", type=int, default=0, help="Port to listen on (default: auto free port)")
    parser.add_argument("--host", default="127.0.0.1", help="Binding host (default: 127.0.0.1)")
    parser.add_argument("--no-browser", action="store_true", help="Do not open default browser automatically")
    parser.add_argument("--self-test", action="store_true",
                        help="Run the offline bundled-FFmpeg smoke test and exit (no server)")
    args = parser.parse_args()

    if args.version:
        print(f"Mistus AV Merger v{__version__} (versionCode: {VERSION_CODE})")
        print(f"Commit: {BUILD_INFO.get('git_commit', 'unknown')}")
        print(f"FFmpeg: {BUILD_INFO.get('ffmpeg_version', 'bundled')}")
        sys.exit(0)

    if args.self_test:
        sys.exit(run_self_test())

    port = args.port if args.port > 0 else find_free_port()
    url = f"http://{args.host}:{port}"

    print("=" * 60)
    print(f"  Mistus AV Merger v{__version__} (versionCode: {VERSION_CODE})")
    print(f"  Server running locally at: {url}")
    print("  Press Ctrl+C or use Quit in the Web UI to exit.")
    print("=" * 60)

    if not args.no_browser:
        open_browser_delayed(url)

    try:
        import uvicorn
        from mistus_av_merger.api.app import app
        uvicorn.run(app, host=args.host, port=port, log_level="warning")
    except KeyboardInterrupt:
        print("\n[Info] Shutting down Mistus AV Merger cleanly...")
        sys.exit(0)
    except Exception as e:
        print(f"[Error] Failed to start server: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
