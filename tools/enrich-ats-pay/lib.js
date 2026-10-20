'use strict';
/* REV-116 (Tim 2026-10-20 18:09-18:17 ET): pay and degree from the posting first, estimates only after the posting was
   checked, done off the Writer. Pure functions here; run.js does the network. */

const LEVELS = [
  [4, /\b(chief|svp|evp|senior vice president|executive vice president|vice president|vp|head of)\b/i],
  [3, /\b(senior director|sr\.? director|executive director)\b/i],
  [2, /\b(director|plant manager|general manager|site (leader|lead))\b/i],
  [1, /\b(senior manager|sr\.? manager|manager)\b/i],
];
function level(title) { for (const [n, re] of LEVELS) if (re.test(title || '')) return n; return 0; }
const FUNCS = [
  ['QUALITY', /\bquality\b/i], ['MFG', /\b(manufactur\w*|production|plant|assembly|fabrication)\b/i],
  ['OPS', /\b(operations?|ops|supply chain|industrial)\b/i], ['ENG', /\bengineering\b/i], ['PROGRAM', /\b(program|project)\b/i],
];
function func(title) { for (const [k, re] of FUNCS) if (re.test(title || '')) return k; return 'OTHER'; }
const REGION = { NE: 'CT ME MA NH RI VT NJ NY PA', MW: 'IL IN MI OH WI IA KS MN MO NE ND SD', S: 'DE FL GA MD NC SC VA DC WV AL KY MS TN AR LA OK TX', W: 'AZ CO ID MT NV NM UT WY AK CA HI OR WA' };
const STATE_REGION = {}; Object.keys(REGION).forEach(r => REGION[r].split(' ').forEach(s => { STATE_REGION[s] = r; }));
function stateOf(loc) { const m = String(loc || '').match(/,\s*([A-Z]{2})\b/); return m ? m[1] : ''; }
function regionOf(loc) { return STATE_REGION[stateOf(loc)] || ''; }

