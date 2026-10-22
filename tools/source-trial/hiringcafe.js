'use strict';
/* HiringCafe discovery adapter (read-only). Uses HiringCafe's documented public MCP connector
   (https://hiringcafe.com/documentation/hiringcafe-claude-connector): POST https://hiringcafe.com/api/mcp, JSON-RPC
   tools/call search_jobs, no account, no auth, rate limited per IP (429 + Retry-After). Not an undocumented site API.
   Bounded: one call per configured search, a fixed gap between calls, a call cap and a time budget; one retry only
   after a short Retry-After, otherwise the remaining searches are skipped. search_jobs returns at most 25 jobs and one
   job per company, with no pagination, and exposes HiringCafe job links only (no direct employer ATS URL), so every
   record carries HiringCafe provenance and direct-ATS evidence stays with the board reader.
   Writes a JobSpy-shaped file that run.js ingests after boards and JobSpy, so what survives its cross-source dedupe is
   HiringCafe's incremental yield. Nothing is sent to the Writer.
   node tools/source-trial/hiringcafe.js tools/source-trial/config.json /tmp/hiringcafe.json */
const fs = require('fs');
const ENDPOINT = 'https://hiringcafe.com/api/mcp';
const sleep = ms => new Promise(r => setTimeout(r, process.env.TRIAL_FAST ? 0 : ms));

