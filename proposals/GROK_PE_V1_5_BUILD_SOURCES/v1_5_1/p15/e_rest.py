# motion
R('("G6","Flash safety","Nothing flashes more than 3× per second (WCAG 2.3.1); confirmed flash is a single pulse.")]','("G6","Flash safety","Nothing flashes more than 3× per second (WCAG 2.3.1); confirmed flash is a single pulse."),\n("G7","Selection budget (v1.5)","Job selection — data, detail materialize, ring, lock-on and auto-fit together — settles in ≤ 0.7 s total; anything longer is cut, not queued.")]')
R('Motion colour follows signal meaning: amber breathe = queued only, red shake = failed only, cyan = live / selected / processing.','Motion colour follows signal meaning: amber breathe = waiting for Writer lock only, red shake = failed only, cyan = live / selected / writing; the changed marker is white, never cyan.')
R('within guardrails G1–G6.','within hard limits G1–G7.')
R('All catalog items obey G1–G6','All catalog items obey G1–G7')
R('("M-08","New-row cyan wipe","Row new / changed","Cyan gradient wipes left → right, settles into a “changed” marker · sweep 600 ms. Replaces silent reorder (HF-05)."),','("M-08","Changed-row wipe","Row new / changed","Neutral white-grey wipe left → right, settles into a white Δ marker · sweep 600 ms. Never cyan. Replaces silent reorder (HF-05)."),')
R("<span style='color:var(--amber)'>◷ queued: amber breathe</span> (1600 ms loop) · <span style='color:var(--cyan)'>◉ processing: cyan sweep</span> across the receipt · <span style='color:var(--green)'>✓ confirmed: single green flash</span> · <span style='color:var(--red)'>✕ failed: red shake</span> (3 × 4 px, 300 ms) then steady red with Retry.",
  "Seconds scale. <span style='color:var(--amber)'>◷ waiting for Writer lock: amber breathe + “N s”, next retry 8 / 15 / 30 / 45 s</span> · <span style='color:var(--cyan)'>⟳ writing: cyan sweep</span> (typically 1–5 s) · <span style='color:var(--green)'>✓ confirmed: single green pulse</span> after readback · <span style='color:var(--red)'>⊗ failed: one shake</span> (3 × 4 px, 300 ms) then steady red with Retry.")
R('("M-18","Recalc progress","Recalc running","Progress bar fills (roll 800 ms per update); ◌ provisional cross-fades to the final score when that job\'s recalc lands. No breathing — amber stays “queued” only."),','("M-18","Publish progress","Update / publish button","Progress bar under the one-button update fills through write → readback (roll 800 ms per step); ◌ on a row clears when its evidence is refreshed. No breathing — amber stays “waiting for lock” only."),')
R("(--pe-motion-sweep\",\"600ms\",\"linear\",\"Row cyan wipe","(--pe-motion-sweep\",\"600ms\",\"linear\",\"Row changed wipe",False)
R('"Row cyan wipe, edge trace, ring draw-on"','"Changed-row wipe, edge trace, ring draw-on"')
R('"Queued amber breathe"','"Waiting-for-lock amber breathe"')
R('<b>coloured by score band</b> (✓ Strong · ◷ Watch · ✕ Weak) with icon + word in the hover card; ◌ provisional pins get an olive ring;','<b>coloured by percentile band</b> (▲ Top · ◆ Upper · ● Mid · ▽ Low; ⊘ HOLD separate) with glyph + word in the hover card; ◌ stale-evidence pins get an olive ring;')
# scoring page as-is
R('Stored policy values: <b>185 awaiting recalculation / 603 eligible</b>, idle — “choose Review refresh… to start”.","No progress indicator; stale scores look final (Anduril 77 → 72 → 59)."),','Stored FLEX evidence: <b>185 of 603</b> stamped under an older rule, idle — “choose Review refresh… to start”.","Stale evidence unmarked; evidence-driven changes show no cause (Anduril 77 → 72 → 59)."),')
R('("D · Ranking weights","LOCAL","“Ranks rows in this browser; does not write to master.”','("D · Ranking weights","SHARED","Copy says “Ranks rows in this browser; does not write to master” — stale: the button publishes to the shared model.')
R('"Visible sum 70; FLEX 30 implicit."),','"Visible sum 70; FLEX 30 on card A; copy claims local."),')
R('("E · Salary curve","LOCAL",','("E · Salary curve","SHARED",')
R('("F · Geo heat map","LOCAL",','("F · Geo heat map","SHARED",')
R('<b>Save paths today.</b> Ranking weights, salary curve and geo points are <b>local to this browser</b>; FLEX weight / policy save to the <b>shared canonical model via Writer</b>; published-model changes go through “Publish shared scoring…” (present in the DOM, not visible on this tab).',
  '<b>Save paths (corrected in v1.5).</b> Weights, salary curve, geo points and FLEX weight all publish to <b>one shared, revision-numbered model</b> (<code>save_scoring_model</code>, rev 24 today). FLEX <i>policy</i> modifiers save to the canonical rules (DEGREE_FLEX) and affect ADJUSTED_FIT / PURSUIT_STATUS only. LOCAL = display, columns, layout, map mode, seen-state, drafts.')
