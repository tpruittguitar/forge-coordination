# forge-coordination

Shared working area for the Forge pipeline lanes (Claude, Grok, ChatGPT). Public by Tim's decision (2026-10-12).
Plan: `FORGE_PLAN_GitHub_Migration_2026-10-12.txt` + `_ADDENDUM_1` (Drive, AI_Coordination). Until the Stage 2 cutover, the Drive files remain the live authorities; nothing here is live yet.

## Folders
| Folder | What goes here | Who writes |
|---|---|---|
| `receipts/` | One new run receipt per lane run | Each lane, its own files only |
| `handoffs/` | Evidence handoffs (COMP, ARCHIVE, email findings) | Producing lane |
| `directives/` | Tim rulings and directives, plain text | Claude or Tim, on Tim's instruction |
| `proposals/` | Proposed policy or control changes awaiting Tim | Any lane |
| `edit-requests/` | Requests to change an existing file (see below) | Any lane |

## Rules for every lane
1. **Label every commit.** The message starts with PROVIDER and RUN_ID, e.g. `GROK FORGE-ENRICH-FEASIBILITY-GROK-20261012-1435ET: ...`. Every commit's author shows as `tpruittguitar`, so the label is the only way to tell lanes apart.
2. **Create, do not edit.** Lanes write new files (receipts, handoffs, proposals). Never edit another lane's file.
3. **To change an existing file**, either edit it directly (passing its current SHA), or create an edit request: a new file `edit-requests/<PROVIDER>_<YYYYMMDD_HHMM>ET.json`:
   ```json
   {"target": "path/to/file", "mode": "append", "content": "text to add\n",
    "base_blob_sha": "<current SHA of the target, optional but recommended>",
    "requested_by": "<PROVIDER> <RUN_ID>"}
   ```
   `mode` is `append` or `replace`. The `apply-edit-requests` Action applies it within about a minute, moves it to `edit-requests/applied/` (or `rejected/` with the reason), and opens an issue on any rejection.
4. **Single-owner files** (CONTROL, ENTRY, once moved) change only on Tim's instruction.
5. **Report only real SHAs.** Claude spot-checks reported SHAs against `git log`.

## Related repos
- `tpruittguitar/forge-policy`: rules, geo floors, scoring, FLEX, salary estimation, Never-Consider. Grok and ChatGPT work there on `backup/<provider>-<time>` branches with a pull request; Tim merges.
- `tpruittguitar/foreman-cockpit`: Pipeline Explorer and Writer code (Cloudflare deploys from `main`). Same backup-branch rule.
