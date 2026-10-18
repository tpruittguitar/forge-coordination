def lum(h):
    h=h.lstrip('#');r,g,b=[int(h[i:i+2],16)/255 for i in (0,2,4)]
    f=lambda c:c/12.92 if c<=0.03928 else ((c+0.055)/1.055)**2.4
    return 0.2126*f(r)+0.7152*f(g)+0.0722*f(b)
def cr(a,b):
    la,lb=sorted([lum(a),lum(b)],reverse=True);return (la+0.05)/(lb+0.05)
S={'Void':'#000000','Hull':'#0B0B0B','Plate':'#141414','Raised':'#1E1E1E'}
C={'Primary':'#E6E6E2','Secondary':'#A3A39E','Muted/Outline':'#6B6B66','Green':'#4ADE80','Amber':'#F2B33D','Red':'#FF4D3D','Cyan':'#38E1D6','Olive':'#8A8F7A','Clay':'#D9826B','BandMid':'#8E8E89','Terminal':'#5A5A5A','Gridline':'#3A3A3A','Seam':'#2A2A2A','RedDim#4a1d18':'#4a1d18'}
if __name__=='__main__':
    print('%-16s'%'', ' '.join('%7s'%s for s in S))
    for n,c in C.items(): print('%-16s'%n,' '.join('%7.2f'%cr(c,v) for v in S.values()))
    print('Green vs Amber',round(cr('#4ADE80','#F2B33D'),2),'Clay vs Red',round(cr('#D9826B','#FF4D3D'),2),'Mid vs Secondary',round(cr('#8E8E89','#A3A39E'),2))
    print('black on Amber',round(cr('#000000','#F2B33D'),2),'black on Cyan',round(cr('#000000','#38E1D6'),2),'white #fff on Red',round(cr('#FFFFFF','#FF4D3D'),2),'black on Red',round(cr('#000000','#FF4D3D'),2))
    print('Primary focus ring on Raised',round(cr('#E6E6E2','#1E1E1E'),2))
