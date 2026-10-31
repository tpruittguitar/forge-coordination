'use strict';
/* REV-116: off-Writer pay / degree enrichment. Reads jobs from the Cloudflare structured copy (not the Writer), selects rows
   with the Writer's own worklist code (same rule and order as WORKLIST_FORGE_ENRICH_FEASIBILITY), reads employer ATS postings
   (Lever, Greenhouse, Ashby public APIs), and only then estimates pay from employer-posted comparables in the master.
   Submits at most MAX_BATCHES x 25 rows per run to the Writer, one batch call at a time; CONFIG.submit=false = dry run.
   node tools/enrich-ats-pay/run.js [--dry] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const L = require('./lib.js');
const P = require('./public-posting.js');
const ROOT = path.resolve(__dirname, '../..'), CONFIG = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
const LEDGER = process.env.ENRICH_LEDGER || path.join(ROOT, 'state/enrich-ats-pay.json'), REPORT = path.join(ROOT, 'state/enrich-ats-pay-report.json'), BLS_CACHE = process.env.ENRICH_BLS_CACHE || path.join(ROOT, 'state/enrich-ats-pay-bls.json'), EMPLOYER_CACHE = process.env.ENRICH_EMPLOYER_CACHE || path.join(ROOT, 'state/enrich-ats-pay-employer.json');
const RAW = 'https://raw.githubusercontent.com/tpruittguitar/foreman-cockpit/main/';
const DRY = process.argv.includes('--dry') || !(CONFIG.submit || (process.env.ENRICH_MASTER_FILE && process.env.ENRICH_TEST_SUBMIT));   // ENRICH_TEST_SUBMIT: tests only
const today = new Date().toISOString().slice(0, 10), RUN_ID = 'FORGE-ENRICH_ATS-ATSBOT-' + new Date().toISOString().replace(/[-:]/g, '').slice(0, 13) + 'Z';
const sleep = ms => new Promise(r => setTimeout(r, process.env.ENRICH_TEST_FAST ? 0 : ms));
async function get(url, opts) { const r = await fetch(url, {signal:AbortSignal.timeout(30000),...opts,headers:{'Accept-Language':'en-US',...opts?.headers}}); if (!r.ok) { const e = new Error(url.replace(/key=[^&]+/, 'key=…') + ' HTTP ' + r.status); e.status = r.status; throw e; } return r; }
const FC_DIR = process.env.ENRICH_FC_DIR || '';   // tests: a local foreman-cockpit checkout instead of raw GitHub
async function fcFile(rel) { return FC_DIR ? fs.readFileSync(path.join(FC_DIR, rel), 'utf8') : (await get(RAW + rel)).text(); }
async function loadModule(name) { const src = await fcFile('apps-script/' + name); const file = path.join(require('os').tmpdir(), name.replace('.gs', '.js')); fs.writeFileSync(file, src.replace(/require\('\.\/([A-Za-z]+)\.gs'\)/g, "require('./$1.js')")); return file; }

(async () => {
  const T0 = Date.now();
  const conn = {}; vm.runInNewContext((await fcFile('pipeline-connection.js')).replace(/^var /m, 'this.'), conn);
  const key = conn.PipelineConnection.key;
  await loadModule('PipelineEvidence.gs'); await loadModule('PipelinePostingFreshness.gs'); await loadModule('PipelineAts.gs'); const W = require(await loadModule('PipelineWorklists.gs'));
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
  // REV-140 (Tim 2026-10-21 03:30 ET): roles archived after they closed still carry valid employer-posted pay; they stay comparables.
  let archiveText = '';
  if (process.env.ENRICH_MASTER_FILE) archiveText = process.env.ENRICH_ARCHIVE_FILE ? fs.readFileSync(process.env.ENRICH_ARCHIVE_FILE, 'utf8') : '';   // tests only
  else { try { const a = await (await get(`${conn.PipelineConnection.url}?action=archive&key=${encodeURIComponent(key)}`)).json(); archiveText = a && a.ok ? String(a.text || '') : ''; } catch (e) { archiveText = ''; } }
  const liveIds = new Set(anchors.map(a => a.id)), archived = W.parseRows('V2_CURRENT_POPULATION_MASTER\n' + archiveText.split('\n').filter(l => /^\d+ \| /.test(l)).join('\n') + '\n').map(r => L.postedAnchor(r, r.p)).filter(a => a && !liveIds.has(a.id));
  archived.forEach(a => { a.archived = true; anchors.push(a); });
  const ledger = fs.existsSync(LEDGER) ? JSON.parse(fs.readFileSync(LEDGER, 'utf8')) : { submitted: {}, tried: {} }; ledger.tried = ledger.tried || {}; ledger.failedReads = ledger.failedReads || {};
  ledger.needs = ledger.needs || {};
  const fresh = r => !P.retryDue(ledger, r.PRIMARY_ID, needsOf(r));
  const val = (r, k) => String(r.p[k] == null ? '' : r.p[k]).trim();
  const need = r => { const n = []; if (/SALARY/.test(needsOf(r))) n.push('SALARY'); if (/DEGREE/.test(needsOf(r))) n.push('DEGREE'); return n; };
  const needsOf = r => W.render('FORGE_ENRICH_FEASIBILITY', { lanes: { FORGE_ENRICH_FEASIBILITY: [r] } }, { generatedAt: 'x' }).match(/NEED=([A-Z,]*)/)[1];
  const stats = { run: RUN_ID, dry: DRY, rows: rows.length, eligible: list.length, anchors: anchors.length, archive_anchors: archived.length, ats_rows: 0, ats_read: 0, ats_failed: 0, posted_pay: 0, degree: 0, estimates: 0, estimate_waiting_for_posting: 0, skipped_recent: 0, submitted: 0, guard_dropped: 0, writer_ok: 0, writer_failed: 0, writer_not_written: 0, remainder: 0 };
  const requests = [], estSamples = []; let aggFetches = 0; const blocked = {}; Object.assign(stats, { agg_tried: {}, agg_read: {}, agg_pay: {}, agg_failed: {}, agg_errors: {}, agg_wall: {} });
  // REV-138 (Tim ruling 2026-10-21 02:31 ET): estimate sources in order: same employer, comparables, BLS cross-check (lib.js).
  const boardByCo = {}; rows.forEach(r => { const b = L.boardOf(r.p), c = L.normCo(r.COMPANY); if (b && c && !boardByCo[c]) boardByCo[c] = b; });
  const boards = {}; let boardFetches = 0;
  Object.assign(stats, { est_same_employer: 0, est_comparables: 0, boards_read: 0, boards_failed: 0, bls: { OK: 0, ABOVE: 0, BELOW: 0, NO_BLS: 0 }, bls_queries: 0 });
  async function employerPostings(b, row) {
    const key = b.kind === 'workday' ? b.key + '|' + row.TITLE : b.key;
    if (boards[key]) return boards[key];
    if (boardFetches >= (CONFIG.maxBoardFetches || 20)) return [];
    boardFetches++; boards[key] = [];
    try {
      const q = L.boardListRequest(b, row.TITLE); await sleep(CONFIG.fetchGapMs);
      const res = await get(q.url, { method: q.method, headers: Object.assign({ accept: 'application/json' }, q.body ? { 'content-type': 'application/json' } : {}), body: q.body });
      let list = L.parseBoard(b, await res.json());
      if (b.kind === 'workday') {   // pay sits on the job page: read up to 3 similar postings, pay-transparency states first
        const L0 = L.level(row.TITLE), F0 = L.func(row.TITLE);
        const cand = list.filter(x => x.detail && L.level(x.title) === L0 && L.func(x.title) === F0).sort((a, c) => (L.PAY_TRANSPARENCY.indexOf(c.state) >= 0) - (L.PAY_TRANSPARENCY.indexOf(a.state) >= 0)).slice(0, 3);
        for (const x of cand) { try { await sleep(CONFIG.fetchGapMs); const d = await (await get(x.detail, { headers: { accept: 'application/json' } })).json(); const info = d && d.jobPostingInfo; if (info) { x.pay = L.payFromText(L.parseAts('workday', d).text); if (!x.state) x.state = L.stateFrom(info.location || ''); } } catch (e) {} }
        list = cand;
      }
      boards[key] = list; stats.boards_read++;
    } catch (e) { stats.boards_failed++; }
    return boards[key];
  }
  const blsCache = fs.existsSync(BLS_CACHE) ? JSON.parse(fs.readFileSync(BLS_CACHE, 'utf8')) : { series: {} }; blsCache.series = blsCache.series || {};
  // Grok Bot QA #21: cache finite numbers only (BLS suppresses some cells with "-" or "*"); retry a missing value after 7 days;
  // count queries per UTC day in the cache and stop at 20 (BLS v1 allows 25 a day; the job runs hourly).
  async function blsWages(state, soc) {
    const ids = ['12', '13', '15'].map(dt => L.blsSeries(state, soc, dt)); if (!ids[0]) return null;
    const day = new Date().toISOString().slice(0, 10); if (!blsCache.daily || blsCache.daily.day !== day) blsCache.daily = { day, queries: 0 };
    const age = id => blsCache.series[id] ? Date.now() - Date.parse(blsCache.series[id].at) : Infinity;
    const stale = ids.filter(id => { const e = blsCache.series[id]; return !e || (Number.isFinite(e.v) ? age(id) > 180 * 864e5 : age(id) > 7 * 864e5); });
    if (stale.length && stats.bls_queries < (CONFIG.blsMaxQueries || 10) && blsCache.daily.queries < (CONFIG.blsMaxPerDay || 20)) {
      stats.bls_queries++; blsCache.daily.queries++;
      try {
        const j = await (await get('https://api.bls.gov/publicAPI/v1/timeseries/data/', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ seriesid: stale }) })).json();
        if (j && j.status === 'REQUEST_SUCCEEDED') ((j.Results && j.Results.series) || []).forEach(x => { const d = (x.data || [])[0], v = d ? Number(String(d.value).replace(/,/g, '')) : NaN; blsCache.series[x.seriesID] = Number.isFinite(v) && v > 0 ? { v, year: d.year, at: new Date().toISOString() } : { v: null, at: new Date().toISOString() }; });
      } catch (e) {}
    }
    const v = id => { const e = blsCache.series[id]; return e && Number.isFinite(e.v) ? e.v : null; };
    return v(ids[0]) && v(ids[2]) ? { state, soc, p25: v(ids[0]), median: v(ids[1]), p90: v(ids[2]) } : null;
  }
  // Tim 2026-10-21 03:10 ET: a comparables range that 3+ eligible roles would share (same comparable set) is too generic to be
  // MED: it goes in at LOW. Counted over the whole eligible list (pure, no network) so the rule does not depend on run order.
  const shareKey = e => e && e.ids.slice().sort().join(',');
  const shared = {}; list.forEach(r => { if (!/SALARY/.test(needsOf(r))) return; const e = L.estimate(r, anchors), k = shareKey(e); if (k) shared[k] = (shared[k] || 0) + 1; });
  stats.est_shared_low = 0;
  async function estimateFor(r, opts) {
    opts = opts || {};
    const soc = L.socOf(r.TITLE), rowState = L.stateFrom(r.LOCATION);
    let comps = L.sameEmployerAnchors(r, anchors);
    if (!comps.length) {
      // REV-140: same-employer pay postings found by any earlier run are remembered (Workday search results vary run to run)
      const co = L.normCo(r.COMPANY), b = L.boardOf(r.p) || boardByCo[co];
      const fresh = b && !opts.noNetwork ? await employerPostings(b, r) : [];
      rememberPostings(co, fresh);
      comps = L.similarPostings(r, fresh.concat(remembered(co)).filter((x, i, a) => a.findIndex(y => y.page === x.page && y.title === x.title) === i));
    }
    let est = null;
    if (comps.length) {
      const med = {}; const home = rowState ? await blsWages(rowState, soc) : null;
      for (const c of comps.slice(0, 5)) if (c.state && c.state !== rowState && !med[c.state]) { const w = await blsWages(c.state, soc); med[c.state] = w && w.median; }
      est = L.sameEmployerEstimate(r, comps, st => home && home.median && med[st] ? home.median / med[st] : null);
      if (est && !opts.noNetwork) stats.est_same_employer++;   // the upgrade pass counts only in `upgraded`
    }
    if (!est && opts.noNetwork) return null;   // the upgrade pass only replaces with a same-employer estimate
    if (!est) { est = L.estimate(r, anchors); if (est) { est.source = 'COMPARABLES'; stats.est_comparables++; const n = shared[shareKey(est)] || 0; if (n >= 3) { est.conf = 'LOW'; est.basis += '; range shared by ' + n + ' eligible roles from the same comparables, so LOW'; stats.est_shared_low++; } } }
    if (!est && rowState) {
      // Required unanchored estimate (Tim 2026-10-28): BLS sets the number when no anchors exist.
      const w = await blsWages(rowState, soc);
      est = L.blsEstimate(r, w, []);   // mlPoints: JobPredictor / nginyc numbers when a lightweight call is available; empty = BLS range only
      if (est) { stats.est_bls = (stats.est_bls || 0) + 1; if (!opts.noNetwork) stats.bls.BLS_EST = (stats.bls.BLS_EST || 0) + 1; }
    }
    if (!est) return null;
    const chk = L.blsCheck(est, rowState ? await blsWages(rowState, soc) : null); if (!opts.noNetwork) stats.bls[chk.flag]++;
    est.conf = chk.conf; est.bls = chk;
    return est;
  }
  const empCache = fs.existsSync(EMPLOYER_CACHE) ? JSON.parse(fs.readFileSync(EMPLOYER_CACHE, 'utf8')) : { employers: {} }; empCache.employers = empCache.employers || {};
  function rememberPostings(co, list) {
    if (!co) return; const day = new Date().toISOString().slice(0, 10);
    list.filter(x => x.pay && x.state).forEach(x => {
      const e = empCache.employers[co] = empCache.employers[co] || [];
      const i = e.findIndex(y => y.page === x.page && y.title === x.title), rec = { title: x.title, location: x.location || '', state: x.state, pay: x.pay, page: x.page, seen: day };
      if (i >= 0) e[i] = rec; else e.push(rec);
    });
  }
  const remembered = co => (empCache.employers[co] || []).filter(x => Date.now() - Date.parse(x.seen) < 60 * 864e5);
  // REV-136: every eligible row with a readable ATS posting goes first (employer-posted pay beats aggregators and estimates);
  // the worklist order is kept within each group. ats_candidates counts the whole eligible list, not just the rows reached.
  const atsOf = new Map(list.map(r => [r, L.atsFor(r.p)])); stats.ats_candidates = list.filter(r => atsOf.get(r)).length;
  stats.ats_by_kind = {}; list.forEach(r => { const a = atsOf.get(r); if (a) stats.ats_by_kind[a.kind] = (stats.ats_by_kind[a.kind] || 0) + 1; });
  // Grok Bot QA #19: at most CONFIG.atsFirstPerRun ATS rows jump the queue, so top-priority non-ATS rows (Shield AI) still get
  // the rest of the 2 x 25 cap.
  // Liveness belongs to the Writer's ATS checker (foreman-cockpit apps-script/PipelineAts.gs: rechecks every active ATS row every
  // 1-3 days, closes only on a proven per-posting answer, writes LIVENESS through the Writer). This bot never decides a posting is
  // gone: a row the checker already marked CLOSED is skipped; a 403/404 here is reported (ats_unconfirmed_rows) and the row still
  // gets its aggregator read and estimate.
  const closedByChecker = r => /^CLOSED/.test(val(r, 'LIVENESS')) || /^CLOSED/.test(val(r, 'ATS_CHECK_RESULT'));
  const first = list.filter(r => atsOf.get(r) && !closedByChecker(r)).slice(0, CONFIG.atsFirstPerRun || 25), firstSet = new Set(first);
  const ordered = first.concat(list.filter(r => !firstSet.has(r)));
  stats.skipped_closed = 0; stats.ats_unconfirmed = 0; const unconfirmedRows = [];
  stats.public_tried=0; stats.public_read=0; stats.public_failed=0; const pending=[];
  for (const r of ordered) {
    if (requests.length >= CONFIG.maxBatches * 25 || Date.now() - T0 > CONFIG.maxRunMs) break;
    if (fresh(r)) { stats.skipped_recent++; continue; }
    if (closedByChecker(r)) { stats.skipped_closed++; continue; }   // the Writer's ATS checker found the posting closed; the closing lane owns it
    const n = need(r), url = val(r, 'SOURCE_URL') || val(r, 'SOURCE'), api = atsOf.get(r), f = {};
    ledger.needs[r.PRIMARY_ID] = needsOf(r);
    let checked = false, attempted = false, postedPay = null, atsUnconfirmed = false;
    if (api) {
      stats.ats_rows++; attempted = true;
      try {
        await sleep(CONFIG.fetchGapMs);
        const parsed = L.parseAts(api.kind, await (await get(api.api, { headers: { accept: 'application/json' } })).json(), api.id);
        if (parsed) {
          stats.ats_read++; checked = true; postedPay = parsed.pay;
          if (parsed.pay) stats.ats_pay_seen = (stats.ats_pay_seen || 0) + 1; if (n.includes('SALARY')) stats.ats_need_salary = (stats.ats_need_salary || 0) + 1;   // REV-136 report: is pay missing from postings or not needed?
          if (n.includes('SALARY') && parsed.pay) { stats.posted_pay++; Object.assign(f, { SALARY_BASE_LOW: parsed.pay.low, SALARY_BASE_HIGH: parsed.pay.high, SALARY_MIDPOINT: Math.round((parsed.pay.low + parsed.pay.high) / 2), SALARY_BASIS: 'EMPLOYER_POSTED', SALARY_SOURCE: api.page, SALARY_ASOF: today, SALARY_CONF: 'HIGH' }); }
          const d = n.includes('DEGREE') && L.degreeFromText(parsed.text);
          if (d) { stats.degree++; Object.assign(f, { DEGREE_TEXT: d.text, DEGREE_REQ: d.req, DEGREE_EVIDENCE_URL: api.page, DEGREE_ASOF: today }); }
        }
      } catch (e) {
        if ((e.status === 403 && api.kind === 'workday') || e.status === 404) {   // maybe taken down, maybe a bad address: not decided here
          stats.ats_unconfirmed++; atsUnconfirmed = true;
          unconfirmedRows.length < 50 && unconfirmedRows.push({ id: r.PRIMARY_ID, company: r.COMPANY, title: r.TITLE, posting: api.page, status: e.status, checker: val(r, 'ATS_CHECK_RESULT') || 'not checked', checkerAsOf: val(r, 'ATS_CHECK_ASOF').slice(0, 10) });   // no run timestamp: an unchanged dry run must not rewrite the report
        }
        stats.ats_failed++; const k = api.kind; (stats.ats_errors = stats.ats_errors || {})[k] = stats.ats_errors[k] || []; stats.ats_errors[k].length < 3 && stats.ats_errors[k].push(String(e.status || e.message).slice(0, 60)); }
    }
    // Tim 2026-10-20 18:21 ET: an aggregator posting (LinkedIn, Indeed, ZipRecruiter) with pay counts as posting pay
    // Tim 2026-10-26: Indeed viewjob pages answer 401 to this runner on every read; Indeed roles come in through JobSpy and HiringCafe.
    const aggPage = L.aggregatorFor(r.p), agg = aggPage && !(CONFIG.aggregatorsOff || []).includes(aggPage.kind) ? aggPage : null;
    if (!postedPay && agg && (n.includes('SALARY') || (n.includes('DEGREE') && !f.DEGREE_REQ)) && aggFetches < CONFIG.maxAggregatorFetches && (blocked[agg.kind] || 0) < 3) {
      attempted = true; aggFetches++; stats.agg_tried[agg.kind] = (stats.agg_tried[agg.kind] || 0) + 1;
      try {
        await sleep(CONFIG.aggregatorGapMs);
        const parsed = L.parseAggregator(agg.kind, await (await get(agg.fetch, { headers: { 'user-agent': CONFIG.userAgent, accept: 'text/html' } })).text(), r);
        if (parsed && parsed.wall) { stats.agg_wall[agg.kind] = (stats.agg_wall[agg.kind] || 0) + 1; blocked[agg.kind] = (blocked[agg.kind] || 0) + 1; }   // sign-in / bot page: not read, no estimate
        else blocked[agg.kind] = 0;
        if (parsed && !parsed.wall) {
          checked = true; stats.agg_read[agg.kind] = (stats.agg_read[agg.kind] || 0) + 1;
          if (n.includes('SALARY') && parsed.pay) { postedPay = parsed.pay; stats.agg_pay[agg.kind] = (stats.agg_pay[agg.kind] || 0) + 1; Object.assign(f, { SALARY_BASE_LOW: parsed.pay.low, SALARY_BASE_HIGH: parsed.pay.high, SALARY_MIDPOINT: Math.round((parsed.pay.low + parsed.pay.high) / 2), SALARY_BASIS: parsed.basis, SALARY_SOURCE: agg.page, SALARY_ASOF: today, SALARY_CONF: parsed.basis === 'EMPLOYER_POSTED' ? 'HIGH' : 'MED', SALARY_NOTE: 'pay shown on the ' + agg.kind + ' posting' }); }
          const d = n.includes('DEGREE') && !f.DEGREE_REQ && L.degreeFromText(parsed.text);
          if (d) { stats.degree++; Object.assign(f, { DEGREE_TEXT: d.text, DEGREE_REQ: d.req, DEGREE_EVIDENCE_URL: agg.page, DEGREE_ASOF: today }); }
        }
      } catch (e) { stats.agg_failed[agg.kind] = (stats.agg_failed[agg.kind] || 0) + 1; blocked[agg.kind] = (blocked[agg.kind] || 0) + 1; (stats.agg_errors[agg.kind] = stats.agg_errors[agg.kind] || []).length < 3 && stats.agg_errors[agg.kind].push(String(e.status || e.message).slice(0, 80)); }   // 3 failures in a row: skip that site for the rest of the run (run 1: Indeed failed 21 of 21)
    }
    // Employer/custom posting formats previously had no reader. Read only an exact
    // company/title JobPosting object; never infer NOT_STATED from page chrome.
    const publicUrl=P.publicUrl(url);
    if(!checked&&publicUrl&&!aggPage&&stats.public_tried<20){
      attempted=true;stats.public_tried++;
      try{await sleep(CONFIG.fetchGapMs);const response=await get(publicUrl,{signal:AbortSignal.timeout(20000),headers:{'user-agent':CONFIG.userAgent}});
        const parsed=P.parse(await response.text(),r);
        if(parsed){checked=true;stats.public_read++;postedPay=parsed.pay;
          if(n.includes('SALARY')&&parsed.pay){stats.posted_pay++;Object.assign(f,{SALARY_BASE_LOW:parsed.pay.low,SALARY_BASE_HIGH:parsed.pay.high,SALARY_MIDPOINT:Math.round((parsed.pay.low+parsed.pay.high)/2),SALARY_BASIS:'EMPLOYER_POSTED',SALARY_SOURCE:publicUrl,SALARY_ASOF:today,SALARY_CONF:'HIGH'});}
          if(n.includes('DEGREE')){const d=L.degreeFromText(parsed.text);if(d){stats.degree++;Object.assign(f,{DEGREE_TEXT:d.text,DEGREE_REQ:d.req,DEGREE_EVIDENCE_URL:publicUrl,DEGREE_ASOF:today});}}
        }else stats.public_failed++;
      }catch{stats.public_failed++;}
    }
    // Tim 2026-10-20 18:17 ET: salary from the posting first; estimate only once the posting was checked and shows none
    // Tim ruling 2026-10-21 02:15 ET: a row may be estimated without a posting read after 2 failed reads on different days
    // (ATS answer unconfirmed, or the Writer checker says NOT_IN_PUBLIC_BOARD / NOT_FOUND / ERROR / UNREADABLE) with no readable
    // aggregator posting. Dates live in the ledger (persisted on live runs only); CLOSED rows were skipped above.
    let noPostingRead = false;
    if (n.includes('SALARY') && !postedPay && !checked && (atsUnconfirmed || /^(NOT_IN_PUBLIC_BOARD|NOT_FOUND|ERROR|UNREADABLE)/.test(val(r, 'ATS_CHECK_RESULT')))) {
      const fr = ledger.failedReads[r.PRIMARY_ID] = ledger.failedReads[r.PRIMARY_ID] || { dates: [] };
      if (fr.dates.indexOf(today) < 0) fr.dates.push(today);
      fr.dates = fr.dates.slice(-5); fr.n = fr.dates.length;
      noPostingRead = fr.n >= 2 && !val(r, 'FEASIBILITY_ATTEMPT_ASOF');
    }
    const postingChecked = checked || !!val(r, 'FEASIBILITY_ATTEMPT_ASOF') || noPostingRead;
    if (n.includes('SALARY') && !postedPay) {
      if (!postingChecked) stats.estimate_waiting_for_posting++;
      else { const est = await estimateFor(r); if (est) { stats.estimates++; Object.assign(f, { SALARY_BASE_LOW: est.low, SALARY_BASE_HIGH: est.high, SALARY_MIDPOINT: est.mid, SALARY_BASIS: 'FORGE-ESTIMATE', SALARY_CONF: est.conf, SALARY_ASOF: today, SALARY_SOURCE: (est.source === 'SAME_EMPLOYER' ? 'same-employer:' : 'comparables:') + est.ids.join(','), SALARY_NOTE: 'FORGE-ESTIMATE from ' + est.n + (est.source === 'SAME_EMPLOYER' ? ' same-employer posted range(s)' : ' employer-posted comparable(s)') + ' [' + est.ids.join(', ') + ']; ' + est.basis + '; ' + est.bls.note + (checked ? '; this posting read, no pay stated' : noPostingRead ? '; NO_POSTING_READ: posting unreadable on ' + ledger.failedReads[r.PRIMARY_ID].dates.join(', ') : '; posting checked by a lane, no pay') + '; uncertainty: ' + (est.source === 'SAME_EMPLOYER' ? (est.conf === 'HIGH' ? 'narrow, 2+ tight same-employer ranges' : est.conf === 'MED' ? 'moderate, same-employer range(s) for a similar role' : 'wide, same-employer range outside the state wage band') : est.conf === 'LOW' ? 'wide, few or distant comparables' : est.conf === 'MED' ? 'moderate, same-region comparables' : 'narrow, 3+ tight same-region comparables') }); if (noPostingRead) stats.estimates_no_posting_read = (stats.estimates_no_posting_read || 0) + 1; estSamples.length < 5 && estSamples.push({ basis: noPostingRead ? 'NO_POSTING_READ' : 'POSTING_READ', id: r.PRIMARY_ID, company: r.COMPANY, title: r.TITLE, location: r.LOCATION, posting: url, est: [est.low, est.high, est.conf], source: est.source, bls: est.bls.flag, basis_detail: est.basis, comparables: est.ids }); } }
    }
    if (checked) f.FEASIBILITY_ATTEMPT_ASOF = today;
    if (attempted) ledger.tried[r.PRIMARY_ID] = new Date().toISOString();
    if (!Object.keys(f).length) { if(attempted) ledger.tried[r.PRIMARY_ID] = new Date().toISOString(); else stats.not_attempted = (stats.not_attempted || 0) + 1; stats.nothing_found = (stats.nothing_found || 0) + 1; pending.push({id:r.PRIMARY_ID,needs:n,reason:attempted?'POSTING_UNREADABLE_OR_NO_USABLE_EVIDENCE':'NO_SUPPORTED_READER_OR_RUN_BUDGET'}); continue; }
    requests.push({ action: 'ruling', ruling: { requestId: `${RUN_ID}-R${String(requests.length + 1).padStart(3, '0')}`, primaryId: r.PRIMARY_ID, kind: 'ENRICH', actor: 'ATSBOT', fields: f } });
  }
  // REV-140: a saved FORGE-ESTIMATE from comparables at LOW is replaced when a same-employer source now exists (master,
  // archive or remembered postings; no new network). Posted pay and anything a lane wrote are never touched.
  const upgradeIds = new Set(); stats.upgraded = 0;
  const weak = r => val(r, 'SALARY_BASIS') === 'FORGE-ESTIMATE' && val(r, 'SALARY_CONF') === 'LOW' && /^comparables:/.test(val(r, 'SALARY_SOURCE'));
  for (const r of rows) {
    if (requests.length >= CONFIG.maxBatches * 25 || stats.upgraded >= (CONFIG.maxUpgradesPerRun || 10)) break;
    if (!weak(r) || requests.some(q => q.ruling.primaryId === r.PRIMARY_ID)) continue;
    const est = await estimateFor(r, { noNetwork: true }); if (!est || est.source !== 'SAME_EMPLOYER' || est.conf === 'LOW') continue;   // LOW for LOW is no upgrade
    stats.upgraded++; upgradeIds.add(r.PRIMARY_ID);
    requests.push({ action: 'ruling', ruling: { requestId: `${RUN_ID}-U${String(stats.upgraded).padStart(3, '0')}`, primaryId: r.PRIMARY_ID, kind: 'ENRICH', actor: 'ATSBOT', fields: { SALARY_BASE_LOW: est.low, SALARY_BASE_HIGH: est.high, SALARY_MIDPOINT: est.mid, SALARY_BASIS: 'FORGE-ESTIMATE', SALARY_CONF: est.conf, SALARY_ASOF: today, SALARY_SOURCE: 'same-employer:' + est.ids.join(','), SALARY_NOTE: 'FORGE-ESTIMATE upgraded from a comparables LOW estimate: ' + est.basis + '; ' + est.bls.note } } });
    estSamples.length < 5 && estSamples.push({ basis: 'UPGRADE', id: r.PRIMARY_ID, company: r.COMPANY, title: r.TITLE, location: r.LOCATION, est: [est.low, est.high, est.conf], source: est.source, bls: est.bls.flag, basis_detail: est.basis, comparables: est.ids });
  }
  stats.planned = requests.length;
  if (!DRY) batches: for (let b = 0; b * 25 < requests.length && b < CONFIG.maxBatches; b++) {
    let batch = requests.slice(b * 25, b * 25 + 25); const requestId = `${RUN_ID}-B${String(b + 1).padStart(2, '0')}`;
    try {
      // Grok Bot QA: the structured copy can lag; re-read these rows from the Writer (read-only, no lock) and drop what a lane
      // filled in meanwhile, so posted pay is never overwritten by an estimate.
      const rb = await (await get(`${conn.PipelineConnection.url}?action=row_readback&key=${encodeURIComponent(key)}&ids=${batch.map(q => q.ruling.primaryId).join(',')}`)).json();
      if (!rb.ok) throw new Error('row_readback: ' + (rb.error || 'not ok'));
      const now = {}; (rb.rows || []).forEach(x => { if (x.found && x.matches === 1) now[x.primaryId] = W.parseRows(x.line)[0]; });
      batch = batch.filter(q => {
        const cur = now[q.ruling.primaryId]; if (!cur || !['SCOUT_INTAKE','DISCOVERY_LEAD','TIM_DECISION_REQUIRED','BLOCKED','MANUAL_RESEARCH','READY_TO_PURSUE'].includes(cur.BUCKET) || /^YES/i.test(cur.p.ANTI_RESURRECTION||'') || cur.p.DO_NOT_REWORK || (/^CLOSED/.test(cur.p.LIVENESS||'') || /^CLOSED/.test(cur.p.ATS_CHECK_RESULT||''))) { stats.guard_dropped++; return false; }
        const left = needsOf(cur), f = q.ruling.fields;
        if (!/SALARY/.test(left) && !(upgradeIds.has(q.ruling.primaryId) && weak(cur))) Object.keys(f).filter(k => /^SALARY_/.test(k)).forEach(k => delete f[k]);   // an upgrade goes in only while the row still holds the weak estimate
        if (!/DEGREE/.test(left)) Object.keys(f).filter(k => /^DEGREE_/.test(k)).forEach(k => delete f[k]);
        const keep = Object.keys(f).some(k => k !== 'FEASIBILITY_ATTEMPT_ASOF'); if (!keep) stats.guard_dropped++;
        return keep;
      });
      if (!batch.length) continue;
      /* REV-153: the Writer refuses a new write (WRITE_FENCE, no per-item results) until the previous one is independently
         verified, which it does no sooner than 120 s after the save. Batches now sit 130 s apart (batchGapMs); a fenced batch
         waits the Writer's retryAfterMs and goes again, up to fenceRetries times. A batch still fenced wrote nothing: it is
         counted as deferred (rows go again next run), never as failed, and the run stops sending. */
      let res, fenced = 0;
      for (;;) {
        try { res = await (await get(conn.PipelineConnection.url, { method: 'POST', headers: { 'content-type': 'text/plain' }, body: JSON.stringify({ action: 'batch', key, requestId, requests: batch }) })).json(); }
        catch (e) {
          /* Google's web-app front end can lose the reply (HTTP 404 on the redirect) after the Writer has already saved the
             batch (2026-10-23 05:22: 22 rows saved, receipts COMPLETE, bot reported 22 failed and stopped). The reply is not
             the record; the receipt index is. Read it (read-only) for this batch's rulings: COMPLETE = saved and the run goes
             on; a failed receipt = failed; nothing or still pending = unconfirmed, counted, and the run continues to the next batch. Never re-POSTed here. */
          const proof = await receiptFor(batch);
          if (proof.status !== 'COMPLETE') { const c = proof.failed ? 'writer_failed' : 'writer_unconfirmed'; stats[c] = (stats[c] || 0) + batch.length; stats.writer_error = String(e.message).slice(0, 160) + '; receipt ' + proof.status; continue batches; }
          stats.writer_reply_lost = (stats.writer_reply_lost || 0) + 1;
          res = { mode: 'RECEIPT_COMPLETE', results: batch.map(q => ({ ok: proof.pids.has(q.ruling.primaryId), mode: proof.pids.has(q.ruling.primaryId) ? 'RECEIPT_COMPLETE' : 'NOT_IN_RECEIPT' })) };
        }
        if (res.mode !== 'WRITE_FENCE' || res.frozen || fenced >= CONFIG.fenceRetries) break;
        fenced++; stats.writer_fenced = (stats.writer_fenced || 0) + 1;
        await sleep(Math.min(Math.max(+res.retryAfterMs || 30000, 30000), 150000));
      }
      if (res.mode === 'WRITE_FENCE') { stats.writer_deferred = (stats.writer_deferred || 0) + batch.length; stats.writer_error = String(res.error || 'WRITE_FENCE').slice(0, 200); continue batches; }
      const results = res.results || [];
      // QA REV-139: ok:true alone is not a write. On BATCH_RULING_RETRY ("master changed") PLANNED items come back ok:true with
      // nothing written; only a committed batch (or an item already applied) counts as saved, the rest is retried next run.
      const committed = res.mode === 'BATCH_RULING_SINGLE_COMMIT' || res.mode === 'RECEIPT_COMPLETE' || !!res.writeId;
      batch.forEach((q, i) => { const it = results[i] || {}; const saved = it.ok && (committed || it.mode === 'ALREADY_APPLIED'); if (saved) { stats.writer_ok++; ledger.submitted[q.ruling.primaryId] = new Date().toISOString(); } else if (it.ok) stats.writer_not_written++; else { stats.writer_failed++; const m = String(it.mode || it.error || res.mode || res.error || 'NO_RESULT').slice(0, 60); (stats.writer_fail_modes = stats.writer_fail_modes || {})[m] = (stats.writer_fail_modes[m] || 0) + 1; } });
      if (res.mode === 'BATCH_RULING_RETRY') { stats.writer_retry = (stats.writer_retry || 0) + 1; }
      stats.submitted += batch.length;
      if (res.remainder) { stats.remainder += (res.remainder.requests || []).length; break; }   // Writer ran out of time: the rest waits for the next run
    } catch (e) { if (!e.counted) { stats.writer_failed += batch.length; stats.writer_error = String(e.message).slice(0, 200); } continue batches; }
    await sleep(CONFIG.batchGapMs);
  }
  // Receipt index entry for a batch whose reply was lost: every ruling's requestId maps to the one batch entry. Polls while it
  // is PENDING (the Writer verifies a save no sooner than 120 s after it), up to replyCheckPolls x replyCheckGapMs.
  async function receiptFor(batch) {
    const rid = batch[0].ruling.requestId; let s = 'NO_ENTRY';
    for (let i = 0; i < (CONFIG.replyCheckPolls || 6); i++) {
      await sleep(CONFIG.replyCheckGapMs || 30000);
      let d; try { d = await (await get(`${conn.PipelineConnection.url}?action=receipt_index&key=${encodeURIComponent(key)}&requestId=${encodeURIComponent(rid)}`)).json(); } catch (e) { continue; }
      const entry = d && d.request; s = entry ? String(entry.s || 'UNKNOWN') : 'NO_ENTRY';
      if (s === 'COMPLETE') return { status: s, pids: new Set((entry.items || []).map(x => x && x.pid)) };
      if (['NEEDS_RESOLUTION', 'NOT_PERSISTED', 'FALSE_COMPLETE'].includes(s)) return { status: s, failed: true };
    }
    return { status: s };
  }
  for (const k of ['submitted', 'tried']) for (const id of Object.keys(ledger[k])) if (Date.now() - Date.parse(ledger[k][id]) > 14 * 864e5) delete ledger[k][id];
  for (const id of Object.keys(ledger.failedReads)) { const d = ledger.failedReads[id].dates || []; if (!d.length || Date.now() - Date.parse(d[d.length - 1]) > 14 * 864e5) delete ledger.failedReads[id]; }
  fs.mkdirSync(path.dirname(LEDGER), { recursive: true });
  Object.keys(empCache.employers).forEach(co => { const e = empCache.employers[co].filter(x => Date.now() - Date.parse(x.seen) < 60 * 864e5).sort((a, b) => String(b.seen).localeCompare(String(a.seen))).slice(0, 50); if (e.length) empCache.employers[co] = e; else delete empCache.employers[co]; });   // Grok QA #23: prune > 60 d, newest 50 per employer
  fs.mkdirSync(path.dirname(EMPLOYER_CACHE), { recursive: true }); fs.writeFileSync(EMPLOYER_CACHE, JSON.stringify(empCache, null, 1) + '\n');   // public posting data: kept in dry runs too
  fs.mkdirSync(path.dirname(BLS_CACHE), { recursive: true }); fs.writeFileSync(BLS_CACHE, JSON.stringify(blsCache, null, 1) + '\n');   // public BLS reference data: kept in dry runs too (BLS v1 allows 25 queries a day)
  if (!DRY) fs.writeFileSync(LEDGER, JSON.stringify(ledger, null, 1) + '\n');
  const body = Object.assign({}, stats, { pending, sample: requests.slice(0, 5).map(q => ({ id: q.ruling.primaryId, fields: q.ruling.fields })), estimate_samples: estSamples, ats_unconfirmed_rows: unconfirmedRows });
  // compare without the per-run stamps and in one key order (Grok Bot QA: key order made every hourly report differ)
  const strip_ = o => { const c = Object.assign({}, o); delete c.at; delete c.run; delete c.bls_queries; /* BLS queries depend on the cache, not on the data */ return JSON.stringify(Object.keys(c).sort().reduce((a, k) => (a[k] = c[k], a), {})); };
  const prev = fs.existsSync(REPORT) ? JSON.parse(fs.readFileSync(REPORT, 'utf8')) : null;
  if (!prev || strip_(prev) !== strip_(body)) fs.writeFileSync(REPORT, JSON.stringify(Object.assign({ at: new Date().toISOString() }, body), null, 1) + '\n');   // unchanged dry run: no new commit
  console.log(JSON.stringify(stats));
})().catch(e => { console.error(e.message); process.exit(1); });
