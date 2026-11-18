#!/usr/bin/env bash
# run-lane.sh <TASK_KEY>
# One Claude box lane run: flock (skip if busy), fresh clone of forge-coordination
# main (+ read-only foreman-cockpit main when the lane needs it), headless
# `claude -p` with a lean prompt (shared header + lane brief + only this task's
# registry entry, built by build-prompt.js from control/CLAUDE_BOX_LANES.json at
# that same SHA), bounded by a timeout, logged (incl. PROMPT_BYTES), cleaned up. The procedure itself
# publishes the lane receipt (or a BLOCKED/PARTIAL receipt). This script never
# pushes, never touches Writer and never prints secrets.
set -uo pipefail
TASK_KEY=${1:-}
[[ $TASK_KEY =~ ^[A-Z][A-Z0-9_]{2,80}$ ]] || { echo "usage: run-lane.sh TASK_KEY" >&2; exit 2; }
HOME_DIR=${FORGE_LANES_HOME:-/home/box/forge-lanes}
REF=${FORGE_BOX_REF:-main}
REPO=tpruittguitar/forge-coordination
COCKPIT=tpruittguitar/foreman-cockpit
UTC=$(date -u +%Y%m%dT%H%M%SZ)
ET=$(TZ=America/New_York date +%Y%m%d-%H%M)
LOGDIR=$HOME_DIR/logs/$TASK_KEY
LOG=$LOGDIR/$UTC.log
mkdir -p "$LOGDIR" "$HOME_DIR/locks" "$HOME_DIR/work/$TASK_KEY"
log() { echo "$(date -u +%FT%TZ) $*" >> "$LOG"; }

exec 9>"$HOME_DIR/locks/$TASK_KEY.lock"
if ! flock -n 9; then log "SKIPPED_BUSY $TASK_KEY (previous run still holds the lane lock; no catch-up)"; exit 0; fi

RUN_ID="FORGE-CLAUDE-BOX-${TASK_KEY//_/-}-${ET}ET"
WORK=$HOME_DIR/work/$TASK_KEY/$RUN_ID
PRIVATE=$HOME_DIR/private/$TASK_KEY
mkdir -p "$WORK" "$PRIVATE" && chmod 700 "$HOME_DIR/private" "$PRIVATE"
log "START $TASK_KEY run=$RUN_ID ref=$REF"

cleanup() {
  local keep=0
  if [ -d "$WORK/repo/.git" ]; then
    git -C "$WORK/repo" fetch -q origin "$REF" 2>/dev/null
    if [ -n "$(git -C "$WORK/repo" status --porcelain 2>/dev/null)" ] || \
       [ -n "$(git -C "$WORK/repo" log --oneline "origin/$REF..HEAD" 2>/dev/null)" ]; then keep=1; fi
  fi
  if [ "$keep" = 1 ]; then log "PRESERVED_UNPUBLISHED $WORK (dirty or unpushed commits; not deleted)"
  else rm -rf "$WORK"; log "CLEANED $WORK"; fi
}
trap cleanup EXIT

GIT_AUTH=(-c credential.helper= -c 'credential.helper=!gh auth git-credential')
if ! git "${GIT_AUTH[@]}" clone -q --filter=blob:none --single-branch --branch "$REF" \
     "https://github.com/$REPO.git" "$WORK/repo" >> "$LOG" 2>&1; then
  log "BLOCKED CLONE_FAILED $REPO@$REF"; exit 1
fi
cd "$WORK/repo" || exit 1
git config credential.helper ''
git config --add credential.helper '!gh auth git-credential'
git config user.name tpruittguitar
git config user.email tpruittguitar@users.noreply.github.com
SHA=$(git rev-parse HEAD)

# Prompt = run variables + shared header + lane brief + only this task's entry (build-prompt.js at the same SHA).
BUILD=tools/claude-box-runner/build-prompt.js
LANE=$(node "$BUILD" . "$TASK_KEY" --meta 2>>"$LOG"); brc=$?
case $brc in
  0) ;;
  3) log "BLOCKED NO_BOX_MAPPING control/CLAUDE_BOX_LANES.json at $SHA has no $TASK_KEY"; exit 1;;
  *) log "BLOCKED MISSING_PROCEDURE build-prompt rc=$brc at $SHA"; exit 1;;
esac
IFS=$'\t' read -r MODEL TIMEOUT_MIN NEEDS_FC TOOLS <<<"$LANE"

FC=NONE
if [ "$NEEDS_FC" = 1 ]; then
  if git "${GIT_AUTH[@]}" clone -q --depth 1 "https://github.com/$COCKPIT.git" "$WORK/fc" >> "$LOG" 2>&1; then
    FC=$WORK/fc; FC_SHA=$(git -C "$FC" rev-parse HEAD)
  else log "COCKPIT_CLONE_FAILED (lane continues; steps needing it must report BLOCKED)"; fi
fi

PROMPT=$(RUN_ID="$RUN_ID" WORKDIR="$WORK/repo" REF="$REF" INSTRUCTION_COMMIT="$SHA" PRIVATE_DIR="$PRIVATE" \
  COCKPIT_DIR="$FC${FC_SHA:+ (foreman-cockpit main $FC_SHA, read-only)}" RUN_STARTED_UTC="$(date -u +%FT%TZ)" \
  node "$BUILD" . "$TASK_KEY" --prompt 2>>"$LOG") || { log "BLOCKED MISSING_PROCEDURE build-prompt failed at $SHA"; exit 1; }
PROMPT_BYTES=$(printf '%s' "$PROMPT" | wc -c | tr -d ' ')
log "PROMPT_BYTES=$PROMPT_BYTES task=$TASK_KEY run=$RUN_ID sha=$SHA"
printf '%s\t%s\t%s\t%s\n' "$(date -u +%FT%TZ)" "$TASK_KEY" "$RUN_ID" "$PROMPT_BYTES" >> "$HOME_DIR/logs/prompt-bytes.tsv"

export PROVIDER=Claude TASK_KEY RUN_ID FORGE_RUN_ID="$RUN_ID" FORGE_LANES_HOME="$HOME_DIR" \
       FORGE_PRIVATE_WORK_DIR="$PRIVATE" ACTIVITY_FC_DIR="$FC" INSTRUCTION_COMMIT="$SHA"
[ -n "${WRITER_KEY:-}" ] && export FORGE_WRITER_KEY="$WRITER_KEY"   # value never logged

log "CLAUDE model=$MODEL timeout=${TIMEOUT_MIN}m prompt_bytes=$PROMPT_BYTES sha=$SHA cockpit=${FC_SHA:-none}"
timeout --kill-after=60s "${TIMEOUT_MIN}m" claude -p "$PROMPT" \
  --model "$MODEL" --add-dir "$WORK" --allowedTools "$TOOLS" \
  --permission-mode dontAsk --no-session-persistence >> "$LOG" 2>&1
rc=$?
case $rc in
  0) log "DONE rc=0";;
  124|137) log "TIMEOUT after ${TIMEOUT_MIN}m rc=$rc (receipt may be missing; next scheduled run resumes, no replay)";;
  *) log "FAILED rc=$rc";;
esac
exit $rc
