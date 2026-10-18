# v1.4 concept mockup: Settings > Flex policy & scoring (2560 x 1440), redesigned. CONCEPT - MOCK DATA.
from desk import rail, MONO, U, badge, OL
from mapsvg import geo_heat_svg, CP, ramp
import math
def card(title,scope,body,extra="",bar="#2A2A2A"):
    return f'<div style="background:#0B0B0B;border:1px solid #2A2A2A;border-left:3px solid {bar};margin-bottom:10px"><div style="display:flex;justify-content:space-between;align-items:center;height:44px;padding:0 14px;border-bottom:1px solid #2A2A2A"><span style="{MONO};font-size:13px;color:#E6E6E2;white-space:nowrap">{title}</span><span style="display:flex;gap:6px">{scope}{extra}</span></div><div style="padding:10px 14px;font-size:14px">{body}</div></div>'
SH=badge("SHARED · every viewer &amp; agent","shared"); LO=badge("LOCAL · this browser","local")
def lbl(t): return f'<div style="{MONO};font-size:11px;color:#A3A39E;margin:7px 0 4px">{t}</div>'
def btn(t,kind="n"):
    st={"n":"border:1px solid #3A3A3A;color:#E6E6E2","p":"border:1px solid #38E1D6;color:#000;background:#38E1D6;font-weight:650","a":"border:1px solid #F2B33D;color:#000;background:#F2B33D;font-weight:650","g":"border:1px solid #3A3A3A;color:#A3A39E"}[kind]
    return f'<span style="{st};{MONO};font-size:11.5px;letter-spacing:.06em;padding:9px 12px;white-space:nowrap;display:inline-block">{t}</span>'
def flex_card():
    rows=[("Degree not stated","HIGH_FLEX"),("Equivalent experience","HIGH_FLEX"),("Hard degree requirement","NO_FLEX"),("Confirmed single degree path","STRICT")]
    rc={"HIGH_FLEX":"#4ADE80","SOFT_FLEX":"#F2B33D","NO_FLEX":"#A3A39E","STRICT":"#FF4D3D"}
    tr=''.join(f'<div style="display:grid;grid-template-columns:1fr 150px;gap:8px;align-items:center;height:28px;border-bottom:1px solid #1c1c1c"><span>{a}</span><span style="border:1px solid #3A3A3A;padding:4px 8px;{MONO};font-size:11.5px;color:{rc[b]}">{b} ▾</span></div>' for a,b in rows)
    mods=''.join(f'<div style="flex:1;background:#141414;border:1px solid #2A2A2A;padding:4px 9px"><div style="{MONO};font-size:10.5px;color:#A3A39E">{a}</div><div style="font-size:22px;font-weight:650;color:{c}">{v}</div></div>' for a,v,c in (("HIGH_FLEX","90","#4ADE80"),("SOFT_FLEX","70","#F2B33D"),("NO_FLEX","−60","#A3A39E"),("STRICT","−100","#FF4D3D")))
    body=f'''<div style="display:flex;align-items:center;gap:14px"><span style="{MONO};font-size:11px;color:#A3A39E">FLEX scoring weight</span><span style="border:1px solid #F2B33D;padding:5px 12px;font-size:22px;font-weight:650">30 <span style="font-size:14px;color:#A3A39E">%</span></span><span style="color:#A3A39E;font-size:13px">a row of the one shared scoring model (rev 24) · {btn("Update FLEX weight","a")}</span></div>
{lbl("FLEX class → score component (fixed, in the score)")}<div style="display:flex;gap:8px">{''.join(f'<div style="flex:1;background:#141414;border:1px solid #2A2A2A;padding:4px 9px"><div style="{MONO};font-size:10.5px;color:#A3A39E">{a}</div><div style="font-size:22px;font-weight:650">{v}</div></div>' for a,v in (("HIGH","80"),("SOFT","62"),("NO","30"),("STRICT","0")))}</div>
{lbl("Eligibility policy · TIM_PIPELINE_RULES_CANONICAL › SECTION=DEGREE_FLEX · consumed by Writer")}{tr}
{lbl("Policy modifiers · canonical rules · ADJUSTED_FIT + PURSUIT_STATUS only — never the score")}<div style="display:flex;gap:8px">{mods}</div>
<div style="display:flex;justify-content:space-between;margin-top:10px;font-size:13.5px"><span>Fresh degree evidence overrides stale FLEX</span><span style="{MONO};font-size:11.5px;color:#4ADE80">YES ▾</span></div>
<div style="margin-top:12px;border:1px solid #F2B33D;background:rgba(242,179,61,.07);padding:10px 12px">
<div style="{MONO};font-size:11.5px;color:#F2B33D">⚠ Confirm shared change · FLEX weight 30 → 25 % (other weights rebalance to 100)</div>
<div style="font-size:13.5px;margin:4px 0 7px;line-height:1.4">Publishes shared model <b>rev 25</b> for <b>every viewer and agent</b> (save_scoring_model). Preview: <b>211 of 603</b> scores change · <b>17 change percentile band</b> (▼ 12 · ▲ 5). Scores compute live — no recalc wait; write completes in seconds.</div>
<div style="display:flex;gap:8px">{btn("Confirm &amp; save shared","a")}{btn("Cancel")}{btn("View 17 band changes ›","g")}</div></div>
<div style="margin-top:9px;border-left:3px solid #4ADE80;background:#141414;padding:7px 10px;font-size:13px;display:flex;justify-content:space-between"><span><span style="color:#4ADE80">✓ RECEIPT rev 24</span> · published 22:34 by Tim · Writer readback ✓ 4 s</span><span style="color:#38E1D6;{U}">Undo = republish rev 23</span></div>'''
    return card("A · FLEX weight (model) &amp; FLEX policy (rules)",SH,body,bar="#F2B33D")
