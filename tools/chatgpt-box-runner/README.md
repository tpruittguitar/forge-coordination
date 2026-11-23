# ChatGPT box lane scheduler

Runs selected ChatGPT-owned Forge lanes on the shared Linux box with
`claude -p` (or grant/Codex when a lane maps to that runner). Modeled on
`tools/claude-box-runner`. Home: `/home/box/chatgpt-lanes` (survives a box
refresh; not under `/workspace/forge-lanes`).

- `lanes.json` — enabled vs held lanes, published cadences, and the readback
  reasons a lane stays off.
- `crontab.txt` — 5-field cron in America/New_York plus TASK_KEY. Only enabled
  lanes have a live line. Missed windows are never caught up.
- `scheduler.js` — one-minute daemon; a second copy exits. Heartbeat and pid
  under `/home/box/chatgpt-lanes`.
- `run-lane.sh` — `flock -n` per task, lean clone of forge-coordination, prompt
  from the published shared entry + procedure + this task's registry entry,
  credit-floor check ($20), no Grok/Cursor/paid fallback, no forced dispatch.
- `start.sh` — copies this directory to `/home/box/chatgpt-lanes/runner` and
  starts the scheduler if it is not already running. `--copy-only` just copies.
  ChatGPT's turnstart hook calls `start.sh` so the daemon restarts after a box
  refresh.

Intake A/B, Claude enrichment, the shared helper, and the grant backlog worker
are not in this scheduler. Outcome, enrichment research, and the drain lanes
are mapped but held until a fresh TIMMAY/cloud readback shows no live copy and
(for drain) a published cadence exists.

Tests: `node --test tools/chatgpt-box-runner/*.test.js`
