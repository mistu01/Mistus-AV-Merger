"""
Main entry point for Mistus AV Merger application.
Finds a free port, starts Uvicorn bound to 127.0.0.1, opens default browser, and handles clean shutdown.
"""

import argparse
import socket
import sys
import threading
import time
import webbrowser
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


def main():
    parser = argparse.ArgumentParser(
        prog="MistusAVMerger",
        description="Mistus AV Merger - Portable Looping Audio-Video Combiner",
    )
    parser.add_argument("--version", action="store_true", help="Print version info and exit")
    parser.add_argument("--port", type=int, default=0, help="Port to listen on (default: auto free port)")
    parser.add_argument("--host", default="127.0.0.1", help="Binding host (default: 127.0.0.1)")
    parser.add_argument("--no-browser", action="store_true", help="Do not open default browser automatically")
    args = parser.parse_args()

    if args.version:
        print(f"Mistus AV Merger v{__version__} (versionCode: {VERSION_CODE})")
        print(f"Commit: {BUILD_INFO.get('git_commit', 'unknown')}")
        print(f"FFmpeg: {BUILD_INFO.get('ffmpeg_version', 'bundled')}")
        sys.exit(0)

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
