'use strict';
/* REV-156 (Tim 2026-10-21 18:09 ET): read-only trial of two discovery sources for Tim's three role families
   (quality leadership; manufacturing / production leadership; manufacturing engineering leadership):
   1. employer job boards (Greenhouse, Lever, Ashby, Workday) for every employer the master already has an ATS link for,
      plus the priority companies in forge-policy derived/TARGET_COMPANIES_PRIORITY.txt (board probed when not known);
   2. JobSpy (python-jobspy, run by the workflow step before this script) on LinkedIn and Indeed (Tim 2026-10-26:
      ZipRecruiter, Glassdoor and Google dropped; each failed 18 of 18 searches on every run from the runner);
   3. HiringCafe (official read-only MCP connector, run by tools/source-trial/hiringcafe.js before this script), read
      last so the roles it alone contributes after cross-source dedupe are its measured incremental yield.
   Every matching US role is marked NEW or EXISTING against the master. Writes only state/source-trial-report.{json,md}.
   Nothing is sent to the Writer.  node tools/source-trial/run.js */
const fs = require('fs'), path = require('path'), vm = require('vm'), os = require('os');
const P = require('../enrich-ats-pay/lib.js'), T = require('./lib.js');
const ROOT = path.resolve(__dirname, '../..');
const CONFIG = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
const RAW = 'https://raw.githubusercontent.com/tpruittguitar/';
const FC_DIR = process.env.TRIAL_FC_DIR || '', OUT = process.env.TRIAL_OUT_DIR || path.join(ROOT, 'state');
const sleep = ms => new Promise(r => setTimeout(r, process.env.TRIAL_FAST ? 0 : ms));
async function get(url, opts) { const r = await fetch(url, Object.assign({ signal: AbortSignal.timeout(20000) }, opts)); if (!r.ok) { const e = new Error('HTTP ' + r.status); e.status = r.status; throw e; } return r; }
async function fcFile(rel) { return FC_DIR ? fs.readFileSync(path.join(FC_DIR, rel), 'utf8') : (await get(RAW + 'foreman-cockpit/main/' + rel)).text(); }
async function loadModule(name) { const src = await fcFile('apps-script/' + name); const file = path.join(os.tmpdir(), 'trial-' + name.replace('.gs', '.js')); fs.writeFileSync(file, src.replace(/require\('\.\/([A-Za-z]+)\.gs'\)/g, "require('./trial-$1.js')")); return file; }

