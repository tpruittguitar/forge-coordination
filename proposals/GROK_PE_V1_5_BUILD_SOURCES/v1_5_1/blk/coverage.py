sec("06","App Coverage")
SITE='''<span class="k">PIPELINE</span>  t=pipeline
├─ Jobs                 p=OPEN                 queue 578 · stat cards · table · job map · drawer
├─ Review queue         p=NEEDS_TIM            50 “Needs decision”
├─ Decline candidates   p=DECLINE_CANDIDATES   8
├─ My rulings           p=RULED                0 · empty map overlay
├─ Map                  m=1                    fullscreen map of current view
├─ Trends               t=reports              “Pipeline reports”
└─ Compare              modal                  Compare roles · 0/3
   <span class="c">Job drawer tabs: Overview · Posting · Fit &amp; Score · Application · Documents · History</span>
<span class="k">INTAKE</span>
├─ Scout results        t=quality              charts · cohort outcomes · scout quality
├─ Scout intake         p=SCOUT_INTAKE         426
├─ Discovery leads      p=LEADS                102
├─ Manual intake        t=intake               + ADD JOB LINK · worker status
└─ Target companies     t=companies            38 · SECTION=TARGET_COMPANIES
<span class="k">SYSTEM</span>    t=automations
├─ Dashboard · Work queue · Intake coverage · Verification &amp; recovery
├─ Schedules · Diagnostics (= Health)          <span class="c">repeated as top tabs</span>
├─ Incidents                                   3 unfinished operations
├─ Writer connection    t=settings             <span class="c">also ⚙ gear</span>
└─ System drawer                               <span class="c">bell · rail Status · Writer pill</span>
<span class="k">SETTINGS</span>
├─ Flex policy &amp; scoring  t=scoring          <span class="c">“Pay &amp; location” = anchor here</span>
├─ Rules (Advanced)     t=rules                19 sections · TIM_PIPELINE_RULES_CANONICAL v4
├─ Display &amp; columns                         ~150 fields · local
└─ Documents            <span class="c">“Resume &amp; ATS” = same view</span>   library · ATS proxy
<span class="k">GLOBAL</span>    top bar · left rail · LAYOUT mode · View &amp; filters · Map point filters
          FAULT banner · footer · hash-only routing'''
LEG=[("Exists","What is on screen today (inventory, Oct 15)."),("Works","Behaviour confirmed in the read-only pass."),("Issues","Observed problems — integrity red, friction amber."),("Propose","Specific v1.4 change, tagged to its requirement (HF) and phase.")]
page(f"""<div class="sec">Section 06</div><h1>App Coverage — Site Map</h1>
<p class="small" style="margin-top:-4px">Single-page app; all state in the URL hash <code>#{{"t":tab,"p":preset,"s":sort,"f":filters,"j":job,"m":1}}</code>. Every view below was opened in the read-only inventory; nothing was saved, applied or published.</p>
<pre style="font-size:8.6pt;line-height:1.5">{SITE}</pre>
<div class="grid2" style="margin-top:8px;gap:6px">{''.join(f'<div class="card" style="margin:0;padding:6px 10px"><span class="label" style="color:var(--cyan)">{a}</span> <span class="small">{b}</span></div>' for a,b in LEG)}</div>
<p class="small muted" style="margin-top:7px">Coverage pages follow this order. Settings › Flex policy &amp; scoring has its own full section (14).</p>""","06 · App Coverage — Site Map")
def cov(name,route,ex,wk,iss,pr):
    rows=''.join(f'<tr><td class="cl" style="color:{c}">{l}</td><td>{t}</td></tr>' for l,t,c in (("Exists",ex,"var(--t2)"),("Works",wk,"var(--green)"),("Issues",iss,"var(--amber)"),("Propose",pr,"var(--cyan)")) if t)
    return f'<div class="card cov" style="padding:5px 10px 4px;margin-bottom:6px"><div style="display:flex;align-items:baseline;gap:8px;margin-bottom:1px"><b style="font-size:10.8pt">{name}</b><span class="label" style="font-size:7.5pt;margin-left:auto">{route}</span></div><table>{rows}</table></div>'
def covpage(sub,title,hdr,items):
    sec(sub,title,1)
    page(f'<div class="sec">Section {sub}</div><h1 style="font-size:17pt;margin-bottom:6px">{title}</h1>'+''.join(cov(*x) for x in items),hdr)
