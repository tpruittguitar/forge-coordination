# Pipeline Explorer look-owner pages (Grok Bot, 2026-10-18). v1.5 style with V-01..V-20 rulings applied.
# Every score/rank/cut-point comes from fixture.json (foreman-cockpit scoreRow() @ e7389ed on a mock population).
import json, html as H
FX=json.load(open('/workspace/pe/look_owner/src/fixture.json'))
CUT=FX['cuts']; AS_OF='18:30'; REV=FX['cfg']['rev']
CSS='''
:root{--void:#000;--hull:#0B0B0B;--plate:#141414;--raised:#1E1E1E;--seam:#2A2A2A;--grid:#3A3A3A;--outline:#6B6B66;
--p:#E6E6E2;--s:#A3A39E;--m:#6B6B66;--g:#4ADE80;--a:#F2B33D;--r:#FF4D3D;--c:#38E1D6;--o:#8A8F7A;--clay:#D9826B;--mid:#8E8E89;--div:#1c1c1c}
*{box-sizing:border-box}body{margin:0;background:#000;color:var(--p);font-family:Inter,sans-serif}
.mono{font-family:'IBM Plex Mono',monospace;letter-spacing:.12em;text-transform:uppercase}
.lbl{font-family:'IBM Plex Mono',monospace;letter-spacing:.08em;text-transform:uppercase;font-size:11px;color:var(--s)}
.s{color:var(--s)}.p{color:var(--p)}.g{color:var(--g)}.a{color:var(--a)}.r{color:var(--r)}.c{color:var(--c)}.o{color:var(--o)}
.u{text-decoration:underline;text-underline-offset:3px}
.panel{background:var(--hull);border:1px solid var(--seam)}
.ph{display:flex;justify-content:space-between;align-items:center;height:44px;padding:0 14px;border-bottom:1px solid var(--seam)}
.ph .t{font-family:'IBM Plex Mono',monospace;letter-spacing:.12em;text-transform:uppercase;font-size:13px;color:var(--p);white-space:nowrap}
.ph .x{font-family:'IBM Plex Mono',monospace;letter-spacing:.08em;text-transform:uppercase;font-size:11px;color:var(--s);white-space:nowrap}
.btn{border:1px solid var(--outline);color:var(--p);background:transparent;font-family:'IBM Plex Mono',monospace;letter-spacing:.06em;text-transform:uppercase;font-size:12px;padding:0 12px;height:32px;display:inline-flex;align-items:center;gap:8px;white-space:nowrap}
.chip{font-family:'IBM Plex Mono',monospace;letter-spacing:.08em;text-transform:uppercase;font-size:11px;padding:2px 7px;border:1px solid var(--outline);color:var(--s);white-space:nowrap;display:inline-block}
.pill{height:32px;display:inline-flex;align-items:center;gap:8px;padding:0 10px 0 9px;border:1px solid var(--outline);border-left-width:3px;font-family:'IBM Plex Mono',monospace;letter-spacing:.08em;text-transform:uppercase;font-size:12px;color:var(--s);white-space:nowrap;background:var(--hull)}
.pill b{font-weight:600;color:var(--p)}
.pill.ok{border-left-color:var(--outline)}.pill.warn{border-left-color:var(--a);color:var(--p)}.pill.fail{border-left-color:var(--r);color:var(--p)}.pill.live{border-left-color:var(--c);color:var(--p)}
.note{font-family:'IBM Plex Mono',monospace;letter-spacing:.06em;font-size:12px;color:var(--s);line-height:1.5}
.callout{position:absolute;font-family:'IBM Plex Mono',monospace;letter-spacing:.04em;font-size:12px;color:var(--s);line-height:1.45;border-left:2px solid var(--outline);padding-left:10px}
.callout b{color:var(--p);font-weight:600}
.dec{flex:1;height:44px;border:1px solid var(--outline);display:flex;align-items:center;justify-content:center;gap:8px;font-size:15px;font-weight:600}
'''
BANDC={'TOP':'var(--g)','UPPER':'var(--a)','MID':'var(--mid)','LOW':'var(--clay)'}
BANDG={'TOP':'▲','UPPER':'◆','MID':'●','LOW':'▽'}
def e(s): return H.escape(str(s))
def band_html(score,band,size=16,word=True):
    if band=='HOLD': return f'<span class="s" style="font-size:{size}px;font-weight:650">{score}</span> <span class="mono r" style="font-size:11px;letter-spacing:.06em">⊘ HOLD</span>'
    if band in (None,'NONE'): return f'<span class="s" style="font-size:{size}px;font-weight:650">{score}</span>'
    return f'<b style="font-size:{size}px;color:{BANDC[band]};font-weight:650">{score}</b> <span class="mono" style="font-size:11px;letter-spacing:.06em;color:{BANDC[band]}">{BANDG[band]}{" "+band if word else ""}</span>'
