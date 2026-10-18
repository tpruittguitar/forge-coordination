# v1.4 mobile mockups (iPhone 18 Pro, ASSUMED 402 x 874 pt). Generous perimeter padding, camera keep-out in
# portrait (top) and landscape (left OR right), bottom controls lifted above the home indicator.
from mapsvg import map_svg
from desk import ring, desktop, BC, BN, MONO, U, OL
PW,PH=402,874
# inset tokens (pt) - see Design Tokens section
SAFE_T,SAFE_B=62,34          # assumed portrait safe area
PAD=24                        # side padding beyond safe area (portrait safe side = 0)
CORNER=36                     # side inset for any control inside a corner zone (top/bottom 96 pt)
LIFT=16                       # extra lift above home indicator -> controls end >= 50 pt above bottom
TOP_PAD=12                    # below the safe-area top
L_SAFE_S,L_SAFE_B=62,21       # assumed landscape safe area (both sides, island side OR other)
L_PAD=20                      # landscape padding beyond safe area on both sides -> content 82..792
R=55                          # assumed display corner radius
ISL=(126,37)
def hatch(uid,col):
    return f'<pattern id="{uid}" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="8" fill="{col}" fill-opacity=".07"/><line x1="0" y1="0" x2="0" y2="8" stroke="{col}" stroke-opacity=".55" stroke-width="2"/></pattern>'
def overlay(w,h,land=False,side='left',labels=True,strong=False):
    a=1.0 if strong else .75
    o=[f'<svg width="{w}" height="{h}" viewBox="0 0 {w} {h}" style="position:absolute;inset:0;z-index:20;pointer-events:none;opacity:{a}"><defs>{hatch("hr"+side+str(land),"#FF4D3D")}{hatch("ha"+side+str(land),"#F2B33D")}</defs>']
    fs=9 if not strong else 10
    T=lambda x,y,t,c,anc="start": f'<text x="{x}" y="{y}" fill="{c}" font-family="IBM Plex Mono" font-size="{fs}" letter-spacing=".06em" text-anchor="{anc}" paint-order="stroke" stroke="#000" stroke-width="3">{t}</text>' if labels else ''
    if not land:
        iw,ih=ISL; ix=(w-iw)/2
        o.append(f'<rect x="{ix-16}" y="0" width="{iw+32}" height="{11+ih+16}" fill="url(#hr{side}{land})" stroke="#FF4D3D" stroke-opacity=".8" stroke-dasharray="3 3"/>')
        o.append(T(w/2,11+ih+16+12,"CAMERA KEEP-OUT","#FF4D3D","middle"))
        o.append(f'<rect x="0" y="{h-SAFE_B}" width="{w}" height="{SAFE_B}" fill="url(#ha{side}{land})"/>')
        o.append(T(w-8,h-SAFE_B-4,"HOME INDICATOR · 34","#F2B33D","end"))
        o.append(f'<line x1="0" y1="{SAFE_T}" x2="{w}" y2="{SAFE_T}" stroke="#38E1D6" stroke-opacity=".7" stroke-dasharray="5 4"/>')
        o.append(T(8,SAFE_T-4,"SAFE TOP 62","#38E1D6"))
        x0,x1,y0,y1=PAD,w-PAD,SAFE_T+TOP_PAD,h-SAFE_B-LIFT
        o.append(f'<rect x="{x0}" y="{y0}" width="{x1-x0}" height="{y1-y0}" fill="none" stroke="#F2B33D" stroke-opacity=".8" stroke-dasharray="6 4"/>')
        o.append(f'<line x1="0" y1="{y1}" x2="{w}" y2="{y1}" stroke="#F2B33D" stroke-opacity=".8" stroke-dasharray="2 3"/>')
        o.append(T(8,y1+12,"LIFT 16 · CONTROLS END ≥ 50","#F2B33D"))
        for cx,cy in ((0,0),(w,0),(0,h),(w,h)):
            sx=1 if cx==0 else -1; sy=1 if cy==0 else -1
            o.append(f'<path d="M{cx},{cy+sy*96} L{cx},{cy} L{cx+sx*CORNER+ (sx*0)},{cy} L{cx+sx*CORNER},{cy+sy*96} Z" fill="url(#hr{side}{land})" fill-opacity=".6" opacity=".55"/>')
        o.append(T(PAD+2,y0+12,"PAD 24","#F2B33D"))
    else:
        iw,ih=ISL[1],ISL[0]; iy=(h-ih)/2
        ix=11 if side=='left' else w-11-iw
        kx=0 if side=='left' else w-(11+iw+16)
        o.append(f'<rect x="{kx}" y="{iy-16}" width="{11+iw+16}" height="{ih+32}" fill="url(#hr{side}{land})" stroke="#FF4D3D" stroke-opacity=".8" stroke-dasharray="3 3"/>')
        o.append(f'<text x="{(kx+ (11+iw+16)/2):.0f}" y="{iy+ih+30}" fill="#FF4D3D" font-family="IBM Plex Mono" font-size="{fs}" text-anchor="middle" paint-order="stroke" stroke="#000" stroke-width="3">CAMERA</text>' if labels else '')
        for x in (L_SAFE_S,w-L_SAFE_S):
            o.append(f'<line x1="{x}" y1="0" x2="{x}" y2="{h}" stroke="#38E1D6" stroke-opacity=".7" stroke-dasharray="5 4"/>')
        o.append(f'<rect x="0" y="{h-L_SAFE_B}" width="{w}" height="{L_SAFE_B}" fill="url(#ha{side}{land})"/>')
        x0,x1,y0,y1=L_SAFE_S+L_PAD,w-L_SAFE_S-L_PAD,L_PAD,h-L_SAFE_B-LIFT
        o.append(f'<rect x="{x0}" y="{y0}" width="{x1-x0}" height="{y1-y0}" fill="none" stroke="#F2B33D" stroke-opacity=".8" stroke-dasharray="6 4"/>')
        o.append(T(x0+4,y1+12,"LIFT 16 · ≥ 37","#F2B33D"))
        o.append(T(L_SAFE_S+3,12 if side=='right' else h-L_SAFE_B-28,"SAFE 62","#38E1D6"))
        o.append(T(w-L_SAFE_S-3,12 if side=='left' else h-L_SAFE_B-28,"SAFE 62","#38E1D6","end"))
        o.append(T(x0+4,y0+12,"PAD 20 · SYMMETRIC","#F2B33D"))
    o.append('</svg>')
    return ''.join(o)