R('A general scoring page, not just a map: six cards across two scopes.','A general scoring page, not just a map: seven cards, all scoring inputs in one shared model.')
# proposals
R('v1.4 only adds clarity and safety."','v1.5 only adds clarity and safety."')
R('("S2","Honest weight totals","Weights card shows <b>100 % = 70 local + 30 shared FLEX</b> as a stacked bar; FLEX is an explicit locked row (“edit in card A”). The total can never read 100 while fields sum to 70."),',
  '("S2","Honest weight totals","One table, one row per weight, all SHARED: experience 35 · FLEX 30 · compensation 15 · geo 10 · title 5 · culture 5 · ats 0 · ownership 0 = <b>100</b> (rev 24). The FLEX row shows the weight; FLEX class scores are fixed (HIGH 80 · SOFT 62 · NO 30 · STRICT 0). Total always equals the visible sum."),')
R("(\"S3\",\"LOCAL vs SHARED badges\",\"Every card carries a scope badge: <span class='tag' style='color:var(--amber);border-color:#4a3a17'>SHARED · every viewer &amp; agent</span> or <span class='tag'>LOCAL · this browser</span>. Page badge PRESENTATION ONLY removed.\"),",
  "(\"S3\",\"One shared model, honest scope\",\"Every scoring card A–G carries <span class='tag' style='color:var(--amber);border-color:#4a3a17'>SHARED · model rev 24</span>; stale “this browser” copy removed. <span class='tag'>LOCAL</span> appears only on display / columns / layout / map mode / seen-state / drafts. Page badge PRESENTATION ONLY removed.\"),")
R('("S4","Shared-change guard","Shared saves (FLEX weight / policy, publish) need a scope warning + confirm naming the impact, return a <b>Writer receipt</b>, and offer <b>Undo</b> (24 h)."),',
  '("S4","Shared-change guard","Every one-button update is a shared publish: ⚠ confirm naming the new revision and impact, Writer receipt with readback, and <b>Undo = republish the previous revision</b> (the app\'s existing “restore … as a new revision”)."),')
R('("S6","Recalc progress + ◌ provisional","Progress bar “418 / 603 · ETA” in card C, System drawer and KPI strip; every stale score shows <b>◌ provisional</b> (table, drawer, map pin, compare) until its recalc lands; band changes held in the change strip."),',
  '("S6","◌ stale evidence + cause","Scores are live, so ◌ marks only stale <b>stored evidence</b> (185 / 603 FLEX values under an older rule; Writer-stamped values pending redeploy) in table, drawer, map pin and compare. Evidence-driven changes appear in the change strip with cause (Anduril 77 → 72 → 59: FLEX HIGH → NO)."),')