def rail(active='Pipeline'):
    it=[("▤","Pipeline"),("⇲","Intake"),("⚙","System"),("☷","Settings")]
    h=''.join(f'<div style="height:60px;display:flex;flex-direction:column;align-items:center;justify-content:center;color:{"var(--c)" if n==active else "var(--s)"};border-left:3px solid {"var(--c)" if n==active else "transparent"}"><div style="font-size:19px">{a}</div><div class="mono" style="font-size:11px;letter-spacing:.02em;margin-top:2px;text-transform:none">{n}</div></div>' for a,n in it)
    return f'<div style="grid-row:1 / -1;background:var(--hull);border:1px solid var(--seam);display:flex;flex-direction:column;padding-top:6px"><div style="height:44px;display:flex;align-items:center;justify-content:center;color:var(--s);font-size:18px;border-bottom:1px solid var(--seam);margin-bottom:6px">☰</div>{h}</div>'
def bell(n,blocking=False):
    bg='var(--r)' if blocking else 'var(--a)'
    return f'<span class="btn" style="position:relative;padding:0 12px"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 0 0 4 0"/></svg> Needs you <span style="background:{bg};color:#000;font:700 12px/18px Inter;min-width:22px;height:18px;padding:0 5px;text-align:center;border-radius:9px">{n}</span></span>'
def pills(state='ok'):
    # M-05 / M-06 HUD pill group. state: ok | busy | fail
    if state=='ok':
        P=['<span class="pill ok"><span class="g">✓</span> Seen sync · <b>18:29</b></span>',
           '<span class="pill ok">My decisions · <b>0</b> waiting</span>',
           '<span class="pill ok">Lane queue · <b>0</b></span>',
           '<span class="pill ok"><span class="g">✓</span> Lanes · <b>10</b> reporting</span>']
    elif state=='busy':
        P=['<span class="pill live"><span class="c">⟳</span> Seen sync · <b>4</b> marks sending</span>',
           '<span class="pill warn"><span class="a">◷</span> My decisions · <b>1</b> waiting for lock · <b>8 s</b></span>',
           '<span class="pill ok">Lane queue · <b>3</b> · oldest <b>2 min</b></span>',
           '<span class="pill warn"><span class="a">▸</span> <b>1</b> lane quiet · <b>1</b> run unfinished</span>']
    else:
        P=['<span class="pill fail"><span class="r">⊗</span> Seen marks not saving · since <b>18:12</b></span>',
           '<span class="pill fail"><span class="r">⊗</span> <b>1</b> decision failed · Retry</span>',
           '<span class="pill warn"><span class="a">▸</span> Lane queue · <b>14</b> · oldest <b>23 min</b></span>',
           '<span class="pill warn"><span class="a">▸</span> <b>1</b> lane quiet · <b>1</b> run unfinished</span>']
    return ''.join(P)
