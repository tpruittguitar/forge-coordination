R('<b>First suspect:</b> the memoized scoring config (lag fix). Verify cache invalidation when rules/weights change."],"Identical value and band for the same job / type / version in every view."),',
  '<b>First suspect:</b> the memoized scoring config (lag fix). Verify cache invalidation when the model is republished.","<b>Dependency (v1.5):</b> Writer-stamped values use the old formula until the Writer Apps Script is redeployed (Phase 0 discrepancy)."],"Identical value and band for the same job / type / revision in every view."),')
R('"Queued state shows time waiting and any upcoming Writer blackout window (Writer latency of 20–45 min and blackouts are normal, not failures).","Failed actions stay visible, keep payload, retry without duplicate canonical writes.","Decline visually separated from Pursue."]',
  '"Writer is synchronous: a write lands in seconds; 30 s script lock; busy refusals auto-retry at 8 / 15 / 30 / 45 s. Queued state reads “◷ Waiting for Writer lock · N s”.","Failed (⊗) actions stay visible, keep payload, retry without duplicate canonical writes.","Decline (⊖) visually separated from Pursue; APPLIED / REJECTED_BY_EMPLOYER stay protected (#115)."]')
R('"Settings clearly separates local preferences from shared-model changes; shared changes warn and confirm."','"Settings shows one shared scoring model (all weights, salary, geo, FLEX weight) vs local display preferences; shared publishes warn and confirm."')
R('"New / changed rows highlighted briefly instead of silent reorder."','"New / changed rows marked with a white Δ and neutral wipe (never cyan) instead of silent reorder; evidence updates state their cause."')
R('"Strip: “Since your last review: N new · N scores changed · N Writer retries needed”, each item clickable."','"Strip: “Since your last review: N new · N scores changed (with cause, e.g. FLEX evidence HIGH → NO) · N Writer retries needed”, each item clickable."')
R('"Guardrails: never blocks input, never hides true state, 60 fps GPU-only, flash-safe."','"Hard limits: never blocks input · never hides true state · job selection settles ≤ 0.7 s total · p95 frame ≤ 16.7 ms · nothing flashes &gt; 3 / s."')
R('"0 input blocked by animation; p95 frame ≤ 16.7 ms; every animation maps to a token; write-state motion never precedes the state event."','"0 input blocked; selection ≤ 0.7 s; p95 frame ≤ 16.7 ms; ≤ 3 flashes / s; every animation maps to a token; write-state motion never precedes the state event."')
R('"Settings › Flex policy &amp; scoring retained and enhanced (Section 14): honest total 100 % = 70 local + 30 shared FLEX.","LOCAL / SHARED badge per card; shared saves confirm + receipt + undo; live impact preview; recalc progress + ◌ provisional."',
  '"Settings › Flex policy &amp; scoring retained and enhanced (Section 14): all eight weights are one shared model; honest total = all rows, all SHARED (rev 24: 35 · 30 · 15 · 10 · 5 · 5 · 0 · 0).","FLEX weight (model) separated from FLEX policy modifiers (rules; ADJUSTED_FIT / PURSUIT_STATUS only). Publish confirm + receipt; Undo = republish previous revision; live impact preview; ◌ only on stale stored evidence."')
