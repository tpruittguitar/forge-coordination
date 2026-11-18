#!/usr/bin/env node
/* build-prompt.js <repoDir> <TASK_KEY> --meta|--prompt
   Builds a Claude box lane prompt from control/CLAUDE_BOX_LANES.json at the checked-out SHA:
   run variables (from env) + the shared header (lanes.common) + the lane brief (lane.procedure) + only this
   task's entry from control/AI_AUTOMATION_TASKS.json (+ its runtime/current.json lane entry for runtime routes).
   --meta prints "model\ttimeoutMinutes\tcockpit(0|1)\ttools" ; --prompt prints the prompt. Exit 3 = no mapping. */
'use strict';
const fs = require('fs'), path = require('path');

const HEADER_MAX_TOKENS = 600, BRIEF_MAX_TOKENS = 1500;
const estTokens = text => Math.ceil(Buffer.byteLength(text, 'utf8') / 4);   // same estimate as runtime/current.json

function loadLane(root, taskKey) {
  const f = path.join(root, 'control/CLAUDE_BOX_LANES.json');
  if (!fs.existsSync(f)) return null;
  const m = JSON.parse(fs.readFileSync(f, 'utf8')), l = m.lanes && m.lanes[taskKey];
  if (m.schema !== 'forge.claude-box-lanes.v1' || !l) return null;
  return { m, l, tools: [...m.baseTools, ...(l.tools || [])] };
}

function taskEntry(root, taskKey) {
  const reg = JSON.parse(fs.readFileSync(path.join(root, 'control/AI_AUTOMATION_TASKS.json'), 'utf8'));
  const t = reg.tasks && reg.tasks[taskKey];
  let runtime = null;
  if (t && t.route === 'runtime') {
    try {
      const cur = JSON.parse(fs.readFileSync(path.join(root, 'runtime/current.json'), 'utf8')), rl = cur.lanes && cur.lanes[taskKey];
      runtime = rl ? { release_id: cur.release_id, owner: rl.owner } : { release_id: cur.release_id, owner: null };
    } catch (e) { runtime = { error: 'runtime/current.json unreadable' }; }
  }
  return { task: t || null, runtime };
}

function buildPrompt(root, taskKey, env) {
  const lane = loadLane(root, taskKey);
  if (!lane) throw Object.assign(new Error('no box mapping for ' + taskKey), { code: 3 });
  const read = rel => {
    const p = path.join(root, rel);
    if (!fs.existsSync(p)) throw Object.assign(new Error('missing ' + rel), { code: 4 });
    return fs.readFileSync(p, 'utf8').replace(/\s+$/, '');
  };
  const header = read(lane.m.common), brief = read(lane.l.procedure), { task, runtime } = taskEntry(root, taskKey);
  const e = k => env[k] || '';
  const vars = [
    'PROVIDER=Claude', 'TASK_KEY=' + taskKey, 'RUN_ID=' + e('RUN_ID'),
    'HOST=claude-box (headless claude -p, America/New_York schedule)',
    'WORKDIR=' + e('WORKDIR') + ' (fresh clone of tpruittguitar/forge-coordination ' + (e('REF') || 'main') + ')',
    'INSTRUCTION_COMMIT=' + e('INSTRUCTION_COMMIT'),
    'COCKPIT_DIR=' + (e('COCKPIT_DIR') || 'NONE'),
    'PRIVATE_DIR=' + e('PRIVATE_DIR') + ' (box-local, outside git; never publish)',
    'RUN_STARTED_UTC=' + e('RUN_STARTED_UTC'),
  ];
  const entry = 'TASK ENTRY (control/AI_AUTOMATION_TASKS.json tasks.' + taskKey + '): ' + JSON.stringify(task) +
    (runtime ? '\nRUNTIME MANIFEST ENTRY (runtime/current.json): ' + JSON.stringify(runtime) : '');
  const prompt = [vars.join('\n'), '===== HEADER =====', header, '===== LANE BRIEF =====', brief, entry].join('\n') + '\n';
  return { prompt, header, brief, lane };
}

if (require.main === module) {
  const [root, taskKey, mode] = process.argv.slice(2);
  try {
    if (!root || !taskKey || !['--meta', '--prompt'].includes(mode)) throw Object.assign(new Error('usage: build-prompt.js <repoDir> <TASK_KEY> --meta|--prompt'), { code: 2 });
    const r = buildPrompt(root, taskKey, process.env);
    if (mode === '--meta') console.log([r.lane.l.model, r.lane.l.timeoutMinutes, r.lane.l.cockpit ? 1 : 0, r.lane.tools.join(',')].join('\t'));
    else process.stdout.write(r.prompt);
  } catch (err) { console.error('build-prompt: ' + err.message); process.exit(err.code || 1); }
}
module.exports = { buildPrompt, loadLane, estTokens, HEADER_MAX_TOKENS, BRIEF_MAX_TOKENS };
