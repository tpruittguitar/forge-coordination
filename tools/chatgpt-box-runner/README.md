# ChatGPT box lane scheduler

Runs the Forge AI lanes on the shared Linux box on OpenAI API credits
(`runner=grant`, `gpt-5.4-mini`, reasoning_effort high); `claude -p` and Codex
stay available as documented runners. Modeled on
`tools/claude-box-runner`. Home: `/home/box/chatgpt-lanes` (survives a box
refresh; not under `/workspace/forge-lanes`).

- `lanes.json` — enabled vs held lanes, runner/model/timeout per lane, the
  grant guard (pool, $1.00 floor, Nov 30 23:59 ET expiry, call log) and the
  reasons a lane stays off. `procedure: "runtime:current"` reads the task's file
  from the release in `runtime/current.json`.
- `crontab.txt` — source of truth for box cadence: 5-field cron in
  America/New_York plus TASK_KEY. Backlog, enrichment, discovery and Writer
  gofer lanes run every 30 minutes on staggered minutes; outcome tracking and
  posting validation run hourly. Only enabled lanes have a live line. Missed
  windows are never caught up.
- `scheduler.js` — one-minute daemon; a second copy exits. Heartbeat and pid
  under `/home/box/chatgpt-lanes`.
- `run-lane.sh` — `flock -n` per task, lean clone of forge-coordination, prompt
  from the published shared entry + procedure + this task's registry entry,
  hard $1.00 credit floor, grant refused after Nov 30 23:59 ET, grant calls
  logged to `/workspace/usage-display/ask_grant_calls.jsonl`, no
  Grok/Cursor/paid fallback, no forced dispatch.
- `start.sh` — copies this directory to `/home/box/chatgpt-lanes/runner` and
  starts the scheduler if it is not already running. `--copy-only` just copies.
  ChatGPT's turnstart hook calls `start.sh` so the daemon restarts after a box
  refresh.

cs-92f6a3b0 (Tim 2026-11-26): every AI lane that can run on OpenAI API credits
is enabled here. Intake A/B and Claude enrichment are mapped but held while
`control/AI_AUTOMATION_TASKS.json` carries executionHold
RESERVATION_TRANSPORT_UNAVAILABLE. The shared helpers, the Sniffer free-research
helper, retired Grok tasks and the free zero-AI `enrich-ats-pay` workflow are
not in this scheduler.

Tests: `node --test tools/chatgpt-box-runner/*.test.js`
