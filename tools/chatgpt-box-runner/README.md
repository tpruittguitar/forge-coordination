# ChatGPT box lane scheduler

Runs Forge AI lanes on the shared Linux box. As of cs-7a534ad2, only
`FORGE_CHATGPT_ENRICHMENT_RESEARCH` is enabled. It runs on the Codex
subscription at minute 6 of every even hour Eastern, with no OpenAI API
credit spend. The discovery and other credit-only lanes are paused at the
$1.00 credit floor. Home: `/home/box/chatgpt-lanes`.

- `lanes.json` — enabled vs held lanes, runner/model/timeout per lane, the
  grant guard (pool, $1.00 floor, Nov 30 23:59 ET expiry, call log) and the
  reasons a lane stays off. `procedure: "runtime:current"` reads the task's file
  from the release in `runtime/current.json`.
- The live `/home/box/chatgpt-lanes/runner/crontab.txt` controls box dispatch.
  The checked-in `crontab.txt` still reflects the earlier grant cadence and
  was not changed in cs-9c170bde. Do not deploy the checked-in runner directory
  to the live box as part of a JSON-only sync. Missed windows are never caught up.
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

Intake A/B and Claude enrichment also remain held by
`RESERVATION_TRANSPORT_UNAVAILABLE` in `control/AI_AUTOMATION_TASKS.json`.

Tests: `node --test tools/chatgpt-box-runner/*.test.js`