def vnext_card():
    W=[("Manufacturing domain alignment",25),("Prototype-to-rate opportunity",20),("Analogous operating experience",15),("Scope / authority / title progression",15),("Strategic employer clout",10),("Compensation economics",10),("Geography",5)]
    wb=''.join(f'<div style="display:grid;grid-template-columns:1fr 160px 44px;gap:8px;align-items:center;margin-bottom:1px;font-size:13px"><span style="color:#A3A39E">{n}</span><span style="height:7px;background:#1E1E1E"><span style="display:block;height:100%;width:{v*4}%;background:#38E1D6;opacity:.6"></span></span><span style="text-align:right">{v}%</span></div>' for n,v in W)
    G=[("24+ user-labeled rows","✕ 9 / 24","#FF4D3D"),("Pairwise accuracy > 70 %","— not run","#6B6B66"),("Good avg materially above bad avg","— not run","#6B6B66"),("Evidence mapping row → VNext","◷ partial","#F2B33D"),("Explicit Tim approval to publish","— not requested","#6B6B66")]
    gb=''.join(f'<div style="display:flex;justify-content:space-between;height:25px;align-items:center;border-bottom:1px solid #1c1c1c;font-size:13px"><span>{a}</span><span style="{MONO};font-size:11px;color:{c}">{b}</span></div>' for a,b,c in G)
    body=f'''<div style="font-size:13px;color:#A3A39E;margin-bottom:6px">DESIGN_AND_BACKTEST_ONLY · cannot publish. Live model stays <b style="color:#E6E6E2">TIM_WEIGHTED_JOB_RATING 2026-10-04.1</b>.</div>{lbl("Proposed weight shape (preview)")}{wb}{lbl("Cutover gates")}{gb}'''
    return card("B · VNext backtest gate",badge("PREVIEW ONLY","cy"),body,badge("✕ NOT READY","red"),bar="#38E1D6")