R('LOCAL scope line.")]','SHARED · model rev 24 scope line.")]')
R('<b>Authority.</b> Geo points and power are LOCAL ranking inputs;','<b>Authority.</b> Geo points and power are part of the SHARED scoring model;')
R('If a local point contradicts','If a geo point contradicts')
R('local curve / points may not contradict them','model curve / points may not contradict them')
R('FLEX policy with confirm + receipt + undo; recalc 418 / 603 + ◌; VNext NOT READY gates.','FLEX weight vs policy split; publish confirm → rev 25; ◌ 185 stale evidence; VNext NOT READY.')
R('<span class="id">D–E</span> <b>Local column</b><div class="muted">Weights 100 % = 70 + 30 FLEX; salary curve drawn with floor / target / ceiling.</div>','<span class="id">D–E</span> <b>Shared model</b><div class="muted">All 8 weights SHARED, Σ 100; salary curve 190 / 240 / 300 K drawn.</div>')
R('11 app columns, readable labels, 30 rows, ◌ provisional; M-08 / M-09.','11 app columns, percentile bands, 30 rows, ◌ stale evidence, Δ changed; M-08 / M-09.')
R('since last review · recalc · map mode','since last review · Δ with cause · map mode')
R('KPI strip with ◌ provisional, change strip,','KPI strip with ◌ stale evidence, Δ change strip,')
# plan
R('"One score, reconciled counts, truthful writes, recalc + ◌ provisional, honest weights, no write on view. <b>Still first.</b>"','"One score, reconciled counts, truthful writes (seconds-scale), ◌ stale evidence, honest all-SHARED weights, no write on view. <b>Data fixes only.</b>"')
R('("02","Workflow + motion core","HF-04 · 05 · 06 · 15 (core) · 16 (panel)"','("1B","Architecture &amp; performance","HF-01 · 03 · 15 (limits)","Single scoring-record selector, counter registry module, write state machine, browser-test migration, performance budget (≤ 0.7 s selection, p95 ≤ 16.7 ms).","Perf + test suite green; budget enforced in CI."),\n("02","Workflow + motion core","HF-04 · 05 · 06 · 15 (core) · 16 (panel)"')
R('after Phase 2 gate, parallel to Phase 3.","Swipe','after Phase 2 gate, parallel to Phase 3.","Swipe')
R('pc=["#A3A39E","#FF4D3D","#F2B33D","#38E1D6","#8A8F7A"]; gt=["SIGN-OFF","0 FALSE OK","CONTEXT 100%","TIMED RE-TEST","OPT-IN"]','pc=["#A3A39E","#4ADE80","#E6E6E2","#F2B33D","#38E1D6","#8A8F7A"]; gt=["SIGN-OFF","0 FALSE OK","PERF BUDGET","CONTEXT 100%","TIMED RE-TEST","OPT-IN"]')
R('No code, backlog, deployment or shared-model changes are authorized by this document. Each phase starts only on Tim\'s explicit approval.','No code, backlog or deployment changes are authorized by this document; each phase starts only on Tim\'s explicit approval. <b>In scope:</b> UI that lets <b>Tim</b> make shared model / rule changes safely. <b>Out of scope in every phase:</b> agents changing the shared model or rules.')
R('No motion or layout work starts before the Phase 1 gate.','No motion or layout work starts before the Phase 1B gate.')
R('01 Integrity         ██████████  <span class="c">◀ first; no motion / layout work before this gate</span>\n02 Workflow                ████████',
  '01 Integrity         ██████████  <span class="c">◀ data fixes only</span>\n1B Arch + perf                ██████  <span class="c">◀ no motion / layout before this gate</span>\n02 Workflow                      ████████')
R('03 Cog + 2560                      ████████████','03 Cog + 2560                            ████████████')
R('04 Adaptive                                    ██████','04 Adaptive                                          ██████')
R('<span class="k">M  Mobile</span>                          <span class="k">░','<span class="k">M  Mobile</span>                                <span class="k">░')
R('<div class="card bar-a" style="padding:8px 12px;margin-bottom:7px"><b>Writer queue latency (20–45 min).</b> <span class="small">Writes routinely take 20–45 min; “queued” and “processing” are normal, not errors. Timings measure time-to-decision, not time-to-confirmation; queued motion (breathe) must never read as a fault.</span></div>',
  '<div class="card bar-a" style="padding:8px 12px;margin-bottom:7px"><b>Writer timing (seconds).</b> <span class="small">Writer is synchronous Apps Script: a write lands in seconds; a 30 s script lock refuses concurrent writes; the client auto-retries at 8 / 15 / 30 / 45 s. Queued = “waiting for Writer lock · N s”, never a fault until retries are exhausted (⊗ failed).</span></div>')
