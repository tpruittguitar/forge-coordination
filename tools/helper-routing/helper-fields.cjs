'use strict';
// Job-text fields a helper lane may propose for a master row (Tim, Nov 20 2026:
// "The writer should be capable of filling all required fields except those that
// come from the app or code built in.").
//
// A helper proposes raw facts only. Every value needs an exact, unshortened quote
// from the posting. The programmed coordinator re-reads the posting and checks each
// quote again before anything reaches the Writer. Scores and other calculated
// columns stay with the Writer and code (COMPUTED below), and bookkeeping/identity
// columns stay with the Writer (PROTECTED below).

// Field groups. One quote in sourceEvidence.fieldQuotes[GROUP] backs every field in
// its group.
const GROUPS = {
 DEGREE: ['DEGREE_TEXT','DEGREE_REQ'],
 SALARY: ['SALARY_BASE_LOW','SALARY_BASE_HIGH','SALARY_BASIS'],
 WORK_ARRANGEMENT: ['WORK_ARRANGEMENT','REMOTE_HYBRID'],
 REQ_ID: ['REQ_ID'],
 POSTING_DATE: ['POSTING_DATE'],
 CLIENT_EMPLOYER: ['CLIENT_EMPLOYER']
};
// LOCATION_NOTE and *_QUOTE/*_NOTE keys are Writer evidence keys: the Writer moves them
// to the evidence file, so they are not master fields and are not accepted here.
// Links are accepted in a return but always rebuilt by code from the verified posting.
const URL_FIELDS = ['SOURCE_URL','COMPANY_SOURCE_URL','DEGREE_EVIDENCE_URL','SALARY_SOURCE'];
// The eight fields helpers could already send. Degree and salary keep working without
// fieldQuotes (code re-derives them from the posting); new groups always need a quote.
const LEGACY = new Set(['DEGREE_TEXT','DEGREE_REQ','DEGREE_EVIDENCE_URL','SALARY_BASE_LOW','SALARY_BASE_HIGH','SALARY_BASIS','SALARY_SOURCE','SOURCE_URL']);
const FIELDS = new Set([...URL_FIELDS,...Object.values(GROUPS).flat()]);
const GROUP_OF = Object.fromEntries(Object.entries(GROUPS).flatMap(([g,keys])=>keys.map(k=>[k,g])));
// Writer or code computes these. Helpers never submit them.
const COMPUTED = ['OVERALL','OVERALL_RATING','GEO','GEO_SCORE','NET_COMP','NET_COMP_SCORE','EXPERIENCE_FIT','RATING_CONFIDENCE',
 'FLEX_RATING_IMPACT','PAY_WORTH','PAY_WORTH_BASIS','FLEX_CLASS','FLEX_MODIFIER','ADJUSTED_FIT','PURSUIT_STATUS','SALARY_MIDPOINT',
 'SALARY_SCORE_POINT','FLOOR_STATUS','FLOOR_BASIS','SCOPE_FIT_RAW','FIT_EVIDENCE','FIT_BASIS','FIT_ASOF','FIT_CONF','LATITUDE','LONGITUDE',
 'GEOCODE_SOURCE','GEOCODE_STATUS','GEOCODE_ASOF','SALARY_ASOF','SALARY_CONF','DEGREE_ASOF','REQUIREMENTS_REVIEWED','SCORING_MODEL_REF',
 'RULES_POLICY_VERSION','OWNERSHIP_POLICY_VERSION'];
// Writer bookkeeping, identity columns and Tim-owned state. Never a helper field.
const PROTECTED = ['PRIMARY_ID','COMPANY','TITLE','LOCATION','REQ','BUCKET','DISPOSITION','STATE_SOURCE','STATE_UPDATED_AT','ENRICH_SOURCE',
 'ENRICH_UPDATED_AT','IDENTITY_SOURCE','IDENTITY_UPDATED_AT','INITIATING_URL','EVIDENCE_REF','ANTI_RESURRECTION','POSTING_STATE','TIM_*','APP_*',
 'DECLINE_REASON_*','REJECTION_*'];

