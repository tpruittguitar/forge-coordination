# v1.4 desktop cockpit mockup (2560 x 1440) grounded in the real Foreman Cockpit / Pipeline Explorer structure.
from mapsvg import map_svg
import math
MONO="font-family:'IBM Plex Mono',monospace;letter-spacing:.12em;text-transform:uppercase"
U="text-decoration:underline;text-underline-offset:3px"
from bands import BC,BN,band,CUT_TOP,CUT_UPPER,CUT_LOW,HARD,CHG
OL="#8A8F7A"
# fictional mock rows: title, company, location, score, delta, bucket, base est, flex, exp fit, age, write state, provisional
ROWS0=[("Director, Manufacturing Ops","Halvorsen Robotics","Nashville, TN",76,"+4","Needs decision","$245K","High flex",74,"2h","—",False),
("Director, Production Ops","Cobalt Aerostructures","Huntsville, AL",71,"","Needs decision","$230K","Soft flex",68,"5h","◷ Waiting for lock · 8 s",False),
("Head of Production","Vantor Defense Sys.","Cleveland, TN",66,"new","Needs decision","$260K","High flex",63,"1h","—",False),
("VP Operations","Ridgeline Composites","Chattanooga, TN",61,"","Research","$275K","Unknown",60,"6h","—",True),
("Plant Manager","Ironbark Battery","Knoxville, TN",58,"+3","Needs decision","$210K","High flex",57,"8h","—",False),
("Sr. Dir., NPI & Scale-up","Tallgrass Motion","Atlanta, GA",56,"","Needs decision","$250K","No flex",55,"9h","—",True),
("Director of Operations","Kestrel Microgrid","Remote (US)",54,"","Research","$235K","Soft flex",53,"9h","✓ Confirmed · 3 s",False),
("Head of Hardware Ops","Pinecrest Orbital","Birmingham, AL",52,"−3","Needs decision","$240K","High flex",51,"10h","—",False),
("Dir., Factory Engineering","Quarry Fabrication","Charlotte, NC",50,"","Research","$225K","Soft flex",49,"1d","—",False),
("Production Director","Arclight Energy","Gulf Shores, AL",48,"new","Scout intake","$205K","Unknown",48,"3h","—",True),
("Sr. Mgr., Mfg Excellence","Vantage Additive","Raleigh, NC",47,"","Needs decision","$198K","High flex",46,"1d","—",False),
("Director, Supply & Mfg","Meridian Freightworks","Tampa, FL",45,"","Research","$230K","Soft flex",44,"1d","—",False),
("Ops Director, Assembly","Sablewood Machines","Cleveland, TN",43,"+2","Needs decision","$195K","High flex",41,"1d","—",False),
("Head of Operations","Lumen Grid Storage","Columbia, SC",39,"","Needs decision","$220K","No flex",37,"1d","⊗ Failed · Retry",False),
("VP Mfg & Quality","Corvid Marine","Remote (US)",35,"","Research","$265K","Strict",33,"2d","—",True),
("Director, Ops Strategy","Harbor Point Rail","Atlanta, GA",31,"","Needs decision","$215K","Soft flex",70,"2d","—",False),
("Plant Operations Lead","Elmstead Polymers","Dalton, GA",67,"","Discovery lead","$190K","Unknown",66,"2d","—",False),
("Mfg Program Director","Tidewell Avionics","Savannah, GA",66,"−5","Needs decision","$225K","High flex",68,"2d","—",False),
("Director, Industrial Ops","Graniteworks","Louisville, KY",66,"","Research","$215K","Soft flex",67,"2d","—",False),
("Head of Fulfillment Ops","Northstar Parcel","Atlanta, GA",65,"","Needs decision","$200K","No flex",64,"2d","—",False),
("Sr. Dir., Operations","Bayline Medical Devices","Orlando, FL",65,"","Needs decision","$240K","Soft flex",66,"3d","—",True),
("Ops Manager, Machining","Orbital Tooling","Memphis, TN",61,"","Decline candidate","$170K","High flex",60,"2d","—",False),
("Director, Production Plan.","Kitehill Foods","Remote (US)",60,"","Research","$205K","No flex",62,"3d","—",False),
("Plant Manager","Kestrel Mfg","Greenville, SC",57,"","Decline candidate","$185K","No flex",58,"3d","—",False),
("Dir., Mfg Engineering","Bluefin Hydraulics","Columbus, OH",56,"","Decline candidate","$215K","Soft flex",64,"3d","—",False),
("Production Manager","Oakridge Cabinets","Atlanta, GA",55,"","Decline candidate","$160K","Strict",55,"3d","—",False),
("Operations Lead","Granger Plastics","Columbia, SC",54,"","Scout intake","$150K","Unknown",52,"4d","—",False),
("Head of Production","Wexley Industrial","Chicago, IL",52,"","Decline candidate","$270K","No flex",81,"4d","—",False),
("Ops Manager, Plant 2","Fernhill Paper","Montgomery, AL",50,"","Decline candidate","$140K","High flex",50,"4d","—",False),
("Dir., Operations","Cindercone Labs","New York, NY",49,"","Decline candidate","$290K","Soft flex",78,"5d","—",False),
("Mfg Systems Manager","Pallas Controls","Detroit, MI",47,"","Decline candidate","$175K","No flex",60,"5d","—",False)]
ROWS=ROWS0[:30]
COLS=[("",6),("SCORE",64),("Δ",36),("TITLE",184),("COMPANY",112),("LOCATION",112),("BUCKET",104),("BASE EST",72),("DEGREE FLEX",84),("EXP FIT",56),("AGE",36),("WRITE STATE",0)]
GT="grid-template-columns:"+" ".join(f"{w}px" if w else "1fr" for _,w in COLS)
def table():
    h=f'<div style="display:grid;{GT};gap:0 8px;align-items:center;height:36px;padding:0 12px 0 0;border-bottom:1px solid #3A3A3A;{MONO};font-size:11px;letter-spacing:.08em;color:#A3A39E;background:#0B0B0B">'+''.join(f'<span style="white-space:nowrap;{"text-align:right" if n in ("SCORE","AGE","BASE EST","EXP FIT") else ""}">{n}</span>' for n,_ in COLS)+'</div>'
    rs=''
    for i,(t,c,l,s,d,bk,base,flex,ex,age,ws,prov) in enumerate(ROWS):
        b=band(s); sel=i==0; new=d=='new'
        bg="#1E1E1E" if sel else ("#070707" if i%2 else "#0B0B0B")
        if new: bg="linear-gradient(90deg,rgba(230,230,226,.10),rgba(230,230,226,0) 55%),"+bg
        bar="#38E1D6" if sel else ("#E6E6E2" if new else "transparent")
        sh="box-shadow:inset 0 0 0 1px rgba(56,225,214,.35);" if sel else ""
        dc={"new":"#E6E6E2"}.get(d,"#E6E6E2" if (d.startswith("+") or d.startswith("−")) else "#A3A39E")
        dd="Δ NEW" if new else (("Δ "+d) if d else "·")
        wsc="#F2B33D" if "Waiting" in ws else ("#4ADE80" if "Confirmed" in ws else (HARD if "Failed" in ws else "#6B6B66"))
        fc={"High flex":"#E6E6E2","Soft flex":"#F2B33D","No flex":"#A3A39E","Strict":HARD,"Unknown":OL}[flex]
        bkc={"Needs decision":"#38E1D6","Research":"#A3A39E","Scout intake":OL,"Discovery lead":OL,"Decline candidate":"#A3A39E"}[bk]
        sc=f'<b style="font-size:16px;color:{BC[b]};font-weight:650">{s}</b> <span style="{MONO};font-size:9.5px;letter-spacing:.04em;color:{BC[b]}">{BN[b][0]}</span>'
        if prov: sc=f'<span style="{MONO};font-size:9.5px;color:{OL};letter-spacing:.02em" title="provisional">◌</span><b style="font-size:16px;color:{BC[b]};font-weight:650;opacity:.7">{s}</b> <span style="{MONO};font-size:9.5px;letter-spacing:.04em;color:{BC[b]}">{BN[b][0]}</span>'
        if flex=="Strict": sc=sc+f' <span style="{MONO};font-size:9px;color:{HARD};border:1px solid #4a1d18;padding:0 3px">⊘ HOLD</span>'
        rs+=f'''<div style="display:grid;{GT};gap:0 8px;align-items:center;height:32px;padding:0 12px 0 0;border-bottom:1px solid #1c1c1c;background:{bg};{sh}font-size:14px">
<span style="height:100%;background:{bar}"></span>
<span style="text-align:right;white-space:nowrap">{sc}</span>
<span style="{MONO};font-size:10.5px;letter-spacing:.04em;color:{dc}">{dd}</span>
<span style="font-weight:{600 if sel else 540};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{t}</span>
<span style="color:#A3A39E;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{c}</span>
<span style="color:#A3A39E;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{l}</span>
<span style="color:{bkc};white-space:nowrap;font-size:13px">{bk}</span>
<span style="text-align:right;color:#E6E6E2;white-space:nowrap">{base}</span>
<span style="color:{fc};white-space:nowrap;font-size:13px">{flex}</span>
<span style="text-align:right;color:#A3A39E">{ex}</span>
<span style="text-align:right;color:#A3A39E">{age}</span>
<span style="color:{wsc};white-space:nowrap;font-size:13px;overflow:hidden;text-overflow:ellipsis">{ws}</span></div>'''
    return h+rs