R('<div class="card bar-a" style="padding:8px 12px;margin-bottom:7px"><b>Writer blackout windows.</b> <span class="small">No commits accepted; decisions queue with payload and show the window end. No rollout steps inside a blackout; fault tests simulate one.</span></div>',
  '<div class="card bar-a" style="padding:8px 12px;margin-bottom:7px"><b>Writer redeploy dependency.</b> <span class="small">The updated Writer Apps Script is not yet deployed; Writer-stamped values use the old formula until it is. Logged in Phase 0; HF-01 consistency gate cannot pass before redeploy.</span></div>')
R('Layout follows Tim\'s v1.4 decisions:','Layout follows Tim\'s v1.4 / v1.5 decisions:')
R('Further layout changes need Tim\'s explicit approval. Shared-model / rule changes stay out of scope in every phase.','Further layout changes need Tim\'s explicit approval. UI for Tim\'s shared changes is in scope; agents changing the model or rules is not.')
R('"Record Writer queue depth and any blackout window active during each session."],','"Record Writer lock refusals and retry counts (8 / 15 / 30 / 45 s) per session.",\n"<b>Discrepancy (v1.5):</b> Writer Apps Script redeploy outstanding — Writer-stamped values on the old formula; note as an HF-01 dependency."],')
R('note Writer queue state.','note Writer lock state.')
R('"Show receipt + Undo under the buttons; queued shows time waiting and the next blackout window; failed keeps its payload and offers Retry."','"Show receipt + Undo under the buttons; queued shows “waiting for Writer lock · N s” with the next retry; failed (⊗) keeps its payload and offers Retry."')
R('"<b>Recalc + provisional</b> (HF-19): record carries model rev + computed-at; stale scores show ◌ everywhere; recalc progress 418 / 603 surfaced; root-cause drift (Anduril 77 → 72 → 59)."','"<b>Stale evidence</b> (HF-19): record carries model rev + evidence status; ◌ on the 185 stale evidence values; evidence-driven changes logged with cause (Anduril 77 → 72 → 59, FLEX HIGH → NO)."')
R('"<b>Honest weights</b>: 100 % = 70 local + 30 shared FLEX on Settings and in Fit &amp; Score; reconcile','"<b>Honest weights</b>: one all-SHARED table summing to 100 (rev 24) on Settings and in Fit &amp; Score; fix stale “this browser” copy; reconcile')
R('"Opening a job never writes; debounce','"Opening a job never writes (<code>openRow → syncStateUp</code> today); debounce')
R('"Fault injection (timeout, 5xx, duplicate ack, blackout): 0 false successes','"Fault injection (timeout, 5xx, duplicate ack, lock busy): 0 false successes')
R('"◌ on 100 % of stale scores; weights total = visible sum"]','"◌ on 100 % of stale evidence; weights total = visible sum, all SHARED"]')
R('["Late confirmations look “stuck” → explicit queued timer and Writer estimate.",','["Lock contention looks “stuck” → seconds timer + next-retry countdown.",')
R('"New / changed rows get the cyan wipe (M-08) and a “changed” marker','"New / changed rows get the neutral wipe (M-08) and a white Δ marker')
R('"<b>Scope + shared-change guard</b> (HF-19): LOCAL / SHARED badges; confirm + receipt + undo for FLEX, publish, registry, rules."','"<b>Scope + shared-change guard</b> (HF-19): SHARED on all scoring cards, LOCAL only on display prefs; confirm + receipt + Undo (= republish previous revision) for every shared publish."')
PB='''("17.3","Phase 1B — Architecture & Performance",("1B","Architecture &amp; performance",["HF-01","HF-03","HF-15"],"Put the structure in place that motion and layout depend on, with an enforced performance budget. Starts after the Phase 1 gate; motion and layout start only after this gate.",
["Single scoring-record selector module; every view reads through it; memo keyed on model revision.",
"Counter registry as code (population, filters, window, source) with unit tests.",
"Write state machine (waiting for lock → writing → confirmed | failed | superseded) as one module; motion subscribes to its events only.",
"Migrate browser tests to the current build (PRs #111–#115) incl. protected APPLIED / REJECTED_BY_EMPLOYER and score-tester flows.",
"Performance budget in CI: selection ≤ 0.7 s end to end, p95 frame ≤ 16.7 ms, concurrent-animation caps, no layout-property animation.",
"Flash audit harness: nothing &gt; 3 flashes / s."],
["Selector + registry + state-machine modules","Updated browser test suite","Perf budget + CI trace"],
["All browser tests green on main","Selection ≤ 0.7 s p95 over 50 selections","p95 frame ≤ 16.7 ms in a scripted motion trace","Tim reviews the gate"],
["Refactor regresses #113 lag fix → perf test is a gate.","Scope creep into UI → no visual changes in this phase."])),
'''
R('("17.3","Phase 2 — Workflow",',PB+'("17.4","Phase 2 — Workflow",')
R('("17.4","Phase 3 — Cognitive + Visual",','("17.5","Phase 3 — Cognitive + Visual",')
R('("17.5","Phase 4 — Adaptive",','("17.6","Phase 4 — Adaptive",')
R('("17.6","Track M — Mobile",','("17.7","Track M — Mobile",')
R('sec("17.7","Inventory Task Register (v1.4)",1)','sec("17.8","Inventory Task Register (v1.5)",1)')
R('<div class="sec">Section 17.7</div><h1 style="font-size:18pt;margin-bottom:6px">Inventory Task Register','<div class="sec">Section 17.8</div><h1 style="font-size:18pt;margin-bottom:6px">Inventory Task Register')
R('<div class="sec">Section 17.7 · continued</div>','<div class="sec">Section 17.8 · continued</div>')
R('Phase 1 (data integrity) tasks T-01 – T-07 and T-17 land before any layout, motion or scoring-page UI work.','Phase 1 (data) tasks T-01 – T-07 and T-17 land first; Phase 1B (T-25 – T-28) lands before any layout, motion or scoring-page UI work.')
R('{\'\'.join(rgr(*x) for x in REG[:12])}','{\'\'.join(rgr(*x) for x in REG[:14])}')
R('{\'\'.join(rgr(*x) for x in REG[12:])}','{\'\'.join(rgr(*x) for x in REG[14:])}')
R('("T-01","Scoring record carries rev + computed-at + provisional flag; ◌ badge on every stale score in table, drawer, map, compare","Pipeline · Settings","HF-01 · 19","1"),','("T-01","Scoring record carries model rev + evidence status; ◌ only on stale stored evidence in table, drawer, map, compare","Pipeline · Settings","HF-01 · 19","1"),')
R('("T-02","Recalc progress (418 / 603 · ETA) in Settings card C, System drawer and KPI strip; band changes held until recalculated","Settings · System","HF-19","1"),','("T-02","Stale-evidence count (185 / 603) in Settings card C, System drawer and KPI strip; Review refresh shows progress","Settings · System","HF-19","1"),')
R('("T-03","Root-cause score drift (Anduril 77 → 72 → 59): stored FLEX vs live policy; no rating changes on view without an event"','("T-03","Evidence-change events with cause in change strip (Anduril 77 → 72 → 59: FLEX HIGH → NO); no rating change without an event"')
R('("T-04","Honest weights total: 100 % = 70 local + 30 shared FLEX, FLEX as explicit locked row","Settings","HF-19","1"),','("T-04","Honest weights: one table of 8 SHARED rows = 100 (rev 24); fix stale “this browser” copy","Settings","HF-19","1"),')
R('("T-06","Opening a job never writes; seen-state local or explicit + receipted;','("T-06","Opening a job never writes (openRow → syncStateUp confirmed); seen-state local-only or batched-explicit + receipted;')
R('("T-12","LOCAL / SHARED badges on every settings card (scoring, target companies, rules, display, documents)","Settings · Intake","HF-04 · 19","2"),','("T-12","Scope badges: SHARED on all scoring cards A–G, target companies, rules; LOCAL only on display / columns / layout / map mode / seen / drafts","Settings · Intake","HF-04 · 19","2"),')
R('("T-13","Shared-change guard: scope warning + confirm + Writer receipt + Undo (FLEX, publish, registry, rules)"','("T-13","Shared-change guard: ⚠ confirm + Writer receipt + Undo = republish previous revision (every one-button update, policy, registry, rules)"')
R('("T-14","Impact preview before save: N scores change, M cross a band, largest Δ"','("T-14","Impact preview before publish: N scores change, M cross a percentile band, largest Δ (extends the #112 score tester)"')
R('("T-17","One-click decisions with receipts + per-decision Undo; reason code required for Decline"','("T-17","One-click decisions with receipts + per-decision Undo; reason code for Decline (⊖); respect APPLIED / REJECTED_BY_EMPLOYER protection"')
R('("T-24","Radar purge: remove sweep from map, loading state, boot, catalog and tokens; lint rule against --pe-motion-radar","global","HF-15 · 16","2")]',
  '("T-24","Radar purge: remove sweep from map, loading state, boot, catalog and tokens; lint rule against --pe-motion-radar","global","HF-15 · 16","2"),\n("T-25","Single scoring-record selector + counter registry as modules","Pipeline","HF-01 · 02","1B"),\n("T-26","Write state machine module (waiting for lock / writing / confirmed / failed / superseded)","global","HF-03","1B"),\n("T-27","Browser-test migration to main (#111–#115) incl. protected states + score tester","tests","HF-14","1B"),\n("T-28","Perf + flash budget in CI: selection ≤ 0.7 s, p95 frame ≤ 16.7 ms, ≤ 3 flashes / s","CI","HF-15","1B")]')
