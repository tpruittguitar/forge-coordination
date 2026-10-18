import re
B='/workspace/pe/build151/'
def P(f,pairs):
    s=open(B+f).read()
    for a,b in pairs:
        if a not in s: print('MISS',f,a[:70]); continue
        s=s.replace(a,b)
    open(B+f,'w').write(s)
P('mapsvg.py',[('fill="#4ADE80" font-family="{MONO}" font-size="{10.5*s:.1f}">82 ✓ STRONG <tspan fill="#E6E6E2">· $230K est.</tspan></text>',
 'fill="#F2B33D" font-family="{MONO}" font-size="{10.5*s:.1f}">◆ UPPER · 57 <tspan fill="#A3A39E">· rank 9 of 412 eligible open · 14:32</tspan></text>'),
 ('bw,bh=214*s,58*s','bw,bh=262*s,58*s')])
P('desk.py',[('<span style="color:#8A8F7A">◌ 185 provisional</span>','<span style="color:#8A8F7A">◌ 185 stale evidence · as of 14:32</span>'),
 ('("Stale evidence","185","#8A8F7A","◌ FLEX class stamped under older rule",False)','("Stale evidence","185","#8A8F7A","◌ live count · of 603 · as of 14:32",False)'),
 ('<span style="margin-left:auto;{MONO};font-size:11px;color:#6B6B66">Ticker scrolls ← · pauses on hover</span>',
  '<span style="margin-left:auto;{MONO};font-size:12px;color:#E6E6E2;border:1px solid #A3A39E;padding:2px 8px">❚❚ Pause</span><span style="{MONO};font-size:12px;color:#E6E6E2;border:1px solid #A3A39E;padding:2px 8px">Hide</span><span style="{MONO};font-size:11px;color:#A3A39E">routine bot events muted · 4 deduped</span>'),
 ('"Auto-fit 600 ms · ⤢ fullscreen"','"Auto-fit 300 ms · ⤢ fullscreen"')])
P('scoring.py',[('<span><b>418 / 603</b> evidence current · 69 %</span><span style="color:{OL}">◌ 185 stamped under older rule</span>','<span><b>418 / 603</b> evidence current · live · as of 14:32</span><span style="color:{OL}">◌ 185 stale (live)</span>'),
 ('<span style="color:{OL}">◌ 185 stale evidence</span>','<span style="color:{OL}">◌ 185 stale evidence · 14:32</span>')])
P('desk.py',[('▲ Top 10% · opportunity rating 76</div><div style="font-size:13px;color:#A3A39E;margin-top:4px">Model rev 24 · computed 23:38 ·','▲ TOP 10% · rank 1 of 412 eligible open · 14:32</div><div style="font-size:13px;color:#A3A39E;margin-top:4px">Score 76 (relative rank, not a fit verdict) · rev 24 ·')])
P('mobile.py',[('▲ Top 10% · model rev 24</div><div style="font-size:12.5px;color:#A3A39E">','▲ TOP 10% · rank 1 / 412 open</div><div style="font-size:12.5px;color:#A3A39E">')])
