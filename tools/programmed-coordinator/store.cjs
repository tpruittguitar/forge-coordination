'use strict';
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const hash = x => crypto.createHash('sha256').update(typeof x === 'string' || Buffer.isBuffer(x) ? x : JSON.stringify(x)).digest('hex');
function read(root, file, fallback) {
  try { return JSON.parse(fs.readFileSync(path.join(root, file), 'utf8')); }
  catch (e) { if (e.code === 'ENOENT' && fallback !== undefined) return structuredClone(fallback); throw e; }
}
function save(root, file, value) {
  const dest = path.join(root, file), tmp = dest + '.tmp';
  fs.mkdirSync(path.dirname(dest), {recursive: true});
  const fd = fs.openSync(tmp, 'w', 0o600);
  try { fs.writeFileSync(fd, JSON.stringify(value, null, 2) + '\n'); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  fs.renameSync(tmp, dest);
}
function immutable(root, file, value) {
  const dest = path.join(root, file), raw = JSON.stringify(value, null, 2) + '\n';
  fs.mkdirSync(path.dirname(dest), {recursive: true});
  if (fs.existsSync(dest)) { if (fs.readFileSync(dest, 'utf8') !== raw) throw Error('Immutable evidence collision'); return; }
  const fd = fs.openSync(dest, 'wx', 0o600);
  try { fs.writeFileSync(fd, raw); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
}
function files(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, {withFileTypes: true}).sort((a,b) => a.name.localeCompare(b.name)).flatMap(e =>
    e.isDirectory() ? files(path.join(dir, e.name)) : e.isFile() && e.name.endsWith('.json') ? [path.join(dir, e.name)] : []);
}
module.exports = {hash, read, save, immutable, files};
