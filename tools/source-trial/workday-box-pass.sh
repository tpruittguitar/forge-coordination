#!/usr/bin/env bash
# Workday box pass (card 14c6e4a): lean checkout of main, TRIAL_WORKDAY_ONLY run, push state with the retry loop.
# Needs network to Workday and GitHub and the box's gh login. Run by /home/box/tools/workday-box-pass/loop.sh.
set -euo pipefail
DIR=${WORKDAY_PASS_DIR:-/home/box/forge-workday-pass}
REPO=https://github.com/tpruittguitar/forge-coordination
FILES=(state/board-health.json state/workday-box-pass.json state/workday-box-pass-report.json state/workday-box-pass-report.md state/workday-box-pass-report.health.json)
git_() { git -C "$DIR" -c credential.helper= -c credential.helper='!gh auth git-credential' "$@"; }
if [ ! -d "$DIR/.git" ]; then
  git clone -q --depth 1 --filter=blob:none --sparse "$REPO" "$DIR"
  git -C "$DIR" sparse-checkout set --no-cone '/tools/' '/reports/' '/state/board-health.json' '/state/workday-box-pass*'
fi
git_ fetch -q --depth 1 origin main && git -C "$DIR" reset -q --hard origin/main
cd "$DIR"
git config user.name "Root (Grok Bot)"; git config user.email root-bot@users.noreply.github.com
TRIAL_WORKDAY_ONLY=1 TRIAL_BOARDS_ONLY=1 node tools/source-trial/run.js
OUT=$(mktemp -d); for f in "${FILES[@]}"; do [ ! -f "$f" ] || cp "$f" "$OUT/"; done
for i in 1 2 3 4 5 6; do
  for f in "${FILES[@]}"; do [ ! -f "$f" ] || git add "$f"; done
  git diff --cached --quiet && { echo "No change"; rm -rf "$OUT"; exit 0; }
  git commit -q -m "board-health: workday box pass"
  git_ push -q origin HEAD:main && { git rev-parse HEAD; rm -rf "$OUT"; exit 0; }
  sleep $((i * 4 + RANDOM % 4))
  git_ fetch -q --depth 1 origin main && git reset -q --hard origin/main
  node tools/source-trial/workday-box-pass.js merge state/board-health.json "$OUT/board-health.json" "$OUT/board-health.json"
  cp "$OUT"/* state/
done
rm -rf "$OUT"; exit 1
