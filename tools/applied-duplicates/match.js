'use strict';
/* Applied-duplicate matcher (Tim 2026-11-03). DRY RUN ONLY: classifies every job waiting on Tim against his decided
   rows (APPLIED, REJECTED_BY_EMPLOYER, DECLINED_BY_TIM). It never writes to the Writer or the master.
   Tim's rule: a role he applied to may be reposted or reopened as a new requisition, and he may want to reapply.
   Only the SAME posting is a duplicate. Order of evidence, strongest first:
     1. Shared posting identity (employer job ID, requisition, Workday R-number, ATS link, LinkedIn job ID) -> same posting.
        Both rows carry employer IDs of the same kind and none overlap -> new requisition (keep).
     2. Different worksite with the same title -> different opening (keep).
     3. Timeline: posting first seen on or before the decision date (+2 days) -> likely the same posting.
        First seen after the rejection, or more than 30 days after applying -> possible repost (ask Tim).
     4. Anything else -> ask Tim (one tap: Same role / Different role).
   Title match alone never closes a job. */
const DAY = 86400000;
const PLACEHOLDER = /^(|-|n\/?a|none|unknown|uncaptured|required|preferred|not[_ ]stated.*|pending.*|tbd)$/i;
const GENERIC_CO = /^(confidential( company)?|stealth|stealth startup|private company|unknown|undisclosed|n a)$/;
const NO_PLACE = /^(|unknown|uncaptured|remote|hybrid|multiple|various|several|united states|us|usa|n a|nationwide|anywhere|tbd)$/;
const STOP = new Set('of the and a an for to in at with on or by'.split(' '));
const ABBR = { sr: 'senior', snr: 'senior', mgr: 'manager', dir: 'director', vp: 'vice president', svp: 'senior vice president', ops: 'operations', mfg: 'manufacturing', eng: 'engineering', qa: 'quality' };
const DECIDED = new Set(['APPLIED', 'REJECTED_BY_EMPLOYER', 'DECLINED_BY_TIM']);
const ACTIVE = new Set(['SCOUT_INTAKE', 'DISCOVERY_LEAD', 'MANUAL_RESEARCH', 'BLOCKED', 'READY_TO_PURSUE', 'TIM_DECISION_REQUIRED']);

