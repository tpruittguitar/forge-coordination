#!/usr/bin/env bash
# Idempotent start of the ChatGPT box scheduler. Copies this runner to
# /home/box/chatgpt-lanes/runner, then starts node scheduler.js unless one
# is already running. Usage: bash tools/chatgpt-box-runner/start.sh [--copy-only]
set -euo pipefail
HOME_DIR=${CHATGPT_LANES_HOME:-/home/box/chatgpt-lanes}
SRC=$(cd "$(dirname "$0")" && pwd)
DEST=$HOME_DIR/runner
mkdir -p "$DEST" "$HOME_DIR/logs" "$HOME_DIR/locks" "$HOME_DIR/work" "$HOME_DIR/private"
chmod 700 "$HOME_DIR/private"
if [ "$SRC" != "$DEST" ]; then
  for f in scheduler.js run-lane.sh build-prompt.js crontab.txt start.sh lanes.json README.md; do
    [ -f "$SRC/$f" ] && install -m 0755 "$SRC/$f" "$DEST/$f.new" && mv -f "$DEST/$f.new" "$DEST/$f"
  done
  echo "runner copied to $DEST"
fi
[ "${1:-}" = "--copy-only" ] && exit 0

PID_FILE=$HOME_DIR/scheduler.pid
if [ -f "$PID_FILE" ]; then
  pid=$(cat "$PID_FILE" 2>/dev/null || true)
  if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null && grep -q scheduler.js "/proc/$pid/cmdline" 2>/dev/null; then
    echo "scheduler already running (pid $pid); crontab changes apply on its next minute tick"
    exit 0
  fi
fi
cd "$HOME_DIR"
export CHATGPT_LANES_HOME="$HOME_DIR"
setsid nohup env CHATGPT_LANES_HOME="$HOME_DIR" node "$DEST/scheduler.js" >> "$HOME_DIR/logs/scheduler.out" 2>&1 < /dev/null &
sleep 1
echo "scheduler started (pid $(cat "$PID_FILE" 2>/dev/null || echo '?')); heartbeat: $HOME_DIR/scheduler.heartbeat"
