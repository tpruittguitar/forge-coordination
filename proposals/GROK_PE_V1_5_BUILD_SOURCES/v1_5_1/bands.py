# v1.5 percentile score bands (display-only). Example cut-points from live OPEN data: top≈76, P90≈61, median≈48.
CUT_TOP,CUT_UPPER,CUT_LOW=61,54,38   # P90, P65, P20 of the current OPEN population (recomputed on model/population change)
BC={'g':'#4ADE80','a':'#F2B33D','m':'#8E8E89','r':'#D9826B'}
BN={'g':'▲ TOP 10%','a':'◆ NEXT 25%','m':'● MID 45%','r':'▽ LOW 20%'}
def band(s): return 'g' if s>=CUT_TOP else ('a' if s>=CUT_UPPER else ('m' if s>=CUT_LOW else 'r'))
HARD='#FF4D3D'   # failed write / hard block only
CHG='#E6E6E2'    # changed marker = Primary white Δ, never cyan