function words(s) { return String(s || '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean); }
function company(s) {
  const w = words(s).filter(x => !['inc', 'llc', 'corp', 'corporation', 'co', 'company', 'ltd', 'industries', 'plc', 'lp', 'the'].includes(x));
  return w.join(' ');
}
function sameCompany(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  const [s, l] = a.length < b.length ? [a, b] : [b, a];
  return s.length >= 4 && l.startsWith(s + ' ');
}
function titleTokens(s) {
  const out = new Set();
  for (const w of words(s)) for (const x of (ABBR[w] || w).split(' ')) if (!STOP.has(x)) out.add(x);
  return out;
}
function similarity(a, b) {
  const A = titleTokens(a), B = titleTokens(b); if (!A.size || !B.size) return 0;
  let n = 0; for (const x of A) if (B.has(x)) n++;
  return n / (A.size + B.size - n);
}
function place(loc) { const p = String(loc || '').split(/,| - |\/|\(/)[0]; return words(p).join(' '); }
function date(s) { const m = String(s || '').match(/(\d{4}-\d{2}-\d{2})/); if (!m) return null; const t = Date.parse(m[1] + 'T00:00:00Z'); return Number.isFinite(t) ? t : null; }
function iso(t) { return t == null ? null : new Date(t).toISOString().slice(0, 10); }

/* One master line -> structured row. Columns: n | ID | company | title | status | disposition | tags | req | location | key=value; ... */
function parseLine(line) {
  const c = line.trim().split(/\s+\|\s+/);
  if (c.length < 9 || !/^V2[A-Z]-/.test(c[1] || '')) return null;
  const kv = {};
  for (const item of c.slice(9).join(' | ').split(/;\s+/)) { const i = item.indexOf('='); if (i > 0) { const k = item.slice(0, i).trim(); if (!(k in kv)) kv[k] = item.slice(i + 1).trim(); } }
  return { id: c[1], company: c[2], title: c[3], status: c[4], tags: c[6] || '', req: c[7] || '', location: c[8] || '', kv, text: line };
}

/* Posting identities. Employer kinds (gh, ashby, lever, wd, req, icims, url) can prove a different requisition; LinkedIn IDs cannot
   (LinkedIn assigns a new ID when a posting is refreshed), so they only ever prove sameness. */
function ids(r) {
  const out = new Set(), urls = [];
  for (const [k, v] of Object.entries(r.kv)) if (/URL|LINK/.test(k) && !/MAIL|GMAIL/.test(k)) urls.push(...String(v).match(/https?:\/\/[^\s;|,]+/g) || []);
  const linkedinIds = new Set();
  for (const u of urls) {
    let m;
    if ((m = u.match(/linkedin\.com\/(?:comm\/)?jobs\/view\/(?:[^/?]*-)?(\d{8,})/i)) || (m = u.match(/currentJobId=(\d{8,})/i))) { out.add('li:' + m[1]); linkedinIds.add(m[1]); continue; }
    if (/mail\.google\.com|[?&](keyword|q|search)=/i.test(u)) continue;
    if ((m = u.match(/greenhouse\.io\/[^?#]*?jobs\/(\d{5,})/i)) || (m = u.match(/[?&]gh_jid=(\d{5,})/i))) { out.add('gh:' + m[1]); continue; }
    if ((m = u.match(/jobs\.ashbyhq\.com\/[^/]+\/([0-9a-f-]{20,})/i))) { out.add('ashby:' + m[1].toLowerCase()); continue; }
    if ((m = u.match(/jobs\.lever\.co\/[^/]+\/([0-9a-f-]{20,})/i))) { out.add('lever:' + m[1].toLowerCase()); continue; }
    if ((m = u.match(/myworkdayjobs\.com\/.*?_((?:[A-Z]{1,4}-?)?\d{3,}[\w-]*?)(?:[/?#]|$)/))) { out.add('wd:' + m[1].toUpperCase()); continue; }
    if ((m = u.match(/icims\.com\/jobs\/(\d+)/i))) { out.add('icims:' + m[1]); continue; }
    if (/linkedin\.com|indeed\.com|ziprecruiter\.com|glassdoor\.com|simplyhired\.com/i.test(u)) continue;
    const clean = u.replace(/[?#].*$/, '').replace(/\/+$/, '').toLowerCase();
    if (clean.split('/').length > 4) out.add('url:' + clean.replace(/^https?:\/\/(www\.)?/, ''));
  }
  for (const raw of [r.req, r.kv.REQ_ID]) {
    const v = String(raw || '').trim();
    if (!v || PLACEHOLDER.test(v) || /\s/.test(v)) continue;
    const li = v.match(/^LI-(\d{8,})$/i); if (li) { out.add('li:' + li[1]); continue; }
    if (linkedinIds.has(v)) continue;
    const norm = v.toUpperCase().replace(/^REQ[-_ ]?/, '');
    out.add('req:' + norm);
    if (/^R\d/.test(norm)) out.add('wd:' + norm);
  }
  return out;
}
const kind = x => x.slice(0, x.indexOf(':'));
const EMPLOYER_KINDS = new Set(['gh', 'ashby', 'lever', 'wd', 'icims']);

function decisionDates(r) {
  const tagDates = re => [...r.tags.matchAll(re)].map(m => date(m[1])).filter(t => t != null);
  const applied = [date(r.kv.APP_DATE), date(r.kv.APP_EVENT_DATE), date(r.kv.APPLICATION_EVENT_DATE), date(r.kv.APP_EMAIL_DATE),
    ...tagDates(/(?:^|;\s*)(?:TIM_)?(?:CONFIRMED_)?APPLIED(?:_EMAIL_CONFIRMED)?_(\d{4}-\d{2}-\d{2})/g),
    ...tagDates(/EMPLOYER_(?:APPLICATION_)?CONFIRMATION[^;]*?_(\d{4}-\d{2}-\d{2})/g)].filter(t => t != null);
  const rejected = [date(r.kv.REJECTION_DATE), ...tagDates(/EMPLOYER_REJECTION_(\d{4}-\d{2}-\d{2})/g)].filter(t => t != null);
  const declined = [...tagDates(/TIM_DECLINE_(\d{4}-\d{2}-\d{2})/g)].filter(t => t != null);
  let decided = applied.length ? Math.min(...applied) : null;
  if (decided == null && r.status === 'DECLINED_BY_TIM') decided = declined.length ? Math.min(...declined) : date(r.kv.STATE_UPDATED_AT);
  if (decided == null && r.status !== 'DECLINED_BY_TIM') decided = tagDates(/EMAIL_UPSERT_(\d{4}-\d{2}-\d{2})/g).concat([date(r.kv.DATE_ADDED)]).filter(t => t != null).sort()[0] ?? null;
  return { decided, rejected: rejected.length ? Math.min(...rejected) : null };
}
function firstSeen(r) {
  const ts = [r.kv.POSTED_AT, r.kv.ATS_POSTED_AT, r.kv.POSTING_DATE, r.kv.DATE_ADDED].map(date).filter(t => t != null);
  return ts.length ? Math.min(...ts) : null;
}

/* Classify one waiting row against one decided row with the same employer and a similar title. */
function compare(w, d, wIds, dIds) {
  const shared = [...wIds].filter(x => dIds.has(x));
  if (shared.length) return { rule: 'SAME_POSTING_ID', outcome: 'CLOSE_CANDIDATE', evidence: 'Same posting identity: ' + shared.join(', ') };
  for (const k of EMPLOYER_KINDS) {
    const a = [...wIds].filter(x => kind(x) === k), b = [...dIds].filter(x => kind(x) === k);
    if (a.length && b.length) return { rule: 'NEW_REQUISITION', outcome: 'KEEP_LABEL', evidence: `Different ${k} posting: ${a.join(', ')} vs earlier ${b.join(', ')}` };
  }
  const a = [...wIds].filter(x => kind(x) === 'req'), b = [...dIds].filter(x => kind(x) === 'req');
  if (a.length && b.length) return { rule: 'NEW_REQUISITION', outcome: 'KEEP_LABEL', evidence: `Different requisition: ${a.join(', ')} vs earlier ${b.join(', ')}` };
  const pw = place(w.location), pd = place(d.location);
  if (!NO_PLACE.test(pw) && !NO_PLACE.test(pd) && pw !== pd) return { rule: 'DIFFERENT_SITE', outcome: 'KEEP_LABEL', evidence: `Different worksite: ${w.location} vs earlier ${d.location}` };
  const seen = firstSeen(w), { decided, rejected } = decisionDates(d), sim = similarity(w.title, d.title);
  if (seen == null || decided == null) return { rule: 'NO_DATES', outcome: 'ASK_TIM', evidence: `Missing ${seen == null ? 'posting first-seen date' : 'decision date'}; no shared posting identity` };
  if (rejected != null && seen > rejected) return { rule: 'POSSIBLE_REPOST', outcome: 'ASK_TIM', evidence: `Posting first seen ${iso(seen)}, after rejection ${iso(rejected)}` };
  if (d.status !== 'DECLINED_BY_TIM' && seen > decided + 30 * DAY) return { rule: 'POSSIBLE_REPOST', outcome: 'ASK_TIM', evidence: `Posting first seen ${iso(seen)}, more than 30 days after applying ${iso(decided)}` };
  if (seen <= decided + 2 * DAY && sim >= 0.9) return { rule: 'SAME_BY_TIMELINE', outcome: 'CLOSE_CANDIDATE', evidence: `Posting first seen ${iso(seen)}, on or before ${d.status === 'DECLINED_BY_TIM' ? 'decline' : 'application'} ${iso(decided)}; same title` };
  return { rule: 'UNCERTAIN', outcome: 'ASK_TIM', evidence: `Posting first seen ${iso(seen)}, ${Math.round((seen - decided) / DAY)} days after ${iso(decided)}; no posting identity to compare` };
}

const RANK = { CLOSE_CANDIDATE: 3, ASK_TIM: 2, KEEP_LABEL: 1 };
function label(m) {
  const dd = decisionDates(m.row), verb = m.row.status === 'APPLIED' ? 'Applied' : m.row.status === 'DECLINED_BY_TIM' ? 'You declined' : 'Applied';
  const parts = [`${verb} ${iso(dd.decided) || '(date unknown)'}`];
  if (m.row.status === 'REJECTED_BY_EMPLOYER') parts.push(`Rejected ${iso(dd.rejected) || '(date unknown)'}`);
  parts.push({ SAME_POSTING_ID: 'same posting', SAME_BY_TIMELINE: 'likely the same posting', NEW_REQUISITION: 'this is a new posting', DIFFERENT_SITE: 'different site', POSSIBLE_REPOST: 'possible repost', UNCERTAIN: 'same or different?', NO_DATES: 'same or different?' }[m.rule]);
  return parts.join(' · ');
}

function classify(rows, { waitingIds = null, minSimilarity = 0.75 } = {}) {
  const parsed = rows.map(r => typeof r === 'string' ? parseLine(r) : r).filter(Boolean);
  const waiting = parsed.filter(r => waitingIds ? waitingIds.has(r.id) : ACTIVE.has(r.status));
  const decided = parsed.filter(r => DECIDED.has(r.status)).map(r => ({ row: r, co: company(r.company), ids: ids(r) }));
  const byCo = new Map(); for (const d of decided) { if (!byCo.has(d.co)) byCo.set(d.co, []); byCo.get(d.co).push(d); }
  const items = [];
  for (const w of waiting) {
    const co = company(w.company), wIds = ids(w), generic = GENERIC_CO.test(co), matches = [];
    const pool = generic ? decided : [...byCo.entries()].filter(([k]) => sameCompany(k, co)).flatMap(([, v]) => v);
    for (const d of pool) {
      if (d.row.id === w.id) continue;
      if (generic) { const shared = [...wIds].filter(x => d.ids.has(x)); if (shared.length) matches.push({ row: d.row, rule: 'SAME_POSTING_ID', outcome: 'CLOSE_CANDIDATE', evidence: 'Same posting identity: ' + shared.join(', '), similarity: similarity(w.title, d.row.title) }); continue; }
      const sim = similarity(w.title, d.row.title); if (sim < minSimilarity) continue;
      matches.push({ row: d.row, similarity: sim, ...compare(w, d.row, wIds, d.ids) });
    }
    if (!matches.length) continue;
    matches.sort((a, b) => RANK[b.outcome] - RANK[a.outcome] || b.similarity - a.similarity);
    const best = matches[0], score = Number(w.kv.OVERALL);
    items.push({
      id: w.id, company: w.company, title: w.title, location: w.location, score: Number.isFinite(score) ? score : null,
      outcome: best.outcome, rule: best.rule, label: label(best), evidence: best.evidence,
      matches: matches.map(m => ({ id: m.row.id, status: m.row.status, title: m.row.title, location: m.row.location, decided: iso(decisionDates(m.row).decided), rejected: iso(decisionDates(m.row).rejected), rule: m.rule, outcome: m.outcome, similarity: Math.round(m.similarity * 100) / 100, evidence: m.evidence }))
    });
  }
  items.sort((a, b) => RANK[b.outcome] - RANK[a.outcome] || (b.score ?? -1) - (a.score ?? -1));
  const counts = { waiting: waiting.length, matched: items.length, CLOSE_CANDIDATE: 0, KEEP_LABEL: 0, ASK_TIM: 0 }, rules = {};
  for (const i of items) { counts[i.outcome]++; rules[i.rule] = (rules[i.rule] || 0) + 1; }
  return { counts, rules, items };
}

module.exports = { classify, parseLine, ids, similarity, company, sameCompany, place, decisionDates, firstSeen, compare, label };
