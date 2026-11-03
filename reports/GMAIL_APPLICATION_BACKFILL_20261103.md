# Gmail application backfill: 2026-11-03 (Claude)

Tim's request: "Integrate applications that never made it to the pipeline. Insert the jobs into the master or archived list."

## Method
- Gmail query (application confirmations and rejections, not sent mail) run window by window, 2025-06 through 2026-11-02. 579 threads were classified; noise was dropped (surveys, passport, digests, talent-community signups, incomplete-application reminders).
- Every thread was checked against the master and the archive on three things: a cited Gmail id (hex or thread-f decimal), the employer plus title, and the requisition id.
- Result: 303 threads were already cited by Gmail id and 236 more matched a row by employer and title or req. 40 had no row. Of those 40, 18 were inserted (below) and the rest were classed as already covered or unresolvable (below).
- Before writing, the plan was dry-run locally with the Writer's own `planUpsertBatch_` against the live master and archive (Code.gs). Writes went through POST `upsert_application` with requestIds `GMAILBACKFILL-<gmail id>`. All rows were read back afterward with `row_readback`: 17/17 found exactly once, and all are ANTI_RESURRECTION=YES.

## Rows created (17)
| Row | Employer | Title | State | Applied |
|---|---|---|---|---|
| V2E-D4142173A5A2 | Volkswagen Group of America | Assistant Manager - Assembly Torque Team (4114) | APPLIED | 2025-06-11 |
| V2E-45EA72D0B75F | General Motors | Lead Quality Engineer - Orion Assembly (JR-202607744) | APPLIED | 2026-04-20 |
| V2E-42D80BBD4AA9 | Confidential (LinkedIn 4422784802) | Plant Quality Manager, Missouri | APPLIED | 2026-07-02 |
| V2E-02A467A230D5 | Confidential Careers (LinkedIn 4434351384) | VP of Global Manufacturing Engineering, Malaysia | APPLIED | 2026-07-02 |
| V2E-97DDAFADA493 | Confidential Careers (LinkedIn 4434335900) | VP of Global Manufacturing Engineering, Hong Kong | APPLIED | 2026-07-02 |
| V2E-2446C9F56C79 | Confidential Careers (LinkedIn 4434351410) | VP of Global Manufacturing Engineering, Taiwan | APPLIED | 2026-07-02 |
| V2E-DA29CF3C7FA6 | Trane Technologies | VP, Enterprise Quality (JR-6039) | REJECTED_BY_EMPLOYER (applied and rejected 2026-07-02) | 2026-07-02 |
| V2E-AC62D4622611 | Confidential Global Company (LinkedIn 4462650138) | Director of Quality, Mississippi | APPLIED | 2026-09-11 |
| V2E-28AFFC233F5B | Stealth (LinkedIn 4467209101) | Vice President of Product Development | APPLIED | 2026-09-14 |
| V2E-37312B61EA0C | Confidential (LinkedIn 4461681398) | Vice President Operations, Tennessee | APPLIED | 2026-09-16 |
| V2E-F6D8A763E546 | Focus | Director of Forge Manufacturing Operations | APPLIED | 2026-09-27 |
| V2E-6E34454D78E2 | VinFast | role not named in the email | APPLIED | 2026-06-05 |
| V2E-46EEC9835071 | Tractor Supply Company | role not named in the email | APPLIED | 2026-06-27 |
| V2E-623462F7709E | BAE Systems | role not named in the email | APPLIED | 2026-06-27 |
| V2E-7A1286A83870 | Cyclic Materials | role not named in the email | APPLIED | 2026-06-29 |
| V2E-6139009FDD85 | Gotion | role not named in the email | APPLIED | 2026-07-26 |
| V2E-285A571E5F74 | Lean Focus | role not named in the email | APPLIED | 2026-09-15 |

The Trane row and the Confidential Global Company row were created with CREATE_NEW. Each is a different posting from an existing row with the same title: Trane V2I-038CCCDB28E3 is an October repost (LI-4454274517) that Tim closed, and V2I-3884AF6F5AD5 is LI-4474996008, applied 2026-10-07.

## Not inserted (reasons)
- No-title confirmations at employers that already have recorded applications. Inserting a blank-title row here would likely duplicate a real one, so these were left alone: Slate Auto (2025-07-17, 2026-04-20), PDW (x3), Mohawk, Standard Nuclear (2026-06-30), Google (2026-09-16), Daniel Defense, Icarus (2026-07-27), JetZero, Molex (2026-11-02).
- Rejections that name no role. Each can't be tied to a row safely: Anduril (2026-08-07, 08-17, 08-20) and Slate Auto (2025-07-21, 2026-07-19).
- LinkedIn "application was sent to X" notices with no title, where X already has the matching ATS-recorded application: HIROTEC, Dexter, Path Robotics, Keller, AUTOKINITON, Cartamundi, Volantyx, ResourceTek, Futura, FPC of Brighton.
- Paycom "Director, Enterprise Quality Management Systems" (2026-09-20). The employer isn't named in the email.

## Gaps in the method
- Matching by employer and title plus date is heuristic. A small number of covered verdicts may be wrong, most likely at Tesla, Anduril and Blue Origin, which have many rows.
- Gmail search caps a window at 50 results. Every window that hit the cap was split until it returned fewer.