def topbar(crumb,state='busy',badge=3,blocking=False):
    return f'''<div style="display:flex;align-items:center;gap:12px;border-bottom:1px solid var(--seam);white-space:nowrap;overflow:hidden;min-width:0">
 <span class="mono" style="font-size:16px">Pipeline Explorer</span>
 <span class="lbl" style="font-size:12px">{crumb}</span>
 <span style="width:300px;border:1px solid var(--outline);background:var(--hull);padding:7px 12px;font-size:14px;color:var(--s)">⌕ Search jobs, companies… <span style="float:right" class="lbl">/</span></span>
 <span class="pill ok"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--g)"></span> Writer <b>idle</b></span>
 {pills(state)}
 <span style="margin-left:auto"></span>{bell(badge,blocking)}<span class="btn">? Shortcuts</span>
 <span style="background:var(--a);color:#000;font-family:'IBM Plex Mono',monospace;letter-spacing:.08em;text-transform:uppercase;font-size:12px;font-weight:650;padding:7px 12px">Concept · mock data</span>
</div>'''
def page(body,w,h,extra=''):
    return f'<!doctype html><meta charset="utf-8"><style>{CSS}{extra}</style><body><div style="width:{w}px;height:{h}px;position:relative;overflow:hidden;background:#000">{body}</div></body>'
def board_head(code,title,rulings,src='Scores, ranks and cut-points computed by foreman-cockpit scoreRow() @ e7389ed on a mock population'):
    return f'''<div style="position:absolute;left:40px;top:28px;right:40px;display:flex;align-items:baseline;gap:18px;border-bottom:1px solid var(--seam);padding-bottom:12px">
<span class="mono c" style="font-size:14px">{code}</span><span class="mono" style="font-size:22px">{title}</span>
<span class="lbl" style="margin-left:auto;font-size:12px">v1.5 style · rulings {rulings} · Grok Bot look owner · 2026-10-18 · PROPOSED</span></div>
<div class="note" style="position:absolute;left:40px;bottom:22px;right:40px;border-top:1px solid var(--seam);padding-top:10px">{src} · bands rank N {CUT['N']} eligible open jobs · P90 {CUT['P90']} · P65 {CUT['P65']} · P20 {CUT['P20']} · model rev {REV} · as of {AS_OF} ET · true size (1 CSS px = 1 px)</div>'''
COLS=[("",6),("SCORE",112),("Δ",40),("TITLE",184),("COMPANY",140),("LOCATION",112),("BUCKET",112),("BASE EST",72),("DEGREE FLEX",88),("EXP FIT",56),("AGE",36),("WRITE STATE",0)]
GT="grid-template-columns:"+" ".join(f"{w}px" if w else "1fr" for _,w in COLS)
def thead():
    return f'<div style="display:grid;{GT};gap:0 8px;align-items:center;height:36px;padding:0 12px 0 0;border-bottom:1px solid var(--outline);background:var(--hull)">'+''.join(f'<span class="lbl" style="white-space:nowrap;{"text-align:right" if n in ("SCORE","AGE","BASE EST","EXP FIT") else ""}">{n}</span>' for n,_ in COLS)+'</div>'
def trow(score,band,d,title,company,loc,bucket,base,flex,exp,age,ws,sel=False,dim=False,i=0,bucket_cls='p',ws_cls='s'):
    bg="var(--raised)" if sel else ("#070707" if i%2 else "var(--hull)")
    bar="var(--c)" if sel else "transparent"
    sh="box-shadow:inset 0 0 0 1px rgba(56,225,214,.35);" if sel else ""
    tc='var(--s)' if dim else 'var(--p)'
    return f'''<div style="display:grid;{GT};gap:0 8px;align-items:center;height:32px;padding:0 12px 0 0;border-bottom:1px solid var(--div);background:{bg};{sh}font-size:14px;color:{tc}">
<span style="height:100%;background:{bar}"></span><span style="text-align:right;white-space:nowrap">{band_html(score,band,16,True)}</span>
<span class="mono" style="font-size:11px;letter-spacing:.04em;color:var(--s)">{d}</span>
<span style="font-weight:{600 if sel else 540};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{title}</span>
<span style="color:var(--s);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{company}</span>
<span style="color:var(--s);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{loc}</span>
<span class="{bucket_cls}" style="white-space:nowrap;font-size:13px;overflow:hidden;text-overflow:ellipsis">{bucket}</span>
<span style="text-align:right;white-space:nowrap">{base}</span><span style="white-space:nowrap;font-size:13px">{flex}</span>
<span style="text-align:right;color:var(--s)">{exp}</span><span style="text-align:right;color:var(--s)">{age}</span>
<span class="{ws_cls}" style="white-space:nowrap;font-size:13px;overflow:hidden;text-overflow:ellipsis">{ws}</span></div>'''
import math
def ring(score,col,R=54,sw=8):
    C=2*math.pi*R;pct=score/100
    return f'<svg width="{2*R+sw*2}" height="{2*R+sw*2}"><circle cx="{R+sw}" cy="{R+sw}" r="{R}" fill="none" stroke="#1E1E1E" stroke-width="{sw}"/><circle cx="{R+sw}" cy="{R+sw}" r="{R}" fill="none" stroke="{col}" stroke-width="{sw}" stroke-dasharray="{C*pct:.1f} {C:.1f}" transform="rotate(-90 {R+sw} {R+sw})"/>'+''.join(f'<line x1="{R+sw}" y1="{sw/2-3}" x2="{R+sw}" y2="{sw/2+4}" stroke="#6B6B66" stroke-width="2" transform="rotate({a} {R+sw} {R+sw})"/>' for a in range(0,360,30))+f'<text x="{R+sw}" y="{R+sw+3}" fill="{col}" font-family="Inter" font-weight="680" font-size="{R*0.78:.0f}" text-anchor="middle" dominant-baseline="middle">{score}</text></svg>'
