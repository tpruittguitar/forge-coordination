#!/usr/bin/env bash
set -euo pipefail
[ -d receipts/auto-intake ] || exit 0
INTAKE_PUBLISH_TMP=$(mktemp -d)
trap 'rm -rf "$INTAKE_PUBLISH_TMP"' EXIT
drain_paths=(state/INTAKE_DRAIN.json state/intake-drain-archive)
drain_base=$(git rev-parse HEAD)
drain_changed=$(git status --porcelain --untracked-files=all -- "${drain_paths[@]}")
if [ -n "$drain_changed" ]; then
  node -e 'require("./tools/upstream-ledger/store.cjs").readDrain(process.cwd())'
  mkdir -p "$INTAKE_PUBLISH_TMP/drain"
  for file in "${drain_paths[@]}"; do
    [ ! -e "$file" ] || cp -R --parents "$file" "$INTAKE_PUBLISH_TMP/drain/"
  done
fi
mkdir -p "$INTAKE_PUBLISH_TMP/rec"
# Preserve only this run's changes, not stale copies of every prior run.
# Otherwise a retry can overwrite newer operator recovery evidence.
while IFS= read -r -d '' file; do
  if [ -f "$file" ]; then cp --parents "$file" "$INTAKE_PUBLISH_TMP/rec/"; fi
done < <(git ls-files -z --modified --others --exclude-standard -- receipts/auto-intake/)
git config user.name forge-auto-intake-bot
git config user.email forge-auto-intake-bot@users.noreply.github.com
for i in 1 2 3 4 5 6; do
  git add receipts/auto-intake
  if [ -n "$drain_changed" ]; then
    for file in "${drain_paths[@]}"; do
      if [ -e "$file" ] || [ -n "$(git ls-files -- "$file")" ]; then git add -A -- "$file"; fi
    done
  fi
  git diff --cached --quiet && exit 0
  git commit -q -m "AUTO-INTAKE-BOT: run record"
  git push -q origin HEAD:main && exit 0
  sleep $((i * 4 + RANDOM % 4))
  git fetch -q origin main
  if [ -n "$drain_changed" ] && ! git diff --quiet "$drain_base" origin/main -- "${drain_paths[@]}"; then
    echo 'Intake drain changed on main. Rebuild validation from the current inventory before publishing it.' >&2
    exit 1
  fi
  git reset -q --hard origin/main
  cp -R "$INTAKE_PUBLISH_TMP/rec/". ./
  if [ -n "$drain_changed" ]; then
    rm -rf -- "${drain_paths[@]}"
    cp -R "$INTAKE_PUBLISH_TMP/drain/". ./
  fi
done
exit 1
