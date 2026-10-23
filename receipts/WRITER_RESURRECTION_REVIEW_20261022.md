# Live master rows that match a role Tim declined or was rejected for. For Tim's review (2026-10-22)

Read-only scan of the live Writer master (1,677 rows) and terminal archive (785 rows), pulled 2026-10-23 00:04 UTC.
A row is listed when a **live** `SCOUT_INTAKE` / `DISCOVERY_LEAD` / `MANUAL_RESEARCH` row has the same normalized
employer, title and location (Writer `normEmployer` / `normTitle` / `normLocation`) as an archived `DECLINED_BY_TIM` or
`REJECTED_BY_EMPLOYER` row. **No master data has been changed.**

"Old" and "new" are what the Writer would do if the row arrived again today, before and after
[foreman-cockpit#186](https://github.com/tpruittguitar/foreman-cockpit/pull/186) (REV-196).

## A: Same role resurfaced through a job-board or other non-employer ID (10)
The archived decision should stand. The usual fix is to mark the live row a duplicate of the archived one.

| Live row | Bucket | Added | Employer · Title · Location | Live REQ | Lane | Archived decision | Old → New |
|---|---|---|---|---|---|---|---|
| V2I-82B87E6CCC65 | SCOUT_INTAKE | 10-22 | Anduril · Deputy Head of Production, Autonomous Airpower (Fury) · Ashville, OH | 4465067799 (LinkedIn) | EMAIL_ALERT:LINKEDIN | V2S-ANDURIL-FURY-5577 REJECTED_BY_EMPLOYER, GH-4962385007, ANTI_RESURRECTION=YES | insert → match |
| V2I-3819C935295E | SCOUT_INTAKE | 10-12 | Collins Aerospace (RTX) · Director Chief Manufacturing Engineer (Onsite) · Riverside, CA | 01864912 | FORGE_WEB_CAREER_DISCOVERY | V2F-F5F594869BE2 DECLINED_BY_TIM, LI 4451066339 | insert → match |
| V2I-A7BB44F3C947 | SCOUT_INTAKE | 10-12 | Charge Robotics · Head of Manufacturing · San Leandro, CA | d106977e… (Ashby) | FORGE_WEB_CAREER_DISCOVERY | V2F-08336A3873AE DECLINED_BY_TIM, LI-4425584106 | insert → match |
| V2I-9C35916D78B9 | SCOUT_INTAKE | 10-13 | MetOx International · Head of Manufacturing · Houston, TX | LI-4458047015 | FORGE_GMAIL_ALERT_BODY | V2S-METOX-HOM-5408957008 DECLINED_BY_TIM, GH-5408957008 | insert → match |
| V2I-47A11CE8EFB8 | SCOUT_INTAKE | 10-13 | BLOX · Director of Quality Engineering · Bessemer, AL | LI-4465278765 | EMAIL_ALERT:linkedin | V2L-BLOX-4504149 DECLINED_BY_TIM, Paylocity 4504149 | insert → match |
| V2I-BC1756E256E6 | SCOUT_INTAKE | 10-13 | Re:Build Manufacturing · Plant Manager, Composite Resources · Rock Hill, SC | LI-4445931943 | EMAIL_ALERT:linkedin | V2F-50DC06DFEE73 DECLINED_BY_TIM, GH 4688288005 | insert → match |
| V2I-8BD6239891B2 | SCOUT_INTAKE | 10-13 | Nokia · Director of Manufacturing Quality · Allentown, PA | LI-4399923513 | EMAIL_ALERT:linkedin | V2S-NOKIA-DMQ-34635 DECLINED_BY_TIM, 34635 | insert → match |
| V2I-7506B47A8EAD | SCOUT_INTAKE | 10-13 | Anduril · VP Production, Mission Systems · Costa Mesa, CA | 12461 (internal) | Grok web discovery | V2S-ANDURIL-VPPROD-MS-5199174007 DECLINED_BY_TIM, GH-5199174007 | match → match (fixed 10-13; row predates it) |
| V2I-1F7FCDC7D808 | SCOUT_INTAKE | 10-13 | Anduril · VP Production, Frontier Systems · Costa Mesa, CA | 13466 (internal) | Grok web discovery | V2S-ANDURIL-VPPROD-FRON-5218932007 DECLINED_BY_TIM, GH-5218932007 | match → match (fixed 10-13; row predates it) |
| V2I-9BA77AF06A61 | DISCOVERY_LEAD | 10-07 | Rich Products · Senior Manager, Equipment Engineering · Buffalo, NY | UNCAPTURED | EMAIL_ALERT:indeed | V2F-D4D7153DDFF4 DECLINED_BY_TIM, LI-4470573483 | match → match |

## B: Different employer requisition, so possibly a genuine re-post (2)
These are your call: the same role (keep it declined/rejected) or a new opening (re-evaluate). After REV-196 the Writer holds new arrivals like these as `IDENTITY_CONFLICT` instead of inserting them.

| Live row | Bucket | Added | Employer · Title · Location | Live REQ | Lane | Archived decision |
|---|---|---|---|---|---|---|
| V2I-A5230F14AEB6 | SCOUT_INTAKE | 10-18 | Blue Origin · Lunar Manufacturing & Assembly Manager · Space Coast, FL | R69279 | ChatGPT web discovery | V2I-674D32C11C4C REJECTED_BY_EMPLOYER, R67525, ANTI_RESURRECTION=YES |
| V2I-DAE0286DF646 | SCOUT_INTAKE | 10-11 | Cummins · Site Manufacturing/Quality Leader · Manning, SC | 4403653830 (LinkedIn number) | EMAIL_ALERT:linkedin | V2F-C13210EC3EA5 DECLINED_BY_TIM, Cummins ReqID 2426125 (printed in posting) |

## C: Same identity, but a re-arrival already fails today (2)
| Live row | Bucket | Added | Employer · Title · Location | Live REQ | Archived decision | Note |
|---|---|---|---|---|---|---|
| V2I-B63A6E3384F6 | DISCOVERY_LEAD | 10-06 | Anduril · Director, Manufacturing Engineering · Costa Mesa, CA | 4800095007 | V2S-ANDURIL-DIR-MFG-ENG-4800095007 DECLINED_BY_TIM, GH-4800095007 | Same requisition. Re-arrival is held as ambiguous (several archived copies). |
| V2I-D9044F4A388C | DISCOVERY_LEAD | 10-06 | Tesla · Sr. Manager, Cell Manufacturing, Cathode Production · Austin, TX | UNCAPTURED | V2F-4238AACB194C DECLINED_BY_TIM, req not captured | No requisition on either side. Re-arrival is held as ambiguous. |

## Not changed
No master row was edited, archived or merged. Correcting the 14 rows needs your rulings through the Writer (for example a duplicate resolution against the archived PRIMARY_ID). REV-196 prevents new resurrections once it's deployed; it doesn't clean up existing rows.