def frame(inner,w=PW,h=PH,land=False,side='left',ov=True,ovstrong=False):
    if land:
        ix=11 if side=='left' else w-11-ISL[1]
        isl=f'<div style="position:absolute;left:{ix}px;top:{(h-ISL[0])//2}px;width:{ISL[1]}px;height:{ISL[0]}px;background:#000;border-radius:20px;z-index:30;border:1px solid #222"></div>'
    else:
        isl=f'<div style="position:absolute;top:11px;left:{(w-ISL[0])//2}px;width:{ISL[0]}px;height:{ISL[1]}px;background:#000;border-radius:20px;z-index:30;border:1px solid #222"></div>'
    home=f'<div style="position:absolute;bottom:8px;left:{(w-(200 if land else 140))//2}px;width:{200 if land else 140}px;height:5px;border-radius:3px;background:#E6E6E2;opacity:.85;z-index:30"></div>'
    o=overlay(w,h,land,side,strong=ovstrong) if ov else ''
    return f'<div style="width:{w+20}px;height:{h+20}px;padding:10px;background:#1b1b1b;border-radius:64px;box-shadow:0 0 0 1px #3A3A3A inset"><div style="width:{w}px;height:{h}px;border-radius:{R}px;overflow:hidden;position:relative;background:#000;color:#E6E6E2;font-family:Inter,sans-serif">{inner}{o}{isl}{home}</div></div>'
def status():
    return '<div style="position:absolute;top:0;left:0;right:0;height:54px;display:flex;justify-content:space-between;align-items:center;padding:6px 34px 0 40px;font-size:16px;font-weight:600;z-index:5"><span>23:41</span><span style="font-size:12px;letter-spacing:.05em">▂▄▆ ᯤ ▮▮▮▯</span></div>'
