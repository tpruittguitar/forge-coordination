# v1.5 patch: gen14.py -> gen15.py (reviewer items 1–11 relayed by Tim, 2026-10-15)
import re
B='/workspace/pe/build151/'
s=open(B+'gen14.py').read().replace('/workspace/pe/build14','/workspace/pe/build151')
miss=[]
def R(a,b,need=True):
    global s
    if a not in s:
        if need: miss.append(a[:90])
        return
    s=s.replace(a,b)
R('<div>1.4 <span class="muted">(supersedes 1.3)</span></div>','<div>1.5 <span class="muted">(supersedes 1.4)</span></div>')
R('<div class="label">New in 1.4</div><div class="muted" style="font-size:10pt">Full app coverage from the live inventory · scoring page section + HF-19 · map: selected job or filtered set, radar removed · mobile perimeter insets + camera keep-out · inventory task register</div>',
  '<div class="label">New in 1.5</div><div class="muted" style="font-size:10pt">Re-baselined on main (PRs #111–#115) · one shared scoring model, honest all-SHARED weights · Writer timed in seconds · percentile score bands · distinct glyphs · ◌ keyed on stale evidence · architecture phase before motion</div>')
R('<div class="num" style="font-size:20pt">5 + M</div><div class="muted small">Baseline → Adaptive + Mobile track</div>','<div class="num" style="font-size:20pt">6 + M</div><div class="muted small">Baseline → Architecture → Adaptive + Mobile</div>')
R('v1.4 · Oct 15 2026 · Prepared for Tim Pruitt','v1.5 · Oct 15 2026 · Prepared for Tim Pruitt')
R('Implementation Plan v1.4</title>','Implementation Plan v1.5</title>')
R('Proposed · v1.4 · October 15, 2026.','Proposed · v1.5 · October 15, 2026.')