# re-order REG so T-25..28 sit in the first page? keep order; split 14 / rest.
# tokens
R('("--pe-text-muted","#6B6B66","non-essential only")','("--pe-text-muted","#6B6B66","large text only")')
R('("--pe-amber","#F2B33D","flex / queued / Hold")','("--pe-amber","#F2B33D","flex / waiting for lock / Hold")')
R('("--pe-red","#FF4D3D","hard block / failed / Decline")','("--pe-red","#FF4D3D","failed write / hard block only")')
R('("--pe-terminal","#5A5A5A","closed / declined")','("--pe-terminal","#5A5A5A","closed / Decline")')
R('("/* Score bands */",None,None),("--pe-band-strong","var(--pe-green)","80–100"),("--pe-band-watch","var(--pe-amber)","65–79"),("--pe-band-weak","var(--pe-red)","< 65"),',
  '("/* Percentile bands (v1.5, display-only) */",None,None),("--pe-band-top","#4ADE80","top 10 %"),("--pe-band-upper","#F2B33D","next 25 %"),("--pe-band-mid","#8E8E89","next 45 %"),("--pe-band-low","#D9826B","bottom 20 % (Clay)"),("--pe-band-cut-top","61","P90, recomputed"),("--pe-band-cut-upper","54","P65"),("--pe-band-cut-low","38","P20"),')
