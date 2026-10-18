from look_common import *
import datetime as dt
NT=json.load(open('needs_tim_20261018_1747ET.json'))
NOW=dt.datetime(2026,10,18,22,30,tzinfo=dt.timezone.utc)  # 18:30 ET
def ms(s):
    if not s: return None
    return dt.datetime.fromisoformat(s.replace('Z','+00:00'))
def age(s):  # same rule as pipeline-needs-tim.js age()
    t=ms(s);
    if not t: return ''
    m=max(0,round((NOW-t).total_seconds()/60))
    return f'{m} min' if m<60 else (f'{round(m/60)} h' if m<48*60 else f'{round(m/1440)} d')
GL={'BLOCKING':'⊘','ACTION':'▸','WATCH':'○'};LC={'BLOCKING':'var(--r)','ACTION':'var(--a)','WATCH':'var(--s)'};LB={'BLOCKING':'var(--r)','ACTION':'var(--a)','WATCH':'var(--outline)'}
repo=NT['items']
live=[
 dict(id='live:state-sync',section='FAILED',level='ACTION',title='Seen marks and incident acknowledgements are not saving to the Writer',detail='STATE_LOCK_TIMEOUT · this browser keeps them and resends on the next change; other devices will not see them until a save succeeds.',action='If it says STATE_UNREADABLE, ask Claude to restore PIPELINE_EXPLORER_STATE.json from its .prev copy.',at='2026-10-18T22:12:00Z',live=True,go=True),
 dict(id='live:jobs-decide',section='JOBS',level='ACTION',title='50 jobs waiting for your decision',detail='Bucket TIM_DECISION_REQUIRED. The lanes leave these alone until you rule.',action='Open the list and rule on each (Pursue / Hold / Research / Decline).',live=True,go=True),
 dict(id='live:jobs-ready',section='JOBS',level='ACTION',title='3 jobs ready for you to apply',detail='Bucket READY_TO_PURSUE with no blocker. Nothing moves until you apply or rule.',action='Apply, or rule Hold / Decline.',live=True,go=True),
 dict(id='live:jobs-decline',section='JOBS',level='WATCH',title='8 AI decline recommendations waiting for your OK',detail='An AI recommends declining; nothing is declined until you approve.',action='Review and approve or reject the declines.',live=True,go=True),
 dict(id='live:jobs-dead-active',section='UPKEEP',level='WATCH',title='2 closed postings still filed as active',detail="The employer's ATS reports these postings closed. They are hidden from your open queue.",action='Claude or a lane should file them CLOSED_DEAD.',live=True,go=True),
]
items=live+[dict(i,live=False) for i in repo]
order={'BLOCKING':0,'ACTION':1,'WATCH':2}
items.sort(key=lambda i:(order[i['level']], (ms(i.get('at')) or NOW).timestamp()))
cnt={'BLOCKING':0,'ACTION':0,'WATCH':0}
for i in items: cnt[i['level']]+=1
BADGE=cnt['BLOCKING']+cnt['ACTION']
SECTIONS=[('DECIDE','Decisions waiting on you'),('JOBS','Job decisions holding up processing'),('FAILED','Unresolved failures · Writer writes and automation runs'),('UPKEEP','Keep the system running')]
def meta(i):
    return ' · '.join([x for x in [i.get('raisedBy') or '', (age(i.get('at'))+' ago') if i.get('at') else '', 'live' if i.get('live') else ''] if x])
