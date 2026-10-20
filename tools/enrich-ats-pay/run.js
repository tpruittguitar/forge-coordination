'use strict';
/* REV-116: off-Writer pay / degree enrichment. Reads jobs from the Cloudflare structured copy (not the Writer), selects rows
   with the Writer's own worklist code (same rule and order as WORKLIST_FORGE_ENRICH_FEASIBILITY), reads employer ATS postings
   (Lever, Greenhouse, Ashby public APIs), and only then estimates pay from employer-posted comparables in the master.
   Submits at most MAX_BATCHES x 25 rows per run to the Writer, one batch call at a time; CONFIG.submit=false = dry run.
   node tools/enrich-ats-pay/run.js [--dry] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const L = require('./lib.js');
const ROOT = path.resolve(__dirname, '../..'), CONFIG = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
const LEDGER = path.join(ROOT, 'state/enrich-ats-pay.json'), REPORT = path.join(ROOT, 'state/enrich-ats-pay-report.json');
const RAW = 'https://raw.githubusercontent.com/tpruittguitar/foreman-cockpit/main/';
const DRY = process.argv.includes('--dry') || !CONFIG.submit;
const today = new Date().toISOString().slice(0, 10), RUN_ID = 'FORGE-ENRICH_ATS-ATSBOT-' + new Date().toISOString().replace(/[-:]/g, '').slice(0, 13) + 'Z';
const sleep = ms => new Promise(r => setTimeout(r, process.env.ENRICH_TEST_FAST ? 0 : ms));
async function get(url, opts) { const r = await fetch(url, opts); if (!r.ok) { const e = new Error(url.replace(/key=[^&]+/, 'key=…') + ' HTTP ' + r.status); e.status = r.status; throw e; } return r; }
const FC_DIR = process.env.ENRICH_FC_DIR || '';   // tests: a local foreman-cockpit checkout instead of raw GitHub
async function fcFile(rel) { return FC_DIR ? fs.readFileSync(path.join(FC_DIR, rel), 'utf8') : (await get(RAW + rel)).text(); }
async function loadModule(name) { const src = await fcFile('apps-script/' + name); const file = path.join(require('os').tmpdir(), name.replace('.gs', '.js')); fs.writeFileSync(file, src.replace(/require\('\.\/([A-Za-z]+)\.gs'\)/g, "require('./$1.js')")); return file; }

(async () => {
  const T0 = Date.now();
  const conn = {}; vm.runInNewContext((await fcFile('pipeline-connection.js')).replace(/^var /m, 'this.'), conn);
  const key = conn.PipelineConnection.key;
  await loadModule('PipelineEvidence.gs'); await loadModule('PipelineAts.gs'); const W = require(await loadModule('PipelineWorklists.gs'));
  // jobs from the structured copy (Cloudflare D1), paged; the Writer is not read
  let jobs = [], total = null;
  if (process.env.ENRICH_MASTER_FILE) { jobs = fs.readFileSync(process.env.ENRICH_MASTER_FILE, 'utf8').split('\n').filter(l => /^\d+ \| /.test(l)).map(l => ({ SOURCE_LINE: l })); total = jobs.length; }   // tests only
  for (let off = 0; !process.env.ENRICH_MASTER_FILE && (total == null || off < total); off += 250) {
    const j = await (await get(`${CONFIG.structuredApi}/jobs?limit=250&offset=${off}`, { headers: { 'x-writer-key': key } })).json();
    if (!j.ok) throw new Error('structured jobs: ' + (j.error || 'not ok')); total = +j.total || 0; jobs = jobs.concat(j.jobs);
    if (!j.jobs.length) break;
  }
  const lines = jobs.map(x => x.SOURCE_LINE || x.source_line).filter(Boolean);
  const text = 'V2_CURRENT_POPULATION_MASTER\nCOUNTS: TOTAL=' + lines.length + '\n' + '='.repeat(64) + '\n' + lines.join('\n') + '\nEND V2_CURRENT_POPULATION_MASTER\n';
  const built = W.build(text), rows = W.parseRows(text), list = built.lanes.FORGE_ENRICH_FEASIBILITY;
  const anchors = rows.map(r => L.postedAnchor(r, r.p)).filter(Boolean);
  const ledger = fs.existsSync(LEDGER) ? JSON.parse(fs.readFileSync(LEDGER, 'utf8')) : { submitted: {}, tried: {} }; ledger.tried = ledger.tried || {};
  const fresh = id => { const t = ledger.submitted[id] || ledger.tried[id]; return t && Date.now() - Date.parse(t) < CONFIG.resubmitHours * 3600e3; };
  const val = (r, k) => String(r.p[k] == null ? '' : r.p[k]).trim();
  const need = r => { const n = []; if (/SALARY/.test(needsOf(r))) n.push('SALARY'); if (/DEGREE/.test(needsOf(r))) n.push('DEGREE'); return n; };
  const needsOf = r => W.render('FORGE_ENRICH_FEASIBILITY', { lanes: { FORGE_ENRICH_FEASIBILITY: [r] } }, { generatedAt: 'x' }).match(/NEED=([A-Z,]*)/)[1];
  const stats = { run: RUN_ID, dry: DRY, rows: rows.length, eligible: list.length, anchors: anchors.length, ats_rows: 0, ats_read: 0, ats_failed: 0, posted_pay: 0, degree: 0, estimates: 0, estimate_waiting_for_posting: 0, skipped_recent: 0, submitted: 0, writer_ok: 0, writer_failed: 0, remainder: 0 };
  const requests = []; let aggFetches = 0; const blocked = {}; Object.assign(stats, { agg_tried: {}, agg_read: {}, agg_pay: {}, agg_failed: {}, agg_errors: {} });
  for (const r of list) {
    if (requests.length >= CONFIG.maxBatches * 25 || Date.now() - T0 > CONFIG.maxRunMs) break;
    if (fresh(r.PRIMARY_ID)) { stats.skipped_recent++; continue; }
    const n = need(r), url = val(r, 'SOURCE_URL') || val(r, 'SOURCE'), api = L.atsApi(url), f = {};
    let checked = false, postedPay = null;
    if (api) {
      stats.ats_rows++;
      try {
        await sleep(CONFIG.fetchGapMs);
        const parsed = L.parseAts(api.kind, await (await get(api.api, { headers: { accept: 'application/json' } })).json(), api.id);
        if (parsed) {
          stats.ats_read++; checked = true; postedPay = parsed.pay;
          if (n.includes('SALARY') && parsed.pay) { stats.posted_pay++; Object.assign(f, { SALARY_BASE_LOW: parsed.pay.low, SALARY_BASE_HIGH: parsed.pay.high, SALARY_MIDPOINT: Math.round((parsed.pay.low + parsed.pay.high) / 2), SALARY_BASIS: 'EMPLOYER_POSTED', SALARY_SOURCE: api.page, SALARY_ASOF: today, SALARY_CONF: 'HIGH' }); }
          const d = n.includes('DEGREE') && L.degreeFromText(parsed.text);
          if (d) { stats.degree++; Object.assign(f, { DEGREE_TEXT: d.text, DEGREE_REQ: d.req, DEGREE_EVIDENCE_URL: api.page, DEGREE_ASOF: today }); }
        }
      } catch (e) { stats.ats_failed++; }
    }
    // Tim 2026-10-20 18:21 ET: an aggregator posting (LinkedIn, Indeed, ZipRecruiter) with pay counts as posting pay
    const agg = L.aggregatorPage(url);
    if (!postedPay && agg && (n.includes('SALARY') || (n.includes('DEGREE') && !f.DEGREE_REQ)) && aggFetches < CONFIG.maxAggregatorFetches && (blocked[agg.kind] || 0) < 3) {
      aggFetches++; stats.agg_tried[agg.kind] = (stats.agg_tried[agg.kind] || 0) + 1;
      try {
        await sleep(CONFIG.aggregatorGapMs);
        const parsed = L.parseAggregator(agg.kind, await (await get(agg.fetch, { headers: { 'user-agent': CONFIG.userAgent, accept: 'text/html' } })).text());
        blocked[agg.kind] = 0;
        if (parsed) {
          checked = true; stats.agg_read[agg.kind] = (stats.agg_read[agg.kind] || 0) + 1;
          if (n.includes('SALARY') && parsed.pay) { postedPay = parsed.pay; stats.agg_pay[agg.kind] = (stats.agg_pay[agg.kind] || 0) + 1; Object.assign(f, { SALARY_BASE_LOW: parsed.pay.low, SALARY_BASE_HIGH: parsed.pay.high, SALARY_MIDPOINT: Math.round((parsed.pay.low + parsed.pay.high) / 2), SALARY_BASIS: parsed.basis, SALARY_SOURCE: agg.page, SALARY_ASOF: today, SALARY_CONF: parsed.basis === 'EMPLOYER_POSTED' ? 'HIGH' : 'MED', SALARY_NOTE: 'pay shown on the ' + agg.kind + ' posting' }); }
          const d = n.includes('DEGREE') && !f.DEGREE_REQ && L.degreeFromText(parsed.text);
          if (d) { stats.degree++; Object.assign(f, { DEGREE_TEXT: d.text, DEGREE_REQ: d.req, DEGREE_EVIDENCE_URL: agg.page, DEGREE_ASOF: today }); }
        }
      } catch (e) { stats.agg_failed[agg.kind] = (stats.agg_failed[agg.kind] || 0) + 1; blocked[agg.kind] = (blocked[agg.kind] || 0) + 1; (stats.agg_errors[agg.kind] = stats.agg_errors[agg.kind] || []).length < 3 && stats.agg_errors[agg.kind].push(String(e.status || e.message).slice(0, 80)); }   // 3 failures in a row: skip that site for the rest of the run (run 1: Indeed failed 21 of 21)
    }
    // Tim 2026-10-20 18:17 ET: salary from the posting first; estimate only once the posting was checked and shows none
    const postingChecked = checked || !!val(r, 'FEASIBILITY_ATTEMPT_ASOF');
    if (n.includes('SALARY') && !postedPay) {
      if (!postingChecked) stats.estimate_waiting_for_posting++;
      else { const est = L.estimate(r, anchors); if (est) { stats.estimates++; Object.assign(f, { SALARY_BASE_LOW: est.low, SALARY_BASE_HIGH: est.high, SALARY_MIDPOINT: est.mid, SALARY_BASIS: 'FORGE-ESTIMATE', SALARY_CONF: est.conf, SALARY_ASOF: today, SALARY_SOURCE: 'comparables:' + est.ids.join(','), SALARY_ESTIMATE_BASIS: est.basis + (checked ? '; employer posting read, no pay stated' : '; posting checked by a lane, no pay'), SALARY_UNCERTAINTY: est.conf === 'LOW' ? 'wide: few or distant comparables' : 'moderate' }); } }
    }
    if (checked) f.FEASIBILITY_ATTEMPT_ASOF = today;
    if (!Object.keys(f).length) { ledger.tried[r.PRIMARY_ID] = new Date().toISOString(); stats.nothing_found = (stats.nothing_found || 0) + 1; continue; }   // let the list move on; retried after resubmitHours
    requests.push({ action: 'ruling', ruling: { requestId: `${RUN_ID}-R${String(requests.length + 1).padStart(3, '0')}`, primaryId: r.PRIMARY_ID, kind: 'ENRICH', actor: 'ATSBOT', fields: f } });
  }
  stats.planned = requests.length;
  if (!DRY) for (let b = 0; b * 25 < requests.length && b < CONFIG.maxBatches; b++) {
    const batch = requests.slice(b * 25, b * 25 + 25), requestId = `${RUN_ID}-B${String(b + 1).padStart(2, '0')}`;
    try {
      const res = await (await get(conn.PipelineConnection.url, { method: 'POST', headers: { 'content-type': 'text/plain' }, body: JSON.stringify({ action: 'batch', key, requestId, requests: batch }) })).json();
      const results = res.results || [];
      batch.forEach((q, i) => { const ok = results[i] && results[i].ok; if (ok) { stats.writer_ok++; ledger.submitted[q.ruling.primaryId] = new Date().toISOString(); } else stats.writer_failed++; });
      if (res.remainder) { stats.remainder += (res.remainder.requests || []).length; break; }   // Writer ran out of time: the rest waits for the next run
    } catch (e) { stats.writer_failed += batch.length; stats.writer_error = String(e.message).slice(0, 200); break; }
    stats.submitted += batch.length; await sleep(CONFIG.batchGapMs);
  }
  for (const k of ['submitted', 'tried']) for (const id of Object.keys(ledger[k])) if (Date.now() - Date.parse(ledger[k][id]) > 14 * 864e5) delete ledger[k][id];
  fs.mkdirSync(path.dirname(LEDGER), { recursive: true });
  if (!DRY) fs.writeFileSync(LEDGER, JSON.stringify(ledger, null, 1) + '\n');
  fs.writeFileSync(REPORT, JSON.stringify(Object.assign({ at: new Date().toISOString() }, stats, { sample: requests.slice(0, 5).map(q => ({ id: q.ruling.primaryId, fields: q.ruling.fields })) }), null, 1) + '\n');
  console.log(JSON.stringify(stats));
})().catch(e => { console.error(e.message); process.exit(1); });
