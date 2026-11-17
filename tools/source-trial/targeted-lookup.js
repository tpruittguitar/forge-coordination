'use strict';
/* Targeted posting lookup (Tim 2026-11-17: JobSpy and HiringCafe posting text is acceptable verification).
   Helper returns that are ready but whose posting page the coordinator cannot fetch (LinkedIn, Glassdoor, Indeed
   walls) are searched one by one: JobSpy with description fetch on, then HiringCafe without its 7-day window.
   Only a result whose company, title and location match the stuck item exactly is kept. It is saved under its
   own URL and also under the item's posting URL (aliasUrls), in state/targeted-posting-lookup.json, which the
   discovery index reads. The coordinator still checks identity and the helper's quotes against this text.
   Read-only toward the Writer.
     node tools/source-trial/targeted-lookup.js targets /tmp/targets.json
     python tools/source-trial/jobspy_targeted.py /tmp/targets.json /tmp/jobspy-targeted.json
     node tools/source-trial/targeted-lookup.js hiringcafe /tmp/targets.json /tmp/hc-targeted.json
     node tools/source-trial/targeted-lookup.js ats /tmp/jobspy-targeted.json /tmp/ats-targeted.json
     node tools/source-trial/targeted-lookup.js merge /tmp/targets.json /tmp/jobspy-targeted.json /tmp/hc-targeted.json /tmp/ats-targeted.json */
const fs = require('fs'), path = require('path');
const E = require('./evidence-store'), Source = require('../programmed-coordinator/source.cjs');
const ROOT = path.resolve(__dirname, '../..'), OUT = 'state/targeted-posting-lookup.json', STATE = 'state/PROGRAMMED_COORDINATOR.json';
const ROUTE = /^(?:SOURCE_ROUTE_BACKOFF|SOURCE_HTTP_403|SOURCE_HTTP_429|WORKING_SOURCE_ROUTE_REQUIRED)$/;
const DEFAULTS = { maxTargets: 40, retryHours: 24, keepDays: 14, gapMs: 2500, budgetMs: 480000 };
const readJson = (file, fallback) => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; } };
const norm = s => Source.norm(String(s || ''));
const hasQuote = (r, t) => Number(!!t.quote && norm(r.description).includes(norm(t.quote)));
const same = (a, b) => E.identity(a).every((x, n) => x && x === E.identity(b)[n]);

