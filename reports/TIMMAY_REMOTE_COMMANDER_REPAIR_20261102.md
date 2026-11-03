# TIMMAY Remote Desktop Commander repair — 2026-11-02 (Claude, Tim-authorized)

Machine: TIMMAY, Windows 11 Home, user timmay\tim. Work was done through Claude's desktop-app link (non-elevated shell).

## Root cause (FACT)

1. **The remote agent wedged silently.** The process was `npx @wonderwhy-er/desktop-commander@0.3.0 remote`, launched by the scheduled task "Forge Remote Desktop Commander" at logon.
   - At 2026-11-02 13:05:59Z (08:05 ET) it received a tool call. Its log (`~\.desktop-commander-device\remote-mon.log`) wrote nothing after that.
   - Its 5-minute `last_seen` heartbeat stopped, and the process held 0 TCP connections. The server therefore showed the device OFFLINE.
   - The process itself stayed alive, so the scheduled task kept reporting "Running".
2. **The supervisor could not detect it.** `Workstation-Supervisor.ps1` counted Desktop Commander as OK whenever the task state was "Running". A wedged agent was never restarted.
3. **Latent:** the Commander task is the only Forge task with StopIfGoingOnBatteries=True and DisallowStartIfOnBatteries=True.

## Existing startup architecture (unchanged)

These are logon-triggered, Interactive tasks under `%LOCALAPPDATA%\Forge`:

| Task | Runs | RunLevel |
|---|---|---|
| Forge Remote Desktop Commander | `Start-RemoteCommander.cmd` | Highest |
| Forge Workstation Supervisor | `Workstation-Supervisor.ps1`, 60 s loop | Limited |
| Forge PC Keep-Alive | `Forge-PC-KeepAlive.ps1` | Limited |
| Forge AI Desktop Startup | `AI-Startup-Orchestrator.ps1` | — |
| Forge Chrome AI Tabs | — | — |

No new startup system was created.

## Changes

- **`Workstation-Supervisor.ps1` (rewritten in place).**
  - Desktop Commander health is now the agent's own heartbeat: the newest `remote-*.log` must have been written within 15 min.
  - When the heartbeat is stale or the task is not running, the supervisor stops and restarts the scheduled task. Task Scheduler ends the elevated tree, and there is a 10-minute cooldown between attempts.
  - All other checks are unchanged.
  - Backup: `Workstation-Supervisor.ps1.before-heartbeat-20261102-2207.bak`.
- **Task XML backups:** `Task-Forge-Remote-Desktop-Commander.before-heartbeat-20261102-2207.xml` and `Task-Forge-Workstation-Supervisor.before-heartbeat-20261102-2207.xml`.
- **NOT changed:**
  - Commander battery settings: Tim set StopIfGoingOnBatteries=False and DisallowStartIfOnBatteries=False from an admin shell at 22:31 ET (Claude's non-elevated attempt was denied). Claude verified both values from TIMMAY; the task kept running and the heartbeat stayed current (03:31:39Z).
  - Power settings, firewall, credentials, Forge code, pipeline data and Writer configuration.

## Verification

| Test | Result |
|---|---|
| Live wedge recovery | PASS. The new supervisor logged STALE (843 min) at 22:09:11 and restarted the task at 22:09:33. The agent logged "Desktop Commander Remote is connected / Status: Online" at 03:09:54Z and channel joined at 03:10:04Z. last_seen heartbeats followed at 03:14:54Z and 03:19:54Z. The wedged process is gone. |
| Termination recovery | PASS. Stop-ScheduledTask at 22:21:21; the supervisor restarted the task at 22:21:30; the channel rejoined at +36 s. |
| No duplicate instances | PASS. One running instance after each restart, and the task setting MultipleInstances=IgnoreNew. |
| Claude access | PASS through the Claude desktop-app link; every command in this report ran there. Claude does not use the DC remote device. |
| ChatGPT access | PASS 2026-11-02 22:24 ET (reported by ChatGPT). The connector showed TIMMAY Online, and `Get-Date; $env:COMPUTERNAME` returned "Monday, November 2, 2026 10:24:13 PM / TIMMAY". No changes were made. |
| Grok access | PASS 2026-11-02 22:25 ET (reported by Grok). Desktop Commander showed TIMMAY Online, device ID b3d2ef5c-fe82-4ea8-bdbb-5667b2021ca5 (matches the local device.json), app 0.3.0. `Get-Date; $env:COMPUTERNAME` returned "Monday, November 2, 2026 10:25:20 PM / TIMMAY". |
| Network-drop recovery | PENDING. Not run because it would cut this session. The agent has built-in channel reconnect; if it wedges instead, the heartbeat check restarts it within about 15–25 min. |
| Reboot / normal startup | PENDING (disruptive). |
| Signed-out or other user | LIMITATION. All Forge tasks use logon triggers in Tim's interactive session. Locked is fine; signed out means no remote access. Changing that would need stored credentials, so it was not done. |
| Sleep | On AC, sleep and hibernate are set to never and Keep-Alive holds the system awake. On battery, Keep-Alive releases and the laptop sleeps, which ends remote access. The lid-close action could not be read with powercfg. If the lid is closed while plugged in, check that Windows is set to "Do nothing". |

## Rollback

```powershell
$d="$env:LOCALAPPDATA\Forge"
Copy-Item "$d\Workstation-Supervisor.ps1.before-heartbeat-20261102-2207.bak" "$d\Workstation-Supervisor.ps1" -Force
Stop-ScheduledTask 'Forge Workstation Supervisor'; Start-ScheduledTask 'Forge Workstation Supervisor'
```

No task definitions were changed, so no task rollback is required.