NAMES={'experience':'Experience fit','flex':'Degree FLEX','compensation':'Net compensation','geo':'Geography','title':'Title / scope','culture':'Company culture'}
ORDER=['experience','flex','compensation','geo','title','culture']
def breakdown(d):
    P={p['k']:p for p in d['parts']}
    rows=''
    for k in ORDER:
        p=P[k]
        if p['known']:
            col=BANDC['TOP'] if p['score']>=75 else (BANDC['UPPER'] if p['score']>=50 else 'var(--mid)')
            rows+=f'<div style="display:grid;grid-template-columns:150px 40px 1fr 74px;gap:8px;align-items:center;margin-bottom:5px;font-size:13px"><span class="s">{NAMES[k]}</span><span class="s" style="text-align:right">{p["w"]}%</span><span style="height:8px;background:var(--raised);position:relative"><span style="position:absolute;left:0;top:0;bottom:0;width:{p["score"]}%;background:var(--c);opacity:.6"></span></span><span style="text-align:right;font-weight:600">{p["shown"]:.1f}</span></div>'
        else:
            rows+=f'<div style="display:grid;grid-template-columns:150px 40px 1fr 74px;gap:8px;align-items:center;margin-bottom:5px;font-size:13px"><span class="s">{NAMES[k]}</span><span class="s" style="text-align:right">{p["w"]}%</span><span style="height:8px;border:1px dashed var(--outline)"></span><span class="mono s" style="text-align:right;font-size:11px;letter-spacing:.04em">? unknown</span></div>'
    kw=sum(p['w'] for p in d['parts'] if p['known'])
    foot=f'Σ known {kw}% = {d["rawShown"]:.1f} · coverage {d["confidence"]}% × factor {d["factor"]:.3f} = <b class="p">{d["overall"]}</b>' if d['confidence']<100 else f'Σ 100% = {d["rawShown"]:.1f} · coverage 100% × factor 1.000 = <b class="p">{d["overall"]}</b>'
    return f'''<div style="display:flex;justify-content:space-between;margin:12px 0 6px"><span class="lbl">Score breakdown · weight · points (normalized)</span><span class="lbl p">ring = {d["overall"]}</span></div>{rows}
<div class="mono s" style="font-size:11px;letter-spacing:.04em;margin-top:4px;text-transform:none">{foot}</div>
<div class="mono s" style="font-size:11px;letter-spacing:.04em;margin-top:3px;text-transform:none">Published model rev {REV} · all weights SHARED · points = weight × score ÷ Σ known weight</div>'''
def decisions(applied=False,closed=False):
    pursue='<div class="dec" style="flex:1.3;border-color:var(--g);color:var(--g);background:var(--raised)">✓ Pursue <span class="lbl" style="font-size:11px">P</span></div>'
    if closed: pursue='<div class="dec" style="flex:1.3;border-color:var(--seam);color:var(--s);font-weight:500;font-size:13px">✓ Pursue · closed</div>'
    hold=f'<div class="dec" style="border-color:var(--a);color:var(--a)">{HOLD_ICON} Hold <span class="lbl" style="font-size:11px">H</span></div>'
    res='<div class="dec" style="color:var(--p);font-weight:500">Research</div>'
    dec='<div class="dec" style="flex:1;color:var(--s);font-weight:500">⊖ Decline</div>'
    if applied:
        return '<div class="lbl" style="margin:12px 0 6px">Tim decision</div><div style="border:1px solid var(--seam);border-left:3px solid var(--g);background:var(--plate);padding:9px 12px;font-size:13.5px;line-height:1.45"><span class="mono g" style="font-size:12px">✓ Applied is protected</span><br><span class="s">The Writer refuses Decline and identity changes on APPLIED rows. Follow-up actions live on the Application tab.</span></div><div style="display:flex;gap:8px;margin-top:8px"><div class="dec" style="color:var(--p);font-weight:500">Open Application tab ›</div><div class="dec" style="flex:.8;border-color:var(--seam);color:var(--s);font-weight:500;font-size:13px">⊖ Decline · unavailable</div></div>'
    return f'<div class="lbl" style="margin:12px 0 6px">Tim decision</div><div style="display:flex;gap:8px">{pursue}{hold}{res}<div style="width:1px;background:var(--outline);margin:0 4px"></div>{dec}</div>'