(async () => {
  const T0 = Date.now(), at = new Date().toISOString();
  const conn = {}; vm.runInNewContext((await fcFile('pipeline-connection.js')).replace(/^var /m, 'this.'), conn);
  const key = conn.PipelineConnection.key;
  await loadModule('PipelineEvidence.gs'); await loadModule('PipelineAts.gs'); const W = require(await loadModule('PipelineWorklists.gs'));

  /* the master, from the structured copy (KV reads only) */
  let lines = [];
  if (process.env.TRIAL_MASTER_FILE) lines = fs.readFileSync(process.env.TRIAL_MASTER_FILE, 'utf8').split('\n').filter(l => /^\d+ \| /.test(l));
  else for (let off = 0, total = null; total == null || off < total; off += 250) {
    const j = await (await get(`${CONFIG.structuredApi}/jobs?limit=250&offset=${off}`, { headers: { 'x-writer-key': key } })).json();
    if (!j.ok) throw new Error('structured jobs: ' + (j.error || 'not ok')); total = +j.total || 0;
    lines = lines.concat(j.jobs.map(x => x.SOURCE_LINE || x.source_line).filter(Boolean)); if (!j.jobs.length) break;
  }
  const rows = W.parseRows('V2_CURRENT_POPULATION_MASTER\n' + lines.join('\n') + '\n');
  /* the terminal archive (Writer GET action=archive, read-only): declined, rejected and closed history is protected,
     never NEW. The Writer dedupes intake against it, so a trial that ignores it overstates NEW. */
  const archive = { read: false, rows: 0, error: '' };
  let archived = [];
  try {
    const text = process.env.TRIAL_ARCHIVE_FILE ? fs.readFileSync(process.env.TRIAL_ARCHIVE_FILE, 'utf8') : await (async () => {
      const j = await (await get(conn.PipelineConnection.url + '?action=archive&key=' + encodeURIComponent(key), { headers: { 'cache-control': 'no-store' } })).json();
      if (!j.ok || j.degraded) throw new Error('archive ' + (j.degraded ? 'degraded' : 'not ok'));
      return j.text || '';
    })();
    archived = W.parseRows('V2_CURRENT_POPULATION_MASTER\n' + text.split('\n').filter(l => /^\d+ \| /.test(l)).join('\n') + '\n');
    archive.read = true; archive.rows = archived.length;
  } catch (e) { archive.error = String(e.message || e).slice(0, 80); }   // never the URL: it carries the key
  const asIndexRow = (r, terminal) => ({ COMPANY: r.COMPANY, TITLE: r.TITLE, LOCATION: r.LOCATION, REQ: r.REQ, BUCKET: r.BUCKET, DISPOSITION: r.DISPOSITION, ANTI_RESURRECTION: r.ANTI_RESURRECTION, DO_NOT_REWORK: r.DO_NOT_REWORK, STATUS: r.STATUS, APP_STATE: r.APP_STATE, p: r.p, ARCHIVED_TERMINAL: terminal });
  const idx = T.masterIndex(rows.map(r => asIndexRow(r, false)).concat(archived.map(r => asIndexRow(r, true))));

  /* boards: priority companies first, then every board the master links to */
  const boards = new Map(), add = (b, company, tier, from) => { if (!b) return; const cur = boards.get(b.key); if (cur) { cur.companies.add(company); if (tier && !cur.tier) cur.tier = tier; return; } boards.set(b.key, Object.assign({}, b, { companies: new Set([company]), tier: tier || '', from })); };
  const priority = T.parsePriority(process.env.TRIAL_PRIORITY_FILE ? fs.readFileSync(process.env.TRIAL_PRIORITY_FILE, 'utf8') : await (await get(RAW + 'forge-policy/main/derived/TARGET_COMPANIES_PRIORITY.txt')).text());
  const activePriority = new Map(priority.map(x => [P.normCo(x.name), x.tier]));
  const staffEligible = (company, title) => T.level(title) !== 'SR_STAFF' || activePriority.has(P.normCo(company));
  const coBoard = {};   // normCo(company) -> board key, from the master's own ATS links
  rows.forEach(r => { const b = P.boardOf(r.p || {}); if (b) { coBoard[P.normCo(r.COMPANY)] = coBoard[P.normCo(r.COMPANY)] || b; } });
  const probes = [];
  for (const c of priority) {
    if (c.tier === 'PAUSED') { probes.push({ company: c.name, found: null, skipped: 'PAUSED' }); continue; }
    let b = T.boardFromCareers(c.careers) || coBoard[P.normCo(c.name)] || null;
    if (!b) {
      for (const slug of T.slugGuesses(c.name)) {
        for (const kind of ['greenhouse', 'lever', 'ashby']) {
          const cand = { kind, key: kind + ':' + slug, board: slug }, req = P.boardListRequest(cand, '');
          try { await sleep(CONFIG.gapMs); const j = await (await get(req.url)).json(); const n = P.parseBoard(cand, j).length; if (n > 0) { b = cand; probes.push({ company: c.name, found: cand.key, openings: n }); break; } } catch (e) {}
        }
        if (b) break;
      }
      if (!b) probes.push({ company: c.name, found: null });
    }
    add(b, c.name, c.tier, 'priority');
  }
  rows.forEach(r => add(P.boardOf(r.p || {}), r.COMPANY, '', 'master'));
  /* Explorer ranking: DREAM, P1, P2, P3, WATCH, then boards known only from the master. PAUSED was not added. */
  const ranked = [...boards.values()].filter(b => b.tier !== 'PAUSED').sort((a, b) => T.tierRank(a.tier) - T.tierRank(b.tier) || a.key.localeCompare(b.key));
  const cap = Math.max(1, +(process.env.TRIAL_MAX_BOARDS || CONFIG.maxBoards) || CONFIG.maxBoards);
  const cursorFile = process.env.TRIAL_CURSOR_FILE || path.join(OUT, 'board-cursor.json');
  let start = 0;
  if (!process.env.TRIAL_SKIP_BOARDS && fs.existsSync(cursorFile)) {
    try {
      const saved = JSON.parse(fs.readFileSync(cursorFile, 'utf8')).next || '';
      const i = ranked.findIndex(b => b.key === saved);
      start = i < 0 ? 0 : i;
    } catch (e) { start = 0; }
  }
  const order = process.env.TRIAL_SKIP_BOARDS ? [] : ranked.slice(start, start + cap);

  /* read each board, keep Tim's three families in the US */
  const found = [], boardStats = [], discovered = new Map();
  const addFound = item => { const key = T.identityKey(item.company,item.title,item.location); const prior = discovered.get(key); if (prior) { if (item.status === 'EXISTING_PROTECTED') prior.status = item.status; else if (item.status === 'EXISTING' && prior.status === 'NEW') prior.status = item.status; return false; } discovered.set(key,item); found.push(item); return true; };
  let consumed = 0;
  for (const b of order) {
    const st = { board: b.key, companies: [...b.companies].slice(0, 3), tier: b.tier, openings: 0, matches: 0, error: '' };
    const reqs = b.kind === 'workday' ? CONFIG.workdaySearches.map(s => P.boardListRequest(b, s)) : [P.boardListRequest(b, '')];
    const seen = new Set();
    for (const req of reqs) {
      if (!req) continue;
      try {
        await sleep(CONFIG.gapMs);
        const j = await (await get(req.url, req.method === 'POST' ? { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: req.body } : { headers: { accept: 'application/json' } })).json();
        P.parseBoard(b, j).forEach(x => {
          if (seen.has(x.page || x.title)) return; seen.add(x.page || x.title); st.openings++;
          const fam = T.family(x.title), place = T.usPlace(x.location);
          if (!fam || !place) return;
          const company = [...b.companies][0];
          if (!staffEligible(company, x.title)) return;
          st.matches++;
          addFound({ source: 'BOARD:' + b.kind, company, tier: b.tier, title: x.title, location: x.location, place, family: fam, level: T.level(x.title), url: x.page, pay: x.pay ? `$${Math.round(x.pay.low / 1000)}K-$${Math.round(x.pay.high / 1000)}K` : '', status: T.novelty(idx, company, x.title, x.page, x.location) });
        });
      } catch (e) { st.error = String(e.message || e).slice(0, 60); }
    }
    boardStats.push(st);
    consumed++;
    if (Date.now() - T0 > CONFIG.boardBudgetMs) { st.note = 'time budget reached; later boards not read'; break; }
  }
  let cursorNext = '';
  if (!process.env.TRIAL_SKIP_BOARDS && ranked.length) {
    const nextPos = start + consumed;
    cursorNext = ranked[nextPos >= ranked.length ? 0 : nextPos].key;
  }

  /* JobSpy results, written by the workflow's Python step. The board job does not wait on this. */
  const js = { ran: false, sites: {}, errors: [] };
  const jsFile = process.env.TRIAL_JOBSPY_FILE || path.join(os.tmpdir(), 'jobspy.json');
  if (!process.env.TRIAL_BOARDS_ONLY && fs.existsSync(jsFile)) {
    const d = JSON.parse(fs.readFileSync(jsFile, 'utf8')); js.ran = true; js.errors = d.errors || []; js.searches = d.searches || [];
    const seen = new Set();
    (d.jobs || []).forEach(x => {
      const site = String(x.site || 'unknown'), s = js.sites[site] = js.sites[site] || { returned: 0, matches: 0, new: 0, protected: 0 };
      s.returned++;
      const k = T.identityKey(x.company, x.title, x.location); if (seen.has(k)) return; seen.add(k);
      const fam = T.family(x.title), place = T.usPlace(x.location); if (!fam || !place || !staffEligible(x.company, x.title)) return;
      s.matches++;
      const status = T.novelty(idx, x.company, x.title, x.job_url_direct || x.job_url, x.location); if (status === 'NEW') s.new++; if (status === 'EXISTING_PROTECTED') s.protected++;
      const pay = x.min_amount && x.max_amount && /year/i.test(x.interval || 'yearly') ? `$${Math.round(x.min_amount / 1000)}K-$${Math.round(x.max_amount / 1000)}K` : '';
      addFound({ source: 'JOBSPY:' + site, company: x.company || '', tier: '', title: x.title, location: x.location, place, family: fam, level: T.level(x.title), url: x.job_url_direct || x.job_url, pay, status, posted: x.date_posted || '' });
    });
  }

  /* HiringCafe results, written by hiringcafe.js; read after boards and JobSpy so overlap is attributed to them */
  const hc = { ran: false, returned: 0, matches: 0, unique: 0, overlap: {}, errors: [], searches: [] };
  const hcFile = process.env.TRIAL_HIRINGCAFE_FILE || path.join(os.tmpdir(), 'hiringcafe.json');
  if (!process.env.TRIAL_BOARDS_ONLY && fs.existsSync(hcFile)) {
    const d = JSON.parse(fs.readFileSync(hcFile, 'utf8')); hc.ran = !!d.ran; hc.errors = d.errors || []; hc.searches = d.searches || []; hc.skipped = d.skipped || '';
    (d.jobs || []).forEach(x => {
      hc.returned++;
      const fam = T.family(x.title), place = T.usPlace(x.location); if (!fam || !place || !staffEligible(x.company, x.title)) return;
      hc.matches++;
      const status = T.novelty(idx, x.company, x.title, x.job_url, x.location);
      const pay = x.min_amount && x.max_amount && /year/i.test(x.interval || '') ? `$${Math.round(x.min_amount / 1000)}K-$${Math.round(x.max_amount / 1000)}K` : '';
      const item = { source: 'HIRINGCAFE', company: x.company || '', tier: activePriority.get(P.normCo(x.company)) || '', title: x.title, location: x.location, place, family: fam, level: T.level(x.title), url: x.job_url, pay, status, posted: x.date_posted || '', hiringcafe_id: x.hiringcafe_id || '' };
      if (addFound(item)) { hc.unique++; return; }
      const prior = discovered.get(T.identityKey(item.company, item.title, item.location)), from = String(prior.source).split(':')[0];
      hc.overlap[from] = (hc.overlap[from] || 0) + 1;
    });
  }

  /* report */
  const by = (src, st) => found.filter(f => f.source.startsWith(src) && (!st || f.status === st)).length;
  const summary = {
    at, run: 'FORGE-SOURCE-TRIAL-' + at.replace(/[-:]/g, '').slice(0, 13) + 'Z', master_rows: rows.length, archive, seconds: Math.round((Date.now() - T0) / 1000),
    boards: { read: boardStats.length, failed: boardStats.filter(s => s.error).length, openings: boardStats.reduce((a, s) => a + s.openings, 0), matches: by('BOARD'), new: by('BOARD', 'NEW'), existing: by('BOARD', 'EXISTING') + by('BOARD', 'EXISTING_PROTECTED'), protected: by('BOARD', 'EXISTING_PROTECTED'), cursor_next: cursorNext, cursor_start: start, ranked: ranked.length },
    jobspy: { ran: js.ran, matches: by('JOBSPY'), new: by('JOBSPY', 'NEW'), existing: by('JOBSPY', 'EXISTING') + by('JOBSPY', 'EXISTING_PROTECTED'), protected: by('JOBSPY', 'EXISTING_PROTECTED'), sites: js.sites, errors: js.errors },
    hiringcafe: { ran: hc.ran, skipped: hc.skipped, returned: hc.returned, matches: hc.matches, unique: hc.unique, new: by('HIRINGCAFE', 'NEW'), existing: by('HIRINGCAFE', 'EXISTING') + by('HIRINGCAFE', 'EXISTING_PROTECTED'), protected: by('HIRINGCAFE', 'EXISTING_PROTECTED'), already_found_by: hc.overlap, errors: hc.errors.length },
    by_family: ['QUALITY', 'MFG_PROD', 'MFG_ENG'].reduce((o, f) => (o[f] = { new: found.filter(x => x.family === f && x.status === 'NEW').length, existing: found.filter(x => x.family === f && x.status !== 'NEW').length, protected: found.filter(x => x.family === f && x.status === 'EXISTING_PROTECTED').length }, o), {}),
    priority_boards_probed: probes,
    by_level: ['DIRECTOR_PLUS','SR_MANAGER','SR_STAFF'].reduce((o, level) => (o[level] = { new: found.filter(x => x.level === level && x.status === 'NEW').length, existing: found.filter(x => x.level === level && x.status !== 'NEW').length, protected: found.filter(x => x.level === level && x.status === 'EXISTING_PROTECTED').length }, o), {}),
  };
  const report = { caution: 'NEW is provisional: checked against the master' + (archive.read ? ' and the terminal archive' : ' only (terminal archive NOT read: ' + archive.error + ')') + ', not adjudicated by the Writer.', summary, new_roles: found.filter(f => f.status === 'NEW').sort((a, b) => (b.tier ? 1 : 0) - (a.tier ? 1 : 0)), existing_roles: found.filter(f => f.status !== 'NEW'), protected_roles: found.filter(f => f.status === 'EXISTING_PROTECTED'), boards: boardStats };
  fs.mkdirSync(OUT, { recursive: true });
  if (!process.env.TRIAL_SKIP_BOARDS) {
    const cursorBody = { at, next: cursorNext, start, read: consumed, ranked: ranked.length, source: 'Pipeline Explorer Target Companies ranking via forge-policy derived/TARGET_COMPANIES_PRIORITY.txt', order: ranked.map(b => ({ key: b.key, tier: b.tier || '', company: [...b.companies][0] || '' })) };
    fs.mkdirSync(path.dirname(cursorFile), { recursive: true });
    fs.writeFileSync(cursorFile, JSON.stringify(cursorBody, null, 1) + '\n');
  }
  const reportName = process.env.TRIAL_BOARDS_ONLY ? 'board-discovery-report' : 'source-trial-report';
  fs.writeFileSync(path.join(OUT, reportName + '.json'), JSON.stringify(report, null, 1) + '\n');
  const md = ['# Forge source trial ' + summary.run, '', 'Read-only (REV-164). NEW is provisional; protected application states are not rediscoveries. Nothing was sent to the Writer.', '', 'Terminal archive: ' + (archive.read ? archive.rows + ' rows read; archived roles count as protected, never NEW.' : 'NOT read (' + archive.error + '); NEW may include archived roles.'), '',
    '| Source | Matching US roles | New | Already in master |', '|---|---|---|---|',
    `| Employer job boards (${summary.boards.read} read, ${summary.boards.failed} failed) | ${summary.boards.matches} | ${summary.boards.new} | ${summary.boards.existing} |`,
    ...Object.keys(js.sites).map(s => `| JobSpy ${s} (${js.sites[s].returned} returned) | ${js.sites[s].matches} | ${js.sites[s].new} | ${js.sites[s].matches - js.sites[s].new} |`),
    `| HiringCafe (${hc.returned} returned; ${hc.matches - hc.unique} already found by ${Object.entries(hc.overlap).map(([k, v]) => k + ' ' + v).join(', ') || 'no other source'}) | ${hc.matches} (${hc.unique} unique) | ${by('HIRINGCAFE', 'NEW')} | ${by('HIRINGCAFE', 'EXISTING') + by('HIRINGCAFE', 'EXISTING_PROTECTED')} |`,
    '', 'JobSpy errors: ' + (js.ran ? (js.errors.length ? js.errors.map(e => e.site + ': ' + e.error).join('; ') : 'none') : 'JobSpy did not run'), '',
    'HiringCafe: ' + (hc.ran ? (hc.errors.length ? hc.errors.map(e => (e.search ? e.search + ': ' : '') + e.error).join('; ') : 'no errors') : (hc.skipped || 'did not run')) + '. Unique = matching US roles no board or JobSpy result already covered.', '',
    'Priority companies with no board found: ' + (probes.filter(p => !p.found).map(p => p.company).join(', ') || 'none'), '',
    '## By level', '', '| Level | New | Existing |', '|---|---:|---:|', ...Object.entries(summary.by_level).map(([k,v]) => `| ${k} | ${v.new} | ${v.existing} |`), '', '## New roles', '', '| Source | Company | Title | Location | Family | Level | Pay |', '|---|---|---|---|---|---|---|',
    ...report.new_roles.slice(0, 200).map(f => `| ${f.source} | ${(f.tier ? f.tier + ' ' : '') + f.company} | [${f.title.replace(/\|/g, '/')}](${f.url}) | ${String(f.location).replace(/\|/g, '/')} | ${f.family} | ${f.level} | ${f.pay} |`), ''];
  fs.writeFileSync(path.join(OUT, reportName + '.md'), md.join('\n'));
  console.log(JSON.stringify(summary));
})().catch(e => { console.error(e); process.exit(1); });