def panel_head(title,right=""):
    return f'<div style="display:flex;justify-content:space-between;align-items:center;height:44px;padding:0 14px;border-bottom:1px solid #3A3A3A"><span style="{MONO};font-size:13px;color:#E6E6E2;white-space:nowrap">{title}</span><span style="{MONO};font-size:11px;color:#6B6B66;white-space:nowrap">{right}</span></div>'
def ring(score,col,R=62,sw=9,pct=None):
    pct=score/100 if pct is None else pct; C=2*math.pi*R
    return f'<svg width="{2*R+sw*2}" height="{2*R+sw*2}" viewBox="0 0 {2*R+sw*2} {2*R+sw*2}"><circle cx="{R+sw}" cy="{R+sw}" r="{R}" fill="none" stroke="#1E1E1E" stroke-width="{sw}"/><circle cx="{R+sw}" cy="{R+sw}" r="{R}" fill="none" stroke="{col}" stroke-width="{sw}" stroke-dasharray="{C*pct:.1f} {C:.1f}" transform="rotate(-90 {R+sw} {R+sw})"/>' + ''.join(f'<line x1="{R+sw}" y1="{sw/2-3}" x2="{R+sw}" y2="{sw/2+4}" stroke="#3A3A3A" stroke-width="2" transform="rotate({a} {R+sw} {R+sw})"/>' for a in range(0,360,30)) + f'<text x="{R+sw}" y="{R+sw+4}" fill="{col}" font-family="Inter" font-weight="680" font-size="{R*0.78:.0f}" text-anchor="middle" dominant-baseline="middle">{score}</text></svg>'
