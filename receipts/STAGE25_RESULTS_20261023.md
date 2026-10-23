# 24-job source intake stage: results (2026-10-23)

Source run FORGE-STAGE25-20261023, mode STAGE. Before snapshot 2026-10-23T05:24:47.171Z; all 24 cases accounted 2026-10-23T07:55:32.439Z; after snapshot 2026-10-23T07:55:59.960Z. Master 1723 → 1748 rows; no row removed.

## Outcome
- 24 of 24 candidates inserted. Each insert: Writer accepted it, its receipt reached COMPLETE, and the exact row was read back before the next case was sent.
- Final batch reconcile: **HOLD (INSERTED_ID_SET_MISMATCH)**. The master gained 25 new rows, not 24. The 25th is V2I-7A3ABB2292B6 SBM Management Services, Director of Operations, inserted by ChatGPT email lane run FORGE-EMAIL-CHATGPT-20261023-0202ET during the stage. All 24 stage rows are present. The reconcile assumes nothing else writes during a stage; the hourly lanes do.
- Halts: 25 recorded, every one a planned stop (24 waits for a receipt, 1 GitHub API limit at 13/24 on the switch read; resumed at 06:18 UTC with an authenticated switch read). Nothing was re-sent.
- Release switch disarmed on main after the stage (commit 9967246).

## Rows
| # | Company | Title | Location | PRIMARY_ID | Request ID |
|---|---|---|---|---|---|
| 1 | Anduril Industries | Deputy Head of Production, Intelligence Systems | Ashville, Ohio, United States | V2I-0E62F3C3A402 | FORGE-SOURCE-B67B721EC3EA6623C33ED427 |
| 2 | Stanley Black & Decker | Plant Manager | Stanfield, NC, United States | V2I-33CB4353B0F7 | FORGE-SOURCE-1A440A97D6D440E95F81B666 |
| 3 | Reframe Systems | Plant Manager - Net Zero Modular Construction | Billerica, MA | V2I-80EE032F22D6 | FORGE-SOURCE-9F55B9DDC60C50F5788C37F2 |
| 4 | Saronic Technologies | Commissioning Chief Engineer, Marauder | Franklin, LA | V2I-98E3DCF7F2AA | FORGE-SOURCE-E8406D149BFA799126ACE97E |
| 5 | GLOBALFOUNDRIES | Deputy Director, Digital Manufacturing Transformation | USA - New York - Malta | V2I-80C55589AF80 | FORGE-SOURCE-255D01778897C64791ED9048 |
| 6 | Anduril Industries | Sr. Manager, Manufacturing Test Engineering (Intelligence Systems) | Ashville, Ohio, United States | V2I-663C7AE85AB9 | FORGE-SOURCE-5C2CADFA77D8E00735F9C99D |
| 7 | Carrier | Sr. Manager, Quality Data Intelligence & Project Management | CAN05: CCS-Charlotte, 5900 Northwoods Business Parkway, Charlotte, NC, 28269 USA | V2I-432C1D29B876 | FORGE-SOURCE-B70201F43521F83FE1D87A60 |
| 8 | Innodyne Systems | Director of Quality | Bloomfield, CT, USA | V2I-E198665EE62E | FORGE-SOURCE-E096EA49848D249A431E9108 |
| 9 | FEAM Aero | Director of Quality - MIA | Miami, FL, USA | V2I-2EFED90E9C5A | FORGE-SOURCE-7176E28B76C2398BBD96E2BD |
| 10 | Prometheus Energetics | Director of Quality | Bloomington, IN, USA | V2I-F51E11D2C7FF | FORGE-SOURCE-AD06DA64A46F67AC05AAAA42 |
| 11 | XP Power | Director of Quality | High Bridge, NJ, USA | V2I-E63411E51E63 | FORGE-SOURCE-BC426E8E2629056BCB782E8D |
| 12 | HexArmor | Vice President of Manufacturing, Compliance & Integration | Grand Rapids, MI, USA | V2I-E1F7D1C88E6A | FORGE-SOURCE-1B14F8A9ECF7706B747005EF |
| 13 | Northrop Grumman | Manufacturing Operations Director | Salt Lake City, UT, USA | V2I-3673CBC7020E | FORGE-SOURCE-42226728C3FEA85383FC2DA5 |
| 14 | Mott Corporation | Director of Manufacturing, High Purity | Farmington, CT, USA | V2I-296DDFC5D0DB | FORGE-SOURCE-86338F0F9644905BC5F66889 |
| 15 | ASTEC | Director, Manufacturing | Parsons, KS, USA | V2I-97A1A7F59437 | FORGE-SOURCE-C1AE30E589B5B2391F452293 |
| 16 | Revolution Sustainable Solutions, LLC | Plant Manager | Mesquite, TX, USA | V2I-23382AE2ED40 | FORGE-SOURCE-6D4205AB0EB8FDF6AD3D0BB2 |
| 17 | Safe Fleet | FRC Plant Manager | Nesconset, NY, USA | V2I-3A789FBF6C16 | FORGE-SOURCE-CBDD56FF37B0857044AB2476 |
| 18 | Quikrete | Plant Manager | Peachland, NC, USA | V2I-10C5D4518D38 | FORGE-SOURCE-76184B72C1057BD704AE0317 |
| 19 | IPEX by Aliaxis | Plant Manager - Extrusion | Pineville, NC, USA | V2I-839CC95D57CB | FORGE-SOURCE-5C272CFA2C2CCBAADFD5B331 |
| 20 | CHEP | Plant Manager | Pendergrass, GA, USA | V2I-962B8A81CF60 | FORGE-SOURCE-69E9E697FE3F9E03E76BF050 |
| 21 | ERock | Plant Manager, Manufacturing Operations | Houston, TX, USA | V2I-7F56B1A9A86E | FORGE-SOURCE-6D61066043F2A4A1BCE7AEE0 |
| 22 | Ash Grove Cement Company | Plant Manager | Louisville, NE, USA | V2I-B184841C3989 | FORGE-SOURCE-EB5D906C36686D019E5BC9C8 |
| 23 | CRH | Plant Manager | Kennedale, TX, USA | V2I-FD595F57D5C5 | FORGE-SOURCE-643F768F2D3AB03AB56B7290 |
| 24 | Resource Label Group | Plant Manager | Minneapolis, MN, USA | V2I-2665BCE4101D | FORGE-SOURCE-74730EE0BDCBD04AE3ED9831 |

## Follow-ups
- The executor re-reads the release switch without GitHub auth for every case, resumed ones included (60 reads an hour). Fix before a 200-job stage.
- The batch reconcile should accept rows other lanes inserted during the stage, when they are attributable to another run.