R('("/* Scope &amp; state (v1.4) */",None,None),("--pe-scope-shared","var(--pe-amber)","SHARED badge"),("--pe-scope-local","var(--pe-text-secondary)","LOCAL badge"),("--pe-provisional","var(--pe-olive)","◌ recalc pending")]',
  '("/* Scope &amp; markers (v1.5) */",None,None),("--pe-scope-shared","var(--pe-amber)","SHARED badge"),("--pe-scope-local","var(--pe-text-secondary)","LOCAL (display only)"),("--pe-changed","#E6E6E2","Δ marker, never cyan"),("--pe-stale-evidence","var(--pe-olive)","◌ stale stored evidence")]')
R('("--pe-motion-stagger","18ms"),','("--pe-motion-stagger","18ms"),("--pe-select-budget","700ms"),("--pe-frame-p95","16.7ms"),("--pe-flash-max","3"),')
R("<span class=\"c\">/* PE tokens · v1.4 */</span>","<span class=\"c\">/* PE tokens · v1.5 */</span>")
R('("<b>v1.4</b> · Writer false-alarm banners on load","0")]','("<b>v1.4</b> · Writer false-alarm banners on load","0"),("<b>v1.5</b> · Job selection settles (incl. motion)","≤ 0.7 s"),("<b>v1.5</b> · Flashes per second","≤ 3"),("<b>v1.5</b> · Scoring inputs badged LOCAL","0"),("<b>v1.5</b> · Glyphs with &gt; 1 meaning","0")]')
R('("<b>v1.4</b> · Stale scores marked ◌ provisional","100%")','("<b>v1.5</b> · Stale evidence marked ◌","100%")')
R('("<b>v1.4</b> · Weights total = sum of visible rows (incl. FLEX)","100%")','("<b>v1.4</b> · Weights total = sum of visible rows (all SHARED)","100%")')
R('("<b>v1.4</b> · Shared saves with confirm + receipt + undo","100%")','("<b>v1.4</b> · Shared publishes with confirm + receipt + undo","100%")')
R('honest totals, scope, preview, recalc","P1")]','honest totals, scope, preview, stale evidence","P1")]')
R("<table class=\"tight\">{CH_}{ct(CAT[:5])}</table>","<table class=\"tight\">{CH_}{ct(CAT[:5])}</table>")
R("<table class=\"tight\">{CH_}{ct(CAT[5:])}</table>","<table class=\"tight\">{CH_}{ct(CAT[5:])}</table>")
R('<pre>{chr(10).join(lines)}</pre>','<pre style="font-size:7.3pt;line-height:1.22">{chr(10).join(lines)}</pre>')
R('<table class="tight"><tr><th style="width:30px">#</th><th style="width:118px">Phase</th>','<table class="tight" style="font-size:8.5pt;line-height:1.22"><tr><th style="width:30px">#</th><th style="width:118px">Phase</th>')

