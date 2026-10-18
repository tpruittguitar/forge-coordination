import re
B='/workspace/pe/build151/'
def P(fn,pairs,regex=False):
    s=open(B+fn).read()
    for a,b in pairs:
        if regex:
            s2=re.sub(a,b,s)
        else:
            assert a in s,(fn,a[:80]); s2=s.replace(a,b)
        s=s2
    open(B+fn,'w').write(s)
# ---------- desk.py ----------
s=open(B+'desk.py').read()
s=s.replace("BC={'g':'#4ADE80','a':'#F2B33D','r':'#FF4D3D'}; BN={'g':'✓ STRONG','a':'◷ WATCH','r':'✕ WEAK'}","from bands import BC,BN,band,CUT_TOP,CUT_UPPER,CUT_LOW,HARD,CHG")
s=s.replace("def band(s): return 'g' if s>=80 else ('a' if s>=65 else 'r')\n","")
NEW=[76,74,71,68,66,63,61,60,58,57,56,55,54,53,52,51,50,49,48,48,47,46,45,44,43,41,39,37,35,33,31]
i=s.index('ROWS0=['); j=s.index('ROWS=ROWS0')
blk=s[i:j]; k=[0]
def rep(m):
    v=NEW[k[0]]; k[0]+=1; return f'",{v},"'
