# DRAFT: Tim's DUPLICATE rulings for resurfaced roles (NOT SUBMITTED)

Prepared 2026-10-22 from the read-only Writer pull at 2026-10-23 00:04 UTC. Machine-readable draft:
`receipts/TIM_DUPLICATE_RULINGS_DRAFT_20261022.json`. **Nothing has been sent to the Writer. It contains no Writer key.**

Each ruling is the Writer's own contract: `{action:"ruling", ruling:{primaryId, requestId, kind:"DUPLICATE", dupOf, actor:"TIM", note}}`,
wrapped in one `batch` (at most 50 rulings, one commit). Each was dry-run with the Writer's own `mutateRow` on the live row:
every one results in `DUPLICATE / DUPLICATE_CANDIDATE/DUP_OF <archived id>`. Request IDs are deterministic
(`TIM-DUPLICATE-20261022-<PRIMARY_ID>`), so a replay is a no-op. Blue Origin and Cummins are excluded, as you asked (re-evaluate them).

## Recommended: same posting, still open, you declined, nothing new (5)
| Live row | Employer · Role | → dupOf (your decision) | Evidence |
|---|---|---|---|
| V2I-7506B47A8EAD | Anduril · VP Production, Mission Systems | V2S-ANDURIL-VPPROD-MS-5199174007 (DECLINED_BY_TIM) | The same Greenhouse posting 5199174007 is both rows, open since 2026-09-02 |
| V2I-1F7FCDC7D808 | Anduril · VP Production, Frontier Systems | V2S-ANDURIL-VPPROD-FRON-5218932007 (DECLINED_BY_TIM) | The same Greenhouse posting 5218932007 is both rows, open since 2026-09-02 |
| V2I-BC1756E256E6 | Re:Build · Plant Manager, Composite Resources | V2F-50DC06DFEE73 (DECLINED_BY_TIM) | Greenhouse 4688288005 open since 2026-04-23; the live row is a LinkedIn re-promotion of it |
| V2I-3819C935295E | Collins Aerospace (RTX) · Director Chief Manufacturing Engineer | V2F-F5F594869BE2 (DECLINED_BY_TIM) | The LinkedIn listing you declined (4451066339) is still open; the live row is the employer's Workday posting |
| V2I-9BA77AF06A61 | Rich Products · Senior Manager, Equipment Engineering | V2F-D4D7153DDFF4 (DECLINED_BY_TIM) | The LinkedIn listing you declined (4470573483) is still open |

## Held for your decision: possible second chance or new information (5)
A ruling is prepared for each in case you decide it's the same role. **They aren't in the recommended batch.**
| Live row | Employer · Role | Your earlier decision | Why it may be worth another look |
|---|---|---|---|
| V2I-82B87E6CCC65 | Anduril · Deputy Head of Production, Autonomous Airpower (Fury) | REJECTED_BY_EMPLOYER 2026-09-14 (ANTI_RESURRECTION=YES) | The same requisition is still open a year after first posting and was re-promoted on LinkedIn ~10 h ago. A possible avenue to be reconsidered. |
| V2I-A7BB44F3C947 | Charge Robotics · Head of Manufacturing | DECLINED_BY_TIM | The LinkedIn listing you declined is closed; a live employer Ashby posting exists. Possibly re-listed. |
| V2I-9C35916D78B9 | MetOx International · Head of Manufacturing | DECLINED_BY_TIM, PAY_BELOW_FLOOR | Reposted on LinkedIn ~1 week ago; the original posting can't be verified. Pay may have changed. |
| V2I-47A11CE8EFB8 | BLOX · Director of Quality Engineering | DECLINED_BY_TIM (reason never normalized) | The original Paylocity posting can't be verified. |
| V2I-8BD6239891B2 | Nokia · Director of Manufacturing Quality | DECLINED_BY_TIM (no reason recorded) | The original posting can't be verified. |

## Before anything is submitted
1. You approve the exact rows (the recommended 5, plus any held ones you rule "same role").
2. Re-pull the live master read-only and re-run the dry run; submit only if every row is unchanged.
3. Submit through the Writer's batch endpoint, then verify with the receipt index and row readback.
