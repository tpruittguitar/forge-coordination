#!/usr/bin/env bash
set -euo pipefail
[ -d receipts/auto-intake ] || exit 0
INTAKE_PUBLISH_TMP=$(mktemp -d)
trap 'rm -rf "$INTAKE_PUBLISH_TMP"' EXIT
mkdir -p "$INTAKE_PUBLISH_TMP/drain"
[ ! -f state/INTAKE_DRAIN.json ] || cp state/INTAKE_DRAIN.json "$INTAKE_PUBLISH_TMP/drain/"
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
  [ ! -f state/INTAKE_DRAIN.json ] || git add state/INTAKE_DRAIN.json
  git diff --cached --quiet && exit 0
  git commit -q -m "AUTO-INTAKE-BOT: run record"
  git push -q origin HEAD:main && exit 0
  sleep $((i * 4 + RANDOM % 4))
  git fetch -q origin main && git reset -q --hard origin/main
  cp -R "$INTAKE_PUBLISH_TMP/rec/". ./
  [ ! -f "$INTAKE_PUBLISH_TMP/drain/"INTAKE_DRAIN.json ] || cp "$INTAKE_PUBLISH_TMP/drain/"INTAKE_DRAIN.json state/
done
exit 1