blk=re.sub(r'",(\d\d),"',rep,blk,count=31)
blk=blk.replace('"◷ Queued 4m"','"◷ Waiting for lock · 8 s"').replace('"✓ Confirmed"','"✓ Confirmed · 3 s"').replace('"✕ Failed · retry"','"⊗ Failed · Retry"')
s=s[:i]+blk+s[j:]
s=s.replace('if new: bg="linear-gradient(90deg,rgba(56,225,214,.16),rgba(56,225,214,0) 55%),"+bg','if new: bg="linear-gradient(90deg,rgba(230,230,226,.10),rgba(230,230,226,0) 55%),"+bg')
s=s.replace('bar="#38E1D6" if (sel or new) else "transparent"','bar="#38E1D6" if sel else ("#E6E6E2" if new else "transparent")')
s=s.replace('dc={"new":"#38E1D6"}.get(d,"#4ADE80" if d.startswith("+") else ("#FF4D3D" if d.startswith("−") else "#6B6B66"))','dc={"new":"#E6E6E2"}.get(d,"#E6E6E2" if (d.startswith("+") or d.startswith("−")) else "#A3A39E")')
s=s.replace('dd="NEW" if new else (d or "·")','dd="Δ NEW" if new else (("Δ "+d) if d else "·")')
s=s.replace('wsc="#F2B33D" if "Queued" in ws','wsc="#F2B33D" if "Waiting" in ws')
s=s.replace('("#FF4D3D" if "Failed" in ws','(HARD if "Failed" in ws')
s=s.replace('"No flex":"#FF4D3D","Strict":"#FF4D3D"','"No flex":"#A3A39E","Strict":HARD')
# STRICT hold shown separately from band
s=s.replace("""        rs+=f'''<div style="display:grid;{GT}""","""        if flex=="Strict": sc=sc+f' <span style="{MONO};font-size:9px;color:{HARD};border:1px solid #4a1d18;padding:0 3px">⊘ HOLD</span>'\n        rs+=f'''<div style="display:grid;{GT}""")
s=s.replace('{ring(86,\'#4ADE80\',R=54,sw=8)}','{ring(76,\'#4ADE80\',R=54,sw=8)}')
s=s.replace('bk=[("Experience fit",35,90,"g"),("Degree FLEX",30,90,"g")','bk=[("Experience fit",35,90,"g"),("Degree FLEX",30,80,"g")')
s=s.replace('{" ⓢ" if n=="Degree FLEX" else ""}','')
s=s.replace('ⓢ shared FLEX weight 30 % · other weights local to this browser','All 8 weights SHARED · published model rev 24 · total 100 · HIGH_FLEX → fixed component 80')
s=s.replace('✕ Decline</div>','⊖ Decline</div>')
s=s.replace('<span style="color:#F2B33D">◷ QUEUED 4m</span> · Pursue · “Director, Production Ops” · est. 20–45m','<span style="color:#F2B33D">◷ WAITING FOR WRITER LOCK</span> · Pursue · “Director, Production Ops” · auto-retry 2/4 in 15 s')
s=s.replace('<span style="color:#4ADE80">✓ CONFIRMED</span> · APPLIED · “Director of Operations” · 23:12','<span style="color:#4ADE80">✓ CONFIRMED</span> · Hold · “Director of Operations” · readback 3 s')
s=s.replace('<span style="color:#FF4D3D">✕ FAILED</span> · Hold · “Head of Operations” · payload kept','<span style="color:#FF4D3D">⊗ FAILED</span> · Hold · “Head of Operations” · 4 retries · payload kept')
s=s.replace('("Writer · queued / failed","2 / 3","#F2B33D","◷ est. 20–45 min · ✕ retry",False),("Provisional scores","185","#8A8F7A","◌ of 603 eligible · recalc 69 %",False)','("Writer · waiting / failed","1 / 1","#F2B33D","◷ lock busy · auto-retry 8/15/30/45 s",False),("Stale evidence","185","#8A8F7A","◌ FLEX class stamped under older rule",False)')
s=s.replace('if l!="Provisional scores"','if l!="Stale evidence"')
s=s.replace('<span style="color:#38E1D6;{U}">12 new</span>','<span style="color:#E6E6E2;{U}">Δ 12 new</span>')
s=s.replace('<span style="color:#38E1D6;{U}">4 scores changed (recalc rev 24)</span>','<span style="color:#E6E6E2;{U}">Δ 4 evidence updates (e.g. FLEX HIGH→NO)</span>')
s=s.replace('<span style="color:#FF4D3D">✕ <span style="{U}">3 Writer retries needed</span></span>','<span style="color:#FF4D3D">⊗ <span style="{U}">1 write failed</span></span>')
s=s.replace('<span><span style="color:#6B6B66">23:38</span> Recalc rev 24: JOB-0412 82 → <b style="color:#4ADE80">86</b> · 418 / 603 done</span>','<span><span style="color:#A3A39E">23:38</span> Δ Evidence: Head of Production (Anduril) FLEX HIGH → NO · 77 → 59</span>')
s=s.replace('<span style="color:#FF4D3D">✕</span> Writer timeout #W-2280 · retry queued','<span style="color:#F2B33D">◷</span> Writer lock busy #W-2280 · retried at 8 s · ✓ 11 s')
s=s.replace('Sort: score ↓ · 11 columns · ◌ = provisional','Sort: score ↓ · 11 columns · bands = percentile (rev 24 · P90 61 · P65 54 · P20 38)')
s=s.replace('{badge("$245K est.","local")}{badge("Nashville","local")}','{badge("$245K est.","prov")}{badge("Nashville","prov")}')
open(B+'desk.py','w').write(s)
# ---------- mapsvg.py ----------
s=open(B+'mapsvg.py').read()
s=s.replace("BC={'g':'#4ADE80','a':'#F2B33D','r':'#FF4D3D'}","from bands import BC")
i=s.index('PINS=['); j=s.index(']\n',i)
blk=s[i:j]; c=[0]
def r2(m):
    c[0]+=1; b=m.group(1)
    if b=='g': return "'g'" if c[0] in (1,) or c[0]%7==0 else ("'a'" if c[0]%3==0 else "'m'")
    if b=='a': return "'m'" if c[0]%2 else "'a'"
    return "'r'"
blk=re.sub(r"'([gar])'(?=,'(?:pin|hover|sel)')",r2,blk)
s=s[:i]+blk+s[j:]
open(B+'mapsvg.py','w').write(s)