def model_card():
    body=f'''<div style="display:flex;justify-content:space-between;font-size:14px"><span>Published <b>rev 24</b> · v2026-10-14.1 · Oct 14, 10:34 PM</span><span style="color:#38E1D6;{U}">SCORING_MODEL.md</span></div>
{lbl("Stored evidence freshness · FLEX_CLASS vs current DEGREE_FLEX rule")}
<div style="height:14px;background:#1E1E1E;position:relative;border:1px solid #2A2A2A"><div style="position:absolute;left:0;top:0;bottom:0;width:69%;background:linear-gradient(90deg,#38E1D6,#2bb3aa)"></div></div>
<div style="display:flex;justify-content:space-between;font-size:13px;margin-top:5px"><span><b>418 / 603</b> evidence current · live · as of 14:32</span><span style="color:{OL}">◌ 185 stale (live)</span></div>
<div style="font-size:13px;color:#A3A39E;margin:6px 0 8px">Scores compute live from rev 24, so a model change never leaves stale scores. ◌ marks rows whose <b>stored evidence</b> is stale (old FLEX rule; Writer-stamped values pending the Writer Apps Script redeploy).</div>
<div style="display:flex;gap:8px">{btn("Score tester (one job)…")}{btn("Load published")}{btn("Restore rev 23…")}</div>'''
    return card("C · Shared model",SH,body,badge("◌ 185 STALE EVIDENCE","prov"),bar="#F2B33D")
def weights_card():
    W=[("Experience",35,"#4ADE80",False),("FLEX",30,"#F2B33D",False),("Compensation",15,"#38E1D6",False),("Geography",10,"#38E1D6",False),("Title",5,"#A3A39E",False),("Culture",5,"#A3A39E",False),("ATS",0,"#6B6B66",False),("Ownership",0,"#6B6B66",False)]
    seg=''.join(f'<div style="width:{v}%;background:{c};{"background-image:repeating-linear-gradient(45deg,rgba(0,0,0,.35) 0 6px,transparent 6px 12px);" if sh else "opacity:.75;"}border-right:2px solid #000;display:flex;align-items:center;justify-content:center;{MONO};font-size:10.5px;color:#000;font-weight:650;white-space:nowrap;overflow:hidden">{n.split(" ")[0] if v>=10 else ""} {v if v>=5 else ""}</div>' for n,v,c,sh in W if v>0)
    rows=''.join(f'<div style="display:grid;grid-template-columns:150px 1fr 64px;gap:10px;align-items:center;height:32px;border-bottom:1px solid #1c1c1c"><span style="color:{"#F2B33D" if sh else "#E6E6E2"}">{n}</span><span style="height:4px;background:#1E1E1E;position:relative"><span style="position:absolute;left:0;top:0;bottom:0;width:{v/40*100:.0f}%;background:{c}"></span><span style="position:absolute;left:{v/40*100:.0f}%;top:-6px;width:3px;height:16px;background:#E6E6E2"></span></span><span style="border:1px solid {"#4a3a17" if sh else "#3A3A3A"};text-align:right;padding:3px 8px">{v}</span></div>' for n,v,c,sh in W)
    body=f'''<div style="display:flex;justify-content:space-between;align-items:baseline"><span style="{MONO};font-size:11px;color:#A3A39E">Opportunity rating · total weight</span><span style="font-size:15px"><b style="color:#4ADE80">100 %</b> = 35 + 30 + 15 + 10 + 5 + 5 + 0 + 0 · all SHARED</span></div>
<div style="display:flex;height:30px;margin:8px 0 4px;border:1px solid #2A2A2A">{seg}</div>
<div style="font-size:12.5px;color:#A3A39E;margin-bottom:6px">One row per weight, FLEX included; every weight is part of the one shared, revision-numbered model (rev 24). Fixes the stale “ranks rows on this browser” copy. {btn("Update weights &amp; salary","a")}</div>{rows}'''
    return card("D · Ranking weights",SH,body,bar="#3A3A3A")
