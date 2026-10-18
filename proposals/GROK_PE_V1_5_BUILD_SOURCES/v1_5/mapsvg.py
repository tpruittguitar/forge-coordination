# v1.4 map renderer: NO radar sweep, NO range rings, NO clusters.
# Pipeline map shows ONLY the selected job (mode='selected') or, by default, the jobs in the
# current filtered selection (mode='filtered'). Targeting look kept: reticle/lock-on, grid,
# coordinate readouts, HUD corner brackets. Pins coloured by score band.
import json, math
GEO=json.load(open('/workspace/pe/build15/us-states.json'))
ABBR={'Alabama':'AL','Alaska':'AK','Arizona':'AZ','Arkansas':'AR','California':'CA','Colorado':'CO','Connecticut':'CT','Delaware':'DE','District of Columbia':'DC','Florida':'FL','Georgia':'GA','Hawaii':'HI','Idaho':'ID','Illinois':'IL','Indiana':'IN','Iowa':'IA','Kansas':'KS','Kentucky':'KY','Louisiana':'LA','Maine':'ME','Maryland':'MD','Massachusetts':'MA','Michigan':'MI','Minnesota':'MN','Mississippi':'MS','Missouri':'MO','Montana':'MT','Nebraska':'NE','Nevada':'NV','New Hampshire':'NH','New Jersey':'NJ','New Mexico':'NM','New York':'NY','North Carolina':'NC','North Dakota':'ND','Ohio':'OH','Oklahoma':'OK','Oregon':'OR','Pennsylvania':'PA','Puerto Rico':'PR','Rhode Island':'RI','South Carolina':'SC','South Dakota':'SD','Tennessee':'TN','Texas':'TX','Utah':'UT','Vermont':'VT','Virginia':'VA','Washington':'WA','West Virginia':'WV','Wisconsin':'WI','Wyoming':'WY'}
LBL={'TN':(-86.4,35.82),'KY':(-85.4,37.55),'NC':(-79.3,35.5),'SC':(-80.95,33.85),'GA':(-83.5,32.6),'AL':(-86.8,32.7),'MS':(-89.75,32.6),'FL':(-81.6,28.6),'LA':(-92.4,31.1),'AR':(-92.4,34.85),'VA':(-78.7,37.55),'WV':(-80.7,38.65),'OH':(-82.8,40.25),'IN':(-86.25,39.9),'IL':(-89.2,39.9),'MO':(-92.4,38.4)}
HOME=(-85.3097,35.0456)
from bands import BC
MONO="IBM Plex Mono,monospace"
# fictional mock pins = jobs in the current filtered view (lon,lat,band,kind,label)
PINS=[(-86.7816,36.1627,'g','sel','JOB-0412'),
(-84.39,33.75,'m','pin',''),(-84.30,33.86,'m','pin',''),(-84.52,33.66,'m','pin',''),(-84.20,33.70,'r','pin',''),
(-88.81,35.61,'a','pin',''),(-83.92,35.96,'g','pin',''),(-86.80,33.52,'a','pin',''),(-86.62,33.40,'m','pin',''),
(-86.59,34.73,'m','hover','HSV'),(-80.84,35.23,'m','pin',''),(-80.70,35.10,'a','pin',''),(-78.64,35.78,'m','pin',''),
(-78.90,35.99,'g','pin',''),(-82.39,34.85,'r','pin',''),(-90.05,35.15,'r','pin',''),(-82.55,35.60,'m','pin',''),
(-81.66,30.33,'a','pin',''),(-81.38,28.54,'m','pin',''),(-85.76,38.25,'a','pin',''),(-84.97,34.77,'g','pin',''),
(-84.88,35.16,'a','pin',''),(-81.10,32.08,'m','pin',''),(-86.30,32.37,'r','pin',''),(-84.50,38.05,'m','pin','')]

def proj(W,H,lon0,lat0,k):
    c=math.cos(math.radians(lat0))
    return (lambda lon,lat:((lon-lon0)*c*k+W/2,(lat0-lat)*k+H/2)),c