def badge(t,kind):
    c={"local":("#A3A39E","#3A3A3A"),"shared":("#F2B33D","#4a3a17"),"prov":(OL,"#3a3d33"),"ok":("#4ADE80","#1f4a2c"),"cy":("#38E1D6","#17403d"),"red":("#FF4D3D","#4a1d18")}[kind]
    return f'<span style="{MONO};font-size:11px;letter-spacing:.08em;color:{c[0]};border:1px solid {c[1]};padding:2px 7px;white-space:nowrap">{t}</span>'
DRAWER_TABS=["Overview","Posting","Fit & Score","Application","Documents","History"]
def workspace():
    tabs=''.join(f'<span style="padding:9px 9px;{MONO};font-size:11px;letter-spacing:.06em;white-space:nowrap;color:{"#38E1D6" if t=="Overview" else "#A3A39E"};border-bottom:2px solid {"#38E1D6" if t=="Overview" else "transparent"}">{t}</span>' for t in DRAWER_TABS)
    ev=[("g","Experience / content fit 90 · mfg scale-up, plant P&L"),("g","Degree FLEX: HIGH_FLEX (equivalent experience)"),("g","Geo 90 · nearest control pt Nashville, TN"),("a","Base pay est. $245K · posted range not stored"),("o","Ownership unknown · research")]
    evh=''.join(f'<div style="border-left:3px solid {dict(BC,o=OL)[c]};background:#141414;padding:6px 10px;margin-bottom:5px;font-size:14px">{ {"g":"✓","a":"◷","o":"?"}[c]} {t}</div>' for c,t in ev)
    bk=[("Experience fit",35,90,"g"),("Degree FLEX",30,80,"g"),("Net compensation",15,70,"a"),("Geography",10,90,"g"),("Title / scope",5,90,"g"),("Company culture",5,75,"a"),("ATS match",0,0,"t"),("Ownership",0,0,"t")]
    bkh=''.join(f'<div style="display:grid;grid-template-columns:150px 44px 1fr 56px;gap:8px;align-items:center;margin-bottom:5px;font-size:13px"><span style="color:#A3A39E">{n}</span><span style="color:#6B6B66;text-align:right">{m}%</span><span style="height:8px;background:#1E1E1E;position:relative"><span style="position:absolute;left:0;top:0;bottom:0;width:{v}%;background:{BC.get(c,"#3A3A3A")}"></span></span><span style="text-align:right;font-weight:600">{m*v/100:.1f}</span></div>' for n,m,v,c in bk)
    return f'''<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 16px 0"><span style="{MONO};font-size:12px;color:#38E1D6">◉ Job drawer · JOB-0412 · locked on map</span><span style="color:#A3A39E;font-size:16px">‹ › ✕</span></div>
<div style="padding:4px 16px 0"><div style="font-size:25px;font-weight:650;line-height:1.15">Director, Manufacturing Ops</div>
<div style="font-size:14.5px;color:#A3A39E;margin-top:3px">Halvorsen Robotics · Nashville, TN · hybrid · posted 2h · LinkedIn</div>
<div style="display:flex;gap:6px;margin-top:8px">{badge("Needs decision","cy")}{badge("High flex","ok")}{badge("$245K est.","prov")}{badge("Nashville","prov")}</div></div>
<div style="display:flex;border-bottom:1px solid #2A2A2A;margin:8px 0 0;padding:0 7px">{tabs}</div>
<div style="padding:10px 16px">
<div style="display:flex;gap:16px;align-items:center;padding-bottom:10px;border-bottom:1px solid #2A2A2A">
 {ring(76,'#4ADE80',R=54,sw=8)}
 <div><div style="{MONO};font-size:13px;color:#4ADE80">▲ Top 10% · opportunity rating 76</div><div style="font-size:13px;color:#A3A39E;margin-top:4px">Model rev 24 · computed 23:38 · {badge("✓ CURRENT","ok")}</div><div style="font-size:13px;color:#4ADE80;margin-top:4px">Δ +3 since last review (evidence: salary posted)</div>
 <div style="font-size:13px;color:#A3A39E;margin-top:6px">Screen gate <span style="color:#4ADE80">PASS</span> · FLEX impact +0</div></div>
</div>
<div style="{MONO};font-size:11px;color:#A3A39E;margin-top:9px">Why</div>
<div style="font-size:15.5px;margin:3px 0 9px;line-height:1.4">Plant-scale mfg leadership, high degree flex, preferred geography; pay est. near target. <span style="color:#38E1D6;{U}">Fit &amp; Score ›</span></div>
{evh}
<div style="display:flex;justify-content:space-between;{MONO};font-size:11px;color:#A3A39E;margin:10px 0 6px"><span>Score breakdown · weight · points</span><span style="color:#E6E6E2">Σ 100% = 86</span></div>{bkh}
<div style="{MONO};font-size:10.5px;color:#6B6B66;margin-top:2px">All 8 weights SHARED · published model rev 24 · total 100 · HIGH_FLEX → fixed component 80</div>
<div style="{MONO};font-size:11px;color:#A3A39E;margin:11px 0 6px">Tim decision</div>
<div style="display:flex;gap:8px;align-items:stretch">
 <div style="flex:1.3;border:1px solid #4ADE80;color:#4ADE80;text-align:center;padding:12px 0;font-weight:650;font-size:16px;background:#1E1E1E;box-shadow:0 0 10px rgba(74,222,128,.25)">✓ Pursue <span style="{MONO};font-size:10px;color:#6B6B66">P</span></div>
 <div style="flex:1;border:1px solid #F2B33D;color:#F2B33D;text-align:center;padding:12px 0;font-weight:620;font-size:16px">◷ Hold <span style="{MONO};font-size:10px;color:#6B6B66">H</span></div>
 <div style="flex:1;border:1px solid #3A3A3A;color:#E6E6E2;text-align:center;padding:12px 0;font-size:15px">Research</div>
 <div style="width:1px;background:#3A3A3A;margin:0 6px"></div>
 <div style="flex:.9;border:1px solid #4a1d18;color:#FF4D3D;text-align:center;padding:12px 0;font-weight:560;font-size:15px">⊖ Decline</div>
</div>
<div style="margin-top:9px;border-left:3px solid #F2B33D;background:linear-gradient(90deg,rgba(242,179,61,.16),#141414 70%);padding:7px 12px;font-size:13px;display:flex;justify-content:space-between"><span><span style="color:#F2B33D">◷ WAITING FOR WRITER LOCK</span> · Pursue · “Director, Production Ops” · auto-retry 2/4 in 15 s</span><span style="color:#38E1D6;{U};margin-left:12px">Undo</span></div>
<div style="margin-top:5px;border-left:3px solid #4ADE80;background:#141414;padding:7px 12px;font-size:13px;display:flex;justify-content:space-between"><span><span style="color:#4ADE80">✓ CONFIRMED</span> · Hold · “Director of Operations” · readback 3 s</span><span style="color:#38E1D6;{U};margin-left:12px">Undo</span></div>
<div style="margin-top:5px;border-left:3px solid #FF4D3D;background:#141414;padding:7px 12px;font-size:13px;display:flex;justify-content:space-between"><span><span style="color:#FF4D3D">⊗ FAILED</span> · Hold · “Head of Operations” · 4 retries · payload kept</span><span style="color:#38E1D6;{U};margin-left:12px">Retry</span></div>
</div>'''
def kpis():
    K=[("Needs decision","50","#38E1D6","Open, undecided · live rows",True),("Applied · all time","84","#4ADE80","✓ Writer-confirmed · live rows",False),("Research","49","#E6E6E2","Manual research bucket",False),("Interviews · 14d","0","#A3A39E","Application tab dates",False),("Writer · waiting / failed","1 / 1","#F2B33D","◷ lock busy · auto-retry 8/15/30/45 s",False),("Stale evidence","185","#8A8F7A","◌ FLEX class stamped under older rule",False)]
    out=''
    for l,v,c,d,f in K:
        bd="#38E1D6" if f else "#2A2A2A"; gl="box-shadow:0 0 10px rgba(56,225,214,.35);" if f else ""
        bar='' if l!="Stale evidence" else '<div style="position:absolute;left:16px;right:16px;bottom:8px;height:3px;background:#1E1E1E"><div style="width:69%;height:100%;background:#8A8F7A"></div></div>'
        out+=f'<div style="flex:1;background:#0B0B0B;border:1px solid {bd};{gl}padding:10px 16px;position:relative"><div style="{MONO};font-size:12px;color:#A3A39E">{l}</div><div style="font-size:38px;font-weight:650;line-height:1.05;color:{c};margin-top:3px">{v}</div><div style="font-size:13px;color:#6B6B66">{d}</div><div style="position:absolute;right:14px;top:9px;color:#A3A39E;font-size:16px">›</div>{bar}</div>'
    return out
