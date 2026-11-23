#!/usr/bin/env node
/* build-prompt.js <repoDir> <TASK_KEY> --meta|--prompt
   Builds a ChatGPT box lane prompt from tools/chatgpt-box-runner/lanes.json at the
   checked-out SHA: run variables + shared entry + GRANT-FIRST excerpt + published
   procedure + only this task's registry entry. Exit 3 = no mapping or held lane. */
'use strict';
const fs = require('fs'), path = require('path');

function loadLane(root, taskKey) {
  const f = path.join(root, 'tools/chatgpt-box-runner/lanes.json');
  if (!fs.existsSync(f)) return null;
  const m = JSON.parse(fs.readFileSync(f, 'utf8')), l = m.lanes && m.lanes[taskKey];
  if (m.schema !== 'forge.chatgpt-box-lanes.v1' || !l) return null;
  return { m, l };
}

function taskEntry(root, taskKey) {
  const reg = JSON.parse(fs.readFileSync(path.join(root, 'control/AI_AUTOMATION_TASKS.json'), 'utf8'));
  return { task: (reg.tasks && reg.tasks[taskKey]) || null };
}

function grantFirst(common) {
  const start = common.indexOf('BEGIN GRANT-FIRST AND WRITER COORDINATION');
  const end = common.indexOf('END GRANT-FIRST AND WRITER COORDINATION');
  if (start < 0 || end < 0 || end <= start) return common;
  return common.slice(start, end + 'END GRANT-FIRST AND WRITER COORDINATION'.length);
}

function buildPrompt(root, taskKey, env) {
  const lane = loadLane(root, taskKey);
  if (!lane) throw Object.assign(new Error('no box mapping for ' + taskKey), { code: 3 });
  if (lane.l.enabled !== true) throw Object.assign(new Error('held lane ' + taskKey + ': ' + (lane.l.hold || 'not enabled')), { code: 3 });
  const read = rel => {
    const p = path.join(root, rel);
    if (!fs.existsSync(p)) throw Object.assign(new Error('missing ' + rel), { code: 4 });
    return fs.readFileSync(p, 'utf8').replace(/\s+$/, '');
  };
  const entryPath = lane.m.commonEntry || 'control/FORGE_SHARED_AUTOMATION_ENTRY.txt';
  const procedure = lane.l.procedure;
  const shared = read(entryPath);
  const common = fs.existsSync(path.join(root, 'policy/current/AI_AUTOMATION_COMMON.txt'))
    ? grantFirst(read('policy/current/AI_AUTOMATION_COMMON.txt'))
    : '';
  const brief = read(procedure);
  const { task } = taskEntry(root, taskKey);
  const e = k => env[k] || '';
  const vars = [
    'PROVIDER=ChatGPT', 'TASK_KEY=' + taskKey, 'RUN_ID=' + e('RUN_ID'),
    'HOST=chatgpt-box (headless claude/codex/grant, America/New_York schedule)',
    'WORKDIR=' + e('WORKDIR') + ' (fresh clone of tpruittguitar/forge-coordination ' + (e('REF') || 'main') + ')',
    'INSTRUCTION_COMMIT=' + e('INSTRUCTION_COMMIT'),
    'COCKPIT_DIR=' + (e('COCKPIT_DIR') || 'NONE'),
    'PRIVATE_DIR=' + e('PRIVATE_DIR') + ' (box-local, outside git; never publish)',
    'RUN_STARTED_UTC=' + e('RUN_STARTED_UTC'),
    'Do not use Grok, Cursor or paid API usage. If OpenAI grant credit is below $20, defer model work and keep progress.',
    'Never replay or force-dispatch a run. Acquire tools/automation-run-lock.cjs when this procedure requires a production lock and the lock path exists on this host.',
  ];
  const entry = 'TASK ENTRY (control/AI_AUTOMATION_TASKS.json tasks.' + taskKey + '): ' + JSON.stringify(task);
  const prompt = [vars.join('\n'), '===== SHARED ENTRY =====', shared, common ? '===== GRANT-FIRST =====\n' + common : '', '===== LANE PROCEDURE =====', brief, entry].filter(Boolean).join('\n') + '\n';
  return { prompt, lane };
}

if (require.main === module) {
  const [root, taskKey, mode] = process.argv.slice(2);
  try {
    if (!root || !taskKey || !['--meta', '--prompt'].includes(mode)) throw Object.assign(new Error('usage: build-prompt.js <repoDir> <TASK_KEY> --meta|--prompt'), { code: 2 });
    const r = buildPrompt(root, taskKey, process.env);
    if (mode === '--meta') console.log([r.lane.l.model || 'sonnet', r.lane.l.timeoutMinutes || 25, r.lane.l.cockpit ? 1 : 0, r.lane.l.runner || 'claude'].join('\t'));
    else process.stdout.write(r.prompt);
  } catch (err) { console.error('build-prompt: ' + err.message); process.exit(err.code || 1); }
}
module.exports = { buildPrompt, loadLane, grantFirst };