// The quote must state how the job itself is worked, not merely contain the word
// ("Remote Operations Center", "hybrid vehicle"), and must not negate it
// ("not eligible for remote work"). Real postings, Nov 20 2026.
const MODE = {REMOTE:'remote(?:ly)?', HYBRID:'hybrid', ONSITE:'on[- ]?site|in[- ](?:office|person)'};
const JOB = '(?:position|role|job|workplace|work type|work mode|work|working|employee|candidate|schedule|arrangement|model|environment|opportunit\w*|days?|week|located|location|based|eligible|option)';
// After "position is onsite", the mode word must end the statement or lead into how or where the
// job is worked. "with on-site Data Center Operations" or "Remote Operations Center" names another
// team or place and does not state this job's mode. Real postings, Nov 20 2026.
const FOLLOW = `(?=\\s*(?:$|[.,;:!?()\\[\\]*|•·\\-–—]|\\d|(?:in|at|from|for|on|only|required|requiring|basis|status|presence|daily|full[- ]time|one|two|three|four|five|monday|each|every|per|and\\s+(?:requires?|will|is|must|may|includes?))\\b|${JOB}\\b))`;
const WORK = Object.fromEntries(Object.entries(MODE).map(([k,m]) => [k, new RegExp(
 `(?:^|[|•·;:(\\[-])\\s*\\**\\s*(?:${m})\\s*\\**\\s*(?:$|[|•·;()\\]])`+            // a label: "| On-site |", "Remote"
 `|\\b(?:fully|100%|primarily|mostly)\\s+(?:${m})\\b`+                          // "fully remote"
 `|\\b(?:${m})[- ](?:first|based|eligible|friendly|${JOB})\\b`+                // "remote role", "hybrid schedule"
 `|\\b${JOB}\\b[^.!?\\n]{0,60}?\\b(?:${m})\\b${FOLLOW}`+                                 // "position is onsite"
 `|\\b(?:work(?:ing)? from home|wfh)\\b`.repeat(k==='REMOTE'?1:0), 'i')]));
const NEGATED = Object.fromEntries(Object.entries(MODE).map(([k,m]) => [k, new RegExp(`\\b(?:not|no|non|never|isn't|is not|ineligible|cannot|can't|without)\\b[^.!?\\n]{0,40}?\\b(?:${m})\\b|\\bnon[- ](?:${m})\\b`, 'i')]));
// Commas also separate labels ("Austin, TX, Remote"), but only in a short line; in a long
// sentence "manned, remote, and autonomous operation" is a list, not the job's mode.
const LISTED = Object.fromEntries(Object.entries(MODE).map(([k,m]) => [k, new RegExp(`(?:^|,)\\s*\\**\\s*(?:${m})\\s*\\**\\s*(?:$|[,()])`, 'i')]));
// "Remote work with select days in the office" or "Hybrid remote" is hybrid, not remote; a quote
// that mentions hybrid does not prove a fully on-site or fully remote job.
const NOT_FULLY_REMOTE = /\b(?:days?|time)\b[^.!?\n]{0,30}?\bin[- ](?:the\s+)?office\b/i;
// "Remote work not considered", "unable to consider ... for remote work".
const NEGATED_AFTER = Object.fromEntries(Object.entries(MODE).map(([k,m]) => [k, new RegExp(`\\b(?:${m})\\b[^.!?\\n]{0,40}?\\b(?:not|isn't|unable)\\b|\\bunable\\b[^.!?\\n]{0,80}?\\b(?:${m})\\b`, 'i')]));
// "may be onsite, remotely, or in a hybrid arrangement" lists options; it settles nothing.
const ANY_MODE = Object.fromEntries(Object.entries(MODE).map(([k,m]) => [k, new RegExp(`\\b(?:${m})\\b`, 'i')]));
const options = s => /\bor\b/i.test(s) && Object.values(ANY_MODE).filter(r => r.test(s)).length > 1;
const statesMode = (q, v) => { const s = String(q);
 return (WORK[v].test(s) || s.length <= 120 && LISTED[v].test(s)) && !NEGATED[v].test(s) && !NEGATED_AFTER[v].test(s) && !options(s)
  && !(v !== 'HYBRID' && /\bhybrid\b/i.test(s)) && !(v === 'REMOTE' && NOT_FULLY_REMOTE.test(s)); };
const MONTHS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
const literal = s => String(s||'').normalize('NFKC').replace(/\s+/g,' ').trim();
const shortened = s => /\.\.\.|…/.test(String(s));
const truncatedText = s => /(?:\.\.\.|…)\s*$|\b(?:show|see|read) more\s*$/i.test(String(s||'').trim());
const text = v => typeof v === 'string' && v.trim().length > 0;
function fail(code, group, key){ return Error(code+(key?': '+key:group?': '+group:'')); }

