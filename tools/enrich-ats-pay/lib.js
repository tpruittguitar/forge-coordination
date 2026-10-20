'use strict';
/* REV-116 (Tim 2026-10-20 18:09-18:17 ET): pay and degree from the posting first, estimates only after the posting was
   checked, done off the Writer. Pure functions here; run.js does the network. */

const LEVELS = [
  [4, /\b(chief|svp|evp|senior vice president|executive vice president|vice president|vp)\b/i],
  [3, /\b(senior director|sr\.? director|executive director|head of)\b/i],
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
/* Grok Bot QA 2026-10-20 19:32 ET: policy asks for the degree sentence verbatim. strip() keeps block breaks as newlines, so a
   sentence ends at a newline, a bullet, or ". " before a capital (not after a B.S. / M.S. style abbreviation). */
const DEG_WORD_RE = /\b(bachelor'?s?|master'?s?|b\.\s?s\.?|b\.\s?a\.?|m\.\s?s\.?|bs|ba|ms|mba|ph\.?\s?d\.?|associate'?s? degree|degree)(?![a-z])/i;
function sentences(text) {
  return String(text || '').split(/\n+|\s*[•·▪●]\s*|(?<!\b[A-Za-z]\.[A-Za-z])(?<!\b[A-Z])(?<=[.!?])\s+(?=[A-Z0-9(])/).map(x => x.replace(/[ \t]+/g, ' ').trim()).filter(Boolean);
}
function degreeFromText(text) {
  const t = String(text || ''); if (!t.trim()) return null;
  const hit = sentences(t).find(x => DEG_WORD_RE.test(x));
  if (!hit) return { text: 'NOT_STATED', req: 'NOT_STATED' };
  // verbatim; only a runaway block (a page with no sentence breaks) is cut, around the degree words
  let s = hit;
  if (hit.length > 500) { const at = hit.search(DEG_WORD_RE), a = Math.max(0, at - 150); s = (a ? '…' : '') + hit.slice(a, a + 498) + (a + 498 < hit.length ? '…' : ''); }
  // judge the bachelor-level clause: "B.S. required; MBA preferred" is a required degree
  const FLEX = /\b(preferred|or equivalent|equivalent (work )?experience|in lieu of|may substitute|a plus|nice to have|desired)\b/i;
  const clauses = hit.split(/;|,\s*(?=(?:an?\s+)?(?:master|mba|m\.\s?s|ms|ph\.?\s?d|advanced|graduate))/i);
  const base = clauses.find(c => /\b(bachelor|b\.\s?[sa]\b|bs\b|ba\b|associate|four-year|4-year|undergraduate)/i.test(c)) || hit;
  return { text: s, req: FLEX.test(base) ? 'PREFERRED' : 'REQUIRED' };
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
function strip(html) { return String(html || '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&#39;|&#x27;|&rsquo;/g, "'").replace(/&quot;/g, '"').replace(/<\s*(br|\/p|\/li|\/div|\/h[1-6]|\/tr|li)\b[^>]*>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/[ \t\r\f\v]+/g, ' ').replace(/ *\n[\n ]*/g, '\n').trim(); }
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
  // COMPENSATION_ESTIMATION: 1 comparable LOW; 2 LOW, MED when close; 3+ strong anchors may go higher.
  // close = same region; strong = same region and the comparables' midpoints within 20% of their median.
  const close = local.length >= 2, mids = use.map(a => (a.low + a.high) / 2), med = median(mids);
  const tight = med > 0 && (Math.max.apply(null, mids) - Math.min.apply(null, mids)) / med <= 0.2;
  const conf = use.length >= 3 && close && tight ? 'HIGH' : use.length >= 2 && close ? 'MED' : 'LOW';
  return { low, high, mid: Math.round((low + high) / 2), conf, n: use.length, close, tight, ids: use.map(a => a.id), basis: `${use.length} employer-posted comparable(s), level ${L} ${F}${close ? ' same region ' + R : ' any region'}` };
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
/* Grok Bot QA 2026-10-20 19:20 ET: a sign-in or bot-check page is not a read posting. It counts only when it carries the
   row's own job content (company or most of the title words) and no wall markers. */
const WALL_RE = /\b(sign in to|join now|log in to|captcha|verify you are (a )?human|security check|access denied|unusual activity|enable javascript)\b/i;
function looksLikePosting(text, row) {
  const t = String(text || '').toLowerCase(); if (t.length < 400) return false;
  const words = s => String(s || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(w => w.length > 2 && !/^(the|and|for|inc|llc|corp|company|group|senior|director|manager|head|vice|president)$/.test(w));
  const co = words(row && row.COMPANY), ti = words(row && row.TITLE);
  const coHit = co.length && t.includes(co[0]), tiHits = ti.filter(w => t.includes(w)).length;
  const content = coHit || (ti.length && tiHits >= Math.ceil(ti.length * 0.6));
  return !!content && !(WALL_RE.test(t) && t.length < 3000);
}
function parseAggregator(kind, html, row) {
  const text = strip(html || ''); if (text.length < 200) return null;
  if (row && !looksLikePosting(text, row)) return { wall: true, pay: null, basis: null, text: '' };
  const pay = payFromText(text); let basis = null;
  if (pay) {
    const at = text.search(RANGE_RE), near = text.slice(Math.max(0, at - 120), at + 160);
    basis = /\b(estimated|est\.|estimate)\b/i.test(near) && !/provided by (the )?employer|base pay range/i.test(near) ? 'THIRD_PARTY_ESTIMATE' : 'EMPLOYER_POSTED';
  }
  return { pay, basis, text };
}
module.exports = { level, func, regionOf, payFromText, degreeFromText, atsApi, parseAts, postedAnchor, estimate, num , aggregatorPage, parseAggregator, looksLikePosting };