Y0=SAFE_T+TOP_PAD   # 74: first content row
TB_H=64; TB_BOT=PH-SAFE_B-LIFT; TB_TOP=TB_BOT-TB_H   # tab bar 760..824
def tabbar(active=0):
    t=[("☰","Queue"),("◎","Map"),("△","Changes"),("⌕","Search")]
    it=''.join(f'<div style="flex:1;text-align:center;color:{"#38E1D6" if i==active else "#A3A39E"};padding-top:9px;position:relative"><div style="font-size:21px;line-height:1">{a}</div><div style="font-size:11px;margin-top:4px;font-weight:{600 if i==active else 450}">{b}</div>{"<span style=position:absolute;top:4px;left:58%;background:#38E1D6;color:#000;font-size:10px;font-weight:700;padding:0 5px;border-radius:8px>12</span>" if b=="Changes" else ""}{"<div style=position:absolute;top:0;left:30%;right:30%;height:2px;background:#38E1D6></div>" if i==active else ""}</div>' for i,(a,b) in enumerate(t))
    return f'<div style="position:absolute;left:{CORNER}px;right:{CORNER}px;top:{TB_TOP}px;height:{TB_H}px;background:rgba(14,14,14,.97);border:1px solid #2A2A2A;border-radius:16px;display:flex;z-index:8;box-shadow:0 -6px 24px rgba(0,0,0,.7)">{it}</div>'
def hdr(title="Pipeline Explorer",back=None,top=Y0):
    b=f'<span style="color:#38E1D6;font-size:17px">‹ {back}</span>' if back else f'<span style="{MONO};font-size:11.5px;white-space:nowrap">{title}</span>'
    return f'<div style="position:absolute;left:{PAD}px;right:{PAD}px;top:{top}px;display:flex;align-items:center;justify-content:space-between;height:44px;z-index:6">{b}<span style="display:flex;gap:8px;align-items:center"><span style="background:#F2B33D;color:#000;{MONO};font-size:8.5px;font-weight:700;padding:3px 5px;letter-spacing:.06em;white-space:nowrap">Concept — mock data</span><span style="border:1px solid #2A2A2A;height:44px;min-width:44px;display:flex;align-items:center;justify-content:center;padding:0 7px;{MONO};font-size:9.5px;color:#A3A39E;letter-spacing:.04em;white-space:nowrap">⧉ Desktop</span></span></div>'
def kstrip(top):
    K=[("Decide","50","#38E1D6",True),("New","12","#E6E6E2",False),("⊗ Failed","1","#FF4D3D",False),("◌ Stale ev.","185",OL,False)]
    return f'<div style="position:absolute;left:{PAD}px;right:{PAD}px;top:{top}px;display:flex;gap:6px">'+''.join(f'<div style="flex:1;background:#0B0B0B;border:1px solid {"#38E1D6" if f else "#2A2A2A"};{"box-shadow:0 0 8px rgba(56,225,214,.35);" if f else ""}padding:6px 8px;min-height:58px"><div style="{MONO};font-size:9px;color:#A3A39E;letter-spacing:.06em;white-space:nowrap">{l}</div><div style="font-size:23px;font-weight:650;color:{c};line-height:1.15">{v}</div></div>' for l,v,c,f in K)+'</div>'
def card(t,c,loc,s,pay,age,why,shift=0,under=None,state=None,prov=False):
    from bands import band as _bd; b=_bd(s)
    st=f'<div style="margin-top:7px;border-left:3px solid #F2B33D;padding:3px 8px;font-size:12.5px;background:#0B0B0B"><span style="color:#F2B33D">◷ Waiting for lock · 8 s</span> · Pursue · <span style="color:#38E1D6;{U}">Undo</span></div>' if state else ''
    pv=f'<span style="{MONO};font-size:9px;color:{OL}">◌ </span>' if prov else ''
    inner=f'<div style="background:#141414;border:1px solid {"#4ADE80" if shift else "#2A2A2A"};border-left:3px solid {BC[b]};padding:10px 12px;transform:translateX({shift}px) rotate({shift/30:.1f}deg);position:relative;z-index:2"><div style="display:flex;justify-content:space-between;gap:10px"><div style="min-width:0"><div style="font-size:16px;font-weight:620;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{t}</div><div style="font-size:13px;color:#A3A39E;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{c} · {loc}</div></div><div style="text-align:right"><div style="font-size:25px;font-weight:680;color:{BC[b]};line-height:1">{pv}{s}</div><div style="{MONO};font-size:9px;color:{BC[b]};letter-spacing:.06em;white-space:nowrap">{BN[b]}</div></div></div><div style="display:flex;gap:10px;font-size:13px;margin-top:5px"><span>{pay}</span><span style="color:#A3A39E">{age}</span><span style="color:#A3A39E;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{why}</span></div>{st}</div>'
    u=''
    if under: u=f'<div style="position:absolute;inset:0;background:linear-gradient(90deg,rgba(74,222,128,.28),rgba(74,222,128,.05));border:1px solid #4ADE80;display:flex;align-items:center;padding-left:14px;color:#4ADE80;{MONO};font-size:12px;font-weight:600">✓ PURSUE<br><span style="font-size:9px;color:#A3A39E">HAPTIC</span></div>'
    return f'<div style="position:relative;margin:0 0 8px">{u}{inner}</div>'
