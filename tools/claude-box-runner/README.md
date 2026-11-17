# Claude box runner

Runs the six Forge lanes moved from ChatGPT/Codex on TIMMAY to headless Claude Code
(`claude -p`) on the shared Linux box (Tim, 2026-11-16 12:40 PM ET), plus
FORGE_CLAUDE_SHARED_HELPER (hourly :25), which also covers the retired Grok shared helper
(#398; scheduled by President decision, Nov 17, 2026, 9:05 AM ET).

- `crontab.txt` — 5-field cron lines in America/New_York + TASK_KEY.
- `scheduler.js` — zero-dependency daemon: checks once a minute, starts due lanes
  detached via `run-lane.sh`, never runs missed windows, writes
  `/home/box/forge-lanes/scheduler.heartbeat` and `scheduler.pid` (a second copy exits).
  Tests: `node --test tools/claude-box-runner/scheduler.test.js`.
- `run-lane.sh <TASK_KEY>` — `flock -n` on `/home/box/forge-lanes/locks/<TASK_KEY>.lock`
  (busy → `SKIPPED_BUSY` log line), fresh clone of forge-coordination main under
  `/home/box/forge-lanes/work/<TASK_KEY>/<RUN_ID>`, read-only foreman-cockpit clone when
  needed, then `claude -p` with `lanes/CLAUDE_BOX_COMMON.txt` + the lane's box procedure
  from `control/CLAUDE_BOX_LANES.json` (model, timeout and allowed tools come from that
  file at the same SHA). Logs: `/home/box/forge-lanes/logs/<TASK_KEY>/<UTC>.log`. The work
  dir is deleted afterwards unless it holds unpushed or dirty work. `$WRITER_KEY` is
  passed only as the `FORGE_WRITER_KEY` environment variable and never logged.
- `start.sh` — copies this directory to `/home/box/forge-lanes/runner` and starts the
  scheduler with `setsid nohup` if it is not already running. `--copy-only` just copies.
- `claude-usage.sh` — captures Claude's interactive `/usage` panel through tmux for the
  usage reader (no signed-in Chrome on the box, so Grok/ChatGPT readings are null).

Optional env: `FORGE_LANES_HOME` (default `/home/box/forge-lanes`), `FORGE_BOX_REF`
(default `main`), `FORGE_BOX_CRONTAB`.

Nothing here runs until someone executes `start.sh`. Until this branch is merged, a run
on `main` stops at `BLOCKED NO_BOX_MAPPING` because the mapping file is not on main yet.