def card(i,phone=False,compact=False):
    if compact:
        return f'<div style="border:1px solid var(--seam);border-left:3px solid var(--outline);background:var(--plate);padding:0 12px;height:34px;display:flex;align-items:center;gap:10px;margin-bottom:6px;font-size:13.5px;white-space:nowrap"><span class="mono s" style="font-size:11px;letter-spacing:.1em">○ WATCH</span><span style="overflow:hidden;text-overflow:ellipsis;flex:1">{e(i["title"])}</span><span class="c u" style="font-size:13px">Source ↗</span><span class="mono s" style="font-size:11px;letter-spacing:.04em;text-transform:none">{age(i.get("at"))} ago</span></div>'
    lv=i['level'];btnh='44px' if phone else '32px'
    opts=''.join(f'<span class="btn" style="height:{btnh};text-transform:none;letter-spacing:0;font-family:Inter;font-size:13px">{e(o)}</span>' for o in (i.get('options') or []))
    detail='' if compact else (f'<div class="s" style="font-size:13px;line-height:1.45;margin-top:4px">{e(i.get("detail",""))}</div>' if i.get('detail') else '')
    action='' if compact else (f'<div class="s" style="font-size:13px;line-height:1.45;margin-top:4px"><b class="p" style="font-weight:600">What to do:</b> {e(i["action"])}</div>' if i.get('action') else '')
    foot=[]
    if i.get('go') or i.get('live'): foot.append(f'<span class="btn" style="height:{btnh}">Open →</span>')
    if i.get('sourceUrl') or (not i.get('live') and 'PR #' in i['title']): foot.append(f'<span class="btn" style="height:{btnh}">Source ↗</span>' if phone else '<span class="c u" style="font-size:13px">Source ↗</span>')
    if i.get('askId') or (not i.get('live') and i['section'] in ('DECIDE','JOBS')): foot.append(f'<span class="btn" style="height:{btnh}">Copy answer</span>')
    return f'''<div style="border:1px solid var(--seam);border-left:3px solid {LB[lv]};background:var(--plate);padding:{"10px 12px" if not compact else "8px 12px"};margin-bottom:8px">
<div style="display:flex;gap:{"10px" if not phone else "3px"};align-items:baseline;{"flex-direction:column" if phone else ""}"><span class="mono" style="font-size:11px;letter-spacing:.1em;color:{LC[lv]};white-space:nowrap;min-width:{"86px" if not phone else "0"}">{GL[lv]} {lv}</span><span style="font-size:{15 if not phone else 15}px;font-weight:600;line-height:1.3">{e(i["title"])}</span></div>
{detail}{action}{f'<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">{opts}</div>' if opts else ''}
<div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-top:8px">{''.join(foot)}<span class="mono s" style="margin-left:auto;font-size:11px;letter-spacing:.04em;text-transform:none">{e(meta(i))}</span></div></div>'''
def section(sid,title,w,phone=False):
    L=[i for i in items if i['section']==sid]
    head=f'<div class="ph"><span class="t">{e(title)}</span><span class="x"><b class="p">{len(L)}</b></span></div>'
    body=''.join(card(i,phone,compact=(i['level']=='WATCH' and 'PR #' in i['title'])) for i in L) if L else '<div class="s" style="padding:10px 14px;font-size:13px">✓ nothing waiting</div>'
    return f'<div class="panel" style="width:{w}px;display:flex;flex-direction:column;min-height:0;overflow:hidden">{head}<div style="padding:10px;overflow:hidden;flex:1;-webkit-mask-image:linear-gradient(#000 93%,transparent)">{body}</div><div class="lbl" style="height:28px;display:flex;align-items:center;padding:0 14px;border-top:1px solid var(--seam)">scrolls inside the column · ▾ {len(L)} items</div></div>'
def lanes_table():
    G={}
    for l in NT['lanes']: G.setdefault(l['lane'],[]).append(l)
    rows=[]
    for n,ls in G.items():
        ls=sorted(ls,key=lambda l:ms(l['lastAt']),reverse=True);nw=ls[0]
        rows.append(dict(lane=n,ais=' · '.join(x['provider'] for x in ls),lastAt=nw['lastAt'],status=nw['lastStatus'],gap=nw['usualGapHours'],runs=sum(x['runs7d'] for x in ls),quiet=all(x['overdue'] for x in ls)))
    rows.sort(key=lambda r:ms(r['lastAt']),reverse=True)
    cols='220px 300px 150px 220px 120px 110px 1fr'
    h=f'<div style="display:grid;grid-template-columns:{cols};gap:0 12px;padding:0 14px;height:30px;align-items:center;border-bottom:1px solid var(--outline)">'+''.join(f'<span class="lbl">{x}</span>' for x in ['Lane','AI (newest first)','Last receipt','Status','Usual gap','Runs 7 d','Health'])+'</div>'
    r=''
    for l in rows:
        q=l['quiet']
        r+=f'<div style="display:grid;grid-template-columns:{cols};gap:0 12px;padding:0 14px;height:25px;align-items:center;border-bottom:1px solid var(--div);font-size:13px"><span class="mono p" style="font-size:12px;letter-spacing:.06em">{e(l["lane"])}</span><span class="s">{e(l["ais"])}</span><span class="{"p" if q else "s"}">{age(l["lastAt"])} ago</span><span class="s">{e(str(l["status"]).replace("_"," "))}</span><span class="s">{"—" if l["gap"] is None else str(l["gap"])+" h"}</span><span class="s">{l["runs"]}</span><span>{"<span class=a>▸</span> <span class=p>quiet · over 2× usual gap</span>" if q else "<span class=g>✓</span> <span class=s>reporting</span>"}</span></div>'
    quiet=[l['lane'] for l in rows if l['quiet']]
    return [l['lane'] for l in rows],quiet,f'<div class="panel" style="overflow:hidden"><div class="ph"><span class="t">Lane heartbeat · {len(rows)} lanes · newest receipt per lane</span><span class="x"><span class="a">▸</span> {len(quiet)} quiet ({", ".join(quiet)}) · AIs on one lane count once · quiet = every AI on the lane past 2× its usual gap</span></div>{h}{r}</div>'