def portrait_queue(ov=True):
    cards=card("Director, Manufacturing Ops","Halvorsen Robotics","Nashville",76,"$245K est.","2h","High flex",shift=84,under=True)
    cards+=card("Director, Production Ops","Cobalt Aerostructures","Huntsville",71,"$230K","5h","Soft flex",state=True)
    cards+=card("Head of Production","Vantor Defense Sys.","Cleveland, TN",63,"$260K","1h","New · 28 mi")
    cards+=card("VP Operations","Ridgeline Composites","Chattanooga",57,"$275K","6h","FLEX unknown",prov=True)
    cards+=card("Plant Manager","Ironbark Battery","Knoxville",48,"$210K","8h","High flex")
    inner=status()+hdr()+kstrip(Y0+52)+f'''<div style="position:absolute;left:{PAD}px;right:{PAD}px;top:{Y0+120}px;border-left:3px solid #38E1D6;background:#0B0B0B;border-top:1px solid #2A2A2A;border-bottom:1px solid #2A2A2A;border-right:1px solid #2A2A2A;padding:0 10px;font-size:13.5px;height:44px;display:flex;align-items:center;white-space:nowrap">Since 18:05 · <span style="color:#E6E6E2;{U};margin:0 4px">Δ 12 new</span>·<span style="color:#E6E6E2;{U};margin:0 4px">Δ 4 evidence</span>·<span style="color:#FF4D3D;margin-left:4px">⊗ 1</span></div>
<div style="position:absolute;left:{PAD}px;right:{PAD}px;top:{Y0+172}px;display:flex;justify-content:space-between;{MONO};font-size:9.5px;color:#6B6B66;letter-spacing:.05em"><span>→ Pursue · ← Hold · long-press Decline</span><span>Score ↓</span></div>
<div style="position:absolute;left:{PAD}px;right:{PAD}px;top:{Y0+192}px;bottom:{PH-TB_TOP+8}px;overflow:hidden">{cards}</div>'''+tabbar(0)
    return frame(inner,ov=ov)