def rail(active="Pipeline"):
    it=[("▤","Pipeline"),("⇲","Intake"),("⚙","System"),("☷","Settings")]
    h=''.join(f'<div style="height:56px;display:flex;flex-direction:column;align-items:center;justify-content:center;color:{"#38E1D6" if n==active else "#A3A39E"};border-left:3px solid {"#38E1D6" if n==active else "transparent"}"><div style="font-size:19px">{a}</div><div style="{MONO};font-size:8.5px;letter-spacing:.04em;margin-top:2px">{n}</div></div>' for a,n in it)
    return f'''<div style="grid-row:1 / -1;background:#0B0B0B;border:1px solid #2A2A2A;display:flex;flex-direction:column;padding-top:6px">
<div style="height:44px;display:flex;align-items:center;justify-content:center;color:#A3A39E;font-size:18px;border-bottom:1px solid #2A2A2A;margin-bottom:6px">☰</div>{h}
<div style="margin-top:auto;padding-bottom:8px;text-align:center;{MONO};font-size:8.5px;color:#A3A39E;letter-spacing:.04em"><div style="height:50px;display:flex;flex-direction:column;justify-content:center"><div style="font-size:15px;color:#4ADE80">●</div>Status</div><div style="height:50px;display:flex;flex-direction:column;justify-content:center"><div style="font-size:15px">⟳</div>Refresh</div><div style="height:44px;display:flex;flex-direction:column;justify-content:center;color:#38E1D6"><div style="font-size:13px">⇤</div>Unpin</div></div></div>'''
def topbar(crumb="Pipeline › Review queue"):
    return f'''<div style="display:flex;align-items:center;gap:15px;border-bottom:1px solid #2A2A2A;white-space:nowrap;overflow:hidden;min-width:0">
 <span style="{MONO};font-size:16px;color:#E6E6E2">Pipeline Explorer</span>
 <span style="{MONO};font-size:12px;color:#6B6B66">{crumb}</span>
 <span style="width:340px;border:1px solid #2A2A2A;background:#0B0B0B;padding:8px 12px;font-size:14px;color:#6B6B66">⌕ Search jobs, companies, or locations… <span style="float:right;{MONO};font-size:11px">/</span></span>
 <span style="{MONO};font-size:12px;color:#A3A39E;border:1px solid #2A2A2A;padding:6px 10px"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#4ADE80;margin-right:8px"></span>Writer idle · stable 12m · refresh 0:42</span>
 <span style="{MONO};font-size:12px;color:#A3A39E">Queue 2</span><span style="{MONO};font-size:12px;color:#A3A39E">Last sync 23:41</span><span style="{MONO};font-size:12px;color:#A3A39E">Compare · 0/3</span>
 <span style="margin-left:auto;{MONO};font-size:12px;color:#A3A39E">Compact ▾</span><span style="{MONO};font-size:12px;color:#A3A39E">Layout</span><span style="{MONO};font-size:12px;color:#A3A39E">⟳</span><span style="{MONO};font-size:12px;color:#A3A39E">🔔 3</span><span style="{MONO};font-size:12px;color:#A3A39E">? Shortcuts</span>
 <span style="background:#F2B33D;color:#000;{MONO};font-size:13px;font-weight:650;padding:7px 14px">Concept — mock data</span>
</div>'''
def subtabs():
    T=[("Jobs","578"),("Review queue","50"),("Decline candidates","8"),("My rulings","0"),("Map",""),("Trends",""),("Compare","0/3")]
    h=''.join(f'<span style="padding:0 16px;height:100%;display:flex;align-items:center;gap:8px;{MONO};font-size:12.5px;letter-spacing:.08em;color:{"#38E1D6" if n=="Review queue" else "#A3A39E"};border-bottom:2px solid {"#38E1D6" if n=="Review queue" else "transparent"}">{n}{f"<span style=color:#6B6B66>{c}</span>" if c else ""}</span>' for n,c in T)
    return f'<div style="display:flex;align-items:stretch;border-bottom:1px solid #2A2A2A">{h}<span style="margin-left:auto;display:flex;align-items:center;gap:14px;{MONO};font-size:11.5px;color:#6B6B66">View &amp; filters: score ≥ 45 · all sources <span style="color:#38E1D6">▾ Edit</span></span></div>'
