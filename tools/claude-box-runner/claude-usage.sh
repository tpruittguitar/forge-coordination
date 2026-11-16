#!/usr/bin/env bash
# Prints the text of Claude Code's interactive /usage panel, captured headless
# through tmux. Read-only: opens a throwaway session in a dedicated empty folder,
# types /usage, captures the pane, closes. No model call is made.
set -uo pipefail
HOME_DIR=${FORGE_LANES_HOME:-/home/box/forge-lanes}
CWD=$HOME_DIR/usage-cwd
mkdir -p "$CWD"
S=forge-usage-$$
cleanup() { tmux send-keys -t "$S" Escape 2>/dev/null; tmux kill-session -t "$S" 2>/dev/null; }
trap cleanup EXIT
tmux new-session -d -s "$S" -x 160 -y 60 -c "$CWD" claude || { echo "USAGE_CAPTURE_FAILED: tmux"; exit 1; }
ready=0
for _ in $(seq 1 20); do
  sleep 1
  pane=$(tmux capture-pane -p -t "$S" 2>/dev/null) || break
  if grep -q "trust this folder" <<<"$pane"; then
    # Only this dedicated empty capture folder is ever trusted.
    tmux send-keys -t "$S" Down; sleep 0.5; tmux send-keys -t "$S" Enter; sleep 3
  elif grep -q "❯" <<<"$pane"; then ready=1; break; fi
done
[ "$ready" = 1 ] || { echo "USAGE_CAPTURE_FAILED: prompt not ready"; exit 1; }
tmux send-keys -t "$S" "/usage"; sleep 1; tmux send-keys -t "$S" Enter
for _ in $(seq 1 15); do
  sleep 1
  out=$(tmux capture-pane -p -t "$S" -S -200)
  if grep -q "Current week (all models)" <<<"$out" && grep -A2 "Current week (all models)" <<<"$out" | grep -q "Resets"; then
    printf '%s\n' "$out" | grep -v '^\s*$'; exit 0
  fi
done
echo "USAGE_CAPTURE_FAILED: weekly meter not shown"; exit 1
