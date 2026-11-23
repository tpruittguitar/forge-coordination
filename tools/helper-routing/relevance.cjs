'use strict';
const fs = require('node:fs'), path = require('node:path');
const root = path.resolve(__dirname, '../..');
// Lanes have no owner (Tim 2026-11-22). Any authorized provider may return
// evidence for this assignment; the provider is recorded, never a gate.
const lanes = require('../automation-lanes.cjs');
function registry(base) {
  try { return JSON.parse(fs.readFileSync(path.join(base, lanes.FILE))); } catch { return null; }
}
function providerAccepted(batch, base = root) {
  return lanes.receiptProvider(registry(base), batch?.taskKey, batch?.provider);
}
function load(base = root) {
  const w = JSON.parse(fs.readFileSync(path.join(base, 'control/CLAUDE_RELEVANCE_WORK.json')));
  if (w.schema !== 'forge.relevance-helper-work.v1' || !w.enabled || new Set(w.keys).size !== w.keys.length) throw Error('Invalid relevance assignment');
  return w;
}
function validate(b, w = load(), base = root) {
  if (b.schema !== 'forge.relevance-helper-batch.v1' || !providerAccepted(b, base) || b.taskKey !== w.taskKey || b.assignmentId !== w.assignmentId || !/^CLAUDE-RELEVANCE-/.test(b.runId || '') || !/^[a-f0-9]{40}$/.test(b.instructionCommit || '') || !Array.isArray(b.items) || !b.items.length || b.items.length > 20) throw Error('Invalid relevance evidence envelope');
  const seen = new Set();
  for (const i of b.items) {
    if (!w.keys.includes(i.key) || seen.has(i.key) || i.writerSubmitted !== false || ![0, 1].includes(i.targetedLookups) || !i.sourceEvidence || !i.recommendation) throw Error('Unassigned, duplicated or submitting relevance item');
    seen.add(i.key);
  }
  return {valid: true, items: seen.size, productionAuthorized: false};
}
if (require.main === module) {
  try {
    const w = load();
    if (process.argv[2] === 'validate') console.log(JSON.stringify(validate(JSON.parse(fs.readFileSync(process.argv[3])), w)));
    else if (process.argv[2] === 'checkpoint') console.log(JSON.stringify(require('./relevance-progress.cjs').checkpoint(root, w, validate, JSON.parse(fs.readFileSync(process.argv[3])))));
    else console.log(JSON.stringify(require('./relevance-progress.cjs').next(root, w, validate, Number(process.argv[3] || 1)), null, 2));
  } catch (e) { console.error(e.message); process.exitCode = 1; }
}
module.exports = {load, validate, providerAccepted};
