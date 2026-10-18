# forge-coordination

Shared working area for the Forge pipeline lanes (Claude, Grok, ChatGPT). Public by Tim's decision (2026-10-12).
Live instructions are on GitHub. Native tasks enter through [ENTRY](control/FORGE_AUTOMATION_ENTRY.txt), read [the current manifest](runtime/current.json), and load exactly one generated lane packet. Current operational sources are in `policy/current/`; CONTROL and STANDARD are historical references, not worker read dependencies. Business policy remains in `forge-policy`; the live receipt index is in `forge-writer-state`. Master, queue, freeze and processed RESULT files remain on Drive.

Maintainers: [build, validation, rollout, limits and rollback](docs/INSTRUCTION_RUNTIME.md). A repository update does not prove native task adoption or change schedules.

## Folders
| Folder | What goes here | Who writes |
|---|---|---|
| `receipts/` | One new run receipt per lane run | Each lane, its own files only |
| `handoffs/` | Evidence handoffs (COMP, ARCHIVE, email findings) | Producing lane |
| `directives/` | Tim rulings and directives, plain text | Claude or Tim, on Tim's instruction |
| `proposals/` | Proposed policy or control changes awaiting Tim | Any lane |
| `policy/current/` | Current common rules, lane procedures, provider adapters and registry | Reviewed instruction PR on Tim's instruction |
| `runtime/` | Generated manifest and immutable release packets | Build script; never hand edit |
| `lanes/` | Generated legacy pointers; standalone Claude usage reader | Build script / authorized maintainer |
| `state/` | Generated discovery hints; never live Writer state | Receipt-index Action |
| `edit-requests/` | Requests to change an existing file (see below) | Any lane |

## Rules for every lane
1. **Label every AI commit.** Start with PROVIDER and RUN_ID, e.g. `GROK FORGE-ENRICH-FEASIBILITY-GROK-20261012-1435ET: ...`. Existing APPLY-BOT and new INDEX-BOT labels identify mechanical workflow commits.
2. **Create, do not edit.** Lanes write new files (receipts, handoffs, proposals). Never edit another lane's file.
3. **Existing files require explicit scope.** Instruction/code changes use reviewed PRs. Edit requests may update only authorized `proposals/` or `usage/` targets: create `edit-requests/<PROVIDER>_<YYYYMMDD_HHMM>ET.json`:
   ```json
   {"target": "proposals/example.txt", "mode": "append", "content": "text to add\n",
    "base_blob_sha": "<required current blob SHA when target exists>",
    "requested_by": "<PROVIDER> <RUN_ID>"}
   ```
   `mode` is `append` or `replace`. The Action rejects authority/generated-state/immutable-evidence targets, applies allowed revisions, moves requests to `applied/` or `rejected/`, and opens an issue on rejection. Claimed `requested_by` is attribution, not approval authority.
4. **Instruction sources and generated releases** change only on Tim's instruction through a reviewed PR. Run `python scripts/build_runtime.py`, tests, then `python scripts/build_runtime.py --check`; commit source and generated outputs together. Tim merges. Never rewrite a published release.
5. **Number every change.** Take the next REV from `control/CHANGE_REGISTER.txt`; the PR title starts `REV-NNN · `; add the register line in the same PR or commit.
6. **Report only real SHAs.** Claude spot-checks reported SHAs against `git log`.

## Related repos
- `tpruittguitar/forge-policy`: rules, geo floors, scoring, FLEX, salary estimation, Never-Consider. Grok and ChatGPT work there on `backup/<provider>-<time>` branches with a pull request; Tim merges.
- `tpruittguitar/foreman-cockpit`: Pipeline Explorer and Writer code (Cloudflare deploys from `main`). Same backup-branch rule.
