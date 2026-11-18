# Sniffer hourly shared-helper runner (box only)

`run.cjs` pages the available `FORGE_SNIFFER_SHARED_HELPER` lane with `shared.next`, produces one research-only batch of up to 20 items, validates it, and publishes only that receipt on an exact `sniffer-shared-helper-batch-*` branch. The existing coordinator harvests that branch without a PR/merge. No Writer call, Writer authority, master write, or AI agent turn is involved. No new GitHub Actions workflow is added. The hourly loop is supplied, **not started**.

## Start / stop

After #448 and this PR merge, in a checkout of the repo:

```sh
mkdir -p /workspace/sniffer-shared-helper
touch /workspace/sniffer-shared-helper/LIVE
setsid nohup tools/sniffer-shared-helper/loop.sh >/workspace/sniffer-shared-helper/launcher.log 2>&1 &
```

The script holds `flock` for its entire lifetime (including sleeps), uses its own lean checkout, and waits until an hour after each run began. Remove `/workspace/sniffer-shared-helper/LIVE` to stop it at the next check. It may finish the current bounded research batch before stopping. `runner.log` records run results. `SNIFFER_STATE_DIR` and `SNIFFER_REPO_DIR` can isolate a different installation; the latter must be a disposable runner-owned clone because the loop resets it to main.

## Free tool contract

The box tool is `/home/box/.local/bin/research`, which executes `python3 /home/box/tools/research/research.py`. `/home/box/tools/research` itself is a directory, not an executable. The runner uses `--batch -`; it never opts in to OpenAI credit, strips `RESEARCH_OPENAI_CREDIT` and `OPENAI_API_KEY`, and removes `GEMINI_API_KEY`. It fails closed if OpenAI opt-in is disabled in the tool's config. It reuses tool caches. Cached research is accepted only when its literal quote is also in a cached source page. Research exit 75 leaves the item for a later run; the tool's own queue remains intact. No key is read or written by this runner.

The free tool and its provider credentials are installed on this shared box. The code makes no assumption that they exist in GitHub-hosted CI. CI runs only deterministic unit tests with fake answers, never live research.

## Scope / limits

- Research only on assigned enrichment SALARY and DEGREE gaps. FIT-only, LINKS-only, INTAKE and DISCOVERY items stay assigned for Sniffer's existing specialist handling. There is no reliable deterministic mapper from free-form answers to those contracts yet.
- Annual dollar salary ranges are returned only from source-stated facts; the coordinator still independently checks employer identity and the source. Hourly and other currencies are left unresolved.
- Literal degree quotes are returned without inventing a waiver, `DEGREE_REQ`, or `FLEX_CLASS`. Writer derives classifications on its normal path.
- An unchanged delivered item is not re-researched. An item with no usable evidence waits 24 hours. Assignment/source-version changes reopen it. A provider limit never becomes proof that a posting is absent or dead.
- Actual posting text, not the model's answer, is the capture. Fields in one evidence item must come from the same URL. Every batch and item says `writerSubmitted:false`.
- Results and progress are saved only after successful receipt delivery. If delivery fails, research is cached by the free tool for a later retry.
- The targeted-posting lookup port from #450 is a separate manual tool. This runner does not publish `state/targeted-posting-lookup.json` or invoke its JobSpy/HiringCafe pipeline. The code is available for Sniffer; there is no implied second scheduled data writer.

Tests: `node --test tools/sniffer-shared-helper/*.test.cjs`; `bash -n tools/sniffer-shared-helper/loop.sh`.
