from look_common import *
def bar(state,badge,blocking=False):
    return f'<div style="width:2480px;height:56px;display:grid">{topbar("Pipeline › Review queue",state,badge,blocking)}</div>'
rowsdef=[
('Seen sync (M-05)','<span class="pill ok"><span class="g">✓</span> Seen sync · <b>18:29</b></span>','<span class="pill live"><span class="c">⟳</span> Seen sync · <b>4</b> marks sending</span>','<span class="pill fail"><span class="r">⊗</span> Seen marks not saving · since <b>18:12</b></span>',
 'S.stateSync {ok, at, error} (pipeline.html syncStateUp → Writer action state). Count = seen marks in the pending batch. FAIL when ok===false; time = first failed at.','Needs you › Failed › "Seen marks and incident acknowledgements are not saving"'),
('My decisions (N-02 counter 1)','<span class="pill ok">My decisions · <b>0</b> waiting</span>','<span class="pill warn"><span class="a">◷</span> My decisions · <b>1</b> waiting for lock · <b>8 s</b></span>','<span class="pill fail"><span class="r">⊗</span> <b>1</b> decision failed · Retry</span>',
 'Explorer write state machine (gsPostRetryBusy_ direct posts): count in WAITING_FOR_LOCK; seconds = time to next retry (8/15/30/45 s). FAIL = count in FAILED. Never includes lane writes.','My rulings (RULED preset) filtered to waiting / failed'),
('Lane queue (N-02 counter 2)','<span class="pill ok">Lane queue · <b>0</b></span>','<span class="pill warn"><span class="a">▸</span> Lane queue · <b>14</b> · oldest <b>23 min</b></span>','<span class="pill fail"><span class="r">⊘</span> Lane queue stopped · trigger missing</span>',
 'writer_status.queue.pending + oldestPendingAt (WRITER_QUEUE folder). Amber ▸ only when the Writer raises QUEUE_BACKLOG (oldest > 10 min) or QUEUE_HOLD; red ⊘ "Lane queue stopped" when TRIGGER_MISSING.','System › Writer (queued / held rows)'),
('Lane health (M-06)','<span class="pill ok"><span class="g">✓</span> Lanes · <b>10</b> reporting</span>','<span class="pill warn"><span class="a">▸</span> <b>1</b> lane quiet · <b>1</b> run unfinished</span>','<span class="s" style="font-size:13px">none · a quiet lane is attention, never a failure</span>',
 'NEEDS_TIM.json lanes[]: distinct lane names (10 today); quiet = lanes with overdue=true (POSTVAL today, 3 providers count as 1); unfinished = FAILED-section items "run never wrote a terminal receipt" (1 today). No red state.','Needs you › Lane heartbeat'),
]
leg='<div class="panel" style="width:2480px"><div class="ph"><span class="t">Pill states · words + glyph + left bar · click opens the named place</span><span class="x">pill 32 high · 1 px #6B6B66 outline (3.67:1 on Hull) · 3 px left bar · mono 12 px</span></div>'
leg+='<div style="display:grid;grid-template-columns:240px 300px 420px 440px 1fr 400px;gap:0 16px;padding:10px 14px;border-bottom:1px solid var(--outline)">'+''.join(f'<span class="lbl">{h}</span>' for h in ['Pill','OK / quiet','Working / attention','Failed / blocking','Source (L-2: app-computed only)','Click opens'])+'</div>'
for n,a,b,c,src,go in rowsdef:
    leg+=f'<div style="display:grid;grid-template-columns:240px 300px 420px 440px 1fr 400px;gap:0 16px;padding:12px 14px;border-bottom:1px solid var(--div);align-items:center"><span class="mono p" style="font-size:12px">{n}</span><span>{a}</span><span>{b}</span><span>{c}</span><span class="s" style="font-size:13px;line-height:1.4">{src}</span><span class="s" style="font-size:13px">{go}</span></div>'
leg+='</div>'
body=board_head('M-05 · M-06','HUD pills · state sync · two queue counters · lane health','V-04 V-05 V-10 V-11 · N-02',src='Lane counts from attention/NEEDS_TIM.json built 17:47 ET; other counts mock')+f'''
<div style="position:absolute;left:40px;top:96px">
<div class="lbl" style="margin-bottom:6px">State A · all quiet (pills stay, neutral; nothing glows at rest)</div>{bar('ok',3)}
<div class="lbl" style="margin:22px 0 6px">State B · working: seen marks sending, one of my decisions waiting for the Writer lock, lane queue draining, one lane quiet</div>{bar('busy',4)}
<div class="lbl" style="margin:22px 0 6px">State C · failed: seen sync failing, one decision failed, lane backlog · badge stays amber (no BLOCKING item); it turns red only when one exists, with black text on red (6.38:1, not white 3.29:1)</div>{bar('fail',5,False)}
<div style="margin-top:30px">{leg}</div>
<div class="note" style="margin-top:18px;width:2480px">Rules · Pills are always present in the same order (position is part of meaning) · colour only on the 3 px left bar and the glyph; the word always states the state · red = failed write / hard block only, amber = waiting or attention, cyan ⟳ = a write in flight (live), grey = quiet · the two queue counters are never summed (mine vs lanes, N-02) · lane quiet count de-duplicates providers ("handed to another AI counts as one lane") · ◷ pulse ≤ 5 s then steady + seconds counter (v1.5.1 loop rule) · pills never flash; a state change is a single 120 ms fade · at &lt; 2200 px wide pills collapse to glyph + count with the full sentence as accessible name and tooltip.</div>
</div>'''
open('m05.html','w').write(page(body,2560,1440))
