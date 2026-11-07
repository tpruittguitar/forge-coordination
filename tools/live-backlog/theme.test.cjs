'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const html = fs.readFileSync(__dirname + '/worksheet.html', 'utf8');
const css = html.match(/<style id="worksheet-dark-theme">([\s\S]*?)<\/style>/)?.[1];
const luminance = hex => {
  const rgb = hex.replace('#', '').match(/../g).slice(0, 3).map(c => parseInt(c, 16) / 255)
    .map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
};
const contrast = (a, b) => { const x=luminance(a), y=luminance(b); return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05); };
test('dark override covers native controls and uses only neutral colors', () => {
  assert.ok(css); assert.match(css, /color-scheme:\s*dark/);
  for (const hex of css.match(/#[\da-f]{6}(?:[\da-f]{2})?/gi)) {
    const [r,g,b] = hex.slice(1).match(/../g); assert.equal(r,g,hex); assert.equal(g,b,hex);
  }
  for (const selector of ['dialog::backdrop', 'input::placeholder', 'summary:focus-visible', 'input[type=checkbox]', '.hold-basis', '.salary-basis', '.ats-basis', '.source-key', '.filter-error', 'tr.selected:hover td']) assert.ok(css.includes(selector), selector);
});
test('text palette meets WCAG AA on the darkest through brightest UI surfaces', () => {
  for (const foreground of ['#e6e6e6', '#bdbdbd', '#dddddd']) {
    for (const background of ['#111111','#191919','#242424','#2d2d2d','#383838','#404040']) {
      assert.ok(contrast(foreground,background)>=4.5, `${foreground} on ${background}`);
    }
  }
  assert.ok(contrast('#e6e6e6','#484848')>=4.5);
  assert.ok(contrast('#aaaaaa','#191919')>=4.5);
  for (const background of ['#242424','#404040','#484848']) {
    assert.ok(contrast('#eeeeee',background)>=3);
    assert.ok(contrast('#999999',background)>=3, `control border on ${background}`);
  }
});
test('selection, errors and destructive controls have non-color cues', () => {
  assert.match(css, /tr\.selected td:first-child\s*\{[^}]*box-shadow/);
  assert.match(css, /\.danger\s*\{[^}]*border-style:\s*double/);
  assert.match(css, /\[aria-invalid=true\]\s*\{[^}]*border-style:\s*dashed/);
  assert.match(css, /content:\s*'Error: '/);
  assert.match(css, /content:\s*'Confirmed: '/);
});
