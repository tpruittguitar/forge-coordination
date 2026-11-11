'use strict';
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process');
const root = path.resolve(__dirname, '../..');
// The current owner is whoever the task control file names. A saved receipt remains
// evidence when its provider was the owner at that instruction revision. No provider
// name has standing authority of its own.
function registryOwner(base, taskKey) {
  try {
    const task = JSON.parse(fs.readFileSync(path.join(base, 'control/AI_AUTOMATION_TASKS.json'))).tasks[taskKey];
    return task && typeof task.owner === 'string' && task.owner ? task.owner : null;
  } catch { return null; }
}
function ownerAtInstruction(base, commit, taskKey) {
  if (!/^[a-f0-9]{40}$/.test(commit || '') || typeof taskKey !== 'string' || !taskKey) return null;
  try {
    const raw = cp.execFileSync('git', ['show', commit + ':control/AI_AUTOMATION_TASKS.json'], {cwd: base, encoding: 'utf8', maxBuffer: 8e6, stdio: ['ignore', 'pipe', 'pipe']});
    const task = JSON.parse(raw).tasks?.[taskKey];
    return task && typeof task.owner === 'string' && task.owner ? task.owner : null;
  } catch { return null; }
}
function providerAccepted(batch, owner, priorOwner) {
  return typeof batch?.provider === 'string' && !!batch.provider && (batch.provider === owner || batch.provider === priorOwner);
}
function load(base = root) {
  const w = JSON.parse(fs.readFileSync(path.join(base, 'control/CLAUDE_RELEVANCE_WORK.json')));
  if (w.schema !== 'forge.relevance-helper-work.v1' || !w.enabled || w.owner !== registryOwner(base, w.taskKey) || new Set(w.keys).size !== w.keys.length) throw Error('Invalid relevance assignment');
  return w;
}
function validate(b, w = load(), base = root) {
  const prior = b?.provider === w?.owner ? null : ownerAtInstruction(base, b?.instructionCommit, w?.taskKey);
  if (b.schema !== 'forge.relevance-helper-batch.v1' || !providerAccepted(b, w.owner, prior) || b.taskKey !== w.taskKey || b.assignmentId !== w.assignmentId || !/^CLAUDE-RELEVANCE-/.test(b.runId || '') || !/^[a-f0-9]{40}$/.test(b.instructionCommit || '') || !Array.isArray(b.items) || !b.items.length || b.items.length > 20) throw Error('Invalid relevance evidence envelope');
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
module.exports = {load, validate, providerAccepted, ownerAtInstruction};
