'use strict';
/* REV-156 (Tim 2026-10-21 18:09 ET): read-only trial of two discovery sources for Tim's three role families
   (quality leadership; manufacturing / production leadership; manufacturing engineering leadership):
   1. employer job boards (Greenhouse, Lever, Ashby, Workday) for every employer the master already has an ATS link for,
      plus the priority companies in forge-policy derived/TARGET_COMPANIES_PRIORITY.txt (board probed when not known);
   2. JobSpy (python-jobspy, run by the workflow step before this script) on LinkedIn, Indeed, ZipRecruiter, Glassdoor,
      Google.
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
  const idx = T.masterIndex(rows.map(r => ({ COMPANY: r.COMPANY, TITLE: r.TITLE, p: r.p })));

  /* boards: priority companies first, then every board the master links to */
  const boards = new Map(), add = (b, company, tier, from) => { if (!b) return; const cur = boards.get(b.key); if (cur) { cur.companies.add(company); if (tier && !cur.tier) cur.tier = tier; return; } boards.set(b.key, Object.assign({}, b, { companies: new Set([company]), tier: tier || '', from })); };
  const priority = T.parsePriority(process.env.TRIAL_PRIORITY_FILE ? fs.readFileSync(process.env.TRIAL_PRIORITY_FILE, 'utf8') : await (await get(RAW + 'forge-policy/main/derived/TARGET_COMPANIES_PRIORITY.txt')).text());
  const coBoard = {};   // normCo(company) -> board key, from the master's own ATS links
  rows.forEach(r => { const b = P.boardOf(r.p || {}); if (b) { coBoard[P.normCo(r.COMPANY)] = coBoard[P.normCo(r.COMPANY)] || b; } });
  const probes = [];
  for (const c of priority) {
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
  const order = [...boards.values()].sort((a, b) => (b.tier ? 1 : 0) - (a.tier ? 1 : 0)).slice(0, CONFIG.maxBoards);

  /* read each board, keep Tim's three families in the US */
  const found = [], boardStats = [];
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
          st.matches++;
          const company = [...b.companies][0];
          found.push({ source: 'BOARD:' + b.kind, company, tier: b.tier, title: x.title, location: x.location, place, family: fam, url: x.page, pay: x.pay ? `$${Math.round(x.pay.low / 1000)}K-$${Math.round(x.pay.high / 1000)}K` : '', status: T.novelty(idx, company, x.title, x.page) });
        });
      } catch (e) { st.error = String(e.message || e).slice(0, 60); }
    }
    boardStats.push(st);
    if (Date.now() - T0 > CONFIG.boardBudgetMs) { st.note = 'time budget reached; later boards not read'; break; }
  }

  /* JobSpy results, written by the workflow's Python step */
  const js = { ran: false, sites: {}, errors: [] };
  const jsFile = process.env.TRIAL_JOBSPY_FILE || path.join(os.tmpdir(), 'jobspy.json');
  if (fs.existsSync(jsFile)) {
    const d = JSON.parse(fs.readFileSync(jsFile, 'utf8')); js.ran = true; js.errors = d.errors || []; js.searches = d.searches || [];
    const seen = new Set();
    (d.jobs || []).forEach(x => {
      const site = String(x.site || 'unknown'), s = js.sites[site] = js.sites[site] || { returned: 0, matches: 0, new: 0 };
      s.returned++;
      const k = T.normUrl(x.job_url) || (x.company + '|' + x.title); if (seen.has(k)) return; seen.add(k);
      const fam = T.family(x.title), place = T.usPlace(x.location); if (!fam || !place) return;
      s.matches++;
      const status = T.novelty(idx, x.company, x.title, x.job_url_direct || x.job_url); if (status === 'NEW') s.new++;
      const pay = x.min_amount && x.max_amount && /year/i.test(x.interval || 'yearly') ? `$${Math.round(x.min_amount / 1000)}K-$${Math.round(x.max_amount / 1000)}K` : '';
      found.push({ source: 'JOBSPY:' + site, company: x.company || '', tier: '', title: x.title, location: x.location, place, family: fam, url: x.job_url_direct || x.job_url, pay, status, posted: x.date_posted || '' });
    });
  }

  /* report */
  const by = (src, st) => found.filter(f => f.source.startsWith(src) && (!st || f.status === st)).length;
  const summary = {
    at, run: 'FORGE-SOURCE-TRIAL-' + at.replace(/[-:]/g, '').slice(0, 13) + 'Z', master_rows: rows.length, seconds: Math.round((Date.now() - T0) / 1000),
    boards: { read: boardStats.length, failed: boardStats.filter(s => s.error).length, openings: boardStats.reduce((a, s) => a + s.openings, 0), matches: by('BOARD'), new: by('BOARD', 'NEW'), existing: by('BOARD', 'EXISTING') },
    jobspy: { ran: js.ran, matches: by('JOBSPY'), new: by('JOBSPY', 'NEW'), existing: by('JOBSPY', 'EXISTING'), sites: js.sites, errors: js.errors },
    by_family: ['QUALITY', 'MFG_PROD', 'MFG_ENG'].reduce((o, f) => (o[f] = { new: found.filter(x => x.family === f && x.status === 'NEW').length, existing: found.filter(x => x.family === f && x.status === 'EXISTING').length }, o), {}),
    priority_boards_probed: probes,
  };
  const report = { summary, new_roles: found.filter(f => f.status === 'NEW').sort((a, b) => (b.tier ? 1 : 0) - (a.tier ? 1 : 0)), existing_roles: found.filter(f => f.status === 'EXISTING'), boards: boardStats };
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'source-trial-report.json'), JSON.stringify(report, null, 1) + '\n');
  const md = ['# Forge source trial ' + summary.run, '', 'Read-only (REV-156). Nothing was sent to the Writer.', '',
    '| Source | Matching US roles | New | Already in master |', '|---|---|---|---|',
    `| Employer job boards (${summary.boards.read} read, ${summary.boards.failed} failed) | ${summary.boards.matches} | ${summary.boards.new} | ${summary.boards.existing} |`,
    ...Object.keys(js.sites).map(s => `| JobSpy ${s} (${js.sites[s].returned} returned) | ${js.sites[s].matches} | ${js.sites[s].new} | ${js.sites[s].matches - js.sites[s].new} |`),
    '', 'JobSpy errors: ' + (js.ran ? (js.errors.length ? js.errors.map(e => e.site + ': ' + e.error).join('; ') : 'none') : 'JobSpy did not run'), '',
    'Priority companies with no board found: ' + (probes.filter(p => !p.found).map(p => p.company).join(', ') || 'none'), '',
    '## New roles', '', '| Source | Company | Title | Location | Family | Pay |', '|---|---|---|---|---|---|',
    ...report.new_roles.slice(0, 200).map(f => `| ${f.source} | ${(f.tier ? f.tier + ' ' : '') + f.company} | [${f.title.replace(/\|/g, '/')}](${f.url}) | ${String(f.location).replace(/\|/g, '/')} | ${f.family} | ${f.pay} |`), ''];
  fs.writeFileSync(path.join(OUT, 'source-trial-report.md'), md.join('\n'));
  console.log(JSON.stringify(summary));
})().catch(e => { console.error(e); process.exit(1); });
