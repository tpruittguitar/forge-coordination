#!/usr/bin/env bash
# run-lane.sh <TASK_KEY>
# One ChatGPT box lane run: flock (skip if busy), fresh clone of forge-coordination
# main, the OpenAI API credit (grant) runner by default (claude/codex remain documented
# runners) with a prompt built from the published shared entry + procedure + this
# task's registry entry at that SHA. Never uses Grok, Cursor or paid fallback.
# Missed windows are not caught up. cs-92f6a3b0 (Tim 2026-11-26): grant calls use
# reasoning_effort high, stop at the hard $1.00 floor and after Nov 30 23:59 ET.
# This script never force-dispatches, never prints secrets and never touches a
# TIMMAY production lock path that does not exist on this host.
set -uo pipefail
TASK_KEY=${1:-}
[[ $TASK_KEY =~ ^[A-Z][A-Z0-9_]{2,80}$ ]] || { echo "usage: run-lane.sh TASK_KEY" >&2; exit 2; }
HOME_DIR=${CHATGPT_LANES_HOME:-/home/box/chatgpt-lanes}
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

CREDIT_FILE=${OPENAI_CREDIT_FILE:-/workspace/usage-display/openai_credit.json}
GRANT_FLOOR_USD=1.00
GRANT_EXPIRES_ET=202611302359
if [ -f "$CREDIT_FILE" ]; then
  if python3 -c "import json,sys; v=float(json.load(open(sys.argv[1])).get('est_left_usd') or 0); sys.exit(0 if v<=float(sys.argv[2]) else 1)" "$CREDIT_FILE" "$GRANT_FLOOR_USD"; then
    log "BLOCKED CREDIT_FLOOR OpenAI grant estimate is at or below the hard \$$GRANT_FLOOR_USD floor; model work deferred, no paid fallback"; exit 0
  fi
fi

RUN_ID="FORGE-CHATGPT-BOX-${TASK_KEY//_/-}-${ET}ET"
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
if ! git "${GIT_AUTH[@]}" clone -q --depth 1 --filter=blob:none --sparse --single-branch --branch "$REF" \
     "https://github.com/$REPO.git" "$WORK/repo" >> "$LOG" 2>&1; then
  log "BLOCKED CLONE_FAILED $REPO@$REF"; exit 1
fi
cd "$WORK/repo" || exit 1
git sparse-checkout set control lanes policy tools/chatgpt-box-runner tools/automation-run-lock.cjs runtime \
  tools/research-preflight tools/helper-routing tools/intake-drain tools/change-register tools/source-trial tools/routine-handoffs >> "$LOG" 2>&1 || true
git config credential.helper ''
git config --add credential.helper '!gh auth git-credential'
git config user.name tpruittguitar
git config user.email tpruittguitar@users.noreply.github.com
SHA=$(git rev-parse HEAD)

# Until this runner is on the ref, use the installed mapping/prompt builder with
# the clone's published entry, procedure and registry.
if [ ! -f tools/chatgpt-box-runner/lanes.json ]; then
  mkdir -p tools/chatgpt-box-runner
  cp "$HOME_DIR/runner/lanes.json" "$HOME_DIR/runner/build-prompt.js" tools/chatgpt-box-runner/ || { log "BLOCKED MISSING_BOX_RUNNER"; exit 1; }
fi

BUILD=tools/chatgpt-box-runner/build-prompt.js
if [ ! -f "$BUILD" ]; then
  BUILD=$HOME_DIR/runner/build-prompt.js
fi
LANE=$(node "$BUILD" . "$TASK_KEY" --meta 2>>"$LOG"); brc=$?
case $brc in
  0) ;;
  3) log "HELD_OR_UNMAPPED $TASK_KEY at $SHA (no enabled box mapping; no run)"; exit 0;;
  *) log "BLOCKED MISSING_PROCEDURE build-prompt rc=$brc at $SHA"; exit 1;;
esac
IFS=$'\t' read -r MODEL TIMEOUT_MIN NEEDS_FC RUNNER <<<"$LANE"

