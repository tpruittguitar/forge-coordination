# Claude box runner

Runs the Forge lanes moved from ChatGPT/Codex on TIMMAY to headless Claude Code
(`claude -p`) on the shared Linux box (Tim, 2026-11-16 12:40 PM ET).

- `crontab.txt` — 5-field cron lines in America/New_York + TASK_KEY.
- `scheduler.js` — zero-dependency daemon: checks once a minute, starts due lanes
  detached via `run-lane.sh`, never runs missed windows, writes
  `/home/box/forge-lanes/scheduler.heartbeat` and `scheduler.pid` (a second copy exits).
- `run-lane.sh <TASK_KEY>` — `flock -n` on `/home/box/forge-lanes/locks/<TASK_KEY>.lock`
  (busy → `SKIPPED_BUSY` log line), fresh clone of forge-coordination main under
  `/home/box/forge-lanes/work/<TASK_KEY>/<RUN_ID>`, read-only foreman-cockpit clone when
  needed, then `claude -p` with a lean prompt built by `build-prompt.js` at the same SHA:
  run variables + the shared header `lanes/CLAUDE_BOX_COMMON.txt` (<= 600 tokens) + the lane brief
  from `control/CLAUDE_BOX_LANES.json` (<= 1,500 tokens, merged from the old box file and original
  procedure) + only this task's entry from `control/AI_AUTOMATION_TASKS.json` (and its
  `runtime/current.json` lane entry for runtime routes). Lanes no longer read the shared entry, the
  whole registry, `policy/current/AI_AUTOMATION_COMMON.txt` (kept for non-box readers) or the old
  procedure. Model, timeout and allowed tools come from the mapping file. Logs:
  `/home/box/forge-lanes/logs/<TASK_KEY>/<UTC>.log` (each run logs `PROMPT_BYTES=<n>`; one line per run
  also goes to `/home/box/forge-lanes/logs/prompt-bytes.tsv`). The work dir is deleted afterwards
  unless it holds unpushed or dirty work. `$WRITER_KEY` is passed only as the `FORGE_WRITER_KEY`
  environment variable and never logged.
- `next-work.js <file.json> --n N [--path a.b] [--where k=v] [--sort f] [--fields a,b]` — prints the
  next N items of a large work/state JSON (header line with total/matched, then one item per line), so
  no lane reads a whole work file.
- Tests: `node --test tools/claude-box-runner/*.test.js` (scheduler, prompt budgets/contents, next-work, and a
  stubbed `run-lane.sh` run that checks the `PROMPT_BYTES` log line).
- `start.sh` — copies this directory to `/home/box/forge-lanes/runner` and starts the
  scheduler with `setsid nohup` if it is not already running. `--copy-only` just copies.
- `claude-usage.sh` — captures Claude's interactive `/usage` panel through tmux for the
  usage reader (no signed-in Chrome on the box, so Grok/ChatGPT readings are null).

Optional env: `FORGE_LANES_HOME` (default `/home/box/forge-lanes`), `FORGE_BOX_REF`
(default `main`), `FORGE_BOX_CRONTAB`.

Nothing here runs until someone executes `start.sh`. Until this branch is merged, a run
on `main` stops at `BLOCKED NO_BOX_MAPPING` because the mapping file is not on main yet.