NAMES,QUIET,LANES=lanes_table()
unfinished=sum(1 for i in items if 'terminal receipt' in i['title'])
def hud_pills():
    return (f'<span class="pill fail"><span class="r">⊗</span> Seen marks not saving · since <b>18:12</b></span>'
            f'<span class="pill ok">My decisions · <b>0</b> waiting</span><span class="pill ok">Lane queue · <b>3</b> · oldest <b>2 min</b></span>'
            f'<span class="pill warn"><span class="a">▸</span> <b>{len(QUIET)}</b> lane quiet · <b>{unfinished}</b> run unfinished</span>')
def desk():
    tb=topbar('Pipeline › Needs you','ok',BADGE).replace(pills('ok'),hud_pills())
    tiles=[('⊘ Blocking',cnt['BLOCKING'],'var(--p)','nothing is blocking'),('▸ To act on',cnt['ACTION'],'var(--a)','bell badge = blocking + act on'),('○ To watch',cnt['WATCH'],'var(--p)','not counted in the badge'),('Lanes',len(NAMES),'var(--p)',f'▸ {len(QUIET)} quiet · {unfinished} run unfinished'),('Repo list','43 min','var(--p)','changed 43 min ago · rebuilt every 30 min'),('Live Writer','12 s','var(--p)','checked 12 s ago · idle')]
    kp=''.join(f'<div style="flex:1;background:var(--hull);border:1px solid var(--seam);padding:10px 16px"><div class="lbl" style="font-size:12px">{a}</div><div style="font-size:38px;font-weight:650;line-height:1.05;color:{c};margin-top:3px">{v}</div><div class="s" style="font-size:13px">{d}</div></div>' for a,v,c,d in tiles)
    jump=''.join(f'<span class="mono" style="padding:0 16px;height:100%;display:flex;align-items:center;gap:8px;font-size:12.5px;letter-spacing:.08em;color:{"var(--c)" if k=="ALL" else "var(--s)"};border-bottom:2px solid {"var(--c)" if k=="ALL" else "transparent"}">{t} <span class="p">{n}</span></span>' for k,t,n in [('ALL','All',len(items))]+[(s,s.title() if s!='FAILED' else 'Failed',sum(1 for i in items if i['section']==s)) for s,_ in SECTIONS])
    strip=f'<div style="display:flex;align-items:center;gap:16px;background:var(--hull);border:1px solid var(--seam);border-left:3px solid var(--c);padding:0 16px;font-size:14px;white-space:nowrap"><span class="lbl" style="font-size:12px">How to answer</span><span>Press an option or <b>Copy answer</b>, paste it into your Claude chat, and Claude records the ruling.</span><span class="s">Nothing on this page writes anything by itself.</span><span style="margin-left:auto" class="s">4 items hidden as already done (asks/resolved/)</span><span class="btn">⟳ Refresh</span></div>'
    W=(2560-40-56-12-3*16)//4
    cols=''.join(section(s,t,W) for s,t in SECTIONS)
    return f'''<div style="width:2560px;height:1440px;background:#000;padding:20px;display:grid;grid-template-columns:56px 1fr;grid-template-rows:56px 44px 96px 40px 1fr 330px;column-gap:12px;row-gap:12px">
{rail('System').replace('grid-row:1 / -1','grid-row:1 / -1')}
{tb}
<div style="display:flex;align-items:stretch;border-bottom:1px solid var(--seam)"><span class="mono" style="font-size:16px;display:flex;align-items:center;padding-right:18px">Needs you</span>{jump}<span class="lbl" style="margin-left:auto;display:flex;align-items:center;font-size:12px">sorted blocking → act on → watch, oldest first · as of {AS_OF}</span></div>
<div style="display:flex;gap:12px">{kp}</div>
{strip}
<div style="display:flex;gap:16px;min-height:0">{cols}</div>
{LANES}
</div>'''
open('m01d.html','w').write(page(desk(),2560,1440))
# ---------- phone 402 x 874 ----------
def phone():
    L=[i for i in items if i['level']!='WATCH']
    chips=''.join(f'<span class="mono" style="height:36px;display:inline-flex;align-items:center;padding:0 10px;font-size:11px;letter-spacing:.06em;border:1px solid var(--outline);{"background:var(--c);color:#000;border-color:var(--c);font-weight:650" if k=="ACT" else "color:var(--s)"}">{t}</span>' for k,t in [('ACT',f'▸ Act on {cnt["ACTION"]}'),('W',f'○ Watch {cnt["WATCH"]}'),('L',f'Lanes ▸{len(QUIET)}')])
    cards=''.join(card(i,phone=True) for i in L[:3])
    bell_svg='<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 0 0 4 0"/></svg>'
    t=[("☰","Queue"),("◎","Map"),("△","Changes"),("⌕","Search")]
    tb=''.join(f'<div style="flex:1;text-align:center;color:var(--s);padding-top:9px"><div style="font-size:21px;line-height:1">{a}</div><div style="font-size:11px;margin-top:4px">{b}</div></div>' for a,b in t)
    return f'''<div style="width:402px;height:874px;position:relative;background:#000;overflow:hidden">
<div style="position:absolute;left:0;right:0;top:0;height:62px;display:flex;justify-content:space-between;align-items:center;padding:0 34px 0 40px;font-size:15px;font-weight:600"><span>18:30</span><span style="width:126px;height:37px;border-radius:19px;background:#000;border:1px solid #111"></span><span class="s" style="font-size:12px">●●● ▮</span></div>
<div style="position:absolute;left:24px;right:24px;top:74px">
<div style="display:flex;justify-content:space-between;align-items:center;height:44px"><span class="c" style="font-size:17px">‹ Queue</span><span style="width:44px;height:44px;border:1px solid var(--c);color:var(--c);display:flex;align-items:center;justify-content:center;position:relative">{bell_svg}<span style="position:absolute;top:-6px;right:-8px;background:var(--a);color:#000;font:700 12px/18px Inter;min-width:20px;height:18px;border-radius:9px;text-align:center;padding:0 4px">{BADGE}</span></span></div>
<div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px"><span class="mono" style="font-size:17px">Needs you</span><span class="btn" style="height:44px">⟳ Refresh</span></div>
<div style="font-size:14px;margin-top:6px"><span class="s">⊘ {cnt["BLOCKING"]} blocking</span> · <span class="a">▸</span> <b>{cnt["ACTION"]}</b> to act on · <span class="s">○ {cnt["WATCH"]} to watch</span></div>
<div class="s" style="font-size:12px;margin-top:3px">Repo list changed 43 min ago · live Writer checked 12 s ago</div>
<div style="display:flex;gap:6px;margin-top:10px">{chips}</div>
<div style="margin-top:10px;border:1px solid var(--seam);border-left:3px solid var(--r);background:var(--plate);padding:8px 12px;font-size:13px"><span class="r">⊗</span> <b>Seen marks not saving</b> <span class="s">· since 18:12 · this phone keeps them</span></div>
<div style="margin-top:10px;height:{760-74-278}px;overflow:hidden;-webkit-mask-image:linear-gradient(#000 88%,transparent)">{cards}</div>
</div>
<div style="position:absolute;left:36px;right:36px;top:760px;height:64px;background:rgba(14,14,14,.97);border:1px solid var(--seam);border-radius:16px;display:flex;box-shadow:0 -6px 24px rgba(0,0,0,.7)">{tb}</div>
<div style="position:absolute;left:134px;width:134px;top:861px;height:5px;border-radius:3px;background:#E6E6E2"></div>
</div>'''
open('m01p.html','w').write(page(phone(),402,874))
print('counts',cnt,'badge',BADGE,'lanes',len(NAMES),QUIET,'unfinished',unfinished,'items',len(items))