def portrait_detail(ov=True):
    ev=[("g","✓","Experience fit 90 · plant P&L"),("g","✓","Degree FLEX: HIGH_FLEX"),("g","✓","Geo 90 · Nashville control pt"),("a","◷","Pay est. $245K · range not stored")]
    evh=''.join(f'<div style="border-left:3px solid {BC[c]};background:#141414;padding:6px 10px;margin-bottom:5px;font-size:14px">{i} {t}</div>' for c,i,t in ev)
    tabs=''.join(f'<span style="padding:7px 0;{MONO};font-size:9.5px;letter-spacing:.03em;color:{"#38E1D6" if i==0 else "#A3A39E"};border-bottom:2px solid {"#38E1D6" if i==0 else "transparent"}">{t}</span>' for i,t in enumerate(["Overview","Posting","Fit","Apply","Docs","History"]))
    AB_BOT=TB_TOP-12; AB_TOP=AB_BOT-56
    inner=status()+hdr(back="Queue")+f'''<div style="position:absolute;left:{PAD}px;right:{PAD}px;top:{Y0+50}px">
<div style="{MONO};font-size:10.5px;color:#38E1D6;letter-spacing:.1em">◉ JOB-0412 · Needs decision</div>
<div style="font-size:22px;font-weight:650;line-height:1.15;margin-top:4px">Director, Manufacturing Ops</div>
<div style="font-size:14px;color:#A3A39E;margin-top:2px">Halvorsen Robotics · Nashville, TN · 2h</div>
<div style="display:flex;justify-content:space-between;border-bottom:1px solid #2A2A2A;margin-top:8px">{tabs}</div>
<div style="display:flex;gap:14px;align-items:center;margin:10px 0;padding-bottom:10px;border-bottom:1px solid #2A2A2A">{ring(76,'#4ADE80',R=40,sw=7)}<div><div style="{MONO};font-size:12px;color:#4ADE80">▲ Top 10% · model rev 24</div><div style="font-size:12.5px;color:#A3A39E">Opportunity rating</div><div style="font-size:12px;color:#A3A39E;margin-top:5px;{MONO}">Base pay est.</div><div style="font-size:18px;font-weight:620">$245K</div></div></div>
<div style="font-size:14.5px;margin:0 0 8px;line-height:1.4">Plant-scale mfg leadership, high flex, preferred geo. <span style="color:#38E1D6;{U}">Fit &amp; Score</span></div>
{evh}</div>
<div style="position:absolute;left:{PAD}px;right:{PAD}px;top:{AB_TOP-52}px;background:#0B0B0B;border:1px solid #2A2A2A;border-left:3px solid #F2B33D;padding:0 12px;height:44px;font-size:13.5px;display:flex;align-items:center;justify-content:space-between"><span><span style="color:#F2B33D">◷ WAITING FOR LOCK</span> · Pursue · retry 8 s</span><span style="color:#38E1D6;{U}">Undo</span></div>
<div style="position:absolute;left:{CORNER}px;right:{CORNER}px;top:{AB_TOP}px;display:flex;gap:8px;align-items:stretch">
<div style="flex:1.3;height:56px;border:1px solid #4ADE80;color:#4ADE80;background:#1E1E1E;display:flex;align-items:center;justify-content:center;font-size:17px;font-weight:650">✓ Pursue</div>
<div style="flex:1;height:56px;border:1px solid #F2B33D;color:#F2B33D;display:flex;align-items:center;justify-content:center;font-size:17px;font-weight:620">◷ Hold</div>
<div style="width:1px;background:#3A3A3A;margin:0 4px"></div>
<div style="flex:.9;height:56px;border:1px solid #4a1d18;color:#FF4D3D;display:flex;align-items:center;justify-content:center;font-size:15px">⊖ Decline</div></div>'''+tabbar(0)
    return frame(inner,ov=ov)