def states_paths(P,W,H,s,fill="#0A0A0A",fop=".55",stroke="#7A7A76",sw=1.6,only=None):
    o=[]
    for f in GEO['features']:
        nm=f['properties'].get('name')
        if only and nm not in only: continue
        g=f['geometry']; polys=g['coordinates'] if g['type']=='MultiPolygon' else [g['coordinates']]
        d=''
        for poly in polys:
            for ring in poly:
                xs=[P(a,b) for a,b in ring]
                if all(x<-50 or x>W+50 for x,_ in xs) or all(y<-50 or y>H+50 for _,y in xs): continue
                d+='M'+'L'.join(f'{x:.1f},{y:.1f}' for x,y in xs)+'Z'
        if d: o.append(f'<path d="{d}" fill="{fill}" fill-opacity="{fop}" stroke="{stroke}" stroke-width="{sw*s:.2f}" stroke-linejoin="round"/>')
    return o

def graticule(P,W,H,c,k,lon0,lat0,s,step=1,major=5):
    o=[]
    lon_min=lon0-W/2/(c*k); lon_max=lon0+W/2/(c*k); lat_max=lat0+H/2/k; lat_min=lat0-H/2/k
    for lo in range(math.floor(lon_min),math.ceil(lon_max)+1,step):
        x,_=P(lo,0); maj=lo%major==0
        o.append(f'<line x1="{x:.1f}" y1="0" x2="{x:.1f}" y2="{H}" stroke="{"#262626" if maj else "#161616"}" stroke-width="{s*(1.2 if maj else .8):.2f}"/>')
    for la in range(math.floor(lat_min),math.ceil(lat_max)+1,step):
        _,y=P(0,la); maj=la%major==0
        o.append(f'<line x1="0" y1="{y:.1f}" x2="{W}" y2="{y:.1f}" stroke="{"#262626" if maj else "#161616"}" stroke-width="{s*(1.2 if maj else .8):.2f}"/>')
    return o,(lon_min,lon_max,lat_min,lat_max)

def brackets(W,H,s,top=0,bottom=0,left=0,right=0,col="#A3A39E",m=10,L=34):
    o=[]; m*=s; L*=s
    for sx,sy in ((0,0),(1,0),(0,1),(1,1)):
        cx=(m+left) if sx==0 else W-m-right; cy=(m+top) if sy==0 else H-m-bottom; dx=1 if sx==0 else -1; dy=1 if sy==0 else -1
        o.append(f'<path d="M{cx:.1f},{cy+dy*L:.1f}L{cx:.1f},{cy:.1f}L{cx+dx*L:.1f},{cy:.1f}" fill="none" stroke="{col}" stroke-width="{2*s:.2f}"/>')
    return o

def reticle(x,y,s,C='#38E1D6',label='◉ LOCK · JOB-0412',lines=('36.1627°N 086.7816°W','RNG 113 MI · BRG 296° FROM HOME'),side=1,scale=1.0):
    o=[]; q=s*scale
    o.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{22*q:.1f}" fill="none" stroke="{C}" stroke-width="{1.6*s:.2f}"/><circle cx="{x:.1f}" cy="{y:.1f}" r="{31*q:.1f}" fill="none" stroke="{C}" stroke-opacity=".35" stroke-width="{s:.2f}" stroke-dasharray="{2*s:.1f} {4*s:.1f}"/>')
    for dx,dy in ((1,0),(-1,0),(0,1),(0,-1)):
        o.append(f'<line x1="{x+dx*26*q:.1f}" y1="{y+dy*26*q:.1f}" x2="{x+dx*46*q:.1f}" y2="{y+dy*46*q:.1f}" stroke="{C}" stroke-width="{1.6*s:.2f}"/>')
    b=38*q; L=11*q
    for sx,sy in ((-1,-1),(1,-1),(-1,1),(1,1)):
        cx,cy=x+sx*b,y+sy*b
        o.append(f'<path d="M{cx:.1f},{cy-sy*L:.1f}L{cx:.1f},{cy:.1f}L{cx-sx*L:.1f},{cy:.1f}" fill="none" stroke="{C}" stroke-width="{2*s:.2f}"/>')
    anc='start' if side>0 else 'end'; tx=x+side*50*q
    if label: o.append(f'<text x="{tx:.1f}" y="{y-24*q:.1f}" fill="{C}" font-family="{MONO}" font-size="{12*s:.1f}" letter-spacing=".12em" text-anchor="{anc}">{label}</text>')
    for i,t in enumerate(lines):
        o.append(f'<text x="{tx:.1f}" y="{y-9*q+i*14.5*s:.1f}" fill="{"#E6E6E2" if i==0 else "#A3A39E"}" font-family="{MONO}" font-size="{10.5*s:.1f}" letter-spacing=".06em" text-anchor="{anc}">{t}</text>')
    return o