function num(s) { if (s == null) return null; const t = String(s).replace(/[$,\s]/g, ''); const k = /k$/i.test(t); const n = parseFloat(t); if (!isFinite(n)) return null; return k ? n * 1000 : n; }
/* annual base range stated in the posting text, e.g. "$175,000 - $260,000" or "$175K to $260K" */
const RANGE_RE = /\$\s?(\d{2,3}(?:,\d{3})+(?:\.\d+)?|\d{2,3}(?:\.\d+)?\s?[kK])(?:\s*(?:\/\s*(?:yr|year)|per year|a year|annually|USD))?\s*(?:-|–|—|to)\s*\$?\s?(\d{2,3}(?:,\d{3})+(?:\.\d+)?|\d{2,3}(?:\.\d+)?\s?[kK])/;
function payFromText(text) {
  const m = String(text || '').match(RANGE_RE); if (!m) return null;
  const lo = num(m[1]), hi = num(m[2]); if (!(lo >= 40000 && hi >= lo && hi <= 2000000)) return null;
  return { low: lo, high: hi };
}
const DEG_RE = /[^.\n]*\b(bachelor'?s?|master'?s?|b\.?s\.?|b\.?a\.?|m\.?s\.?|mba|ph\.?d|associate'?s? degree|degree)\b[^.\n]*/i;
function degreeFromText(text) {
  const t = String(text || ''); if (!t.trim()) return null;
  const m = t.match(DEG_RE);
  if (!m) return { text: 'NOT_STATED', req: 'NOT_STATED' };
  const s = m[0].replace(/\s+/g, ' ').trim().slice(0, 400);
  const req = /\b(preferred|or equivalent|equivalent experience|a plus|nice to have|desired)\b/i.test(s) ? 'PREFERRED' : 'REQUIRED';
  return { text: s, req };
}
/* ATS posting URL -> JSON API URL (public, read-only). Workday needs a POST; left to the lanes. */
function atsApi(url) {
  const u = String(url || '');
  let m = u.match(/jobs\.lever\.co\/([^/?#]+)\/([0-9a-f-]{36})/i); if (m) return { kind: 'lever', api: `https://api.lever.co/v0/postings/${m[1]}/${m[2]}`, page: u };
  m = u.match(/(?:boards|job-boards)\.greenhouse\.io\/([^/?#]+)\/jobs\/(\d+)/i) || u.match(/greenhouse\.io\/embed\/job_app\?.*for=([^&]+).*token=(\d+)/i);
  if (m) return { kind: 'greenhouse', api: `https://boards-api.greenhouse.io/v1/boards/${m[1]}/jobs/${m[2]}?pay_transparency=true`, page: u };
  m = u.match(/jobs\.ashbyhq\.com\/([^/?#]+)\/([0-9a-f-]{36})/i); if (m) return { kind: 'ashby', api: `https://api.ashbyhq.com/posting-api/job-board/${m[1]}?includeCompensation=true`, id: m[2], page: u };
  return null;
}
function strip(html) { return String(html || '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '); }
/* parse an ATS API response into {pay, text} */
function parseAts(kind, j, id) {
  if (kind === 'lever') {
    const text = [j.descriptionPlain, j.additionalPlain].concat((j.lists || []).map(l => l.text + ' ' + strip(l.content))).join(' ');
    let pay = null; const s = j.salaryRange;
    if (s && s.min && s.max && (!s.interval || /year|annual/i.test(s.interval))) pay = { low: +s.min, high: +s.max };
    return { pay: pay || payFromText(text), text };
  }
  if (kind === 'greenhouse') {
    const text = strip(j.content);
    let pay = null; const r = (j.pay_input_ranges || [])[0];
    if (r && r.min_cents && r.max_cents) pay = { low: r.min_cents / 100, high: r.max_cents / 100 };
    return { pay: pay || payFromText(text), text };
  }
  if (kind === 'ashby') {
    const job = (j.jobs || []).find(x => x.id === id); if (!job) return null;
    const text = job.descriptionPlain || strip(job.descriptionHtml);
    let pay = null; const comp = job.compensation && (job.compensation.summaryComponents || []).find(c => /salary/i.test(c.compensationType || '') && /year/i.test(c.interval || 'year'));
    if (comp && comp.minValue && comp.maxValue) pay = { low: +comp.minValue, high: +comp.maxValue };
    return { pay: pay || payFromText(text) || payFromText(job.compensation && job.compensation.compensationTierSummary), text };
  }
  return null;
}
/* employer-posted comparables from the master; one per row */
function postedAnchor(r, p) {
  const basis = String(p.SALARY_BASIS || '');
  const lo = num(p.SALARY_BASE_LOW), hi = num(p.SALARY_BASE_HIGH);
  if (/EMPLOYER_POSTED/i.test(basis) && lo >= 40000 && hi >= lo) return { id: r.PRIMARY_ID, co: r.COMPANY, title: r.TITLE, low: lo, high: hi, level: level(r.TITLE), func: func(r.TITLE), region: regionOf(r.LOCATION) };
  return null;
}
function median(a) { const s = a.slice().sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : null; }
/* Tim's COMPENSATION_ESTIMATION: 1 employer-posted comparable = LOW; 2 = LOW (MED when role/geo close); 3+ strong = MED.
   Comparables must share level and function; same-region ones first. */
function estimate(row, anchors) {
  const L = level(row.TITLE), F = func(row.TITLE), R = regionOf(row.LOCATION);
  const same = anchors.filter(a => a.level === L && a.func === F && a.id !== row.PRIMARY_ID);
  if (!same.length) return null;
  const local = same.filter(a => R && a.region === R);
  const use = (local.length >= 2 ? local : same).slice(0, 7);
  const low = Math.round(median(use.map(a => a.low)) / 1000) * 1000, high = Math.round(median(use.map(a => a.high)) / 1000) * 1000;
  const close = local.length >= 2;
  const conf = use.length >= 3 && close ? 'MED' : use.length === 2 && close ? 'MED' : 'LOW';
  return { low, high, mid: Math.round((low + high) / 2), conf, n: use.length, close, ids: use.map(a => a.id), basis: `${use.length} employer-posted comparable(s), level ${L} ${F}${close ? ' same region ' + R : ' any region'}` };
}
/* Tim 2026-10-20 18:21 ET: pay shown on an aggregator posting (LinkedIn, Indeed, ZipRecruiter) is posting pay and comes
   before any estimate. Pay the site itself labels as its own estimate is THIRD_PARTY_ESTIMATE; it still beats FORGE-ESTIMATE. */
function aggregatorPage(url) {
  const u = String(url || ''); let m;
  if ((m = u.match(/linkedin\.com\/.*?(?:jobs\/view\/(?:[^/?#]*-)?(\d{6,})|currentJobId=(\d{6,}))/i))) { const id = m[1] || m[2]; return { kind: 'linkedin', id, page: 'https://www.linkedin.com/jobs/view/' + id, fetch: 'https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/' + id }; }
  if ((m = u.match(/indeed\.com\/.*?[?&]jk=([0-9a-f]{12,})/i))) return { kind: 'indeed', id: m[1], page: 'https://www.indeed.com/viewjob?jk=' + m[1], fetch: 'https://www.indeed.com/viewjob?jk=' + m[1] };
  if (/ziprecruiter\.com\/(c|jobs|k)\//i.test(u)) return { kind: 'ziprecruiter', id: u, page: u, fetch: u };
  return null;
}
function parseAggregator(kind, html) {
  const text = strip(html || ''); if (text.length < 200) return null;
  const pay = payFromText(text); let basis = null;
  if (pay) {
    const at = text.search(RANGE_RE), near = text.slice(Math.max(0, at - 120), at + 160);
    basis = /\b(estimated|est\.|estimate)\b/i.test(near) && !/provided by (the )?employer|base pay range/i.test(near) ? 'THIRD_PARTY_ESTIMATE' : 'EMPLOYER_POSTED';
  }
  return { pay, basis, text };
}
module.exports = { level, func, regionOf, payFromText, degreeFromText, atsApi, parseAts, postedAnchor, estimate, num , aggregatorPage, parseAggregator };