def portrait_map(ov=True):
    MH=PH-SAFE_T
    mp=map_svg(PW,MH,-86.2,35.25,120,s=0.8,uid='pm',mode='selected',show_hover=False,show_controls=False,legend=False,ctrl_bottom=PH-TB_TOP-SAFE_T+200,top_off=96,left_off=PAD-8,right_off=PAD-8,readout=False,status=False,sel_lines=('36.16°N 086.78°W','RNG 113 MI · BRG 296°'))
    btn=lambda t: f'<div style="width:44px;height:44px;background:rgba(11,11,11,.92);border:1px solid #3A3A3A;display:flex;align-items:center;justify-content:center;font-size:17px;margin-bottom:8px">{t}</div>'
    SH_BOT=TB_TOP-10; SH_TOP=SH_BOT-300
    inner=f'''<div style="position:absolute;left:0;right:0;top:{SAFE_T}px;bottom:0">{mp}</div>
<div style="position:absolute;top:0;left:0;right:0;height:{SAFE_T}px;background:#000"></div>{status()}{hdr()}
<div style="position:absolute;top:{Y0+52}px;left:{PAD}px;right:{PAD}px;display:flex;gap:6px;align-items:center">
<span style="display:flex;border:1px solid #2A2A2A;background:rgba(11,11,11,.95)"><span style="padding:0 10px;height:36px;display:flex;align-items:center;font-size:13px;color:#000;background:#38E1D6;font-weight:600">Selected</span><span style="padding:0 10px;height:36px;display:flex;align-items:center;font-size:13px;color:#A3A39E">Filtered · 50</span></span>
<span style="margin-left:auto;{MONO};font-size:9.5px;color:#38E1D6;letter-spacing:.05em">AUTO-FIT</span></div>
<div style="position:absolute;right:{PAD}px;top:{Y0+110}px">{btn("+")}{btn("−")}{btn("◎")}{btn("⤢")}</div>
<div style="position:absolute;left:12px;right:12px;top:{SH_TOP}px;height:{SH_BOT-SH_TOP}px;background:#0B0B0B;border:1px solid #38E1D6;border-radius:18px;box-shadow:0 -10px 30px rgba(0,0,0,.8);padding:8px 12px 0;z-index:7">
<div style="width:40px;height:5px;background:#3A3A3A;border-radius:3px;margin:0 auto 10px"></div>
<div style="display:flex;justify-content:space-between;align-items:flex-start"><div><div style="{MONO};font-size:10.5px;color:#38E1D6;letter-spacing:.1em">◉ Lock · JOB-0412 · 113 mi</div><div style="font-size:19px;font-weight:650;margin-top:3px">Director, Manufacturing Ops</div><div style="font-size:13.5px;color:#A3A39E">Halvorsen Robotics · Nashville · $245K</div></div><div style="text-align:right"><div style="font-size:32px;font-weight:680;color:#4ADE80;line-height:1">76</div><div style="{MONO};font-size:9.5px;color:#4ADE80">▲ TOP 10%</div></div></div>
<div style="font-size:14px;margin:8px 0;color:#E6E6E2">Plant-scale mfg leadership, high flex.</div>
<div style="display:flex;gap:5px;margin-bottom:12px;font-size:12px"><span style="border-left:3px solid #4ADE80;background:#141414;padding:3px 7px">✓ Exp 90</span><span style="border-left:3px solid #4ADE80;background:#141414;padding:3px 7px">✓ Geo 90</span><span style="border-left:3px solid #F2B33D;background:#141414;padding:3px 7px">◷ Pay est.</span></div>
<div style="display:flex;gap:8px;margin:0 12px"><div style="flex:1.3;height:52px;border:1px solid #4ADE80;color:#4ADE80;background:#1E1E1E;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:650">✓ Pursue</div><div style="flex:1;height:52px;border:1px solid #F2B33D;color:#F2B33D;display:flex;align-items:center;justify-content:center;font-size:16px">◷ Hold</div><div style="width:1px;background:#3A3A3A;margin:0 2px"></div><div style="flex:.8;height:52px;border:1px solid #4a1d18;color:#FF4D3D;display:flex;align-items:center;justify-content:center;font-size:14px">⊖ Decline</div></div>
<div style="{MONO};font-size:9.5px;color:#6B6B66;letter-spacing:.05em;margin:10px 12px 0">Swipe up for detail · ◂ ▸ next job in filter</div>
</div>'''+tabbar(1)
    return frame(inner,ov=ov)
LW,LH=874,402; LX0=L_SAFE_S+L_PAD; LX1=LW-L_SAFE_S-L_PAD; LY0=L_PAD; LY1=LH-L_SAFE_B-LIFT
def land_list(sel=0):
    R=[("Director, Manufacturing Ops","Halvorsen Robotics",76),("Director, Production Ops","Cobalt Aerostructures",71),("Head of Production","Vantor Defense Sys.",63),("VP Operations","Ridgeline Composites",57),("Plant Manager","Ironbark Battery",48),("Sr. Dir., NPI & Scale-up","Tallgrass Motion",36)]
    out=''
    for i,(t,c,s) in enumerate(R):
        from bands import band as _bd; b=_bd(s)
        st="background:#1E1E1E;border-left:3px solid #38E1D6;" if i==sel else "border-left:3px solid transparent;"
        out+=f'<div style="{st}display:flex;justify-content:space-between;align-items:center;min-height:48px;padding:3px 10px;border-bottom:1px solid #1c1c1c"><div style="min-width:0"><div style="font-size:14px;font-weight:580;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{t}</div><div style="font-size:12px;color:#A3A39E">{c}</div></div><div style="font-size:19px;font-weight:680;color:{BC[b]}">{s}</div></div>'
    return out
