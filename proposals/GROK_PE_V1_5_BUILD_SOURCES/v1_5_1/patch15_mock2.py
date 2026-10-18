B='/workspace/pe/build151/'
s=open(B+'desk.py').read()
for a,b in [('✓ Strong · opportunity rating','▲ Top 10% · opportunity rating 76'),('▲ 4 since last review (recalc)','Δ +3 since last review (evidence: salary posted)')]:
    assert a in s; s=s.replace(a,b)
open(B+'desk.py','w').write(s)
s=open(B+'mapsvg.py').read()
s=s.replace("items=[('#4ADE80','STRONG'),('#F2B33D','WATCH'),('#FF4D3D','WEAK')]","items=[('#4ADE80','TOP 10%'),('#F2B33D','NEXT 25%'),('#8E8E89','MID 45%'),('#D9826B','LOW 20%')]")
s=s.replace("o.append(f'<circle cx=\"{xx+5*s:.1f}\" cy=\"{ly:.1f}\" r=\"{4.5*s:.1f}\" fill=\"{col}\"/><text x=\"{xx+14*s:.1f}\" y=\"{ly+4*s:.1f}\" fill=\"#A3A39E\" font-family=\"{MONO}\" font-size=\"{10*s:.1f}\" letter-spacing=\".08em\">{t}</text>'); xx+=78*s","o.append(f'<circle cx=\"{xx+5*s:.1f}\" cy=\"{ly:.1f}\" r=\"{4.5*s:.1f}\" fill=\"{col}\"/><text x=\"{xx+14*s:.1f}\" y=\"{ly+4*s:.1f}\" fill=\"#A3A39E\" font-family=\"{MONO}\" font-size=\"{10*s:.1f}\" letter-spacing=\".08em\">{t}</text>'); xx+=92*s")
open(B+'mapsvg.py','w').write(s)
s=open(B+'mobile.py').read()
R=[("    b='g' if s>=80 else ('a' if s>=65 else 'r')","    from bands import band as _bd; b=_bd(s)"),
("        b='g' if s>=80 else 'a'","        from bands import band as _bd; b=_bd(s)"),
('<span style="color:#F2B33D">◷ Queued 4m</span>','<span style="color:#F2B33D">◷ Waiting for lock · 8 s</span>'),
('"Nashville",86,','"Nashville",76,'),('"Huntsville",82,','"Huntsville",71,'),('"Cleveland, TN",81,','"Cleveland, TN",63,'),('"Chattanooga",80,','"Chattanooga",57,'),('"Knoxville",79,','"Knoxville",48,'),
("ring(86,'#4ADE80',R=40,sw=7)","ring(76,'#4ADE80',R=40,sw=7)"),("ring(86,'#4ADE80',R=30,sw=6)","ring(76,'#4ADE80',R=30,sw=6)"),
('✓ Strong · rev 24 current','▲ Top 10% · model rev 24'),
('color:#4ADE80;line-height:1">86</div>','color:#4ADE80;line-height:1">76</div>'),('color:#4ADE80">✓ STRONG</div>','color:#4ADE80">▲ TOP 10%</div>'),
('("Halvorsen Robotics",86)','("Halvorsen Robotics",76)'),
('"Halvorsen Robotics",86),("Director, Production Ops","Cobalt Aerostructures",82),("Head of Production","Vantor Defense Sys.",81),("VP Operations","Ridgeline Composites",80),("Plant Manager","Ironbark Battery",79),("Sr. Dir., NPI & Scale-up","Tallgrass Motion",78)','"Halvorsen Robotics",76),("Director, Production Ops","Cobalt Aerostructures",71),("Head of Production","Vantor Defense Sys.",63),("VP Operations","Ridgeline Composites",57),("Plant Manager","Ironbark Battery",48),("Sr. Dir., NPI & Scale-up","Tallgrass Motion",36)'),
('("Failed","3","#FF4D3D",False),("◌ Prov.","185",OL,False)','("⊗ Failed","1","#FF4D3D",False),("◌ Stale ev.","185",OL,False)'),
('New 12 · ✕3 · ◌185','Δ12 · ⊗1 · ◌185'),
('✕ Decline</div>','⊖ Decline</div>'),
('<span style="color:#F2B33D">◷ QUEUED</span> · Pursue · toast ▲','<span style="color:#F2B33D">◷ WAITING FOR LOCK</span> · Pursue · retry 8 s'),
]
for a,b in R:
    if a in s: s=s.replace(a,b)
    else: print("MISS",a[:60])
open(B+'mobile.py','w').write(s)
