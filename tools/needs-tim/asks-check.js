#!/usr/bin/env node
'use strict';
/* Fails when an ask is in both asks/open and asks/resolved (same file name or same id).
   Resolving is one step: git mv asks/open/<ID>.json asks/resolved/<ID>.json, then add the ruling (asks/README.md).
   Run: node tools/needs-tim/asks-check.js [root] */
const fs = require('fs'), path = require('path');

function readDir(root, dir) {
  const full = path.join(root, 'asks', dir);
  const files = fs.existsSync(full) ? fs.readdirSync(full).filter(f => f.endsWith('.json')).sort() : [];
  return files.map(file => {
    let id = null;
    try { id = JSON.parse(fs.readFileSync(path.join(full, file), 'utf8')).id || null; } catch (e) { id = null; }
    return { file, id };
  });
}

function check(root) {
  const open = readDir(root, 'open'), resolved = readDir(root, 'resolved');
  const files = new Set(resolved.map(r => r.file)), ids = new Set(resolved.map(r => r.id).filter(Boolean));
  return open.filter(o => files.has(o.file) || (o.id && ids.has(o.id)))
    .map(o => 'asks/open/' + o.file + (o.id ? ' (id ' + o.id + ')' : '') + ' is already in asks/resolved; resolve with git mv, not a copy');
}

if (require.main === module) {
  const errors = check(path.resolve(process.argv[2] || '.'));
  if (errors.length) { errors.forEach(e => console.error('DUPLICATE ' + e)); process.exit(1); }
  console.log('asks-check: no ask is in both asks/open and asks/resolved');
}
module.exports = { check };
