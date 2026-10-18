sec("17.7","Inventory Task Register (v1.4)",1)
REG=[("T-01","Scoring record carries rev + computed-at + provisional flag; ◌ badge on every stale score in table, drawer, map, compare","Pipeline · Settings","HF-01 · 19","1"),
("T-02","Recalc progress (418 / 603 · ETA) in Settings card C, System drawer and KPI strip; band changes held until recalculated","Settings · System","HF-19","1"),
("T-03","Root-cause score drift (Anduril 77 → 72 → 59): stored FLEX vs live policy; no rating changes on view without an event","Pipeline","HF-01","1"),
("T-04","Honest weights total: 100 % = 70 local + 30 shared FLEX, FLEX as explicit locked row","Settings","HF-19","1"),
("T-05","Counter registry + scope labels: Declined 0 / 56 / 57, Employer rejected 0 / 2 / 7, Applied 84 / 26","Trends · Intake","HF-02","1"),
("T-06","Opening a job never writes; seen-state local or explicit + receipted; footer “unverified” opens receipts","Pipeline · global","HF-03 · 04","1"),
("T-07","Writer banner / pill debounce: banner after 2 failed checks or 20 s grace; health = worst current fault","global · System","HF-04","1"),
("T-08","Fullscreen map: below tab bar, always-visible ✕ Close + Esc, never traps (My rulings empty state)","Pipeline › Map","HF-06 · 16","2"),
("T-09","Map = selected job only, else filtered set; animated auto-fit replaces 600 % zoom; remove clusters, dense-area boost","Pipeline › Map","HF-16","2"),
("T-10","Rail pin toggles with visible ⇤ Unpin; rail pushes content","global","HF-06","2"),
("T-11","De-duplicate entry points: Settings tabs, cards, ⚙ → Settings, one drawer entry, System top tabs","global · Settings · System","HF-04","2"),
("T-12","LOCAL / SHARED badges on every settings card (scoring, target companies, rules, display, documents)","Settings · Intake","HF-04 · 19","2"),
("T-13","Shared-change guard: scope warning + confirm + Writer receipt + Undo (FLEX, publish, registry, rules)","Settings · Intake","HF-03 · 19","2"),
("T-14","Impact preview before save: N scores change, M cross a band, largest Δ","Settings","HF-19","2–3"),
("T-15","Geo map: targeting look, click-to-add, drag-to-move, keyboard nudge, table ↔ map sync","Settings","HF-19","3"),
("T-16","Salary curve chart + COMPENSATION_GEOGRAPHY / DEGREE_FLEX authority notes and conflict ⚠","Settings · Rules","HF-19","3"),
("T-17","One-click decisions with receipts + per-decision Undo; reason code required for Decline","Drawer · Decline candidates","HF-03 · 11","1–2"),
("T-18","Readable labels for columns, states and reason codes; 11-column 2560 preset","Pipeline · Display","HF-07 · 08 · 17","3"),
("T-19","Source normalisation (LinkedIn / LINKEDIN, Indeed / INDEED); persist decline reasons","Trends","HF-11","3"),
("T-20","Path aliases + not-found notice instead of silent redirect to /pipeline","global","HF-04","2"),
("T-21","Bulk actions (SELECT VISIBLE, AI DISCOVER, MARK SEEN, catch-up, acknowledge) separated from filters, confirm + count + receipt","global · System","HF-03","2"),
("T-22","Writer connection: single entry, credentials behind explicit reveal","System","HF-04","2"),
("T-23","Mobile inset tokens, camera keep-out both orientations, lifted bottom controls; simulator check both landscape rotations","Track M","HF-18","M"),
("T-24","Radar purge: remove sweep from map, loading state, boot, catalog and tokens; lint rule against --pe-motion-radar","global","HF-15 · 16","2")]
rgr=lambda a,b,c,d,e: f'<tr><td class="id">{a}</td><td class="small">{b}</td><td class="small muted">{c}</td><td class="label" style="font-size:7.5pt">{d}</td><td class="num" style="text-align:center">{e}</td></tr>'
RGT='<tr><th style="width:36px">ID</th><th>Task</th><th style="width:100px">Area</th><th style="width:66px">Req</th><th style="width:34px;text-align:center">Ph</th></tr>'
page(f"""<div class="sec">Section 17.7</div><h1 style="font-size:18pt;margin-bottom:6px">Inventory Task Register <span class="muted" style="font-size:11pt;font-weight:400">· every baseline issue → a task</span></h1>
<table class="tight">{RGT}{''.join(rgr(*x) for x in REG[:12])}</table>""","17 · Implementation Plan — Task Register (1/2)")
page(f"""<div class="sec">Section 17.7 · continued</div><h1 style="font-size:18pt;margin-bottom:6px">Inventory Task Register (2/2)</h1>
<table class="tight">{RGT}{''.join(rgr(*x) for x in REG[12:])}</table>
<p class="small muted" style="margin-top:4px">Phase 1 (data integrity) tasks T-01 – T-07 and T-17 land before any layout, motion or scoring-page UI work.</p>""","17 · Implementation Plan — Task Register (2/2)")