function amount(v){ const n = typeof v === 'number' ? v : typeof v === 'string' && /^\s*\d[\d,]*(?:\.\d+)?\s*$/.test(v) ? Number(v.replace(/,/g,'')) : NaN; return Number.isFinite(n) ? n : NaN; }
// The quote must show the figure itself: 150000, 150,000 or 150K.
function amountIn(quote, n){
 const q = String(quote).toLowerCase().replace(/(\d),(?=\d{3}\b)/g,'$1').replace(/\s+/g,'');
 const forms = [String(n)];
 if (n % 1000 === 0) forms.push(String(n/1000)+'k');
 if (n % 100 === 0 && n % 1000 !== 0) forms.push(String(n/1000)+'k');
 return forms.some(f => new RegExp('(^|[^0-9.])'+f.replace('.','\\.')+'(?![0-9])').test(q));
}
// The quote must show the same calendar day as the value (no relative "3 days ago").
function dateIn(quote, iso){
 const [y,m,d] = iso.split('-').map(Number), q = String(quote);
 if (q.includes(iso)) return true;
 for (const x of q.matchAll(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g)) if (+x[1]===m && +x[2]===d && +x[3]===y) return true;
 for (const x of q.matchAll(/\b([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/g)) if (MONTHS.indexOf(x[1].slice(0,3).toLowerCase())+1===m && +x[2]===d && +x[3]===y) return true;
 for (const x of q.matchAll(/\b(\d{1,2})\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})\b/g)) if (MONTHS.indexOf(x[2].slice(0,3).toLowerCase())+1===m && +x[1]===d && +x[3]===y) return true;
 return false;
}
// A high school diploma or GED is not a degree (Tim's standing rule).
function highSchoolOnly(s){
 const t = String(s||'');
 return /\bhigh school\b|\bGED\b|\bsecondary school\b|\bdiploma\b/i.test(t) &&
  !/\b(?:bachelor|master|associate'?s?\s+degree|mba|ph\.?\s?d|b\.?\s?[sa]\.?\b|m\.?\s?s\.?\b|college degree|university degree|four[- ]year degree|4[- ]year degree|engineering degree|technical degree|graduate degree|undergraduate degree)/i.test(t);
}

// Envelope check for one returned item. `capture` is the helper's verbatim text when
// it sent one. Throws on the first broken rule; returns the groups the item proposes.
function check(e, {capture=null} = {}){
 const raw = e.proposedRawFields || {}, quotes = e.fieldQuotes;
 if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw fail('HELPER_PROTECTED_FIELDS_FORBIDDEN');
 for (const k of Object.keys(raw)) if (!FIELDS.has(k)) throw fail('HELPER_PROTECTED_FIELDS_FORBIDDEN', null, k);
 if (quotes !== undefined && (!quotes || typeof quotes !== 'object' || Array.isArray(quotes))) throw fail('HELPER_FIELD_QUOTES_INVALID');
 for (const [g,q] of Object.entries(quotes||{})) {
  if (!GROUPS[g]) throw fail('HELPER_FIELD_QUOTE_UNKNOWN_GROUP', g);
  if (!text(q) || q.length > (g==='DEGREE' ? 12000 : 1500)) throw fail('HELPER_FIELD_QUOTE_INVALID', g);
  if (shortened(q)) throw fail('HELPER_FIELD_QUOTE_SHORTENED', g);
  if (capture != null && !literal(capture).includes(literal(q))) throw fail('HELPER_FIELD_QUOTE_NOT_IN_CAPTURE', g);
 }
 const groups = [...new Set(Object.keys(raw).map(k => GROUP_OF[k]).filter(Boolean))];
 for (const k of URL_FIELDS) if (Object.hasOwn(raw,k) && !(typeof raw[k]==='string' && /^https:\/\/\S+$/.test(raw[k]))) throw fail('EXACT_SOURCE_URL_REQUIRED', null, k);
 for (const g of groups) {
  const q = quotes?.[g];
  if (!q && !GROUPS[g].every(k => LEGACY.has(k))) throw fail('HELPER_FIELD_QUOTE_REQUIRED', g);
  if (q) values(g, raw, q, e, {capture}); else legacy(g, raw);
 }
 return groups;
}
// Degree and salary sent the old way (no fieldQuotes). Code re-derives both from the
// posting, so only the plain value rules apply here.
function legacy(g, raw){
 if (g === 'DEGREE') {
  if (raw.DEGREE_REQ !== undefined && !['REQUIRED','PREFERRED','NOT_STATED'].includes(raw.DEGREE_REQ)) throw fail('DEGREE_REQ_INVALID');
  if (raw.DEGREE_TEXT !== undefined && (!text(raw.DEGREE_TEXT) || raw.DEGREE_TEXT.length > 12000)) throw fail('INVALID_FIELD_VALUE', null, 'DEGREE_TEXT');
  if (raw.DEGREE_TEXT !== undefined && shortened(raw.DEGREE_TEXT)) throw fail('HELPER_FIELD_QUOTE_SHORTENED', g);
  return;
 }
 if (raw.SALARY_BASIS !== undefined && raw.SALARY_BASIS !== 'EMPLOYER_POSTED') throw fail('HELPER_SALARY_MUST_BE_EMPLOYER_POSTED');
 const has = ['SALARY_BASE_LOW','SALARY_BASE_HIGH'].filter(k => Object.hasOwn(raw,k));
 if (has.length === 1) throw fail('SALARY_LOW_AND_HIGH_REQUIRED');
 if (has.length) {
  const low = amount(raw.SALARY_BASE_LOW), high = amount(raw.SALARY_BASE_HIGH);
  if (!(low > 0) || !(high > 0)) throw fail('SALARY_ZERO_OR_INVALID');
  if (low > high) throw fail('SALARY_RANGE_INVERTED');
 }
}
// Value rules shared by the envelope check and the coordinator's posting check.
// `body` is the full posting text when known (capture or verified description).
function values(g, raw, q, e, {capture=null, body=null, fullPosting=null} = {}){
 const page = body ?? capture;
 if (g === 'DEGREE') {
  const req = raw.DEGREE_REQ, deg = raw.DEGREE_TEXT;
  if (req !== undefined && !['REQUIRED','PREFERRED','NOT_STATED'].includes(req)) throw fail('DEGREE_REQ_INVALID');
  if (deg !== undefined && (!text(deg) || deg.length > 12000)) throw fail('INVALID_FIELD_VALUE', null, 'DEGREE_TEXT');
  if (deg !== undefined && shortened(deg)) throw fail('HELPER_FIELD_QUOTE_SHORTENED', g);
  if (req === 'NOT_STATED' || deg === 'NOT_STATED') {
   if (req !== 'NOT_STATED' || deg !== undefined && deg !== 'NOT_STATED') throw fail('DEGREE_NOT_STATED_MISMATCH');
   // "Not stated" only after reading the whole posting; a cut-off page proves nothing.
   if (e.fullPostingRead !== true || fullPosting === false || page != null && truncatedText(page)) throw fail('NOT_STATED_REQUIRES_FULL_POSTING');
   return;
  }
  if (req !== undefined && deg === undefined) throw fail('DEGREE_TEXT_REQUIRED');
  if (highSchoolOnly(deg) || q && highSchoolOnly(q) && !/\bdegree\b/i.test(deg)) throw fail('HIGH_SCHOOL_IS_NOT_A_DEGREE');
  if (q && !literal(q).includes(literal(deg)) && !literal(deg).includes(literal(q))) throw fail('DEGREE_TEXT_NOT_IN_QUOTE');
  if (page != null && !literal(page).includes(literal(deg))) throw fail('DEGREE_TEXT_NOT_VERBATIM');
  return;
 }
 if (g === 'SALARY') {
  const has = ['SALARY_BASE_LOW','SALARY_BASE_HIGH'].filter(k => Object.hasOwn(raw,k));
  if (has.length === 1) throw fail('SALARY_LOW_AND_HIGH_REQUIRED');
  if (raw.SALARY_BASIS !== undefined && raw.SALARY_BASIS !== 'EMPLOYER_POSTED') throw fail('HELPER_SALARY_MUST_BE_EMPLOYER_POSTED');
  if (!has.length) { if (raw.SALARY_BASIS !== undefined) throw fail('SALARY_LOW_AND_HIGH_REQUIRED'); return; }
  const low = amount(raw.SALARY_BASE_LOW), high = amount(raw.SALARY_BASE_HIGH);
  if (!(low > 0) || !(high > 0)) throw fail('SALARY_ZERO_OR_INVALID');
  if (low > high) throw fail('SALARY_RANGE_INVERTED');
  if (q) {
   if (!amountIn(q,low) || !amountIn(q,high)) throw fail('SALARY_NOT_IN_QUOTE');
   if (/\b(?:per hour|hourly|an hour|\/\s*hr)\b/i.test(q)) throw fail('SALARY_NOT_ANNUAL_BASE');
  }
  return;
 }
 if (g === 'WORK_ARRANGEMENT') {
  const vals = ['WORK_ARRANGEMENT','REMOTE_HYBRID'].filter(k => Object.hasOwn(raw,k)).map(k => raw[k]);
  for (const v of vals) if (!Object.hasOwn(WORK, v)) throw fail('WORK_ARRANGEMENT_INVALID');
  if (new Set(vals).size > 1) throw fail('WORK_ARRANGEMENT_CONFLICT');
  if (!statesMode(q, vals[0])) throw fail('WORK_ARRANGEMENT_NOT_IN_QUOTE');
  return;
 }
 if (g === 'REQ_ID') {
  const v = raw.REQ_ID;
  if (!text(v) || v.length > 80 || !/^[A-Za-z0-9][A-Za-z0-9._\/-]*$/.test(v)) throw fail('REQ_ID_INVALID');
  if (!literal(q).includes(v)) throw fail('REQ_ID_NOT_IN_QUOTE');
  return;
 }
 if (g === 'POSTING_DATE') {
  const v = raw.POSTING_DATE;
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v) || new Date(v+'T00:00:00Z').toISOString().slice(0,10) !== v) throw fail('POSTING_DATE_INVALID');
  const seen = Date.parse(e.observedAt);
  if (Number.isFinite(seen) && Date.parse(v+'T00:00:00Z') > seen + 86400000) throw fail('POSTING_DATE_IN_FUTURE');
  if (!dateIn(q, v)) throw fail('POSTING_DATE_NOT_IN_QUOTE');
  return;
 }
 if (g === 'CLIENT_EMPLOYER') {
  const v = raw.CLIENT_EMPLOYER;
  if (!text(v) || v.length > 200) throw fail('CLIENT_EMPLOYER_INVALID');
  if (!literal(q).toLowerCase().includes(literal(v).toLowerCase())) throw fail('CLIENT_EMPLOYER_NOT_IN_QUOTE');
  return;
 }
}

