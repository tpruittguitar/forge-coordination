# Stage 25: candidates for Tim's approval (DRAFT, nothing submitted)

Built 2026-10-23 from discovery run `FORGE-SOURCE-TRIAL-20261023T0131Z` (boards + JobSpy + HiringCafe, archive-aware) and a read-only
pull of the live Writer (master 1,703, archive 785, rules `876a618c…`, Writer build `4e011a9`). Machine-readable:
`receipts/STAGE25_CANDIDATES_DRAFT_20261023.json` (approval flags false until you approve).

## How they were chosen
1. 323 provisional NEW roles → the **deployed Writer's own `planIntake`** on the live master + archive: 300 would insert.
2. Director+ / Senior Manager, core target functions only (production, manufacturing, quality, plant, test/manufacturing engineering,
   commissioning, operational excellence); no accounting/HSE/strategy/software/supply-chain titles; not West Coast or Memphis;
   no staffing agencies; at most 2–3 per employer.
3. Posting checked **live** on the employer's ATS (Greenhouse / Ashby / Workday) or the posting page (LinkedIn / HiringCafe), and the
   employer description taken from the posting itself; employers whose description matches Never Consider industries excluded.
4. Removed on review: i-Pharm Consulting (pharma recruiter), ALAC HR Solutions (agency), Powerfleet (software), Diamond Generating
   (power-plant operations), Southern Industrial Constructors (construction), Panther Life Sciences (drug delivery), and Power Flame
   (same Parsons KS job as its parent ASTEC).
5. Sequential Writer dry run of all 24 with inserts carried forward: **24 clean predicted inserts**, no Never Consider rule or review
   flag, no duplicates within the batch. These are predictions; only the live run's receipts and readbacks prove insertion.