R('"Per Section 14.1: total = visible sum; preview = actual change; ◌ on 100 % of stale scores.")','"Per Section 14.1: total = visible sum, all SHARED; preview = actual change; ◌ on 100 % of stale evidence values; 0 LOCAL badges on scoring inputs.")')
R('("#FF4D3D","Alert Red","Hard block · failed · <b>Decline</b>","✕")','("#FF4D3D","Alert Red","Failed write ⊗ · hard block ⊘ — <b>only</b>","⊗")')
R('("#5A5A5A","Terminal Grey","Closed · declined","■")','("#5A5A5A","Terminal Grey","Closed · <b>Decline</b> ⊖ (with word)","⊖")')
R('("#6B6B66","Muted","Metadata · non-essential only")','("#6B6B66","Muted","Large text (≥ 18.66 px bold / 24 px) only")')
R('so it is limited to non-essential metadata or large text.','so in v1.5 it is restricted to <b>large text only</b>; small metadata uses Secondary.')
R('"One color = one meaning everywhere: green fits rules; amber flex/question; red hard block/failed; grey terminal."','"One color = one meaning everywhere: green fits rules / top band; amber flex / waiting; red <b>failed write or hard block only</b>; clay low band; grey terminal."')
OLD=s[s.index('<div class="label" style="color:var(--t1);margin:8px 0 6px">11.4 Score bands</div>'):s.index('<div class="label" style="color:var(--t1);margin:8px 0 6px">11.5 Usage rules</div>')]
NEW='''<div class="label" style="color:var(--t1);margin:8px 0 6px">11.4 Score bands — percentile (v1.5)</div>
<div class="bands" style="grid-template-columns:repeat(4,1fr)">
 <div class="band" style="border-left:2px solid #4ADE80"><div class="label">Top 10 % · ≥ P90 (61)</div><div class="bn" style="color:#4ADE80">▲ Top</div></div>
 <div class="band" style="border-left:2px solid #F2B33D"><div class="label">Next 25 % · ≥ 54</div><div class="bn" style="color:#F2B33D">◆ Upper</div></div>
 <div class="band" style="border-left:2px solid #8E8E89"><div class="label">Next 45 % · ≥ 38</div><div class="bn" style="color:#8E8E89">● Mid</div></div>
 <div class="band" style="border-left:2px solid #D9826B"><div class="label">Bottom 20 %</div><div class="bn" style="color:#D9826B">▽ Low</div></div>
</div>
<p class="small muted" style="margin-top:5px">Display-only, recomputed when the model or the eligible population changes; cut-points are tokens (example: top 76 · P90 61 · median 48). STRICT / hard-block shows ⊘ HOLD separately, never as a band. Rows, ring and pins share one band from the single score record (HF-01).</p>
'''
s=s.replace(OLD,NEW)
R('<span style="color:var(--red);font-size:9pt">✕ Write failed</span>','<span style="color:var(--red);font-size:9pt">⊗ Write failed</span>')
R('<span class="dot" style="background:var(--amber)"></span>Queued 12m</span>','<span class="dot" style="background:var(--amber)"></span>Waiting for lock 8 s</span>')
GL=r'''sec("11.6","Bands, Glyphs & Markers",1)
GLY=[("✕","Close","#A3A39E","Close panel / fullscreen only"),("⊖","Decline","#A3A39E","Decision — grey + word, separated from Pursue"),("⊗","Failed write","#FF4D3D","Red; keeps payload; Retry"),("⊘","Hard block / HOLD","#FF4D3D","STRICT FLEX etc.; outside bands"),("▲","Top 10 %","#4ADE80","Band"),("◆","Next 25 %","#F2B33D","Band"),("●","Mid 45 %","#8E8E89","Band"),("▽","Low 20 %","#D9826B","Band (Clay, not red)"),("◷","Waiting for Writer lock","#F2B33D","Seconds; auto-retry 8/15/30/45 s"),("⟳","Writing","#38E1D6","Live state (cyan = live)"),("✓","Confirmed","#4ADE80","Readback matched"),("Δ","Changed","#E6E6E2","White + neutral wipe; never cyan"),("◌","Stale evidence","#8A8F7A","Stored evidence under an older rule / pre-redeploy"),("⚠","Confirm shared publish","#F2B33D","Shared-model change gate")]
gh=''.join(f'<tr><td style="font-size:14pt;color:{c};text-align:center">{g}</td><td><b>{n}</b></td><td class="hx" style="font-family:var(--mono);font-size:8pt">{c}</td><td class="small">{u}</td></tr>' for g,n,c,u in GLY)
page(f"""<div class="sec">Section 11.6 · new in v1.5</div><h1 style="font-size:18pt;margin-bottom:6px">Bands, Glyphs &amp; Markers</h1>
<p class="small muted" style="margin-top:-2px">One glyph = one meaning. Weak, failed, Decline and Close no longer share ✕; red no longer means a low score; the changed marker is not cyan.</p>
<table class="tight"><tr><th style="width:30px">Glyph</th><th style="width:150px">Meaning</th><th style="width:66px">Colour</th><th>Use</th></tr>{gh}</table>
<div class="grid2" style="margin-top:8px">
<div class="card bar-g small" style="margin:0"><b>Change-strip example.</b> <span style="color:#E6E6E2">Δ</span> Anduril · Head of Production <b>77 → 72 → 59</b> — cause: FLEX evidence HIGH → NO (rules evidence update, rev 24 unchanged). Click opens the evidence diff.</div>
<div class="card bar-a small" style="margin:0"><b>◌ scope.</b> Never marks a model revision — scores are live. Marks only stored evidence that predates the current rule (185 / 603) or Writer-stamped values awaiting the Writer redeploy.</div></div>""","11.6 · Bands, Glyphs & Markers")

'''
R('# ---------- v1.3 new sections (inserted after Color System) ----------',GL+'# ---------- v1.3 new sections (inserted after Color System) ----------')