def salary_card():
    W,H=560,190; x0,x1=150,330
    X=lambda v:(v-x0)/(x1-x0)*(W-50)+40; Y=lambda s:H-26-(s/100)*(H-46)
    def sc(v):
        if v<=190: return 0
        if v<=240: return 50*(v-190)/50
        if v<=300: return 50+50*(v-240)/60
        return 100
    pts=' '.join(f'{X(v):.1f},{Y(sc(v)):.1f}' for v in range(150,331,2))
    g=''.join(f'<line x1="{X(v):.1f}" y1="10" x2="{X(v):.1f}" y2="{H-26}" stroke="#1c1c1c"/><text x="{X(v):.1f}" y="{H-8}" fill="#6B6B66" font-family="IBM Plex Mono" font-size="11" text-anchor="middle">{v}K</text>' for v in range(160,331,40))
    mk=''.join(f'<line x1="{X(v):.1f}" y1="10" x2="{X(v):.1f}" y2="{H-26}" stroke="{c}" stroke-dasharray="4 4"/><circle cx="{X(v):.1f}" cy="{Y(s):.1f}" r="5" fill="#000" stroke="{c}" stroke-width="2"/><text x="{X(v)+6:.1f}" y="22" fill="{c}" font-family="IBM Plex Mono" font-size="11">{n} {v}K → {s}</text>' for v,s,n,c in ((190,0,"FLOOR","#FF4D3D"),(240,50,"TARGET","#F2B33D"),(300,100,"CEILING","#4ADE80")))
    job=f'<circle cx="{X(245):.1f}" cy="{Y(sc(245)):.1f}" r="6" fill="#38E1D6"/><text x="{X(245)+8:.1f}" y="{Y(sc(245))+18:.1f}" fill="#38E1D6" font-family="IBM Plex Mono" font-size="11">JOB-0412 $245K → {sc(245):.0f} raw</text>'
    svg=f'<svg width="{W}" height="{H}" style="display:block"><rect width="{W}" height="{H}" fill="#050505"/>{g}<polyline points="{pts}" fill="none" stroke="#E6E6E2" stroke-width="2"/>{mk}{job}<text x="4" y="{Y(100)+4:.1f}" fill="#6B6B66" font-family="IBM Plex Mono" font-size="11">100</text><text x="4" y="{Y(0)+4:.1f}" fill="#6B6B66" font-family="IBM Plex Mono" font-size="11">0</text></svg>'
    f=lambda n,v: f'<div style="flex:1"><div style="{MONO};font-size:10.5px;color:#A3A39E">{n}</div><div style="border:1px solid #3A3A3A;padding:5px 8px;margin-top:3px;font-size:15px">{v}</div></div>'
    body=f'''<div style="display:flex;gap:8px;margin-bottom:9px">{f("Salary floor","190,000")}{f("Salary target","240,000")}{f("Salary ceiling","300,000")}{f("Geo interp. power","6")}</div>{svg}
<div style="font-size:12.5px;color:#A3A39E;margin-top:6px">Net compensation = midpoint × state net-value factor. Authority: canonical pay / geo rules (<b style="color:#E6E6E2">COMPENSATION_GEOGRAPHY</b> in TIM_PIPELINE_RULES_CANONICAL); this curve may not contradict them.</div>'''
    return card("E · Salary curve · pay",SH,body,bar="#3A3A3A")