FC=NONE
if [ "$NEEDS_FC" = 1 ]; then
  if git "${GIT_AUTH[@]}" clone -q --depth 1 --filter=blob:none "https://github.com/$COCKPIT.git" "$WORK/fc" >> "$LOG" 2>&1; then
    FC=$WORK/fc; FC_SHA=$(git -C "$FC" rev-parse HEAD)
  else log "COCKPIT_CLONE_FAILED (lane continues; steps needing it must report BLOCKED)"; fi
fi

PROMPT=$(RUN_ID="$RUN_ID" WORKDIR="$WORK/repo" REF="$REF" INSTRUCTION_COMMIT="$SHA" PRIVATE_DIR="$PRIVATE" \
  COCKPIT_DIR="$FC${FC_SHA:+ (foreman-cockpit main $FC_SHA, read-only)}" RUN_STARTED_UTC="$(date -u +%FT%TZ)" \
  node "$BUILD" . "$TASK_KEY" --prompt 2>>"$LOG") || { log "BLOCKED MISSING_PROCEDURE build-prompt failed at $SHA"; exit 1; }
PROMPT_BYTES=$(printf '%s' "$PROMPT" | wc -c | tr -d ' ')
log "PROMPT_BYTES=$PROMPT_BYTES task=$TASK_KEY run=$RUN_ID sha=$SHA runner=$RUNNER"
printf '%s\t%s\t%s\t%s\n' "$(date -u +%FT%TZ)" "$TASK_KEY" "$RUN_ID" "$PROMPT_BYTES" >> "$HOME_DIR/logs/prompt-bytes.tsv"

export PROVIDER=ChatGPT TASK_KEY RUN_ID FORGE_RUN_ID="$RUN_ID" CHATGPT_LANES_HOME="$HOME_DIR" \
       FORGE_PRIVATE_WORK_DIR="$PRIVATE" ACTIVITY_FC_DIR="$FC" INSTRUCTION_COMMIT="$SHA"
# Writer key, if present in the environment, is passed through and never logged.

TOOLS="Read,Write,Edit,Glob,Grep,Bash(git *),Bash(gh *),Bash(node *),Bash(python3 *),Bash(date *),Bash(sha256sum *),Bash(ls *),Bash(mkdir *),Bash(jq *)"
log "RUNNER=$RUNNER model=$MODEL timeout=${TIMEOUT_MIN}m prompt_bytes=$PROMPT_BYTES sha=$SHA cockpit=${FC_SHA:-none}"
case "$RUNNER" in
  claude)
    timeout --kill-after=60s "${TIMEOUT_MIN}m" claude -p "$PROMPT" \
      --model "$MODEL" --add-dir "$WORK" --allowedTools "$TOOLS" \
      --permission-mode dontAsk --no-session-persistence >> "$LOG" 2>&1
    rc=$?
    ;;
  grant)
    if [ "$(TZ=America/New_York date +%Y%m%d%H%M)" -gt "$GRANT_EXPIRES_ET" ]; then
      log "BLOCKED GRANT_EXPIRED OpenAI grant ended Nov 30 23:59 ET; no paid fallback"; exit 0
    fi
    # Calls log to /workspace/usage-display/ask_grant_calls.jsonl (ask_grant.py contract).
    OPENAI_REASONING_EFFORT=high ASK_GRANT_MODEL="$MODEL" \
    timeout --kill-after=60s "${TIMEOUT_MIN}m" python3 /home/box/tools/ask_grant.py \
      --card "${CHATGPT_LANE_CARD:-cs-bdec2136}" --max-out 4000 "$PROMPT" >> "$LOG" 2>&1
    rc=$?
    ;;
  codex)
    timeout --kill-after=60s "${TIMEOUT_MIN}m" codex exec --skip-git-repo-check "$PROMPT" >> "$LOG" 2>&1
    rc=$?
    ;;
  *) log "BLOCKED UNKNOWN_RUNNER $RUNNER"; exit 1;;
esac
case $rc in
  0) log "DONE rc=0";;
  124|137) log "TIMEOUT after ${TIMEOUT_MIN}m rc=$rc (receipt may be missing; next scheduled run resumes, no replay)";;
  *) log "FAILED rc=$rc";;
esac
exit $rc