/* Stuck, ready helper returns, oldest lookup first; each item is retried at most once per retryHours. */
function targets(root = ROOT, { now = Date.now(), opts = DEFAULTS } = {}) {
  const st = readJson(path.join(root, STATE), { items: {}, exceptions: {} }), prior = readJson(path.join(root, OUT), {}), looked = prior.lookedUp || {};
  const cache = new Map(), out = [];
  for (const [key, item] of Object.entries(st.items || {})) {
    if (item.status !== 'EXCEPTION' || !ROUTE.test(st.exceptions?.[key]?.reason || '')) continue;
    if (looked[key] && now - Date.parse(looked[key]) < opts.retryHours * 3600000) continue;
    if (!cache.has(item.batch)) cache.set(item.batch, readJson(path.join(root, item.batch), { items: [] }));
    const returned = (cache.get(item.batch).items || []).find(i => (i.key || i.primaryId) === item.itemKey);
    const e = returned?.sourceEvidence || {};
    if (returned?.recommendation !== 'ENRICHMENT_EVIDENCE_READY' || !/^https:\/\//.test(e.url || '') || E.identity(e).some(x => !x)) continue;
    out.push({ key, company: e.company, title: e.title, location: e.location, url: e.url, quote: e.quote || '', lastLookup: looked[key] || null });
  }
  out.sort((a, b) => (a.lastLookup || '').localeCompare(b.lastLookup || '') || a.key.localeCompare(b.key));
  return out.slice(0, opts.maxTargets);
}

/* HiringCafe's search_jobs per target ("title company"), no posted-within window, bounded like hiringcafe.js. */
async function hiringcafe(list, { fetcher = globalThis.fetch, now = () => Date.now(), opts = DEFAULTS, sleep } = {}) {
  const H = require('./hiringcafe'), wait = sleep || (ms => new Promise(r => setTimeout(r, ms))), T0 = now(), out = { jobs: [], errors: [] };
  for (let i = 0; i < list.length; i++) {
    if (now() - T0 > opts.budgetMs) { out.errors.push({ key: list[i].key, error: 'time budget reached' }); break; }
    try {
      if (i) await wait(opts.gapMs);
      const text = await H.callTool('search_jobs', { search: list[i].title + ' ' + list[i].company, location: 'United States', limit: 5 } /* HiringCafe rejects many city strings ("Dulles, VA"); title + company is specific enough */, { fetcher, id: i + 1 });
      for (const j of H.parseResults(text).jobs) out.jobs.push({ ...H.normalize(j), targetKey: list[i].key });
    } catch (e) { out.errors.push({ key: list[i].key, error: String(e.message || e).slice(0, 80) }); if (e.status === 429) break; }
  }
  return out;
}

/* Employer ATS pages: a JobSpy result's direct link (Greenhouse, Lever, Ashby, Workday) read through the ATS API. */
async function ats(jobs, { fetcher = globalThis.fetch, gapMs = 2000, sleep } = {}) {
  const L = require('../enrich-ats-pay/lib.js'), wait = sleep || (ms => new Promise(r => setTimeout(r, ms))), out = { jobs: [], errors: [] }, seen = new Set();
  let calls = 0;
  for (const j of jobs) {
    const a = L.atsApi(String(j.job_url_direct || '')); if (!a || seen.has(a.api + j.targetKey)) continue; seen.add(a.api + j.targetKey);
    try {
      // Workday answers 429 to fast reads: space calls out and retry once after a 429.
      const get = async () => { if (calls++) await wait(gapMs); return fetcher(a.api, { signal: AbortSignal.timeout(30000), headers: { accept: 'application/json', 'user-agent': 'forge-targeted-lookup/1 (read-only)' } }); };
      let r = await get();
      if (r.status === 429) { await wait(Math.min(60, +(r.headers?.get?.('retry-after') || 0) || 10) * 1000); r = await get(); }
      if (!r.ok) throw Error('HTTP ' + r.status);
      const parsed = L.parseAts(a.kind, await r.json(), a.id);
      if (parsed?.text) out.jobs.push({ site: 'ats:' + a.kind, company: j.company, title: j.title, location: j.location, job_url: a.page, description: parsed.text, targetKey: j.targetKey });
    } catch (e) { out.errors.push({ key: j.targetKey, url: a.page, error: String(e.message || e).slice(0, 80) }); }
  }
  return out;
}

/* Tim 2026-11-17: a full posting description found anywhere is verification. Keep only exact-identity matches whose
   text passes the full-posting check; prefer the helper's quote, then the employer's own ATS page, then the longest. */
function merge(root, list, results, { now = Date.now(), opts = DEFAULTS } = {}) {
  const prior = readJson(path.join(root, OUT), {}), at = new Date(now).toISOString(), keepMs = opts.keepDays * 86400000;
  const roles = (prior.roles || []).filter(r => now - Date.parse(r.observedAt) < keepMs), lookedUp = { ...(prior.lookedUp || {}) }, summary = { targets: list.length, matched: 0, quoteFound: 0 };
  for (const t of list) {
    lookedUp[t.key] = at;
    const found = results.filter(r => r.targetKey === t.key && /^https:\/\//.test(r.job_url || '') && E.postingComplete({ description: r.description }) && same(r, t))
      .sort((a, b) => hasQuote(b, t) - hasQuote(a, t) || /^ats:/.test(b.site) - /^ats:/.test(a.site) || norm(b.description).length - norm(a.description).length);
    const r = found[0]; if (!r) continue;
    const quoteFound = !!t.quote && norm(r.description).includes(norm(t.quote));
    const role = { company: r.company, title: r.title, location: r.location, url: r.job_url, aliasUrls: [t.url], description: r.description,
      source: r.site === 'hiringcafe' ? 'HIRINGCAFE' : /^ats:/.test(r.site) ? 'ATS:' + r.site.slice(4) : 'JOBSPY:' + r.site, observedAt: at, targetKey: t.key, quoteFound, contentBasis: 'CAPTURED_ROLE_CONTENT' };
    const i = roles.findIndex(x => x.targetKey === t.key);
    if (i >= 0) roles[i] = role; else roles.push(role);
    summary.matched++; if (quoteFound) summary.quoteFound++;
  }
  const doc = { schema: 'forge.targeted-posting-lookup.v1', at, summary, roles, lookedUp };
  fs.writeFileSync(path.join(root, OUT), JSON.stringify(doc, null, 2) + '\n');
  return doc;
}

if (require.main === module) {
  const [cmd, a, b, c] = process.argv.slice(2), cfg = { ...DEFAULTS, ...(readJson(path.join(__dirname, 'config.json'), {}).targetedLookup || {}) };
  (async () => {
    if (cmd === 'targets') { const t = targets(ROOT, { opts: cfg }); fs.writeFileSync(a, JSON.stringify(t)); console.log(JSON.stringify({ targets: t.length })); }
    else if (cmd === 'hiringcafe') { const r = await hiringcafe(readJson(a, []), { opts: cfg }); fs.writeFileSync(b, JSON.stringify(r)); console.log(JSON.stringify({ jobs: r.jobs.length, errors: r.errors.length, sample: r.errors.slice(0, 3) })); }
    else if (cmd === 'ats') { const r = await ats(readJson(a, {}).jobs || []); fs.writeFileSync(b, JSON.stringify(r)); console.log(JSON.stringify({ jobs: r.jobs.length, errors: r.errors.length, sample: r.errors.slice(0, 3) })); }
    else if (cmd === 'merge') { const jobs = [...(readJson(b, {}).jobs || []), ...(readJson(c, {}).jobs || []), ...(readJson(process.argv[6], {}).jobs || [])]; console.log(JSON.stringify(merge(ROOT, readJson(a, []), jobs, { opts: cfg }).summary)); }
    else { console.error('usage: targets|hiringcafe|ats|merge'); process.exitCode = 2; }
  })().catch(e => { console.error(e.message); process.exitCode = 1; });
}
module.exports = { targets, hiringcafe, ats, merge, DEFAULTS, OUT };