HOLD_ICON='<svg width="12" height="14" viewBox="0 0 12 14" aria-hidden="true"><rect x="1" y="1" width="3.2" height="12" fill="currentColor"/><rect x="7.8" y="1" width="3.2" height="12" fill="currentColor"/></svg>'
TABS=["Overview","Posting","Fit & Score","Application","Documents","History"]
def drawer(d,jid,sub,chips,banner='',evidence='',why='',ring_col=None,band_line='',decisions_html=None,tab='Overview',h=1068):
    tabs=''.join(f'<span class="mono" style="padding:9px 9px;font-size:11px;letter-spacing:.06em;white-space:nowrap;color:{"var(--c)" if t==tab else "var(--s)"};border-bottom:2px solid {"var(--c)" if t==tab else "transparent"}">{e(t)}</span>' for t in TABS)
    rc=ring_col or BANDC.get(d['band'],'var(--s)')
    rcol={'var(--g)':'#4ADE80','var(--a)':'#F2B33D','var(--mid)':'#8E8E89','var(--clay)':'#D9826B','var(--s)':'#A3A39E'}[rc]
    return f'''<div class="panel" style="width:508px;height:{h}px;border-top:2px solid var(--c);overflow:hidden">
<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 16px 0"><span class="mono c" style="font-size:12px">◉ Job drawer · {jid}</span><span class="s" style="font-size:16px">‹ › ✕</span></div>
<div style="padding:4px 16px 0"><div style="font-size:25px;font-weight:650;line-height:1.15">{e(d['title'])}</div>
<div class="s" style="font-size:14.5px;margin-top:3px">{sub}</div>
<div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">{chips}</div></div>
{banner}
<div style="display:flex;border-bottom:1px solid var(--seam);margin:8px 0 0;padding:0 7px">{tabs}</div>
<div style="padding:10px 16px">
<div style="display:flex;gap:16px;align-items:center;padding-bottom:10px;border-bottom:1px solid var(--seam)">{ring(d['overall'],rcol)}<div>{band_line}</div></div>
{why}{evidence}{breakdown(d)}{decisions_html if decisions_html is not None else decisions()}
</div></div>'''
def ev(items):
    C={'g':'var(--g)','a':'var(--a)','s':'var(--outline)','o':'var(--o)','r':'var(--r)'}
    return ''.join(f'<div style="border-left:3px solid {C[c]};background:var(--plate);padding:6px 10px;margin-bottom:5px;font-size:14px">{g} {t}</div>' for c,g,t in items)