def preview_card():
    body=f'''<div style="{MONO};font-size:11px;color:#38E1D6">Draft changes · 2 · not yet published</div>
<div style="font-size:13.5px;margin:6px 0;line-height:1.5">• Austin, TX dragged 31.20°N 098.60°W → 30.27°N 097.74°W<br>• New point (click) Columbus, GA · 32.50°N 085.00°W · score 85</div>
<div style="display:flex;gap:8px;margin:8px 0">
<div style="flex:1;background:#141414;border:1px solid #2A2A2A;padding:7px 10px"><div style="{MONO};font-size:10.5px;color:#A3A39E">Scores change</div><div style="font-size:26px;font-weight:650;color:#38E1D6">47</div></div>
<div style="flex:1;background:#141414;border:1px solid #2A2A2A;padding:7px 10px"><div style="{MONO};font-size:10.5px;color:#A3A39E">Cross a band</div><div style="font-size:26px;font-weight:650;color:#F2B33D">6 <span style="font-size:13px;color:#A3A39E">▲4 ▼2</span></div></div>
<div style="flex:1;background:#141414;border:1px solid #2A2A2A;padding:7px 10px"><div style="{MONO};font-size:10.5px;color:#A3A39E">Largest Δ</div><div style="font-size:26px;font-weight:650">+7</div></div></div>
<div style="font-size:12.5px;color:#A3A39E;margin-bottom:9px">Live preview before publish. “Update geo scores” republishes the shared model (rev 25): progress bar + Writer readback in seconds. Undo = republish rev 24.</div>
<div style="display:flex;gap:8px">{btn("Update geo scores","a")}{btn("Discard draft")}{btn("Score tester…","g")}</div>'''
    return card("F · Impact preview",SH,body,bar="#38E1D6")
def cp_table():
    rows=CP[:]
    def r(q,sel=False):
        n,la,lo,sc,h=q
        return f'<div style="display:grid;grid-template-columns:1fr 70px 82px 92px 50px 22px;gap:8px;align-items:center;height:31px;border-bottom:1px solid #1c1c1c;font-size:13.5px;{"background:#1E1E1E;box-shadow:inset 3px 0 0 #38E1D6;" if sel else ""}padding-left:8px"><span>{n}</span><span style="color:#A3A39E">{la:.2f}</span><span style="color:#A3A39E">{lo:.2f}</span><span style="display:flex;align-items:center;gap:6px"><span style="width:10px;height:10px;background:{ramp(sc)}"></span>{sc}</span><span style="{MONO};font-size:11px;color:{"#E6E6E2" if h else "#3A3A3A"}">{"◆ HARD" if h else "□"}</span><span style="color:#6B6B66">×</span></div>'
    hd=f'<div style="display:grid;grid-template-columns:1fr 70px 82px 92px 50px 22px;gap:8px;height:30px;align-items:center;{MONO};font-size:10.5px;color:#A3A39E;border-bottom:1px solid #3A3A3A;padding-left:8px"><span>Location</span><span>Lat</span><span>Lon</span><span>Score</span><span>Hard</span><span></span></div>'
    L=''.join(r(q,q[0]=="Austin, TX") for q in rows[:10]); R=''.join(r(q) for q in rows[10:])
    return f'<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;padding:6px 14px">{"<div>"+hd+L+"</div>"}{"<div>"+hd+R+"</div>"}</div>'