def land_shell(right_html,side='left',ov=True):
    lw=268
    return f'''<div style="position:absolute;left:{LX0}px;top:{LY0}px;width:{lw}px;bottom:{LH-LY1}px;border:1px solid #2A2A2A;background:#0B0B0B;overflow:hidden">
<div style="display:flex;justify-content:space-between;align-items:center;height:44px;padding:0 10px;border-bottom:1px solid #2A2A2A"><span style="{MONO};font-size:11px">Review queue · 50</span><span style="{MONO};font-size:9px;color:#6B6B66;letter-spacing:.05em">Δ12 · ⊗1 · ◌185</span></div>{land_list()}</div>
<div style="position:absolute;left:{LX0+lw+10}px;top:{LY0}px;right:{LW-LX1}px;bottom:{LH-LY1}px;border:1px solid #2A2A2A;overflow:hidden;background:#050505">{right_html}</div>'''
def seg(active):
    return f'<div style="position:absolute;top:8px;left:10px;display:flex;border:1px solid #2A2A2A;background:rgba(11,11,11,.95);z-index:3">'+''.join(f'<span style="padding:0 12px;height:36px;display:flex;align-items:center;font-size:13px;{"color:#000;background:#38E1D6;font-weight:600" if a==active else "color:#A3A39E"}">{a}</span>' for a in ("Detail","Map"))+f'</div><div style="position:absolute;top:8px;right:10px;display:flex;gap:6px;z-index:3"><span style="background:#F2B33D;color:#000;{MONO};font-size:8.5px;font-weight:700;padding:3px 6px;letter-spacing:.06em;height:18px">Concept — mock data</span><span style="border:1px solid #2A2A2A;background:rgba(11,11,11,.95);height:44px;padding:0 9px;display:flex;align-items:center;{MONO};font-size:10px;color:#A3A39E">⧉ Desktop</span></div>'
def landscape_map(side='left',ov=True):
    rw=LX1-(LX0+268+10); rh=LY1-LY0
    mp=map_svg(rw,rh,-86.0,35.3,95,s=0.62,uid='lm'+side,mode='selected',show_hover=False,show_controls=False,legend=False,readout=False,status=False,top_off=48,ctrl_bottom=64,sel_lines=('36.16°N 086.78°W','RNG 113 MI'))
    right=mp+seg("Map")+f'<div style="position:absolute;left:10px;right:10px;bottom:8px;background:rgba(11,11,11,.96);border:1px solid #2A2A2A;border-left:3px solid #38E1D6;padding:4px 10px;display:flex;align-items:center;gap:8px"><div style="flex:1;min-width:0"><div style="font-size:13.5px;font-weight:620;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">Dir., Manufacturing Ops <span style="color:#4ADE80">76 ▲</span></div><div style="font-size:11.5px;color:#A3A39E">Halvorsen · Nashville · $245K</div></div><div style="height:44px;padding:0 12px;border:1px solid #4ADE80;color:#4ADE80;display:flex;align-items:center;font-size:14px;font-weight:620">✓ Pursue</div><div style="height:44px;padding:0 12px;border:1px solid #F2B33D;color:#F2B33D;display:flex;align-items:center;font-size:14px">◷ Hold</div></div>'
    return frame(land_shell(right,side),LW,LH,True,side,ov=ov)
def landscape_detail(side='right',ov=True):
    right=seg("Detail")+f'''<div style="position:absolute;left:12px;right:12px;top:52px">
<div style="display:flex;gap:12px;align-items:center">{ring(76,'#4ADE80',R=30,sw=6)}<div><div style="font-size:17px;font-weight:650">Director, Manufacturing Ops</div><div style="font-size:12.5px;color:#A3A39E">Halvorsen Robotics · Nashville · $245K est.</div><div style="{MONO};font-size:10px;color:#4ADE80;margin-top:2px">▲ Top 10% · model rev 24</div></div></div>
<div style="font-size:13.5px;margin:8px 0 6px">Plant-scale mfg leadership, high flex, preferred geo.</div>
<div style="display:flex;gap:5px;font-size:12px"><span style="border-left:3px solid #4ADE80;background:#141414;padding:3px 7px">✓ Exp 90</span><span style="border-left:3px solid #4ADE80;background:#141414;padding:3px 7px">✓ FLEX high</span><span style="border-left:3px solid #4ADE80;background:#141414;padding:3px 7px">✓ Geo 90</span><span style="border-left:3px solid #F2B33D;background:#141414;padding:3px 7px">◷ Pay est.</span></div></div>
<div style="position:absolute;left:10px;right:10px;bottom:8px;display:flex;gap:8px"><div style="flex:1.3;height:48px;border:1px solid #4ADE80;color:#4ADE80;background:#1E1E1E;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:650">✓ Pursue</div><div style="flex:1;height:48px;border:1px solid #F2B33D;color:#F2B33D;display:flex;align-items:center;justify-content:center;font-size:15px">◷ Hold</div><div style="width:1px;background:#3A3A3A"></div><div style="flex:.8;height:48px;border:1px solid #4a1d18;color:#FF4D3D;display:flex;align-items:center;justify-content:center;font-size:13px">⊖ Decline</div></div>'''
    return frame(land_shell(right,side),LW,LH,True,side,ov=ov)
