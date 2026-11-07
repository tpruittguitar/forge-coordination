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
const tokens = Object.fromEntries([...css.matchAll(/--([\w-]+):\s*(#[\da-f]{6});/gi)].map(m=>[m[1],m[2]]));
const neutral = value => {const [r,g,b]=value.slice(1).match(/../g);return r===g&&g===b;};
test('dark surfaces stay neutral and color is limited to semantic accents, never orange', () => {
  assert.ok(css); assert.match(css, /color-scheme:\s*dark/);
  for (const key of ['page','surface','control','hover','selected','selected-hover','text','muted','line','control-line']) assert.ok(neutral(tokens[key]),key);
  const accents=['accent','error','success','warning','error-bg','success-bg'].map(key=>tokens[key]);
  assert.deepEqual(accents,['#bed4f5','#f3b6c0','#add6c6','#cfbde8','#2a2023','#1e2823']);
  for (const hex of css.match(/#[\da-f]{6}(?:[\da-f]{2})?/gi)) assert.ok(neutral(hex)||accents.includes(hex),hex);
  for (const selector of ['dialog::backdrop', 'input::placeholder', 'summary:focus-visible', 'input[type=checkbox]', '.hold-basis', '.salary-basis', '.ats-basis', '.source-key', '.filter-error', 'tr.selected:hover td']) assert.ok(css.includes(selector), selector);
});
test('actual text and accent tokens meet WCAG AA on the UI surfaces', () => {
  for (const foreground of ['text','muted','accent','error','success','warning'].map(key=>tokens[key])) {
    for (const background of ['page','surface','control','hover','selected','selected-hover'].map(key=>tokens[key])) assert.ok(contrast(foreground,background)>=4.5, `${foreground} on ${background}`);
  }
  for (const state of ['error','success']) {
    assert.ok(contrast(tokens[state],tokens[state+'-bg'])>=4.5);
    assert.ok(contrast(tokens.text,tokens[state+'-bg'])>=4.5);
  }
  assert.ok(contrast(tokens.error,'#484848')>=4.5);
  assert.ok(contrast('#aaaaaa',tokens.surface)>=4.5);
  for (const background of [tokens.control,tokens['selected-hover'],'#484848']) {
    assert.ok(contrast(tokens.accent,background)>=3);
    assert.ok(contrast(tokens['control-line'],background)>=3, `control border on ${background}`);
  }
});
test('selection, errors and destructive controls have non-color cues', () => {
  assert.match(css, /tr\.selected td:first-child\s*\{[^}]*box-shadow/);
  assert.match(css, /\.danger\s*\{[^}]*border-style:\s*double/);
  assert.match(css, /\[aria-invalid=true\]\s*\{[^}]*border-style:\s*dashed/);
  assert.match(css, /content:\s*'Error: '/);
  assert.match(css, /content:\s*'Confirmed: '/);
});
