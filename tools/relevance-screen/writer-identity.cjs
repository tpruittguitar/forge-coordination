'use strict';
// Source: foreman-cockpit commit ed9235670867c41da4c71718ff8abf09d9116def.
// Credential-free copy of foreman-cockpit Code.gs identity/sanitizer contract.
// The parity test compares these exact pure definitions with the Writer checkout.
// PipelinePolicy remains the shared policy module; never import Writer runtime.
function createIdentity(PipelinePolicy){
function clean_(v) { return String(v == null ? '' : v).replace(/[\r\n]+/g, ' ').replace(/; /g, ', ').replace(/ \| /g, ' / ').trim(); }
function normEmployer(s) {
  s = String(s || '').toLowerCase().split(' / ')[0].split(' (')[0];
  s = s.replace(/&/g, ' and ').replace(/[^a-z0-9 ]+/g, ' ').replace(/\b(inc|llc|l l c|corp|corporation|co|company|ltd|limited|plc|group|holdings|the|careers)\b/g, ' ').replace(/\s+/g, ' ').trim();
  return s;
}
function normTitle(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\bsr\b/g, 'senior').replace(/\bjr\b/g, 'junior').replace(/\b(the|of|and|a|an)\b/g, ' ').replace(/\s+/g, ' ').trim(); }
var US_STATE_ABBR_ = {alabama:'al',alaska:'ak',arizona:'az',arkansas:'ar',california:'ca',colorado:'co',connecticut:'ct',delaware:'de',florida:'fl',georgia:'ga',hawaii:'hi',idaho:'id',illinois:'il',indiana:'in',iowa:'ia',kansas:'ks',kentucky:'ky',louisiana:'la',maine:'me',maryland:'md',massachusetts:'ma',michigan:'mi',minnesota:'mn',mississippi:'ms',missouri:'mo',montana:'mt',nebraska:'ne',nevada:'nv','new hampshire':'nh','new jersey':'nj','new mexico':'nm','new york':'ny','north carolina':'nc','north dakota':'nd',ohio:'oh',oklahoma:'ok',oregon:'or',pennsylvania:'pa','rhode island':'ri','south carolina':'sc','south dakota':'sd',tennessee:'tn',texas:'tx',utah:'ut',vermont:'vt',virginia:'va',washington:'wa','west virginia':'wv',wisconsin:'wi',wyoming:'wy'};
// Full state names become postal codes so "Costa Mesa, California, United States" and "Costa Mesa, CA" compare equal (2026-10-13).
function normLocation(s) { s = String(s || '').toLowerCase(); if (!s || /not_stated|not stated|unknown|^-$/.test(s)) return ''; s = s.replace(/\b(metropolitan area|metro area|area|united states|usa|us)\b/g, ' ').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim(); return s.replace(/\b(new hampshire|new jersey|new mexico|new york|north carolina|north dakota|rhode island|south carolina|south dakota|west virginia|[a-z]+)$/, function (m) { return US_STATE_ABBR_[m] || m; }); }
var INTAKE_FACT_KEYS = ['PAY_POSTED', 'SALARY_BASE_POSTED', 'SALARY_BASE_EST', 'SALARY_BASIS', 'SALARY_CONF', 'SALARY_SOURCE', 'SALARY_ASOF', 'SALARY_NOTE', 'SALARY_BASE_LOW', 'SALARY_BASE_HIGH', 'SALARY_MIDPOINT', 'SALARY_SCORE_POINT', 'DEGREE_TEXT', 'FLEX_HINT', 'FLEX_CLASS', 'FLEX_BASIS', 'REPORTING_LEVEL', 'EMPLOYER_DOMAIN_HINT', 'SCOUT_NOTES', 'POSTING_DATE', 'REMOTE_HYBRID'];
function sanitizeRecord(rec) {
  var out = {}; if (!rec || typeof rec !== 'object') return null;
  ['INTAKE_KEY', 'COMPANY', 'TITLE', 'LOCATION', 'REQ_ID', 'SOURCE', 'SOURCE_URL', 'INITIATING_URL', 'COMPANY_SOURCE_URL', 'SOURCE_PROVIDER', 'DISCOVERY_SOURCE', 'DISCOVERED_AT_ET', 'IDENTITY_CONFIDENCE', 'PROPOSED_BUCKET', 'EMPLOYER_ALIASES', 'EMPLOYER_RELATIONSHIP_EVIDENCE', 'EMPLOYER_RELATIONSHIP_URL', 'EMPLOYER_PRIMARY_BUSINESS', 'IDENTITY_SITE_SOURCE_URL', 'IDENTITY_SITE_VALUE', 'IDENTITY_SITE_EVIDENCE', 'IDENTITY_SITE_MODE', 'OPERATING_SCOPE', 'OPERATING_SCOPE_SOURCE_URL', 'OPERATING_SCOPE_EVIDENCE', 'IDENTITY_PRIOR_SCOPE_EVIDENCE', 'NEVER_CONSIDER_RULE_ID', 'NEVER_CONSIDER_REASON', 'EXCLUSION_CONFIDENCE', 'EXCLUSION_REASON'].concat(INTAKE_FACT_KEYS).forEach(function (k) { if (rec[k] !== undefined && rec[k] !== null) out[k] = clean_(rec[k]).slice(0,k==='DEGREE_TEXT'?12000:400); });
  var unk = rec.INITIAL_UNKNOWN_FIELDS; out.INITIAL_UNKNOWN_FIELDS = Array.isArray(unk) ? unk.map(clean_).filter(Boolean).join(',') : clean_(unk || '');
  out.SOURCE_URL=PipelinePolicy.links(out).preferred;
  if (out.SOURCE_URL && !/^https?:\/\//i.test(out.SOURCE_URL)) out.SOURCE_URL = '';
  if (out.SOURCE && !out.DISCOVERY_SOURCE) out.DISCOVERY_SOURCE = out.SOURCE;
  return out;
}

return {normEmployer,normTitle,normLocation,sanitizeRecord};
}
module.exports={createIdentity};