def landscape_desktop(side='left',ov=True):
    W=LX1-LX0; H=LY1-LY0; s=W/2560*1.25
    d=desktop()
    inner=f'''<div style="position:absolute;left:{LX0}px;top:{LY0}px;width:{W}px;height:{H}px;overflow:hidden;background:#000;border:1px solid #2A2A2A"><div style="transform:scale({s:.4f});transform-origin:-120px -10px;width:2560px;height:1440px">{d}</div></div>
<div style="position:absolute;left:{LX0}px;right:{LW-LX1}px;top:{LY0+8}px;display:flex;justify-content:center"><div style="background:rgba(11,11,11,.96);border:1px solid #38E1D6;box-shadow:0 0 8px rgba(56,225,214,.35);height:44px;padding:0 14px;display:flex;align-items:center;gap:12px;font-size:13px"><span style="color:#38E1D6;{MONO};font-size:10.5px;letter-spacing:.08em">⧉ Desktop mode · pinch / pan</span><span style="color:#A3A39E">Kept: JOB-0412 · filters · scroll</span><span style="border-left:1px solid #2A2A2A;padding-left:12px;color:#E6E6E2;font-weight:600">◧ Exit</span></div></div>
<div style="position:absolute;right:{LW-LX1+10}px;bottom:{LH-LY1+8}px;width:96px;height:56px;border:1px solid #3A3A3A;background:rgba(11,11,11,.9)"><div style="position:absolute;left:10px;top:8px;width:42px;height:26px;border:1px solid #38E1D6"></div><div style="position:absolute;bottom:2px;left:4px;{MONO};font-size:8px;color:#6B6B66;letter-spacing:.06em">Viewport</div></div>'''
    return frame(inner,LW,LH,True,side,ov=ov)
def keepout_diagrams():
    # bare frames with strong overlays + content rectangle, for the safe/keep-out diagram page
    p=f'<div style="position:absolute;left:{PAD}px;right:{PAD}px;top:{Y0}px;bottom:{PH-TB_TOP+12}px;background:rgba(56,225,214,.05);display:flex;align-items:center;justify-content:center;{MONO};font-size:12px;color:#38E1D6;text-align:center">CONTENT + TAP TARGETS<br>x 24 – 378 · y 74 – 748</div><div style="position:absolute;left:{CORNER}px;right:{CORNER}px;top:{TB_TOP}px;height:{TB_H}px;border:1px dashed #E6E6E2;border-radius:16px;display:flex;align-items:center;justify-content:center;{MONO};font-size:11px;color:#E6E6E2">TAB BAR · x 36–366 · ends y 824</div>'
    l=lambda side: f'<div style="position:absolute;left:{LX0}px;right:{LW-LX1}px;top:{LY0}px;bottom:{LH-LY1}px;background:rgba(56,225,214,.05);display:flex;align-items:center;justify-content:center;{MONO};font-size:12px;color:#38E1D6;text-align:center">CONTENT + TAP TARGETS · x 82 – 792 · y 20 – 365<br>SAME RECT FOR BOTH ROTATIONS · CAMERA {side.upper()}</div>'
    return frame(p,ovstrong=True),frame(l('left'),LW,LH,True,'left',ovstrong=True),frame(l('right'),LW,LH,True,'right',ovstrong=True)
if __name__=='__main__':
    a,b,c=keepout_diagrams()
    open('/tmp/mob.html','w').write('<!doctype html><meta charset="utf-8"><body style="margin:0;background:#222;display:flex;flex-wrap:wrap;gap:20px;width:2000px">'+portrait_queue()+portrait_detail()+portrait_map()+a+landscape_map()+landscape_detail()+landscape_desktop()+b+c+'</body>')