## The 24
| # | Employer | Role | Location | Level | Source | Employer business (from the posting) |
|---|---|---|---|---|---|---|
| 1 | Anduril Industries | Deputy Head of Production, Intelligence Systems | Ashville, Ohio, United States | Director+ | Board (greenhouse) | Anduril Industries is a defense technology company with a mission to transform U.S. and allied military capabi… |
| 2 | Stanley Black & Decker | Plant Manager | Stanfield, NC, United States | Director+ | Board (workday) | Our portfolio features industry-leading brands such as Avdel®, Integra™, Nelson®, Optima®, POP®, and Tucker®. … |
| 3 | Reframe Systems | Plant Manager - Net Zero Modular Construction | Billerica, MA | Director+ | Board (ashby) | ABOUT US Reframe Systems is a Physical AI and robotics company on a mission to make high-performance housing a… |
| 4 | Saronic Technologies | Commissioning Chief Engineer, Marauder | Franklin, LA | Director+ | Board (ashby) | Saronic Technologies is a leader in revolutionizing autonomy at sea, dedicated to developing state-of-the-art … |
| 5 | GLOBALFOUNDRIES | Deputy Director, Digital Manufacturing Transformation | USA - New York - Malta | Director+ | Board (workday) | Deputy Director, Digital Manufacturing Transformation Malta, NY About GlobalFoundries: GlobalFoundries is a le… |
| 6 | Anduril Industries | Sr. Manager, Manufacturing Test Engineering (Intelligence Systems) | Ashville, Ohio, United States | Sr Manager | Board (greenhouse) | Anduril Industries is a defense technology company with a mission to transform U.S. and allied military capabi… |
| 7 | Carrier | Sr. Manager, Quality Data Intelligence & Project Management | CAN05: CCS-Charlotte, 5900 Northwoods Busines | Sr Manager | Board (workday) | HVAC, aerospace, or related industries preferred. Demonstrated experience leading cross-functional projects an… |
| 8 | Innodyne Systems | Director of Quality | Bloomfield, CT, USA | Director+ | Jobspy (linkedin) | The Director of Quality is responsible for leading and managing all quality assurance, regulatory compliance, … |
| 9 | FEAM Aero | Director of Quality - MIA | Miami, FL, USA | Director+ | Jobspy (linkedin) | FEAM Aero is currently seeking an experienced Director of Quality to join our Miami, FL team. We pride ourselv… |
| 10 | Prometheus Energetics | Director of Quality | Bloomington, IN, USA | Director+ | Jobspy (linkedin) | DIRECTOR OF QUALITY About Prometheus Energetics Prometheus Energetics is an independent U.S.-based merchant su… |
| 11 | XP Power | Director of Quality | High Bridge, NJ, USA | Director+ | Jobspy (linkedin) | We are committed to our culture that values Customer Focus, Flexibility, Knowledge, Speed and Integrity. Joini… |
| 12 | HexArmor | Vice President of Manufacturing, Compliance & Integration | Grand Rapids, MI, USA | Director+ | Jobspy (linkedin) | COMPANY OVERVIEW HexArmor® is a leader in developing some of the most advanced PPE solutions for your eyes, ha… |
| 13 | Northrop Grumman | Manufacturing Operations Director | Salt Lake City, UT, USA | Director+ | Jobspy (linkedin) | ink is impossible. Our employees are not only part of history, they're making history. Northrop Grumman Missio… |
| 14 | Mott Corporation | Director of Manufacturing, High Purity | Farmington, CT, USA | Director+ | Jobspy (linkedin) | r, you’ve found it. Whether you’re an experienced professional, a recent college graduate or somewhere in betw… |
| 15 | ASTEC | Director, Manufacturing | Parsons, KS, USA | Director+ | Jobspy (linkedin) | BUILT TO CONNECT Astec is a global, environmentally focused infrastructure and manufacturing company of asphal… |
| 16 | Revolution Sustainable Solutions, LLC | Plant Manager | Mesquite, TX, USA | Director+ | Jobspy (linkedin) | provement while maintaining high standards for safety, quality, productivity, and customer service. The ideal … |
| 17 | Safe Fleet | FRC Plant Manager | Nesconset, NY, USA | Director+ | Jobspy (linkedin) | nset, NY New York Annual Salary Range: $145,000 - $175,000 USD Position Summary FRC , a Clarience Technologies… |
| 18 | Quikrete | Plant Manager | Peachland, NC, USA | Director+ | Jobspy (linkedin) | We are looking for a Plant Manager to join our team in Peachland, North Carolina , in the Charlotte area. As a… |
| 19 | IPEX by Aliaxis | Plant Manager - Extrusion | Pineville, NC, USA | Director+ | Jobspy (linkedin) | IPEX is one of the North American leading providers of advanced plastic piping systems. Our mission is to shap… |
| 20 | CHEP | Plant Manager | Pendergrass, GA, USA | Director+ | Jobspy (linkedin) | The Plant Manager provides the leadership, management, and vision necessary to ensure operating efficiency and… |
| 21 | ERock | Plant Manager, Manufacturing Operations | Houston, TX, USA | Director+ | Jobspy (linkedin) | Job Type Full-time Description We are ERock! ERock is a leader and innovator in distributed energy. ERock has … |
| 22 | Ash Grove Cement Company | Plant Manager | Louisville, NE, USA | Director+ | Jobspy (linkedin) | Job ID: 529086 Ash Grove family of companies is one of North America's leading cement manufacturers, with a le… |
| 23 | CRH | Plant Manager | Kennedale, TX, USA | Director+ | Jobspy (linkedin) | Job ID: 529948 Exempt Oldcastle, a CRH company, is reinventing what's possible in building solutions. We are t… |
| 24 | Resource Label Group | Plant Manager | Minneapolis, MN, USA | Director+ | Jobspy (linkedin) | Resource Label Group is seeking a Plant Manager for our Brooklyn Center, MN Operations team who will be respon… |

## If approved
Approval flags set; release switch armed as `STAGE` (`SOURCE_INTAKE_STAGE_V1`, `maxBatch: 25`, `approvedBy`); `canary-cli.js snapshot before
--mode STAGE`, `auto` (one Writer transaction at a time; waits read-only for each receipt), `snapshot after`, `finalize`; switch disarmed.
Any UNKNOWN / HOLD stops the run. Unknown pay, degree and FLEX go in as `INITIAL_UNKNOWN_FIELDS` for enrichment.
