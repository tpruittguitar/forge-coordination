'use strict';
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const hash = x => crypto.createHash('sha256').update(typeof x === 'string' || Buffer.isBuffer(x) ? x : JSON.stringify(x)).digest('hex');
function read(root, file, fallback) {
  try { return JSON.parse(fs.readFileSync(path.join(root, file), 'utf8')); }
  catch (e) { if (e.code === 'ENOENT' && fallback !== undefined) return structuredClone(fallback); throw e; }
}
function save(root, file, value) {
  // Never overwrite an earlier failed save's evidence or share a staging file
  // with another invocation. Keep it beside the destination for atomic rename.
  const dest = path.join(root, file), tmp = dest + '.tmp-' + crypto.randomUUID();
  fs.mkdirSync(path.dirname(dest), {recursive: true});
  const fd = fs.openSync(tmp, 'wx', 0o600);
  try { fs.writeFileSync(fd, JSON.stringify(value, null, 2) + '\n'); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  // Windows readers/virus scanners can briefly deny delete sharing even after
  // the writer is closed. Retry only the rename of these already-flushed bytes.
  // Never unlink or truncate the old destination to make replacement succeed.
  const delays = [25, 50, 100, 200, 400, 400, 400];
  for (let attempt = 0; ; attempt++) {
    try { fs.renameSync(tmp, dest); return; }
    catch (e) {
      if (!['EACCES', 'EBUSY', 'EPERM'].includes(e.code) || attempt === delays.length) {
        e.pendingPath = tmp;
        throw e; // Preserve both the old destination and the failed staging file.
      }
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, delays[attempt]);
    }
  }
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