// Coordinator side: the posting was fetched and identity-checked by code. Each quote
// must be in that posting's own text. Returns the raw helper facts that survive; code
// adds links, dates and confidence from the verified source.
function verified(e, source){
 const raw = e?.proposedRawFields || {}, quotes = e?.fieldQuotes || {}, body = source.description;
 if (!text(body)) return {};
 const fullPosting = source.sourceCaptured ? source.fullPosting === true : true, out = {};
 for (const g of Object.keys(GROUPS)) {
  if (!GROUPS[g].some(k => Object.hasOwn(raw,k))) continue;
  const q = quotes[g];
  if (!q) continue;   // legacy degree/salary without a quote: code derives its own
  if (shortened(q)) throw fail('HELPER_FIELD_QUOTE_SHORTENED', g);
  if (!literal(body).includes(literal(q))) throw fail('HELPER_FIELD_QUOTE_NOT_IN_POSTING', g);
  // A value the quote does not support drops only its own group; the item's other facts still count.
  try { values(g, raw, q, e, {body, fullPosting}); } catch (err) { if (/^HELPER_FIELD_QUOTE/.test(err.message)) throw err; continue; }
  for (const k of GROUPS[g]) if (Object.hasOwn(raw,k)) out[k] = raw[k];
  out[g+'__QUOTE'] = literal(q);
 }
 if (out.SALARY_BASE_LOW !== undefined) { out.SALARY_BASE_LOW = amount(out.SALARY_BASE_LOW); out.SALARY_BASE_HIGH = amount(out.SALARY_BASE_HIGH); }
 if (out.DEGREE_REQ === 'NOT_STATED') out.DEGREE_TEXT = 'NOT_STATED';
 return out;
}

module.exports = {GROUPS, URL_FIELDS, LEGACY, FIELDS, COMPUTED, PROTECTED, GROUP_OF, check, values, legacy, statesMode, verified, highSchoolOnly, amountIn, dateIn, truncatedText};
