'use strict';
// HiringCafe adapter: Markdown parsing in the connector's live format, bounded calls, 429 handling. No network.
const test = require('node:test'), assert = require('node:assert/strict');
process.env.TRIAL_FAST = '1';
const H = require('./hiringcafe.js');
// Same shape as a live search_jobs answer (2026-10-22), synthetic employers.
const PAGE = `## HiringCafe job results (showing 2 of 1,184 matches)

### [Director of Manufacturing](https://hiringcafe.com/job/director-of-manufacturing-nova-forge-huntsville-aaaa1111bbbb2222?utm_source=claude&utm_medium=llm-app&utm_campaign=mcp)
**Nova Forge Robotics**
- **Location:** Huntsville, Alabama, United States
- **Workplace:** Onsite
- **Compensation:** $200,000 – $275,000/yr
- **Employment type:** Full Time
- **Seniority:** Senior Level
- **Posted:** 2026-10-12
- **Job ID:** aaaa1111bbbb2222

Bachelor's degree; 10+ years manufacturing leadership.

---

### [Plant Manager](https://hiringcafe.com/job/plant-manager-steel-automation-dayton-cccc3333dddd4444?utm_source=claude)
**Steel Automation Partners**
- **Location:** Dayton, Ohio, United States
- **Workplace:** Onsite
- **Employment type:** Full Time
- **Seniority:** Senior Level
- **Posted:** 2026-10-13
- **Job ID:** cccc3333dddd4444

Lean manufacturing leadership.`;
const reply = (text, status = 200, headers = {}) => ({ ok: status < 400, status, headers: { get: k => headers[k.toLowerCase()] || (k.toLowerCase() === 'content-type' ? 'application/json' : null) },
  text: async () => JSON.stringify({ jsonrpc: '2.0', id: 1, result: { content: [{ type: 'text', text }] } }) });
const config = (over = {}) => ({ jobspy: { searches: ['Director of Manufacturing', 'Plant Manager', 'Director of Quality'] }, hiringcafe: Object.assign({ enabled: true, gapMs: 1 }, over) });

test('parses the connector Markdown: title, employer, location, pay, posted date, ID, canonical URL', () => {
  const r = H.parseResults(PAGE);
  assert.equal(r.totalMatches, 1184); assert.equal(r.jobs.length, 2);
  const j = H.normalize(r.jobs[0]);
  assert.deepEqual([j.company, j.title, j.location, j.date_posted, j.hiringcafe_id], ['Nova Forge Robotics', 'Director of Manufacturing', 'Huntsville, Alabama, United States', '2026-10-12', 'aaaa1111bbbb2222']);
  assert.equal(j.job_url, 'https://hiringcafe.com/job/director-of-manufacturing-nova-forge-huntsville-aaaa1111bbbb2222', 'attribution parameters stripped');
  assert.equal(j.job_url_direct, '', 'connector exposes no direct employer ATS URL; never invented');
  assert.deepEqual([j.min_amount, j.max_amount, j.interval], [200000, 275000, 'yearly']);
  const k = H.normalize(r.jobs[1]);
  assert.equal(k.min_amount, undefined, 'unpublished pay stays unknown');
  assert.equal(k.provenance, 'HIRINGCAFE_MCP');
});
test('pay parsing covers ranges, single values, k suffix and hourly; garbage is unknown', () => {
  assert.deepEqual(H.parsePay('$85/hr'), { min_amount: 85, max_amount: 85, interval: 'hourly' });
  assert.deepEqual(H.parsePay('$180k – $220k/yr'), { min_amount: 180000, max_amount: 220000, interval: 'yearly' });
  assert.deepEqual(H.parsePay('Competitive'), {});
  assert.equal(H.canonicalUrl('https://evil.example/job/x?utm=1'), '', 'only hiringcafe.com links are kept as source identity');
});
test('empty or malformed answers yield no jobs rather than partial records', () => {
  assert.deepEqual(H.parseResults('No jobs matched these filters.').jobs, []);
  assert.deepEqual(H.parseResults('### [Title](https://hiringcafe.com/job/x)\n- **Location:** Austin').jobs, [], 'no employer or ID: dropped');
});
test('disabled by config: no network at all', async () => {
  let calls = 0; const out = await H.run(config({ enabled: false }), { fetcher: async () => { calls++; } });
  assert.equal(out.ran, false); assert.equal(calls, 0);
});
test('one bounded search_jobs call per search, documented endpoint, limit capped at 25, jobs de-duplicated by ID', async () => {
  const bodies = []; const out = await H.run(config({ limit: 99, maxCalls: 2, seniorityLevels: ['Senior Level'] }), { fetcher: async (url, o) => { assert.equal(url, 'https://hiringcafe.com/api/mcp'); assert.equal(o.method, 'POST'); bodies.push(JSON.parse(o.body)); return reply(PAGE); } });
  assert.equal(bodies.length, 2, 'maxCalls bounds the run');
  assert.ok(bodies.every(b => b.method === 'tools/call' && b.params.name === 'search_jobs' && b.params.arguments.limit === 25 && b.params.arguments.posted_within_days === 7 && b.params.arguments.location === 'United States'));
  assert.deepEqual(bodies[0].params.arguments.seniority_levels, ['Senior Level']);
  assert.equal(out.jobs.length, 2, 'same job IDs from two searches kept once');
  assert.deepEqual(out.searches.map(s => s.returned), [2, 2]);
});
test('a short Retry-After is honoured once; a long one stops the remaining searches', async () => {
  let n = 0; const short = await H.run(config(), { fetcher: async () => (++n === 1 ? reply('', 429, { 'retry-after': '2' }) : reply(PAGE)) });
  assert.equal(n, 4, 'one retry then the other two searches'); assert.equal(short.errors.length, 0);
  let m = 0; const long = await H.run(config(), { fetcher: async () => { m++; return reply('', 429, { 'retry-after': '600' }); } });
  assert.equal(m, 1, 'no hammering after a long rate limit'); assert.match(long.errors.map(e => e.error).join(' '), /rate limited; remaining searches skipped/);
});
test('endpoint failures are recorded and the run stops once every call has failed three times', async () => {
  let n = 0; const out = await H.run(config({ searches: ['a', 'b', 'c', 'd', 'e'] }), { fetcher: async () => { n++; return reply('', 503); } });
  assert.equal(n, 3); assert.equal(out.errors.length, 3); assert.equal(out.jobs.length, 0);
});
test('MCP tool errors are surfaced, not parsed as empty success', async () => {
  const out = await H.run(config({ searches: ['a'] }), { fetcher: async () => ({ ok: true, status: 200, headers: { get: () => 'application/json' }, text: async () => JSON.stringify({ jsonrpc: '2.0', id: 1, result: { isError: true, content: [{ type: 'text', text: 'invalid location' }] } }) }) });
  assert.match(out.errors[0].error, /tool error: invalid location/);
});
