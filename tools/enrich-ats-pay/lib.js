'use strict';
const Context = require('./context');
const Scope = require('./anchor-scope');
/* REV-116 (Tim 2026-10-20 18:09-18:17 ET): pay and degree from the posting first, estimates only after the posting was
   checked, done off the Writer. Pure functions here; run.js does the network. */

const LEVELS = [
  [4, /\b(chief|svp|evp|senior vice president|executive vice president|vice president|vp)\b/i],
  [3, /\b(senior director|sr\.? director|executive director|head of)\b/i],
  [2, /\b(director|plant manager|general manager|site (leader|lead))\b/i],
  [1.5, /\b(senior|sr\.?)\s+(?:[a-z]+\s+){0,4}manager\b/i],
  [0.5, /\b(associate|assistant|asst\.?)\s+manager\b/i],
  [1, /\bmanager\b/i],
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
  // REV-136: the API forms lanes stored as liveness evidence, and Workday (the most common ATS in the eligible rows)
  m = u.match(/boards-api\.greenhouse\.io\/v1\/boards\/([^/?#]+)\/jobs\/(\d+)/i); if (m) return { kind: 'greenhouse', api: `https://boards-api.greenhouse.io/v1/boards/${m[1]}/jobs/${m[2]}?pay_transparency=true`, page: `https://job-boards.greenhouse.io/${m[1]}/jobs/${m[2]}` };
  m = u.match(/api\.lever\.co\/v0\/postings\/([^/?#]+)\/([0-9a-f-]{36})/i); if (m) return { kind: 'lever', api: `https://api.lever.co/v0/postings/${m[1]}/${m[2]}`, page: `https://jobs.lever.co/${m[1]}/${m[2]}` };
  m = u.match(/^https?:\/\/([a-z0-9-]+)\.(wd\d+)\.myworkdayjobs\.com\/(?:[a-z]{2}-[A-Z]{2}\/)?([^/?#]+)\/job\/([^?#]+)/i);
  if (m && !/^wday$/i.test(m[3])) return { kind: 'workday', api: `https://${m[1]}.${m[2]}.myworkdayjobs.com/wday/cxs/${m[1]}/${m[3]}/job/${m[4].replace(/\/+$/, '')}`, page: u.split(/[?#]/)[0] };
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
  if (kind === 'workday') {
    const info = j && j.jobPostingInfo; if (!info) return null;
    const text = strip(info.jobDescription);
    return { pay: payFromText(text), text };
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
  // A legacy posted flag must not promote a site-labelled estimate to employer evidence.
  if (/estimate/i.test(String(p.PAY_POSTED || '')) || /glassdoor\.com|salary\.com|payscale\.com/i.test(String(p.SALARY_SOURCE || ''))) return null;
  const lo = num(p.SALARY_BASE_LOW), hi = num(p.SALARY_BASE_HIGH);
  if (basis === 'EMPLOYER_POSTED' && lo >= 40000 && hi >= lo) return { id: r.PRIMARY_ID, co: r.COMPANY, title: r.TITLE, location:r.LOCATION, asOf:p.SALARY_ASOF, sourceUrl:p.SALARY_SOURCE, low: lo, high: hi, level: level(r.TITLE), func: func(r.TITLE), region: regionOf(r.LOCATION), state: stateFrom(r.LOCATION) };
  return null;
}
function median(a) { const s = a.slice().sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : null; }
function comparable(row, anchor) {
  // Recompute from actual titles, never trust a cached coarse level.
  const track = title => /\b(program|project)\s+manager\b/i.test(title||'') ? 'PROGRAM' : 'LINE';
  // Applied AI/ML leadership is not a generic plant-management comparator. Do not
  // infer a technology premium; with no matching specialty, retain missing evidence.
  const specialty=title=>/\b(?:AI|ML|artificial intelligence|machine learning)\b/i.test(title||'')?'AI_ML':'GENERAL';
  return !!String(anchor.title || '').trim() && level(row.TITLE) === level(anchor.title) && func(row.TITLE) === func(anchor.title) && track(row.TITLE) === track(anchor.title) && specialty(row.TITLE)===specialty(anchor.title) && Scope.family(row.TITLE)===Scope.family(anchor.title) && Scope.executiveScope(row.TITLE)===Scope.executiveScope(anchor.title);
}
function invalidSavedAnchors(row, rows) {
  const p = row.p || {};
  if (p.SALARY_BASIS !== 'FORGE-ESTIMATE' || !/^(same-employer|comparables):/.test(p.SALARY_SOURCE || '')) return [];
  const by = new Map(rows.map(r => [r.PRIMARY_ID, r]));
  return [...new Set(String(p.SALARY_SOURCE).match(/V2[IE]-[A-Z0-9]+/g) || [])].flatMap(id => {
    const a = by.get(id); if (!a) return []; // Missing history is not proof of a bad comparator.
    return !postedAnchor(a, a.p || {}) || !comparable(row, { title: a.TITLE }) ? [id] : [];
  });
}
/* Tim's COMPENSATION_ESTIMATION: 1 employer-posted comparable = LOW; 2 = LOW (MED when role/geo close); 3+ strong = MED.
   Comparables must share level and function; same-region ones first. */
function estimate(row, anchors, context) {
  const L = level(row.TITLE), F = func(row.TITLE), R = regionOf(row.LOCATION);
  const same = anchors.filter(a => comparable(row, a) && a.id !== row.PRIMARY_ID);
  if (!same.length) return null;
  // Always use the same employer-first, deduplicated selector, including callers
  // without a context reference. Missing context remains unknown, not a premium.
  const use = Context.select({...row,state:stateFrom(row.LOCATION)},same,context||{}).slice(0, 7);
  if(!use.length)return null;
  const low = Math.round(Context.weightedMedian(use,'low') / 1000) * 1000, high = Math.round(Context.weightedMedian(use,'high') / 1000) * 1000;
  // COMPENSATION_ESTIMATION: 1 comparable LOW; 2 LOW, MED when close; 3+ strong anchors may go higher.
  // close = same region; strong = same region and the comparables' midpoints within 20% of their median.
  const close = use.filter(a=>R&&a.region===R).length >= 2, mids = use.map(a => (a.low + a.high) / 2), med = median(mids);
  const tight = med > 0 && (Math.max.apply(null, mids) - Math.min.apply(null, mids)) / med <= 0.2;
  let conf = use.length >= 3 && close && tight ? 'HIGH' : use.length >= 2 && close ? 'MED' : 'LOW';
  if(context)conf=Context.confidence({conf},use);
  return { low, high, mid: Math.round((low + high) / 2), conf, n: use.length, close, tight, ids: use.map(a => a.id), modelVersion:context?Context.VERSION:null, basis: `${use.length} employer-posted comparable(s), level ${L} ${F}${close ? ' same region ' + R : ' any region'}`+(context?'; '+Context.annotation(use):'') };
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
/** REV-136: the first field on a row that names a readable ATS posting (rows keep the ATS link in ATS_POSTING_URL more often
 *  than in SOURCE_URL, which is usually the LinkedIn / Indeed alert). */
const ATS_URL_KEYS = ['ATS_POSTING_URL', 'DIRECT_JOB_URL', 'CLAUDE_REVIEW_EVIDENCE_URL', 'DEGREE_EVIDENCE_URL', 'SALARY_EVIDENCE_URL', 'LIVENESS_EVIDENCE_URL', 'SOURCE_URL', 'SOURCE', 'COMPANY_SOURCE_URL', 'INITIATING_URL'];
function aggregatorFor(p) { for (const k of ATS_URL_KEYS) { const a = aggregatorPage(p[k]); if (a) return Object.assign({ key:k },a); } return null; }
function atsFor(p) { for (const k of ATS_URL_KEYS) { const a = atsApi(String(p[k] == null ? '' : p[k]).trim()); if (a) return Object.assign({ key: k }, a); } return null; }

/* ---------- REV-138 (Tim ruling 2026-10-21 02:31 ET): estimate sources, in this order ----------
   1) Same employer, similar role, posted pay: the master's own employer-posted rows for that company, then the employer's
      public ATS board (Greenhouse / Lever / Ashby list APIs; Workday search + detail). Postings in states whose law requires a
      pay range in job ads come first. A range posted in another state is scaled by the BLS median ratio of the two states.
   2) Similar role at other employers in the master (level + function, same region first). The master has no company
      size / industry field (checked 2026-10-21), so "similar company type/size" is not available yet.
   3) BLS OEWS state wages for the role's occupation: cross-check when an anchored estimate exists (lowers confidence if far outside). When no anchored estimate exists, BLS sets the number (required, LOW confidence) so the row can be scored and processed. Tim 2026-10-28.
   4) Salary sites (Glassdoor, Salary.com, Payscale): THIRD_PARTY_ESTIMATE, LOW, lanes only; this bot does not fetch them.
   Pay-range-in-posting states (secondary source, loio.com guide 2026-07-03, plus WA since 2023): verify against statutes. */
const PAY_TRANSPARENCY = ['CA', 'CO', 'CT', 'DC', 'HI', 'IL', 'MA', 'MD', 'ME', 'MN', 'NJ', 'NY', 'VA', 'VT', 'WA'];
const STATE_NAMES = { alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA', colorado: 'CO', connecticut: 'CT', delaware: 'DE', 'district of columbia': 'DC', florida: 'FL', georgia: 'GA', hawaii: 'HI', idaho: 'ID', illinois: 'IL', indiana: 'IN', iowa: 'IA', kansas: 'KS', kentucky: 'KY', louisiana: 'LA', maine: 'ME', maryland: 'MD', massachusetts: 'MA', michigan: 'MI', minnesota: 'MN', mississippi: 'MS', missouri: 'MO', montana: 'MT', nebraska: 'NE', nevada: 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND', ohio: 'OH', oklahoma: 'OK', oregon: 'OR', pennsylvania: 'PA', 'rhode island': 'RI', 'south carolina': 'SC', 'south dakota': 'SD', tennessee: 'TN', texas: 'TX', utah: 'UT', vermont: 'VT', virginia: 'VA', washington: 'WA', 'west virginia': 'WV', wisconsin: 'WI', wyoming: 'WY' };
const STATE_FIPS = { AL: '01', AK: '02', AZ: '04', AR: '05', CA: '06', CO: '08', CT: '09', DE: '10', DC: '11', FL: '12', GA: '13', HI: '15', ID: '16', IL: '17', IN: '18', IA: '19', KS: '20', KY: '21', LA: '22', ME: '23', MD: '24', MA: '25', MI: '26', MN: '27', MS: '28', MO: '29', MT: '30', NE: '31', NV: '32', NH: '33', NJ: '34', NM: '35', NY: '36', NC: '37', ND: '38', OH: '39', OK: '40', OR: '41', PA: '42', RI: '44', SC: '45', SD: '46', TN: '47', TX: '48', UT: '49', VT: '50', VA: '51', WA: '53', WV: '54', WI: '55', WY: '56' };
/** US state of a free location text ("Kent, WA", "Seattle, Washington, United States", "US-CA-Irvine"), or ''.
 *  Grok Bot QA #21: a text that names another country is not a US state ("Toronto, ON, CA", "Bangalore, IN", "Munich, DE");
 *  only ", XX" and "-XX-" tokens count as codes (so "Remote OR Hybrid" is not Oregon). */
const NON_US_RE = /\b(canada|india|germany|deutschland|mexico|m[ée]xico|united kingdom|england|scotland|wales|ireland|china|japan|korea|singapore|taiwan|philippines|vietnam|thailand|malaysia|indonesia|australia|new zealand|brazil|argentina|chile|colombia|costa rica|france|spain|italy|netherlands|belgium|switzerland|austria|poland|czech|hungary|romania|sweden|norway|denmark|finland|israel|turkey|uae|united arab emirates|saudi|qatar|south africa|egypt|morocco|puerto rico)\b|\b(uk|gbr|deu|ind|mex|can|chn|jpn)\b/i;
/* a foreign city next to a code that is also a country code ("Bangalore, IN", "Munich, DE"); "London, KY" stays Kentucky */
const FOREIGN_CITY_RE = /\b(bangalore|bengaluru|pune|hyderabad|chennai|mumbai|delhi|gurgaon|gurugram|noida|munich|m[üu]nchen|berlin|frankfurt|stuttgart|hamburg|toronto|vancouver|montreal|montr[ée]al|calgary|ottawa|mississauga|monterrey|guadalajara|tijuana|ju[áa]rez|quer[ée]taro|london|manchester|shanghai|shenzhen|beijing|tokyo|seoul|sydney|melbourne|paris|madrid|barcelona|milan|amsterdam|dublin|tel aviv|krak[óo]w|warsaw|prague|budapest|bucharest|s[ãa]o paulo)\b/i, AMBIGUOUS_CODES = ['AL', 'AR', 'CA', 'CO', 'DE', 'GA', 'ID', 'IL', 'IN', 'MA', 'ME', 'MN', 'MT', 'NE', 'PA', 'SD', 'VA'];
const CA_PROVINCE_RE = /(^|[,\s-])(AB|BC|MB|NB|NL|NS|NT|NU|ON|PE|QC|SK|YT)\s*,\s*(CA|CAN|Canada)\b/;
function stateFrom(loc) {
  const t = String(loc || '');
  if (!t.trim() || NON_US_RE.test(t) || CA_PROVINCE_RE.test(t)) return '';
  const re = /(?:,\s*|\bUS-|-)([A-Z]{2})(?=\s*(?:$|[,\-(]|\s+\d{5}|\s+(?:US|USA|United States)\b))/g; let m;
  while ((m = re.exec(t))) if (STATE_FIPS[m[1]]) return AMBIGUOUS_CODES.indexOf(m[1]) >= 0 && FOREIGN_CITY_RE.test(t) ? '' : m[1];
  const low = t.toLowerCase(); for (const n of Object.keys(STATE_NAMES).sort((a, b) => b.length - a.length)) if (new RegExp('\\b' + n + '\\b').test(low)) return STATE_NAMES[n];
  return '';
}
function normCo(s) { return String(s || '').toLowerCase().replace(/\(.*?\)/g, ' ').replace(/&/g, ' and ').replace(/[^a-z0-9 ]+/g, ' ').replace(/\b(inc|llc|ltd|corp|corporation|company|co|the|plc|holdings|group|usa|us|na)\b/g, ' ').replace(/\s+/g, ' ').trim(); }
/** The employer's public ATS board, from any ATS link on the row: { kind, key, ... } or null. */
function boardOf(p) {
  for (const k of ATS_URL_KEYS) {
    const u = String(p[k] == null ? '' : p[k]); let m;
    if ((m = u.match(/(?:boards|job-boards|boards-api)\.greenhouse\.io\/(?:v1\/boards\/)?([^/?#]+)\/jobs/i)) && m[1] !== 'embed') return { kind: 'greenhouse', key: 'greenhouse:' + m[1].toLowerCase(), board: m[1] };
    if ((m = u.match(/(?:jobs|api)\.lever\.co\/(?:v0\/postings\/)?([^/?#]+)\//i))) return { kind: 'lever', key: 'lever:' + m[1].toLowerCase(), board: m[1] };
    if ((m = u.match(/(?:jobs\.ashbyhq\.com|api\.ashbyhq\.com\/posting-api\/job-board)\/([^/?#]+)/i))) return { kind: 'ashby', key: 'ashby:' + m[1].toLowerCase(), board: m[1] };
    if ((m = u.match(/^https?:\/\/(([a-z0-9-]+)\.wd\d+\.myworkdayjobs\.com)\/(?:wday\/cxs\/[^/]+\/|[a-z]{2}-[A-Z]{2}\/)?([^/?#]+)\/job\//i)) && !/^wday$/i.test(m[3])) return { kind: 'workday', key: 'workday:' + m[1].toLowerCase() + '/' + m[3], host: m[1], tenant: m[2], site: m[3] };
  }
  return null;
}
/** List request for a board. Workday searches by the row's title words (POST); the others list every open posting. */
function boardListRequest(b, title) {
  if (b.kind === 'greenhouse') return { url: `https://boards-api.greenhouse.io/v1/boards/${b.board}/jobs?content=true`, method: 'GET' };
  if (b.kind === 'lever') return { url: `https://api.lever.co/v0/postings/${b.board}?mode=json`, method: 'GET' };
  if (b.kind === 'ashby') return { url: `https://api.ashbyhq.com/posting-api/job-board/${b.board}?includeCompensation=true`, method: 'GET' };
  if (b.kind === 'workday') {
    const words = String(title || '').replace(/[^A-Za-z ]+/g, ' ').split(/\s+/).filter(w => w.length > 3 && !/^(senior|director|manager|head|vice|president|lead)$/i.test(w)).slice(0, 3).join(' ');
    return { url: `https://${b.host}/wday/cxs/${b.tenant}/${b.site}/jobs`, method: 'POST', body: JSON.stringify({ appliedFacets: {}, limit: 20, offset: 0, searchText: words }) };
  }
  return null;
}
/** Board answer -> [{ title, location, state, pay, page, detail? }]; Workday rows carry a detail URL (pay is on the job page). */
function parseBoard(b, j) {
  const out = [];
  if (b.kind === 'greenhouse') (j && j.jobs || []).forEach(x => out.push({ title: x.title, location: x.location && x.location.name || '', pay: payFromText(strip(x.content)), page: x.absolute_url || '' }));
  if (b.kind === 'lever') (Array.isArray(j) ? j : []).forEach(x => { const s = x.salaryRange; const pay = s && s.min && s.max && (!s.interval || /year|annual/i.test(s.interval)) ? { low: +s.min, high: +s.max } : payFromText([x.descriptionPlain, x.additionalPlain].join(' ')); out.push({ title: x.text, location: x.categories && (x.categories.location || (x.categories.allLocations || []).join(', ')) || '', pay, page: x.hostedUrl || '' }); });
  if (b.kind === 'ashby') (j && j.jobs || []).forEach(x => { const c = x.compensation && (x.compensation.summaryComponents || []).find(k => /salary/i.test(k.compensationType || '') && /year/i.test(k.interval || 'year')); const pay = c && c.minValue && c.maxValue ? { low: +c.minValue, high: +c.maxValue } : payFromText(x.compensation && x.compensation.compensationTierSummary); out.push({ title: x.title, location: x.location || '', pay, page: x.jobUrl || '' }); });
  if (b.kind === 'workday') (j && j.jobPostings || []).forEach(x => out.push({ title: x.title, location: x.locationsText || '', pay: null, page: `https://${b.host}/${b.site}${x.externalPath || ''}`, detail: x.externalPath ? `https://${b.host}/wday/cxs/${b.tenant}/${b.site}${x.externalPath}` : '' }));
  out.forEach(x => { x.state = stateFrom(x.location); });
  return out;
}
/** Postings of the same employer that are the same kind of role (same level and function), with pay, transparency states first. */
function similarPostings(row, postings) {
  const L = level(row.TITLE), F = func(row.TITLE);
  return postings.filter(x => x.pay && x.state && comparable(row,x) && x.pay.low >= 40000)   // a posting with no US state (abroad, remote, unknown) is never a comparable
    .sort((a, b) => (PAY_TRANSPARENCY.indexOf(b.state) >= 0) - (PAY_TRANSPARENCY.indexOf(a.state) >= 0));
}
/** Step 1 estimate. comps: [{ title, state, pay, page, id? }]. ratio(fromState) -> BLS median(row state)/median(fromState) or null. */
function sameEmployerEstimate(row, comps, ratio, context) {
  // Revalidate here too: remembered/cache callers must not bypass title matching.
  const valid=comps.filter(c => comparable(row, c));
  const use = Context.select({...row,state:stateFrom(row.LOCATION)},valid.map(c=>({...c,co:c.co||row.COMPANY,low:c.pay.low,high:c.pay.high})),context||{}).slice(0, 5); if (!use.length) return null;
  const rowState = stateFrom(row.LOCATION), adj = [], notes = [];
  use.forEach(c => {
    let k = 1; if (c.state && rowState && c.state !== rowState) { const r = ratio && ratio(c.state); if (r) k = Math.min(1.1, Math.max(0.75, r)); }
    adj.push({ low: c.pay.low * k, high: c.pay.high * k, weight:c.weight });
    notes.push(`${c.title} (${c.state || 'location n/a'}) $${Math.round(c.pay.low / 1000)}K-$${Math.round(c.pay.high / 1000)}K` + (k !== 1 ? ` x${k.toFixed(2)} BLS state ratio` : ''));
  });
  const low = Math.round((context?Context.weightedMedian(adj,'low'):median(adj.map(a => a.low))) / 1000) * 1000, high = Math.round((context?Context.weightedMedian(adj,'high'):median(adj.map(a => a.high))) / 1000) * 1000;
  const mids = adj.map(a => (a.low + a.high) / 2), med = median(mids), tight = med > 0 && (Math.max(...mids) - Math.min(...mids)) / med <= 0.2;
  let conf = use.length >= 2 && tight ? 'HIGH' : use.length>=2 ? 'MED' : 'LOW';
  if(context)conf=Context.confidence({conf},use);
  return { low, high, mid: Math.round((low + high) / 2), conf, n: use.length, ids: use.map(c => c.id || c.page).filter(Boolean), source: 'SAME_EMPLOYER',
    modelVersion:context?Context.VERSION:null,basis: `same employer, ${use.length} posted range(s) for level ${level(row.TITLE)} ${func(row.TITLE)} roles: ` + notes.join('; ')+(context?'; '+Context.annotation(use):'') };
}
/** Master anchors from the same employer (step 1, no network). */
function sameEmployerAnchors(row, anchors) {
  const co = normCo(row.COMPANY), L = level(row.TITLE), F = func(row.TITLE);
  return co ? anchors.filter(a => a.id !== row.PRIMARY_ID && normCo(a.co) === co && comparable(row, a))
    .map(a => ({ id: a.id, co:a.co, title: a.title, location:a.location, asOf:a.asOf,sourceUrl:a.sourceUrl,state: a.state || '', pay: { low: a.low, high: a.high }, page: '' })) : [];
}
/* BLS OEWS (step 3). SOC by function; series OEU S <state FIPS>00000 000000 <SOC> <datatype>; 12 = P25, 13 = median, 15 = P90. */
const SOC = { QUALITY: '113051', MFG: '113051', OPS: '111021', ENG: '119041', PROGRAM: '111021', OTHER: '111021' };
function socOf(title) { return /supply chain|logistics|procurement|purchasing/i.test(title || '') ? '113071' : SOC[func(title)]; }
function blsSeries(state, soc, dt) { return STATE_FIPS[state] ? 'OEUS' + STATE_FIPS[state] + '00000' + '000000' + soc + dt : null; }
/** Cross-check: { flag, note, conf } given the estimate and the state's P25/median/P90 (numbers or null). */
function blsCheck(est, w) {
  if (!w || !w.p25 || !w.p90) return { flag: 'NO_BLS', note: 'BLS state wage n/a', conf: est.conf };
  const down = c => c === 'HIGH' ? 'MED' : 'LOW';
  if (est.mid > w.p90 * 1.5) return { flag: 'ABOVE', note: `BLS ${w.state} ${w.soc} P90 $${Math.round(w.p90 / 1000)}K: estimate is >1.5x P90`, conf: down(est.conf) };
  if (est.high < w.p25) return { flag: 'BELOW', note: `BLS ${w.state} ${w.soc} P25 $${Math.round(w.p25 / 1000)}K: estimate is below P25`, conf: down(est.conf) };
  return { flag: 'OK', note: `BLS ${w.state} ${w.soc} P25-P90 $${Math.round(w.p25 / 1000)}K-$${Math.round(w.p90 / 1000)}K`, conf: est.conf };
}


/** Required unanchored estimate (Tim 2026-10-28). When no employer or comparable anchors exist:
    Range = 30% to 110% of the BLS P25-P90 span:
      low  = P25 + 0.30*(P90-P25)
      high = P25 + 1.10*(P90-P25)
    If ML points are available, the range also spans those points.
    PAY_WORTH uses 75% of the resulting range. */
function blsEstimate(row, w, mlPoints) {
  if (!w || !w.p25 || !w.p90) return null;
  const span = w.p90 - w.p25;
  let low = w.p25 + 0.30 * span, high = w.p25 + 1.10 * span;
  const points = (mlPoints || []).filter(x => Number.isFinite(x) && x > 0);
  if (points.length) { low = Math.min(low, ...points); high = Math.max(high, ...points); }
  low = Math.round(low / 1000) * 1000; high = Math.round(high / 1000) * 1000;
  const scorePoint = Math.round(low + 0.75 * (high - low));
  const mlNote = points.length ? ` + ${points.length} ML point(s)` : '';
  return {
    low, high, mid: scorePoint, conf: 'LOW', n: points.length, close: false, tight: false, ids: [],
    source: points.length ? 'BLS_ML_RANGE' : 'BLS_OEWS',
    basis: `BLS OEWS ${w.state} SOC ${w.soc} 30-110% of P25-P90 $${Math.round(w.p25/1000)}K-$${Math.round(w.p90/1000)}K${mlNote} (no anchors; required)`
  };
}

module.exports = { stateFrom, normCo, boardOf, boardListRequest, parseBoard, similarPostings, sameEmployerEstimate, sameEmployerAnchors, socOf, blsSeries, blsCheck, blsEstimate, PAY_TRANSPARENCY, aggregatorFor, atsFor, ATS_URL_KEYS, level, func, regionOf, payFromText, degreeFromText, atsApi, parseAts, postedAnchor, estimate, num , aggregatorPage, parseAggregator, looksLikePosting };
module.exports.comparable = comparable; module.exports.invalidSavedAnchors = invalidSavedAnchors;
