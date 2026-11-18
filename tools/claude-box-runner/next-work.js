#!/usr/bin/env node
/* next-work.js <file.json> [--n 10] [--path a.b] [--where k=v[,v2]] [--where k!=v] [--sort field] [--fields a,b]
   Prints the next N work items of a large work/state JSON so a lane never reads the whole file.
   Line 1: {"file","path","total","matched","shown"}; then one compact JSON item per line.
   --path picks the list (dot path); default: the largest array or object-map within two levels.
   Map entries get their key as "_key". --where filters on top-level item fields (repeatable; all must match;
   "k=" matches empty/missing). --sort sorts ascending by a field, missing values last. Strings over 300 chars are cut. */
'use strict';
const fs = require('fs');

function parseArgs(argv) {
  const o = { file: null, n: 10, path: null, where: [], sort: null, fields: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i], v = () => { if (i + 1 >= argv.length) throw new Error('missing value for ' + a); return argv[++i]; };
    if (a === '--n') o.n = Number(v());
    else if (a === '--path') o.path = v();
    else if (a === '--where') o.where.push(v());
    else if (a === '--sort') o.sort = v();
    else if (a === '--fields') o.fields = v().split(',').filter(Boolean);
    else if (a.startsWith('--')) throw new Error('unknown option ' + a);
    else if (!o.file) o.file = a;
    else throw new Error('unexpected argument ' + a);
  }
  if (!o.file) throw new Error('usage: next-work.js <file.json> [--n 10] [--path a.b] [--where k=v] [--sort f] [--fields a,b]');
  if (!Number.isInteger(o.n) || o.n < 0) throw new Error('--n must be a non-negative integer');
  return o;
}

const size = x => Array.isArray(x) ? x.length : (x && typeof x === 'object' ? Object.keys(x).length : -1);
const isMapOfObjects = x => x && typeof x === 'object' && !Array.isArray(x) &&
  Object.keys(x).length > 0 && Object.values(x).every(v => v && typeof v === 'object' && !Array.isArray(v));

function findList(data) {
  let best = null;
  const visit = (node, path, depth) => {
    if (Array.isArray(node) || (depth > 0 && isMapOfObjects(node))) {
      if (!best || size(node) > size(best.node)) best = { node, path };
      if (Array.isArray(node)) return;
    }
    if (depth < 2 && node && typeof node === 'object' && !Array.isArray(node)) {
      for (const k of Object.keys(node)) visit(node[k], path ? path + '.' + k : k, depth + 1);
    }
  };
  visit(data, '', 0);
  if (!best) throw new Error('no array or object map found; pass --path');
  return best;
}

function toItems(node) {
  if (Array.isArray(node)) return node;
  if (node && typeof node === 'object') return Object.keys(node).map(k => (node[k] && typeof node[k] === 'object' && !Array.isArray(node[k])) ? Object.assign({ _key: k }, node[k]) : { _key: k, value: node[k] });
  throw new Error('path is not an array or object');
}

function matcher(expr) {
  const m = /^([^!=]+)(!?=)(.*)$/.exec(expr);
  if (!m) throw new Error('bad --where ' + expr + ' (use k=v or k!=v)');
  const [, key, op, raw] = m, vals = raw === '' ? [''] : raw.split(',');
  const hit = item => { const x = item && typeof item === 'object' ? item[key] : undefined; return vals.includes(x === undefined || x === null ? '' : String(x)); };
  return op === '=' ? hit : item => !hit(item);
}

const cut = x => typeof x === 'string' ? (x.length > 300 ? x.slice(0, 300) + '…' : x)
  : Array.isArray(x) ? x.map(cut) : (x && typeof x === 'object' ? Object.fromEntries(Object.entries(x).map(([k, v]) => [k, cut(v)])) : x);

function nextWork(data, opt) {
  const found = opt.path ? { node: opt.path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), data), path: opt.path } : findList(data);
  if (found.node === undefined) throw new Error('path not found: ' + opt.path);
  let items = toItems(found.node);
  const total = items.length;
  for (const w of opt.where) items = items.filter(matcher(w));
  if (opt.sort) {
    const f = opt.sort, val = i => (i && i[f] != null && i[f] !== '') ? i[f] : null;
    items = items.map((it, idx) => ({ it, idx })).sort((a, b) => {
      const x = val(a.it), y = val(b.it);
      if (x === null || y === null) return (x === null) - (y === null) || a.idx - b.idx;
      return (x < y ? -1 : x > y ? 1 : 0) || a.idx - b.idx;
    }).map(e => e.it);
  }
  const shown = items.slice(0, opt.n).map(it => {
    if (!opt.fields || !it || typeof it !== 'object') return cut(it);
    const o = {}; for (const k of ['_key', ...opt.fields]) if (k in it) o[k] = it[k]; return cut(o);
  });
  return { head: { path: found.path, total, matched: items.length, shown: shown.length }, items: shown };
}

if (require.main === module) {
  try {
    const opt = parseArgs(process.argv.slice(2));
    const r = nextWork(JSON.parse(fs.readFileSync(opt.file, 'utf8')), opt);
    const out = [JSON.stringify(Object.assign({ file: opt.file }, r.head)), ...r.items.map(i => JSON.stringify(i))];
    process.stdout.write(out.join('\n') + '\n');
  } catch (e) { console.error('next-work: ' + e.message); process.exit(2); }
}
module.exports = { nextWork, parseArgs, findList };