R('Targeting look, drag + click-to-add, synced 20-point table. Full-res PNG supplied.','Targeting look, drag + click-to-add, 20-point table.')
R('"Model rev + percentile band next to the ring; ◌ only for stale stored evidence; evidence updates show their cause in the change strip; drawer selection = map lock-on (HF-01 / 16 / 19)."','"Rev + percentile band by the ring; ◌ = stale evidence only; changes show cause; selection = map lock-on (HF-01 / 16 / 19)."')
R('"Rating can change while open (FLEX evidence update, cause not shown).",','"Rating changes while open, no cause shown.",')

s=s.replace('<table class="tight">{CH_}{ct(CAT[:5])}</table>','<table class="tight" style="font-size:8.2pt;line-height:1.18">{CH_}{ct(CAT[:5])}</table>')
s=s.replace('<table class="tight"><tr><th style="width:34px">ID</th><th style="width:132px">Guardrail</th>','<table class="tight" style="font-size:8.2pt;line-height:1.18"><tr><th style="width:34px">ID</th><th style="width:132px">Guardrail</th>')
R('FLEX weight vs policy split; publish confirm → rev 25; ◌ 185 stale evidence; VNext NOT READY.','FLEX weight vs policy; publish → rev 25; ◌ 185 stale.')
s=s.replace('{ct(CAT[:5])}</table>','{ct(CAT[:3])}</table>').replace('{CH_}{ct(CAT[5:])}</table>','{CH_}{ct(CAT[3:])}</table>')
s=s.replace('<table class="tight">{CH_}{ct(CAT[3:])}</table>','<table class="tight" style="font-size:8.2pt;line-height:1.18">{CH_}{ct(CAT[3:])}</table>')
R('"Rev + percentile band by the ring; ◌ = stale evidence only; changes show cause; selection = map lock-on (HF-01 / 16 / 19)."','"Rev + band by the ring; ◌ stale evidence; change cause shown; map lock-on (HF-01 / 16 / 19)."')
R('"Weight · raw · points table summing to 100 incl. FLEX, all SHARED (rev 24); FLEX shown as fixed class score (NO_FLEX = 30) — the “NO_FLEX −60” input example is wrong, −60 is a policy modifier for ADJUSTED_FIT only (HF-09 / 19)."','"Weight · raw · points table = 100 incl. FLEX, all SHARED (rev 24); FLEX input = fixed class score (NO 30); −60 is an ADJUSTED_FIT modifier (HF-09 / 19)."')
R('<div class="card bar-l small" style="margin-top:9px">All catalog items obey G1–G7: the action has already happened when the animation starts, and the screen shows the true state at every frame.</div>','<p class="small muted" style="margin-top:4px">All items obey G1–G7: true state at every frame.</p>')
