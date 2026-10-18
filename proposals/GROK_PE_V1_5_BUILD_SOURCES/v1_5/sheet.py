import sys,glob
from PIL import Image
fs=sorted(glob.glob('pv-*.png')); sel=[int(x) for x in sys.argv[2].split(',')] if len(sys.argv)>2 else range(1,len(fs)+1)
ims=[Image.open(fs[i-1]) for i in sel]
W=max(i.width for i in ims); H=max(i.height for i in ims); cols=int(sys.argv[3]) if len(sys.argv)>3 else 3
rows=(len(ims)+cols-1)//cols
sh=Image.new('RGB',(W*cols,H*rows),(60,60,60))
for k,im in enumerate(ims): sh.paste(im,((k%cols)*W,(k//cols)*H))
sh.save(sys.argv[1])
