#!/bin/bash
# usage: render.sh page.html out.png W H [scale]
set -e
google-chrome --headless=new --no-sandbox --disable-gpu --hide-scrollbars --force-device-scale-factor=${5:-1} --window-size=$3,$4 --virtual-time-budget=3000 --screenshot="$2" "file://$PWD/$1" >/dev/null 2>&1
python3 -c "from PIL import Image;im=Image.open('$2');print('$2',im.size)"