P1=[("Jobs","t=pipeline · p=OPEN","“Job decision queue (578)”; stat cards Needs decision 50 · Applied 84 · Research 49 · Interviews 14d 0; Open roles ▾ / funnel → View &amp; filters; sortable table NEW · TITLE · COMPANY · LOCATION · LINK · SCORE · BUCKET · SALARY_BASE_EST · FLEX_CLASS · EXPERIENCE_FIT · AGE; row checkboxes; job location map; job drawer.",
"Stat cards switch views; sort; drawer opens; map legend Primary / Additional / Home; RECENTER / RESET.",
"Table truncated horizontally; raw codes as headers; ~578 dots on the map; opening a row queued an unverified write; ratings drift while browsing (Anduril 77 → 72 → 59).",
"Readable 11-column default, all visible at 2560 (HF-07 / 08 / 17) · ◌ provisional on stale scores (HF-19) · map shows selected job, else filtered set, with animated auto-fit (HF-16) · opening a job never writes; seen-state local or explicit with receipt (HF-04) · Ph 1–3."),
("Review queue","p=NEEDS_TIM","Same queue preset to 50 “Needs decision” rows (Research bucket dominant), e.g. a VP Ops role at 68.",
"Preset loads; decisions from the drawer.",
"Header “0 need you” vs Needs decision 50 (v1.3); no “since last review” summary.",
"Default landing view of the cockpit; KPI tile = exact population (HF-02); change strip (HF-10); keys P / H / R / D for Pursue / Hold / Research / Decline · Ph 1–3."),
("Decline candidates","p=DECLINE_CANDIDATES","8 rows, scores 37–64 (e.g. an ops-tech role at 64).","List loads; drawer works.",
"The rule that made a row a candidate is not shown; declining is two-step and reasons are not persisted (Trends shows none).",
"Show the triggering rule per row; batch “Confirm declines” with reason code required, receipts and Undo (HF-03 / 11) · Ph 1–3."),
("My rulings","p=RULED","0 rows; map overlay “No mapped jobs in this group”; rulings list “none”.","Empty state renders.",
"Empty fullscreen-map overlay blocks the tab bar — user is trapped until reload.",
"Map never covers tabs; empty state explains rulings and links to Trends export / import (HF-06) · Ph 2."),
("Map (fullscreen)","m=1","Fullscreen US map of the current view (578 rows), zoom, Layers, RECENTER / RESET, legend.","Shows the current view; zoom works.",
"Covers section tabs; no visible close (hidden in DOM) — exit by reload; header clipped under the rail; Layers click no visible change; Selection zoom 600 %.",
"<b>Tim's rule:</b> selected job only, else the filtered selection; always-visible <b>✕ Close · Esc</b>; animated auto-fit (600 ms) instead of fixed 600 %; no clusters / radar / rings; Layers popover visibly applies (HF-16) · Ph 2."),
("Trends (“Pipeline reports”)","t=reports","Research bottlenecks; next actions; state donut (662 roles); base-comp mix; discovery sources; integrity table (749 / 749, parse errors 0); buckets table; rulings export / import; decline reasons; notification sources.",
"Integrity COUNTS OK; parse errors 0; charts render.",
"Declined by Tim 0 / Employer rejected 0 here vs 56 / 2 (Scout results) vs 57 / 7 (Buckets); LinkedIn 183 + LINKEDIN 69, Indeed 87 + INDEED 17; reason codes “none”; tab “Trends” ≠ title “Pipeline reports”.",
"Scope label on every chart (live / archive / cohort) from one counter registry (HF-02) · case-insensitive source normalisation · persist reason codes (HF-11) · one name “Reports” · Ph 1 / 3."),
("Compare","modal · COMPARE · 0/3","“Compare roles · 0/3 — use Compare role in a job drawer to set up to three roles. Missing evidence stays visible.” CLOSE.","Modal opens and closes.",
"Only discoverable from the drawer; top-bar counter gives no hint.",
"Compare tray in the workspace; columns render from the single scoring record (HF-01) and carry ◌ provisional · Ph 3.")]
covpage("06.1","Coverage — Pipeline (1/2)","06 · Coverage — Pipeline",P1[:4])
covpage("06.2","Coverage — Pipeline (2/2)","06 · Coverage — Pipeline",P1[4:])
D=[("Drawer header","job drawer","Title, company, location, “Hybrid / in person…”, posted age; score ring (rating + Strong / Watch / Weak); prev / next; ✕; chips bucket · FLEX class · salary · location.","Opens from table and map; prev / next.",
"Rating can change while open (stale FLEX).","Model rev + computed-at + ◌ provisional next to the ring; drawer selection = map lock-on (HF-01 / 16 / 19)."),
("Overview","tab","Key details, evidence signals, summary; TIM DECISION form: State (READY_TO_PURSUE, APPLIED, Rejected by Employer, MANUAL_RESEARCH, DECLINED_BY_TIM, CLOSED_DEAD, INVALID_DISCOVERY, DUPLICATE), Reason code, Duplicate of, note, SAVE JOB DECISION, UNDO LAST; COMPARE ROLE; ☆ PIN; provenance + DUPLICATE WARNING.",
"Form, compare and pin present.","Two-step decide (PURSUE / HOLD / DECLINE / RESEARCH prepare, Save commits); raw state codes; Undo only “last”.",
"One-click decision state machine with receipts and per-decision Undo (HF-03); readable labels (HF-08); Decline separated with inline reason picker · Ph 1–3."),
("Posting","tab","Source links, posting facts, “no posting text stored”, OPEN EXTERNAL.","External link opens.","Missing posting text is common and silent.",
"Show “posting text missing” as an olive evidence gap; AI discover is an explicit, receipted action (HF-09)."),
("Fit &amp; Score","tab","Opportunity rating breakdown — e.g. 59 WEAK: experience 88 · Degree FLEX weighted 30 (NO_FLEX −60) · net compensation 57 · geo 20 (nearest Los Angeles, CA) · ATS 46 · title 90 · culture 90 (P2) · ownership unknown; screen gate FAIL; FLEX impact −6.",
"Explains each factor; names the nearest geo control point.","Weights do not visibly sum; stored FLEX may be stale; “derived viewer model” scope unclear.",
"Weight · raw · points table summing to 100 incl. FLEX; LOCAL / SHARED badges; links to Settings anchors (HF-09 / 19)."),
("Application · Documents · History","tabs","Application: state, interview mode, JD link, ADD TRIAGE NOTE / SAVE TIMESTAMPED NOTE, interview history. Documents: docs for this role, OPEN THE DOCUMENT LIBRARY. History: this-device ruling, added, first loaded, activity timeline.",
"Tabs render.","Notes are writes without receipts; “this-device ruling” vs canonical unclear.",
"Interviews 14d tile reads from Application dates; notes get receipts; History merges Writer receipts with scope labels (HF-02 / 03).")]
covpage("06.3","Coverage — Job Drawer","06 · Coverage — Job Drawer",D)
I=[("Scout results","t=quality","Intake by discovery day (10-01..10-10); cohort outcomes (638: Ready 1, Scout intake 426, Discovery lead 102, Research 8, Applied 26, Employer rejected 2, Declined by Tim 56, Duplicate 9, Closed 8); maturity 108 finalized; quality windows 7d / 30d (admission 99.3 / 98.6 %, actionable yield 0.7 / 1.4 %, invalid 96.4 / 84 %, median to final 25.1 h / 2.9 d); per-run table.",
"Charts render.","Per-run rows mostly “no run record”; cohort counts differ from Trends without a scope label; 0.7 % actionable yield buried.",
"Scope header on every block (HF-02); yield as the headline KPI; per-run empty state explains why · Ph 1 / 3."),
("Scout intake · Discovery leads","p=SCOUT_INTAKE · p=LEADS","Job queue filtered to 426 and 102.","Filters apply.","Same UI as Jobs for very different work; View &amp; filters shows AWAITING AI 528 / STALLED 72H 536.",
"Triage mode (bulk dismiss with reason, confirm + count + receipt); leads styled olive “unverified”; promote-to-job action · Ph 3."),
("Manual intake","t=intake","Status counters; + ADD JOB LINK; Show filter; empty table; “Worker has not checked this queue yet”; refreshes every 30 s.",
"Status refresh.","No last-check time or ETA.","Show last worker check + Writer latency; ADD JOB LINK gets a receipt · Ph 2."),
("Target companies","t=companies","Registry P1 0 · P2 18 · P3 16 · Watch 0 · Paused 4 (38); SAVE REGISTRY / DISCARD-RELOAD; ADD COMPANY; per-row priority + EDIT; rule text: priority sets discovery intensity and culture score (P1 100, P2 90, P3 75, Watch 60, unlisted / Paused 40); stored in canonical Rules SECTION=TARGET_COMPANIES.",
"Registry loads; form present.","A canonical (shared) write is not badged as such; culture-score impact invisible.",
"SHARED badge + confirm / receipt / undo; preview “changes culture score for N jobs” (HF-19 pattern) · Ph 2–3.")]
covpage("06.4","Coverage — Intake","06 · Coverage — Intake",I)
S=[("Dashboard","t=automations","AI Operations: REFRESH EVIDENCE; KPIs backlog 82 · completion 89 % (690 / 772) · writer blocked 14 · intake reviewed 0 · oldest open 5 d; Writer throughput (waiting 1, finished 24 h 41, peak 5 / h, longest wait 5 min, failed 24 h 2); intake funnel; backlog by stage; runtime read health (master LIVE, snapshot OK, 749 rows, age 4 d).",
"Renders evidence.","Very dense; funnel “found 0” vs scout counts; 4-day-old snapshot not flagged.","One-line health summary first; age warnings; KPIs link to filtered Work queue · Ph 3."),
("Work queue · Intake coverage · Verification &amp; recovery","sub-tabs","772 tracked / 690 verified / 82 unresolved (STAGE · STATE · OWNER · SOURCE · OUTCOME · NEXT ACTION); coverage UNKNOWN with window pickers + REQUEST CATCH UP, 2 requests PENDING_MANUAL; unresolved obligations with ACKNOWLEDGE.",
"Tables load.","Jargon states; catch-up and acknowledge are writes with no confirm or receipt.","Readable states (HF-08); catch-up / acknowledge need reason + confirm + receipt (HF-03) · Ph 2–3."),
("Schedules · Diagnostics (Health) · Incidents","sub-tabs + top tabs","“Native control: UNSUPPORTED”, Stage a schedule proposal; PR70 production acceptance INDETERMINATE; incident history with All / Unresolved / Verified recovered / Historical and 3 unfinished operations.",
"Read-only views render.","Schedules and Health duplicated as top tabs; INDETERMINATE / UNSUPPORTED unexplained.","One entry each; plain-language status + next step; Writer banner links to Incidents · Ph 2."),
("Writer connection","t=settings · ⚙","Script URL, passphrase (masked), TEST, SAVE CONNECTION ON THIS DEVICE, CLEAR, SEED STRUCTURED RUNTIME FROM WRITER; receipts → LOAD RECEIPTS FROM DRIVE; status “Connected structured runtime”, no write errors.",
"Connection healthy after load.","Two entry points; credential fields on a general page; “unreachable” banner on first load then Connected.",
"Single entry (System › Writer connection); credentials behind explicit reveal + confirm; banner only after 2 failed checks / 20 s grace (HF-04) · Ph 1–2."),
("System drawer","bell · Status · Writer pill","Health DEGRADED (no current faults; 3 prior failures to verify); master LIVE; live code PR #109; scoring rev 24; 185 FLEX values need recalc of 603; frontend check unavailable (PR #113); migration CUTOVER_COMPLETE; AI usage meters; 3 unfinished ops; REFRESH NOW, CHECK LATEST BUILD, REVIEW FULL UNFINISHED-WORK QUEUE.",
"Rich status in one place.","Three entry points; DEGRADED with no current fault reads as an alarm.","Pill + one icon open it; health = worst <i>current</i> fault, history separate; recalc progress mirrored from Settings (HF-19) · Ph 1–2.")]
covpage("06.5","Coverage — System (1/2)","06 · Coverage — System",S[:3])
covpage("06.6","Coverage — System (2/2)","06 · Coverage — System",S[3:])
ST=[("Flex policy &amp; scoring","t=scoring","FLEX policy (shared), VNext backtest gate, shared model rev 24 + recalc, ranking weights (local), salary curve, geo heat map with 20 control points.","See Section 14.","Weights 100 / 70; scope mixed; 185 provisional; duplicate “Pay &amp; location” tab.","Full redesign in Section 14 (HF-19) · Ph 1–3."),
("Rules (Advanced rules)","t=rules","TIM_PIPELINE_RULES_CANONICAL v4, ACTIVE, owner Tim Pruitt, 19 sections (Ruleset overview … Target companies), search; EDIT SOURCE TEXT / DISCARD-RELOAD / LOAD APPROVED FLEX-URL UPDATE. Change control: AIs may propose; only Tim pressing Save makes it canonical.",
"Read and search.","Rules are the authority for scoring (COMPENSATION_GEOGRAPHY, DEGREE_FLEX, TARGET_COMPANIES) but nothing links them.",
"Section index with “used by” links (Scoring A / E / G, Target companies); diff preview before Save; SHARED badge + receipt (HF-04 / 19) · Ph 2–3."),
("Display &amp; columns","Settings","Columns “local to this browser”: ~150 grouped fields, desktop / phone sets, frozen columns; SAVE DISPLAY ON THIS DEVICE / RESET DEFAULTS / USE COCKPIT COLUMNS / RESTORE COLUMNS.","Lists render.","Scope only in copy; no readable preset.",
"LOCAL badge; ship the 11-column readable preset (HF-07 / 08); phone set = Track M cards · Ph 3."),
("Documents (+ “Resume &amp; ATS”)","Settings","Resumes 3 (1 APPROVED) · cover letters 3 · supporting 3 · Tim's voice 2; working-text drafts (browser-only, not saved to Drive); Open in Drive; ATS profile + local proxy scores; “Automatic text extraction unavailable” for PDF.",
"Library renders; Drive links.","“Resume &amp; ATS” is the same view; browser-only drafts risk loss.","Merge tabs as “Documents &amp; ATS”; LOCAL draft badge + “not saved to Drive” warning; ATS score labelled “proxy” · Ph 2–3.")]
covpage("06.7","Coverage — Settings","06 · Coverage — Settings",ST)
G=[("Routing","URL hash","Hash-only state; /scoring, /rules, /map, /trends, /companies, /help … and /zz-control-404 all return 200 and redirect to /pipeline.","Hash deep links restore views.","Silent redirects hide typos and broken links.","Keep hash state; add readable path aliases and a not-found notice instead of silent redirect · Ph 2."),
("Top bar","global","Menu · title + tagline · breadcrumb · search “Search jobs, companies, or locations…” · Writer pill (idle / checking / queued / processing + countdown) · QUEUE n · LAST SYNC · COMPARE · 0/3 · COMPACT / COMFORTABLE · LAYOUT · REFRESH · bell · ⚙ (= Writer setup).",
"Search, density and layout work.","Refresh twice (top + rail); ⚙ opens Writer setup, not Settings; pill flaps.","One Refresh; ⚙ → Settings; pill debounced with “stable 12m” (HF-04 / 06) · Ph 2."),
("Left rail · Layout mode","global","Pipeline · Intake · System · Settings, Status, Refresh; expands on hover; Menu pins. LAYOUT: MOVE handles, LOCK VIEW / SAVE / RESET VIEW / DONE.",
"Hover expand; DONE exits layout.","Pin cannot unpin; rail overlaps title / map header.","Pin toggles with visible ⇤ Unpin; rail pushes content (HF-06); LOCAL badge on layouts · Ph 2."),
("View &amp; filters · Map point filters","panels","READY 1 / AWAITING AI 528 / STALLED 72H 536; ~20 preset chips; SELECT VISIBLE · AI DISCOVER MISSING DATA · MARK VISIBLE SEEN. Map: Auto zoom on selection, Selection zoom 600 %, Dense-area boost, colour chips.",
"Presets apply; popover opens.","Bulk write / AI actions sit beside filters; dense-area boost is cluster-like; colours not score bands.",
"Separate filters from bulk actions (confirm + count + receipt); keep auto-zoom (current behaviour) as animated fit; drop dense-area boost; pins by score band (HF-16) · Ph 2–3."),
("FAULT banner · footer","global","Red “Writer unreachable — Failed to fetch” with ✕; footer “OPERATIONS · 10 local entries · 10 unverified · browser does not run jobs or check scheduler health”.",
"Dismiss works.","False alarm on load; “unverified” count not actionable.","Debounced banner linked to Incidents; footer count opens receipts (HF-03 / 04) · Ph 1–2.")]
covpage("06.8","Coverage — Global Chrome","06 · Coverage — Global Chrome",G)
