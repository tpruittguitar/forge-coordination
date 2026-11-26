#!/usr/bin/env bash
# Publish this run's receipts/auto-intake (and its intake drain) to main with a bounded retry.
# On a rejected push: fetch main, reset onto it, restore this run's snapshot, retry (6 attempts, no force push).
# If the drain paths also changed on main, main's drain wins and only the receipts are restored (cs-59c4d9d5).
# Run record commits left unpushed by an earlier call in the same job are folded back in and retried.
set -euo pipefail
[ -d receipts/auto-intake ] || exit 0
INTAKE_PUBLISH_TMP=$(mktemp -d)
trap 'rm -rf "$INTAKE_PUBLISH_TMP"' EXIT
record_subject='AUTO-INTAKE-BOT: run record'
drain_paths=(state/INTAKE_DRAIN.json state/intake-drain-archive)
# An earlier call in this job may have committed its run record and then stopped before the push landed.
# Fold those commits back into the working tree so they are published below, not abandoned on a clean index.
if git rev-parse -q --verify origin/main >/dev/null; then
  unpushed=$(git rev-list origin/main..HEAD)
  if [ -n "$unpushed" ] && [ -z "$(git log --format=%s origin/main..HEAD | grep -vxF "$record_subject" || true)" ]; then
    echo "Re-publishing $(printf '%s\n' "$unpushed" | wc -l) unpushed run record commit(s) from an earlier attempt." >&2
    git reset -q --mixed "$(printf '%s\n' "$unpushed" | tail -n 1)^"
  fi
fi
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
  git commit -q -m "$record_subject"
  git push -q origin HEAD:main && exit 0
  [ "$i" = 6 ] && break
  [ "${INTAKE_PUBLISH_NO_SLEEP:-}" = 1 ] || sleep $((i * 4 + RANDOM % 4))
  git fetch -q origin main
  if [ -n "$drain_changed" ] && ! git diff --quiet "$drain_base" origin/main -- "${drain_paths[@]}"; then
    # Main's newer drain wins. Publish this run's receipts on top of it; never copy the stale drain over main.
    echo "Intake drain changed on main since $drain_base. Leaving the drain to main and publishing only receipts/auto-intake." >&2
    drain_changed=
  fi
  git reset -q --hard origin/main
  cp -R "$INTAKE_PUBLISH_TMP/rec/". ./
  if [ -n "$drain_changed" ]; then
    rm -rf -- "${drain_paths[@]}"
    cp -R "$INTAKE_PUBLISH_TMP/drain/". ./
  fi
done
echo "Run record push still rejected after 6 attempts." >&2
exit 1
