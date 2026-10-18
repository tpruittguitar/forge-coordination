set -e
cd /workspace/pe/build151
google-chrome --headless=new --no-sandbox --disable-gpu --no-pdf-header-footer --virtual-time-budget=5000 --print-to-pdf=draft.pdf file:///workspace/pe/build151/proposal.html 2>/dev/null
google-chrome --headless=new --no-sandbox --disable-gpu --virtual-time-budget=5000 --dump-dom file:///workspace/pe/build151/proposal.html 2>/dev/null | grep -o 'data-overflow="[^"]*"'
pdfinfo draft.pdf | grep Pages
rm -f pv-*.png; pdftoppm -r 80 -png draft.pdf pv