def pin(x,y,col,s):
    return f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{10*s:.1f}" fill="none" stroke="{col}" stroke-opacity=".4" stroke-width="{s:.2f}"/><circle cx="{x:.1f}" cy="{y:.1f}" r="{5.5*s:.1f}" fill="{col}" stroke="#000" stroke-width="{1.5*s:.2f}"/>'

def map_svg(W,H,lon0,lat0,k,s=1.0,uid='m',mode='filtered',show_hover=True,show_controls=True,show_labels_readouts=True,
            ctrl_bottom=0,legend=True,top_off=0,fullscreen=False,home=True,fit_ghost=False,sel_label='◉ LOCK · JOB-0412',
            sel_lines=('36.1627°N 086.7816°W','RNG 113 MI · BRG 296° FROM HOME'),readout=True,left_off=0,right_off=0,sel_side=1,status=True,lock=None):
    P,c=proj(W,H,lon0,lat0,k)
    o=[f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" style="display:block;background:#050505">']
    o.append(f'<defs><radialGradient id="{uid}vg" cx="50%" cy="55%" r="70%"><stop offset="0" stop-color="#121212"/><stop offset="1" stop-color="#030303"/></radialGradient><clipPath id="{uid}cp"><rect width="{W}" height="{H}"/></clipPath></defs>')
    o.append(f'<rect width="{W}" height="{H}" fill="url(#{uid}vg)"/><g clip-path="url(#{uid}cp)">')
    g,(lon_min,lon_max,lat_min,lat_max)=graticule(P,W,H,c,k,lon0,lat0,s); o+=g
    o+=states_paths(P,W,H,s)
    for ab,(lo,la) in LBL.items():
        x,y=P(lo,la)
        if -20<x<W+20 and -20<y<H+20:
            o.append(f'<text x="{x:.1f}" y="{y:.1f}" fill="#8E8E89" fill-opacity=".55" font-family="{MONO}" font-size="{24*s:.1f}" text-anchor="middle" dominant-baseline="middle">{ab}</text>')
    hx,hy=P(*HOME)
    if home:
        o.append(f'<rect x="{hx-7*s:.1f}" y="{hy-7*s:.1f}" width="{14*s:.1f}" height="{14*s:.1f}" transform="rotate(45 {hx:.1f} {hy:.1f})" fill="#000" stroke="#E6E6E2" stroke-width="{1.6*s:.2f}"/><circle cx="{hx:.1f}" cy="{hy:.1f}" r="{2.2*s:.1f}" fill="#E6E6E2"/>')
        o.append(f'<text x="{hx-12*s:.1f}" y="{hy+20*s:.1f}" fill="#E6E6E2" font-family="{MONO}" font-size="{11*s:.1f}" text-anchor="end" letter-spacing=".08em">HOME</text>')
    sel=None; xs=[]; ys=[]
    for lon,lat,b,kind,lab in PINS:
        x,y=P(lon,lat); col=BC[b]
        if kind=='sel': sel=(x,y,col)
        if mode=='selected': continue
        xs.append(x); ys.append(y)
        o.append(pin(x,y,col,s))
        if kind=='hover' and show_hover:
            bw,bh=214*s,58*s; bx,by=x-bw-18*s,y+16*s
            o.append(f'<rect x="{bx:.1f}" y="{by:.1f}" width="{bw:.1f}" height="{bh:.1f}" fill="#0B0B0B" fill-opacity=".95" stroke="#38E1D6" stroke-opacity=".7" stroke-width="{s:.2f}"/><line x1="{x-5*s:.1f}" y1="{y+5*s:.1f}" x2="{bx+bw:.1f}" y2="{by:.1f}" stroke="#38E1D6" stroke-opacity=".6" stroke-width="{s:.2f}"/>')
            o.append(f'<text x="{bx+9*s:.1f}" y="{by+17*s:.1f}" fill="#E6E6E2" font-family="Inter,sans-serif" font-weight="600" font-size="{12*s:.1f}">Director, Production Ops</text><text x="{bx+9*s:.1f}" y="{by+32*s:.1f}" fill="#A3A39E" font-family="Inter,sans-serif" font-size="{10.5*s:.1f}">Cobalt Aerostructures · Huntsville, AL</text><text x="{bx+9*s:.1f}" y="{by+48*s:.1f}" fill="#4ADE80" font-family="{MONO}" font-size="{10.5*s:.1f}">82 ✓ STRONG <tspan fill="#E6E6E2">· $230K est.</tspan></text>')
    if fit_ghost and xs:
        pad=34*s; x0,x1,y0,y1=min(xs)-pad,max(xs)+pad,min(ys)-pad,max(ys)+pad
        o.append(f'<rect x="{x0:.1f}" y="{y0:.1f}" width="{x1-x0:.1f}" height="{y1-y0:.1f}" fill="none" stroke="#38E1D6" stroke-opacity=".55" stroke-width="{1.2*s:.2f}" stroke-dasharray="{8*s:.1f} {6*s:.1f}"/>')
        o.append(f'<text x="{x0+6*s:.1f}" y="{y1+16*s:.1f}" fill="#38E1D6" font-family="{MONO}" font-size="{10.5*s:.1f}" letter-spacing=".1em">AUTO-FIT BOUNDS · {len(xs)} JOBS · PAN/ZOOM 600 MS</text>')
    if lock is None: lock=(mode=='selected')
    if sel and lock:
        x,y,col=sel
        o.append(pin(x,y,col,s))
        o+=reticle(x,y,s,label=sel_label,lines=sel_lines,side=sel_side)
    o.append('</g>')
    if show_labels_readouts:
        for lo in range(math.ceil(lon_min),math.floor(lon_max)+1,2 if k<200 else 1):
            x,_=P(lo,0)
            if x<left_off+30*s or x>W-right_off-40*s: continue
            o.append(f'<text x="{x+3*s:.1f}" y="{H-6*s-ctrl_bottom:.1f}" fill="#6B6B66" font-family="{MONO}" font-size="{9.5*s:.1f}">{abs(lo):03d}°W</text>')
        for la in range(math.ceil(lat_min),math.floor(lat_max)+1,2 if k<200 else 1):
            _,y=P(0,la)
            if y<top_off+40*s or y>H-ctrl_bottom-20*s: continue
            o.append(f'<text x="{6*s+left_off:.1f}" y="{y-3*s:.1f}" fill="#6B6B66" font-family="{MONO}" font-size="{9.5*s:.1f}">{la}°N</text>')
    o+=brackets(W,H,s,top=top_off,bottom=ctrl_bottom,left=left_off,right=right_off)
    o.append(f'<g stroke="#A3A39E" stroke-opacity=".35" stroke-width="{s:.2f}"><line x1="{W/2-12*s:.1f}" y1="{H/2:.1f}" x2="{W/2-4*s:.1f}" y2="{H/2:.1f}"/><line x1="{W/2+4*s:.1f}" y1="{H/2:.1f}" x2="{W/2+12*s:.1f}" y2="{H/2:.1f}"/><line x1="{W/2:.1f}" y1="{H/2-12*s:.1f}" x2="{W/2:.1f}" y2="{H/2-4*s:.1f}"/><line x1="{W/2:.1f}" y1="{H/2+4*s:.1f}" x2="{W/2:.1f}" y2="{H/2+12*s:.1f}"/></g>')
    if status:
        txt=('SHOWING · SELECTED JOB ONLY · Esc = filtered view' if mode=='selected' else f'SHOWING · CURRENT FILTERED VIEW · {len(xs)} ON MAP')
        o.append(f'<text x="{22*s+left_off:.1f}" y="{top_off+30*s:.1f}" fill="#38E1D6" font-family="{MONO}" font-size="{11*s:.1f}" letter-spacing=".1em">{txt}</text>')
    if readout:
        o.append(f'<text x="{22*s+left_off:.1f}" y="{top_off+48*s:.1f}" fill="#6B6B66" font-family="{MONO}" font-size="{10*s:.1f}" letter-spacing=".08em">CURSOR 35.21°N 085.93°W · ZOOM AUTO-FIT</text>')
    def btn(x,y,w,h,t,fs=13,col="#E6E6E2",bd="#3A3A3A"):
        return f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" fill="#0B0B0B" stroke="{bd}" stroke-width="{s:.2f}"/><text x="{x+w/2:.1f}" y="{y+h/2+0.5*s:.1f}" fill="{col}" font-family="{MONO}" font-size="{fs*s:.1f}" text-anchor="middle" dominant-baseline="middle" letter-spacing=".06em">{t}</text>'
    if show_controls:
        bx=W-22*s-right_off; by=H-22*s-ctrl_bottom; bs=30*s
        o.append(btn(bx-bs,by-bs,bs,bs,'−',16)+btn(bx-bs,by-bs-24*s,bs,20*s,'FIT',9)+btn(bx-bs,by-2*bs-28*s,bs,bs,'+',16)+btn(bx-bs,by-3*bs-36*s,bs,bs,'◈',13))
        o.append(btn(bx-bs-8*s-64*s,by-26*s,64*s,26*s,'RESET',10)+btn(bx-bs-16*s-150*s,by-26*s,78*s,26*s,'RECENTER',10)+btn(bx-bs-24*s-262*s,by-26*s,104*s,26*s,'⤢ FULLSCREEN',10))
    if fullscreen:
        o.append(btn(W-22*s-right_off-150*s,top_off+16*s,150*s,36*s,'✕ CLOSE MAP · Esc',11,'#000','#38E1D6').replace('fill="#0B0B0B"','fill="#38E1D6"',1))
    if legend:
        lx=22*s+left_off; ly=H-48*s-ctrl_bottom
        items=[('#4ADE80','TOP 10%'),('#F2B33D','NEXT 25%'),('#8E8E89','MID 45%'),('#D9826B','LOW 20%')]
        xx=lx
        for col,t in items:
            o.append(f'<circle cx="{xx+5*s:.1f}" cy="{ly:.1f}" r="{4.5*s:.1f}" fill="{col}"/><text x="{xx+14*s:.1f}" y="{ly+4*s:.1f}" fill="#A3A39E" font-family="{MONO}" font-size="{10*s:.1f}" letter-spacing=".08em">{t}</text>'); xx+=92*s
        if home: o.append(f'<rect x="{xx+1*s:.1f}" y="{ly-4.5*s:.1f}" width="{9*s:.1f}" height="{9*s:.1f}" transform="rotate(45 {xx+5.5*s:.1f} {ly:.1f})" fill="none" stroke="#E6E6E2" stroke-width="{1.2*s:.2f}"/><text x="{xx+16*s:.1f}" y="{ly+4*s:.1f}" fill="#A3A39E" font-family="{MONO}" font-size="{10*s:.1f}" letter-spacing=".08em">HOME</text>')
    o.append('</svg>')
    return ''.join(o)

# ---------------- Geographic preference heat map (Settings > Flex policy & scoring) ----------------
# control points from the live inventory (Oct 15 2026): (name, lat, lon, score, hard)
CP=[("Cleveland, TN",35.16,-84.88,100,True),("New York, NY",40.71,-74.01,0,True),("Tampa, FL",27.95,-82.46,90,True),("Detroit, MI",42.33,-83.05,5,False),
("Los Angeles, CA",34.05,-118.24,20,False),("San Francisco, CA",37.77,-122.42,20,False),("Seattle, WA",47.61,-122.33,20,False),("Columbus, OH",39.96,-83.0,40,False),
("Austin, TX",30.27,-97.74,50,False),("Nashville, TN",36.16,-86.78,90,False),("Charlotte, NC",35.23,-80.84,80,False),("Birmingham, AL",33.52,-86.80,90,False),
("Gulf Shores, AL",30.25,-87.70,100,True),("Columbia, SC",34.00,-81.03,80,False),("Atlanta, GA",33.75,-84.39,80,False),("Memphis, TN",35.15,-90.05,10,False),
("Raleigh, NC",35.78,-78.64,70,False),("Chicago, IL",41.88,-87.63,0,True),("Minneapolis, MN",44.98,-93.27,5,False),("Denver, CO",39.74,-104.99,40,False)]
def hav(a,b,c,d):
    R=3959; p1,p2=math.radians(a),math.radians(c); dp=p2-p1; dl=math.radians(d-b)
    h=math.sin(dp/2)**2+math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    return 2*R*math.asin(min(1,math.sqrt(h)))
def idw(lat,lon,cps,power=6):
    num=den=0
    for n,la,lo,sc,hard in cps:
        d=max(hav(lat,lon,la,lo),1.0)
        if hard and d<60: return sc
        w=1/d**power; num+=w*sc; den+=w
    return num/den
def ramp(v):
    stops=[(0,(255,77,61)),(50,(242,179,61)),(100,(74,222,128))]
    for (a,ca),(b,cb) in zip(stops,stops[1:]):
        if v<=b:
            t=(v-a)/(b-a); return '#%02x%02x%02x'%tuple(int(ca[i]+(cb[i]-ca[i])*t) for i in range(3))
    return '#4ade80'
def geo_heat_svg(W,H,s=1.0,uid='g',cell=0.45,cps=None,selected="Austin, TX",drag_from=None,hover=True,new_point=None,controls=True,lon0=-96.0,lat0=37.8,k=None,power=6,top_off=0,legend=True,annot=False):
    cps=cps or CP
    if k is None: k=W/(62*math.cos(math.radians(lat0)))
    P,c=proj(W,H,lon0,lat0,k)
    o=[f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" style="display:block;background:#050505">']
    clip=''.join(p.replace('<path','<path',1) for p in states_paths(P,W,H,s,only=[n for n in ABBR if n not in ('Alaska','Hawaii','Puerto Rico')]))
    o.append(f'<defs><clipPath id="{uid}us">{clip}</clipPath><clipPath id="{uid}cp"><rect width="{W}" height="{H}"/></clipPath></defs>')
    o.append(f'<rect width="{W}" height="{H}" fill="#050505"/><g clip-path="url(#{uid}cp)">')
    g,_=graticule(P,W,H,c,k,lon0,lat0,s,step=5,major=10); o+=g
    cells=[]
    lat=24.0
    while lat<50:
        lon=-125.0
        while lon<-66:
            v=idw(lat+cell/2,lon+cell/2,cps,power)
            x0,y0=P(lon,lat+cell); x1,y1=P(lon+cell,lat)
            cells.append(f'<rect x="{x0:.1f}" y="{y0:.1f}" width="{x1-x0+0.6:.1f}" height="{y1-y0+0.6:.1f}" fill="{ramp(v)}"/>')
            lon+=cell
        lat+=cell
    o.append(f'<g clip-path="url(#{uid}us)" opacity=".62">{"".join(cells)}</g>')
    o+=states_paths(P,W,H,s,fill="none",fop="0",stroke="#0A0A0A",sw=1.1,only=[n for n in ABBR if n not in ('Alaska','Hawaii','Puerto Rico')])
    # control points
    for n,la,lo,sc,hard in cps:
        x,y=P(lo,la); col=ramp(sc)
        if drag_from and n==selected: continue
        if hard:
            o.append(f'<rect x="{x-7*s:.1f}" y="{y-7*s:.1f}" width="{14*s:.1f}" height="{14*s:.1f}" transform="rotate(45 {x:.1f} {y:.1f})" fill="#000" stroke="#E6E6E2" stroke-width="{1.8*s:.2f}"/><circle cx="{x:.1f}" cy="{y:.1f}" r="{3*s:.1f}" fill="{col}"/>')
        else:
            o.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{6.5*s:.1f}" fill="#000" stroke="#E6E6E2" stroke-width="{1.6*s:.2f}"/><circle cx="{x:.1f}" cy="{y:.1f}" r="{3*s:.1f}" fill="{col}"/>')
        if n.split(',')[0] in ("Cleveland","New York","Tampa","Los Angeles","Seattle","Denver","Chicago","Minneapolis","Memphis","Detroit","Gulf Shores","Raleigh","Columbus") and annot is not None:
            o.append(f'<text x="{x+10*s:.1f}" y="{y-8*s:.1f}" fill="#E6E6E2" font-family="{MONO}" font-size="{10*s:.1f}" letter-spacing=".04em" paint-order="stroke" stroke="#000" stroke-width="{3*s:.1f}">{n.split(",")[0].upper()} {sc}{" H" if hard else ""}</text>')
    if selected:
        cp=[q for q in cps if q[0]==selected][0]
        x,y=P(cp[2],cp[1])
        if drag_from:
            fx,fy=P(drag_from[1],drag_from[0])
            o.append(f'<circle cx="{fx:.1f}" cy="{fy:.1f}" r="{6.5*s:.1f}" fill="none" stroke="#E6E6E2" stroke-opacity=".45" stroke-dasharray="{3*s:.1f} {3*s:.1f}" stroke-width="{1.4*s:.2f}"/><line x1="{fx:.1f}" y1="{fy:.1f}" x2="{x:.1f}" y2="{y:.1f}" stroke="#38E1D6" stroke-width="{1.4*s:.2f}" stroke-dasharray="{5*s:.1f} {4*s:.1f}"/>')
            o.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{6.5*s:.1f}" fill="#000" stroke="#38E1D6" stroke-width="{2*s:.2f}"/><circle cx="{x:.1f}" cy="{y:.1f}" r="{3*s:.1f}" fill="{ramp(cp[3])}"/>')
        o+=reticle(x,y,s,label=f'◉ CONTROL PT · {selected.upper()}',lines=(f'{cp[1]:.2f}°N {abs(cp[2]):06.2f}°W · SCORE {cp[3]}','DRAG TO MOVE · ↑↓ SCORE · DEL REMOVE' if drag_from else 'CLICK MAP = ADD POINT'),side=-1,scale=.8)
    if new_point:
        la,lo,sc=new_point; x,y=P(lo,la)
        o.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{6.5*s:.1f}" fill="#000" stroke="#38E1D6" stroke-width="{1.8*s:.2f}" stroke-dasharray="{3*s:.1f} {2*s:.1f}"/><text x="{x+10*s:.1f}" y="{y+16*s:.1f}" fill="#38E1D6" font-family="{MONO}" font-size="{10*s:.1f}" letter-spacing=".06em" paint-order="stroke" stroke="#000" stroke-width="{3*s:.1f}">+ NEW POINT (click) · {sc}</text>')
    if hover:
        la,lo=34.73,-86.59; x,y=P(lo,la); v=idw(la,lo,cps,power)
        bw,bh=246*s,60*s; bx,by=x+20*s,y-96*s
        o.append(f'<g stroke="#38E1D6" stroke-width="{1.2*s:.2f}"><line x1="{x-9*s:.1f}" y1="{y:.1f}" x2="{x+9*s:.1f}" y2="{y:.1f}"/><line x1="{x:.1f}" y1="{y-9*s:.1f}" x2="{x:.1f}" y2="{y+9*s:.1f}"/></g>')
        o.append(f'<rect x="{bx:.1f}" y="{by:.1f}" width="{bw:.1f}" height="{bh:.1f}" fill="#0B0B0B" fill-opacity=".96" stroke="#38E1D6" stroke-opacity=".75" stroke-width="{s:.2f}"/>')
        o.append(f'<text x="{bx+9*s:.1f}" y="{by+18*s:.1f}" fill="#E6E6E2" font-family="Inter,sans-serif" font-weight="600" font-size="{12*s:.1f}">Huntsville, AL · geo {v:.0f}/100</text><text x="{bx+9*s:.1f}" y="{by+34*s:.1f}" fill="#A3A39E" font-family="{MONO}" font-size="{10*s:.1f}">NEAREST BIRMINGHAM, AL 90 · 82 MI</text><text x="{bx+9*s:.1f}" y="{by+50*s:.1f}" fill="#A3A39E" font-family="{MONO}" font-size="{10*s:.1f}">34.73°N 086.59°W · 6 JOBS HERE</text>')
    o.append('</g>')
    o+=brackets(W,H,s,top=top_off)
    o.append(f'<text x="{22*s:.1f}" y="{top_off+32*s:.1f}" fill="#38E1D6" font-family="{MONO}" font-size="{11*s:.1f}" letter-spacing=".1em">GEO PREFERENCE · IDW POWER {power} · {len(cps)} CONTROL PTS · {sum(1 for q in cps if q[4])} HARD</text>')
    o.append(f'<text x="{22*s:.1f}" y="{top_off+50*s:.1f}" fill="#6B6B66" font-family="{MONO}" font-size="{10*s:.1f}" letter-spacing=".08em">CURSOR 34.73°N 086.59°W · LOCAL TO THIS BROWSER</text>')
    for lo in range(-120,-65,10):
        x,_=P(lo,0)
        if 30<x<W-60: o.append(f'<text x="{x+3*s:.1f}" y="{H-8*s:.1f}" fill="#6B6B66" font-family="{MONO}" font-size="{9.5*s:.1f}">{abs(lo):03d}°W</text>')
    for la in (30,40):
        _,y=P(0,la); o.append(f'<text x="{6*s:.1f}" y="{y-3*s:.1f}" fill="#6B6B66" font-family="{MONO}" font-size="{9.5*s:.1f}">{la}°N</text>')
    if legend:
        lx=W-300*s; ly=H-40*s
        st=''.join(f'<stop offset="{t/100}" stop-color="{ramp(t)}"/>' for t in (0,25,50,75,100))
        o.append(f'<defs><linearGradient id="{uid}lg">{st}</linearGradient></defs><rect x="{lx:.1f}" y="{ly:.1f}" width="{200*s:.1f}" height="{10*s:.1f}" fill="url(#{uid}lg)" opacity=".8"/><text x="{lx:.1f}" y="{ly-6*s:.1f}" fill="#A3A39E" font-family="{MONO}" font-size="{9.5*s:.1f}">0 · LOW</text><text x="{lx+200*s:.1f}" y="{ly-6*s:.1f}" fill="#A3A39E" font-family="{MONO}" font-size="{9.5*s:.1f}" text-anchor="end">100 · PREFERRED</text>')
        o.append(f'<rect x="{lx+212*s:.1f}" y="{ly-1*s:.1f}" width="{10*s:.1f}" height="{10*s:.1f}" transform="rotate(45 {lx+217*s:.1f} {ly+4*s:.1f})" fill="none" stroke="#E6E6E2" stroke-width="{1.4*s:.2f}"/><text x="{lx+228*s:.1f}" y="{ly+8*s:.1f}" fill="#A3A39E" font-family="{MONO}" font-size="{9.5*s:.1f}">HARD</text>')
    if controls:
        def b(x,y,w,h,t,hi=False):
            return f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" fill="{"#38E1D6" if hi else "#0B0B0B"}" stroke="{"#38E1D6" if hi else "#3A3A3A"}" stroke-width="{s:.2f}"/><text x="{x+w/2:.1f}" y="{y+h/2+.5*s:.1f}" fill="{"#000" if hi else "#E6E6E2"}" font-family="{MONO}" font-size="{10*s:.1f}" text-anchor="middle" dominant-baseline="middle" letter-spacing=".06em">{t}</text>'
        o.append(b(W-22*s-34*s,top_off+18*s,34*s,30*s,'+')+b(W-22*s-34*s,top_off+52*s,34*s,30*s,'−')+b(W-22*s-34*s,top_off+86*s,34*s,30*s,'◈')+b(W-22*s-34*s-170*s,top_off+18*s,160*s,30*s,'+ ADD POINT (CLICK MAP)',True))
    o.append('</svg>')
    return ''.join(o)
if __name__=='__main__':
    open('/tmp/m.html','w').write('<body style="margin:0;background:#000">'+map_svg(820,1000,-86.0,35.4,150,mode='selected',fullscreen=True)+map_svg(820,1000,-84.4,33.8,90,fit_ghost=True)+geo_heat_svg(1100,680,drag_from=(31.2,-98.6))+'</body>')
