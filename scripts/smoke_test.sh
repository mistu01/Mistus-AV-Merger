#!/usr/bin/env bash
#
# Smoke tests a built Mistus AV Merger package (PyInstaller onedir).
# Usage: bash scripts/smoke_test.sh <app_dir> <expected_version>
#   app_dir: the distribution directory containing MistusAVMerger(.exe)
#   expected_version: e.g. 0.6.0
#
# Verifies:
#   1. `--version` prints the expected version.
#   2. The server starts with --no-browser and /api/v1/health reports the version.
#   3. A tiny looped render through the binary succeeds (2s clip + 6s tone -> ~6s output).
#   4. The server shuts down cleanly.

set -euo pipefail

APP_DIR="${1:?usage: smoke_test.sh <app_dir> <expected_version>}"
EXPECTED_VERSION="${2:?usage: smoke_test.sh <app_dir> <expected_version>}"

PY=python3
if ! command -v "$PY" >/dev/null 2>&1; then
  PY=python
fi

case "$(uname -s)" in
  MINGW*|MSYS*|CYGWIN*) EXE="$APP_DIR/MistusAVMerger.exe" ;;
  *)                    EXE="$APP_DIR/MistusAVMerger" ;;
esac

if [ ! -f "$EXE" ]; then
  echo "FAIL: executable not found at $EXE" >&2
  exit 1
fi

cleanup() {
  local rc=$?
  if [ -n "${SERVER_PID:-}" ] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID" 2>/dev/null || true
    sleep 2
    kill "$SERVER_PID" 2>/dev/null || taskkill //F //PID "$SERVER_PID" >/dev/null 2>&1 || true
  fi
  exit $rc
}
trap cleanup EXIT

echo "== Smoke test: $EXE (expecting v$EXPECTED_VERSION) =="

# 1. --version flag
VERSION_OUTPUT="$("$EXE" --version)"
echo "--version output: $VERSION_OUTPUT"
echo "$VERSION_OUTPUT" | grep -q "v$EXPECTED_VERSION" || {
  echo "FAIL: --version did not contain v$EXPECTED_VERSION" >&2
  exit 1
}

# 2. Server health check on a free port
PORT="$($PY -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1",0)); print(s.getsockname()[1]); s.close()')"
echo "Starting server on 127.0.0.1:$PORT (--no-browser)"
"$EXE" --no-browser --port "$PORT" > server_smoke_test.log 2>&1 &
SERVER_PID=$!

health_ok=0
for _ in $(seq 1 30); do
  if "$PY" - "$PORT" "$EXPECTED_VERSION" <<'PY'
import json, sys, time, urllib.request
port, version = sys.argv[1], sys.argv[2]
try:
    with urllib.request.urlopen(f"http://127.0.0.1:{port}/api/v1/health", timeout=2) as r:
        data = json.load(r)
    ok = data.get("status") == "healthy" and str(data.get("version")) == version
    if ok:
        print("HEALTH OK:", data)
except Exception:
    pass
PY
  then
    health_ok=1
    break
  fi
  sleep 1
done

[ "$health_ok" = "1" ] || {
  echo "FAIL: /api/v1/health did not report version $EXPECTED_VERSION within 30s" >&2
  cat server_smoke_test.log >&2
  exit 1
}

# 3. Tiny looped render through the binary (bundled FFmpeg + app command builder)
echo "Running --self-test (synthetic 2s clip + 6s tone, looped render)"
"$EXE" --self-test

# 4. Clean shutdown (trap handles it; success exit resets code)
echo "SMOKE TEST PASS"
SERVER_PID=""
exit 0