def desktop():
    mp=map_svg(800,1024,-86.25,35.55,165,s=1.0,uid='d',mode='selected',sel_lines=('36.1627°N 086.7816°W','RNG 113 MI · BRG 296° FROM HOME','NEAREST GEO PT NASHVILLE, TN · 90'))
    seg=f'<div style="position:absolute;top:56px;right:14px;display:flex;border:1px solid #2A2A2A;background:rgba(11,11,11,.95);{MONO};font-size:11px;letter-spacing:.06em"><span style="padding:7px 10px;background:#38E1D6;color:#000;font-weight:650">Selected job</span><span style="padding:7px 10px;color:#A3A39E">Filtered view · 50</span></div>'
    return f'''<div style="width:2560px;height:1440px;background:#000;color:#E6E6E2;font-family:Inter,sans-serif;padding:20px;display:grid;grid-template-columns:56px 1fr;grid-template-rows:56px 44px 96px 40px 1068px 36px;column-gap:12px;row-gap:12px;position:relative">
{rail()}
{topbar()}
{subtabs()}
<div style="display:flex;gap:12px">{kpis()}</div>
<div style="display:flex;align-items:center;gap:16px;background:#0B0B0B;border:1px solid #2A2A2A;border-left:3px solid #38E1D6;padding:0 16px;font-size:15px;white-space:nowrap">
 <span style="{MONO};font-size:12px;color:#A3A39E">Since your last review · 18:05</span>
 <span style="color:#E6E6E2;{U}">Δ 12 new</span><span style="color:#6B6B66">·</span><span style="color:#E6E6E2;{U}">Δ 4 evidence updates (e.g. FLEX HIGH→NO)</span><span style="color:#6B6B66">·</span><span style="color:#FF4D3D">⊗ <span style="{U}">1 write failed</span></span><span style="color:#6B6B66">·</span><span style="color:#F2B33D">◷ 2 queued</span><span style="color:#6B6B66">·</span><span style="color:#8A8F7A">◌ 185 provisional</span>
 <span style="margin-left:auto;{MONO};font-size:11.5px;color:#6B6B66">Map shows: selected job · Esc → filtered view (50)</span>
</div>
<div style="display:grid;grid-template-columns:1112px 800px 508px;column-gap:16px;min-height:0">
 <div style="background:#0B0B0B;border:1px solid #2A2A2A;overflow:hidden">{panel_head("Review queue · 50 · 30 visible","Sort: score ↓ · 11 columns · bands = percentile (rev 24 · P90 61 · P65 54 · P20 38)")}{table()}</div>
 <div style="background:#0B0B0B;border:1px solid #2A2A2A;overflow:hidden;position:relative">{panel_head("◎ Job location map · selected job","Auto-fit 600 ms · ⤢ fullscreen")}{seg}{mp}</div>
 <div style="background:#0B0B0B;border:1px solid #2A2A2A;overflow:hidden;border-top:2px solid #38E1D6">{workspace()}</div>
</div>
<div style="display:flex;align-items:center;gap:22px;background:#0B0B0B;border:1px solid #2A2A2A;padding:0 16px;font-size:13.5px;white-space:nowrap;overflow:hidden">
 <span style="{MONO};font-size:12px;color:#38E1D6">▸ Pipeline events</span>
 <span><span style="color:#6B6B66">23:41</span> Scout intake +3 (LinkedIn)</span><span style="color:#3A3A3A">│</span>
 <span><span style="color:#A3A39E">23:38</span> Δ Evidence: Head of Production (Anduril) FLEX HIGH → NO · 77 → 59</span><span style="color:#3A3A3A">│</span>
 <span><span style="color:#6B6B66">23:22</span> <span style="color:#4ADE80">✓</span> Writer confirmed APPLIED #W-2287</span><span style="color:#3A3A3A">│</span>
 <span><span style="color:#6B6B66">23:19</span> <span style="color:#F2B33D">◷</span> Writer lock busy #W-2280 · retried at 8 s · ✓ 11 s</span><span style="color:#3A3A3A">│</span>
 <span><span style="color:#6B6B66">23:05</span> Discovery leads +9</span><span style="color:#3A3A3A">│</span>
 <span><span style="color:#6B6B66">22:51</span> Sources normalized: LINKEDIN → LinkedIn (69)</span>
 <span style="margin-left:auto;{MONO};font-size:11px;color:#6B6B66">Ticker scrolls ← · pauses on hover</span>
</div>
</div>'''
if __name__=='__main__':
    open('/workspace/pe/build15/desktop_2560.html','w').write('<!doctype html><meta charset="utf-8"><body style="margin:0;background:#000">'+desktop()+'</body>')