def scoring_page():
    geo=geo_heat_svg(1098,740,s=1.0,uid='sg',drag_from=(31.2,-98.6),new_point=(32.5,-85.0,85))
    tabs=''.join(f'<span style="padding:0 16px;height:100%;display:flex;align-items:center;{MONO};font-size:12.5px;letter-spacing:.08em;color:{"#38E1D6" if i==0 else "#A3A39E"};border-bottom:2px solid {"#38E1D6" if i==0 else "transparent"}">{t}</span>' for i,t in enumerate(["Scoring &amp; flex","Rules · 19 sections","Display &amp; columns","Documents &amp; ATS"]))
    jump=''.join(f'<span style="border:1px solid #2A2A2A;padding:3px 8px">{t}</span>' for t in ["A FLEX","B VNext","C Model","D Weights","E Pay","F Preview","G Geo"])
    return f'''<div style="width:2560px;height:1440px;background:#000;color:#E6E6E2;font-family:Inter,sans-serif;padding:20px;display:grid;grid-template-columns:56px 1fr;grid-template-rows:56px 44px 48px 1192px;column-gap:12px;row-gap:12px">
{rail("Settings")}
<div style="display:flex;align-items:center;gap:18px;border-bottom:1px solid #2A2A2A;white-space:nowrap">
 <span style="{MONO};font-size:16px">Pipeline Explorer</span><span style="{MONO};font-size:12px;color:#6B6B66">Settings › Flex policy &amp; scoring</span>
 <span style="{MONO};font-size:12px;color:#A3A39E;border:1px solid #2A2A2A;padding:6px 10px"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#4ADE80;margin-right:8px"></span>Writer idle · stable 12m</span>
 <span style="margin-left:auto;display:flex;gap:6px;{MONO};font-size:11px;color:#A3A39E">Jump · {jump}</span>
 <span style="background:#F2B33D;color:#000;{MONO};font-size:13px;font-weight:650;padding:7px 14px">Concept — mock data</span></div>
<div style="display:flex;align-items:stretch;border-bottom:1px solid #2A2A2A">{tabs}<span style="margin-left:auto;display:flex;align-items:center;gap:10px;{MONO};font-size:11px;color:#6B6B66">Pay &amp; location → anchor E/G · Resume &amp; ATS → Documents &amp; ATS (duplicates merged)</span></div>
<div style="display:flex;align-items:center;gap:16px;background:#0B0B0B;border:1px solid #2A2A2A;padding:0 16px;font-size:14px;white-space:nowrap">
 <span style="{MONO};font-size:11.5px;color:#A3A39E">Scope</span>{SH}<span style="color:#A3A39E;font-size:13px">weights · salary · geo · FLEX weight → one model (save_scoring_model)</span>{LO}<span style="color:#A3A39E;font-size:13px">display · columns · layout · map mode · seen · drafts</span>
 <span style="color:#3A3A3A">│</span><span>Model <b>rev 24</b> · scores live</span><span style="color:{OL}">◌ 185 stale evidence · 14:32</span>
 <span style="margin-left:auto;{MONO};font-size:11px;color:#6B6B66">Authority: TIM_PIPELINE_RULES_CANONICAL › COMPENSATION_GEOGRAPHY · DEGREE_FLEX</span></div>
<div style="display:grid;grid-template-columns:700px 620px 1100px;column-gap:16px;min-height:0">
 <div style="min-height:0;overflow:hidden">{flex_card()}{model_card()}{vnext_card()}</div>
 <div style="min-height:0;overflow:hidden">{weights_card()}{salary_card()}{preview_card()}</div>
 <div style="min-height:0;overflow:hidden;background:#0B0B0B;border:1px solid #2A2A2A;border-left:3px solid #3A3A3A">
  <div style="display:flex;justify-content:space-between;align-items:center;height:44px;padding:0 14px;border-bottom:1px solid #2A2A2A"><span style="{MONO};font-size:13px;white-space:nowrap">G · Geographic preference heat map</span><span style="display:flex;gap:6px">{SH}{badge("2 IN DRAFT","prov")}</span></div>
  {geo}
  <div style="display:flex;justify-content:space-between;align-items:center;height:40px;padding:0 14px;border-top:1px solid #2A2A2A;border-bottom:1px solid #2A2A2A"><span style="{MONO};font-size:12px">Control points · 20 + 1 new</span><span style="{MONO};font-size:11px;color:#6B6B66">Click map = add · drag = move · row edits sync to map · ◆ hard overrides nearby interpolation</span></div>
  {cp_table()}
 </div>
</div></div>'''
if __name__=='__main__':
    open('/workspace/pe/build151/scoring_2560.html','w').write('<!doctype html><meta charset="utf-8"><body style="margin:0;background:#000">'+scoring_page()+'</body>')