/* job page URL without HiringCafe's attribution parameters: a stable source identity */
function canonicalUrl(u) { try { const x = new URL(u); return x.hostname.endsWith('hiringcafe.com') ? x.origin + x.pathname : ''; } catch (e) { return ''; } }
function parsePay(s) {
  const m = String(s || '').replace(/,/g, '').match(/\$(\d+(?:\.\d+)?)(k?)\s*(?:[–-]\s*\$?(\d+(?:\.\d+)?)(k?))?\s*\/\s*(yr|year|hr|hour|mo|month|wk|week|day)/i);
  if (!m) return {};
  const n = (v, k) => v == null ? null : +v * (k ? 1000 : 1), lo = n(m[1], m[2]), hi = n(m[3], m[4]) ?? lo;
  const interval = { yr: 'yearly', year: 'yearly', hr: 'hourly', hour: 'hourly', mo: 'monthly', month: 'monthly', wk: 'weekly', week: 'weekly', day: 'daily' }[m[5].toLowerCase()];
  return { min_amount: lo, max_amount: hi, interval };
}
/* search_jobs answers in Markdown: "### [Title](url)", "**Company**", then "- **Key:** value" lines, blocks split by "---" */
function parseResults(text) {
  const t = String(text || ''), total = (t.match(/showing\s+\d+\s+of\s+([\d,]+)\s+match/i) || [])[1];
  const jobs = t.split(/\n-{3,}\s*\n/).map(block => {
    const head = block.match(/^#{2,3}\s+\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/m); if (!head) return null;
    const field = k => ((block.match(new RegExp('^-\\s+\\*\\*' + k + ':\\*\\*\\s*(.+)$', 'mi')) || [])[1] || '').trim();
    const company = ((block.slice(head.index + head[0].length).match(/^\s*\*\*([^*\n]+)\*\*\s*$/m)) || [])[1] || '';
    const id = field('Job ID'); if (!id || !company.trim()) return null;
    return { title: head[1].trim(), company: company.trim(), location: field('Location'), workplace: field('Workplace'), compensation: field('Compensation'),
      employment_type: field('Employment type'), seniority: field('Seniority'), date_posted: field('Posted'), hiringcafe_id: id, job_url: canonicalUrl(head[2]) };
  }).filter(Boolean);
  return { totalMatches: total ? +total.replace(/,/g, '') : null, jobs };
}
function normalize(j) {
  return Object.assign({ site: 'hiringcafe', provenance: 'HIRINGCAFE_MCP', company: j.company, title: j.title, location: j.location, job_url: j.job_url, job_url_direct: '',
    hiringcafe_id: j.hiringcafe_id, date_posted: j.date_posted, workplace: j.workplace, seniority: j.seniority, employment_type: j.employment_type }, parsePay(j.compensation));
}
async function callTool(name, args, { fetcher = globalThis.fetch, id = 1 } = {}) {
  const r = await fetcher(ENDPOINT, { method: 'POST', signal: AbortSignal.timeout(45000),
    headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', 'user-agent': 'forge-source-trial/1 (read-only discovery)' },
    body: JSON.stringify({ jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: args } }) });
  if (r.status === 429) { const e = new Error('HTTP 429'); e.status = 429; e.retryAfter = +(r.headers.get('retry-after') || 0); throw e; }
  if (!r.ok) { const e = new Error('HTTP ' + r.status); e.status = r.status; throw e; }
  let body = await r.text();
  if (/text\/event-stream/.test(r.headers.get('content-type') || '')) body = body.split('\n').filter(l => l.startsWith('data:')).map(l => l.slice(5)).pop() || '';
  const d = JSON.parse(body);
  if (d.error) throw new Error('MCP ' + (d.error.message || d.error.code));
  if (d.result && d.result.isError) throw new Error('tool error: ' + String((d.result.content || [])[0]?.text || '').slice(0, 80));
  return ((d.result && d.result.content) || []).filter(c => c.type === 'text').map(c => c.text).join('\n');
}
async function run(config, { fetcher = globalThis.fetch, now = () => Date.now() } = {}) {
  const c = config.hiringcafe || {}, out = { ran: false, at: new Date(now()).toISOString(), source: ENDPOINT, searches: [], errors: [], jobs: [] };
  if (c.enabled !== true) { out.skipped = 'hiringcafe.enabled is not true'; return out; }
  const searches = (c.searches || (config.jobspy && config.jobspy.searches) || []).slice(0, c.maxCalls || 25), T0 = now(), seen = new Set();
  out.ran = true;
  for (let i = 0; i < searches.length; i++) {
    if (now() - T0 > (c.budgetMs || 480000)) { out.errors.push({ search: searches[i], error: 'time budget reached; later searches skipped' }); break; }
    const args = Object.assign({ search: searches[i], location: c.location || 'United States', posted_within_days: c.postedWithinDays || 7, limit: Math.min(25, c.limit || 25) },
      c.seniorityLevels ? { seniority_levels: c.seniorityLevels } : {}, c.employmentTypes ? { employment_types: c.employmentTypes } : {});
    const st = { search: searches[i], returned: 0, totalMatches: null, error: '' };
    let text = null;
    for (let attempt = 0; attempt < 2 && text == null; attempt++) {
      try { if (i || attempt) await sleep(c.gapMs || 2500); text = await callTool('search_jobs', args, { fetcher, id: i + 1 }); }
      catch (e) {
        if (e.status === 429 && attempt === 0 && e.retryAfter > 0 && e.retryAfter <= 60) { await sleep(e.retryAfter * 1000); continue; }
        st.error = String(e.message || e).slice(0, 80); break;
      }
    }
    out.searches.push(st);
    if (st.error) {
      out.errors.push({ search: searches[i], error: st.error });
      if (/429/.test(st.error)) { out.errors.push({ search: '', error: 'rate limited; remaining searches skipped' }); break; }
      if (out.errors.length >= 3 && out.searches.every(s => s.error)) break;   // the endpoint is down: stop, do not hammer it
      continue;
    }
    const parsed = parseResults(text); st.totalMatches = parsed.totalMatches; st.returned = parsed.jobs.length;
    parsed.jobs.forEach(j => { if (seen.has(j.hiringcafe_id)) return; seen.add(j.hiringcafe_id); out.jobs.push(normalize(j)); });
  }
  return out;
}
if (require.main === module) {
  const [cfgPath, outPath] = process.argv.slice(2);
  run(JSON.parse(fs.readFileSync(cfgPath, 'utf8'))).then(out => {
    fs.writeFileSync(outPath, JSON.stringify(out, null, 1) + '\n');
    console.log(JSON.stringify({ ran: out.ran, searches: out.searches.length, jobs: out.jobs.length, errors: out.errors.length, skipped: out.skipped || '' }));
  }).catch(e => { console.error(e); process.exit(1); });
}
module.exports = { ENDPOINT, canonicalUrl, parsePay, parseResults, normalize, callTool, run };
