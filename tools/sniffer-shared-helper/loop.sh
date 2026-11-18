#!/usr/bin/env bash
# Sniffer's hourly shared-helper loop on the box (the box has no cron or systemd). Research only, free providers only,
# no Writer authority, no AI agent turns. One copy only (flock). Stops on its own when the LIVE file is removed.
# Start (only after Tim's go and #448 merged):
#   touch /workspace/sniffer-shared-helper/LIVE
#   setsid nohup tools/sniffer-shared-helper/loop.sh >/dev/null 2>&1 &
set -u
STATE=${SNIFFER_STATE_DIR:-/workspace/sniffer-shared-helper}
REPO=${SNIFFER_REPO_DIR:-$STATE/forge-coordination}
URL=https://github.com/tpruittguitar/forge-coordination
mkdir -p "$STATE"
exec 9>"$STATE/loop.lock"; flock -n 9 || { echo "loop already running"; exit 0; }
log() { echo "$(date -Is) $*" >> "$STATE/runner.log"; }
while [ -f "$STATE/LIVE" ]; do
  started=$(date +%s)
  # Lean checkout: depth 1, blob filter, only the folders the runner reads. No step reads git history.
  if [ ! -d "$REPO/.git" ]; then
    git clone -q --depth 1 --filter=blob:none --sparse "$URL" "$REPO" && git -C "$REPO" sparse-checkout set tools control policy lanes || log "clone failed"
  fi
  if git -C "$REPO" fetch -q --depth 1 origin main && git -C "$REPO" checkout -q -B main origin/main && git -C "$REPO" reset -q --hard origin/main && git -C "$REPO" clean -qfd receipts; then
    out=$(cd "$REPO" && SNIFFER_STATE_DIR="$STATE" timeout 50m node tools/sniffer-shared-helper/run.cjs --repo "$REPO" --apply 2>&1)
    log "$out"
  else
    log "fetch failed"
  fi
  # Hourly, measured from the start of the run.
  while [ -f "$STATE/LIVE" ] && [ $(( $(date +%s) - started )) -lt 3600 ]; do sleep 60; done
done
log "LIVE removed; loop stopped"
