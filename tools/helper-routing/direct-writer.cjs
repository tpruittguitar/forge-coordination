'use strict';
// Offline syntax validation only. Source truth, current rows, ownership and
// request-outcome reconciliation remain producer/Writer obligations.
const fs = require('node:fs');
const KEYS = new Set(['DEGREE_TEXT','DEGREE_REQ','DEGREE_EVIDENCE_URL','DEGREE_ASOF','REQUIREMENTS_REVIEWED',
  'SOURCE_URL','COMPANY_SOURCE_URL','FIT_EVIDENCE','FIT_BASIS','FIT_ASOF','FIT_CONF',
  'SALARY_BASE_LOW','SALARY_BASE_HIGH','SALARY_MIDPOINT','SALARY_BASIS','SALARY_SOURCE','SALARY_ASOF','SALARY_CONF']);
const id = value => typeof value === 'string' && /^FORGE-GROK-[A-Za-z0-9_-]{3,130}$/.test(value);
const object = value => !!value && typeof value === 'object' && !Array.isArray(value);
function exact(value, keys, reason) {
  if (!object(value) || Object.keys(value).some(k => !keys.includes(k))) throw Error(reason);
}
function validate(payload) {
  exact(payload, ['action','requestId','requests'], 'EXACT_WRITER_BATCH_REQUIRED');
  if(payload.action !== 'batch' || !id(payload.requestId) || !Array.isArray(payload.requests) ||
    payload.requests.length < 1 || payload.requests.length > 25) throw Error('GROK_ENRICH_BATCH_REQUIRED');
  const ids = new Set([payload.requestId]), rows = new Set();
  for (const request of payload.requests) {
    exact(request, ['action','ruling'], 'EXACT_RULING_REQUIRED');
    exact(request.ruling, ['requestId','primaryId','kind','actor','fields'], 'EXACT_ENRICH_RULING_REQUIRED');
    const r = request.ruling;
    if(request.action !== 'ruling' || r.kind !== 'ENRICH' || r.actor !== 'GROK' || !id(r.requestId) ||
      !/^V2[A-Z]-[A-Za-z0-9_-]+$/.test(r.primaryId || '')) throw Error('GROK_ENRICH_RULING_REQUIRED');
    if(ids.has(r.requestId) || rows.has(r.primaryId)) throw Error('DUPLICATE_REQUEST_OR_ROW');
    ids.add(r.requestId); rows.add(r.primaryId);
    if(!object(r.fields) || !Object.keys(r.fields).length) throw Error('NONEMPTY_RAW_FIELDS_REQUIRED');
    for (const [key, value] of Object.entries(r.fields)) {
      if(!KEYS.has(key)) throw Error('UNSUPPORTED_OR_PROTECTED_FIELD');
      if(!['string','number'].includes(typeof value) || typeof value === 'number' && !Number.isFinite(value) ||
        typeof value === 'string' && (value.includes('[object Object]') || !value.trim() || value.length > (key === 'DEGREE_TEXT' ? 12000 : 1500))) throw Error('INVALID_FIELD_VALUE');
      if(!key.startsWith('SALARY_BASE_') && key!=='SALARY_MIDPOINT' && typeof value!=='string')throw Error('PLAIN_TEXT_FIELD_REQUIRED');
      if(key.endsWith('_ASOF') && !/^\d{4}-\d{2}-\d{2}$/.test(value))throw Error('DATE_REQUIRED');
      if(key.endsWith('_URL') && !/^https:\/\/[^\s]+$/.test(value)) throw Error('EXACT_SOURCE_URL_REQUIRED');
    }
    if(Object.keys(r.fields).some(k=>k.startsWith('FIT_')) &&
      (!['FIT_EVIDENCE','FIT_BASIS','FIT_ASOF','FIT_CONF'].every(k=>typeof r.fields[k]==='string'&&r.fields[k].trim()) || r.fields.FIT_CONF!=='LOW'))throw Error('COMPLETE_OBSERVED_FIT_EVIDENCE_REQUIRED');
  }
  return {schema:'forge.grok-direct-writer-preflight.v1',status:'SYNTAX_VALID',requests:payload.requests.length,
    sourceVerified:false,ownershipVerified:false,originalRequestsReconciled:false,writerSubmitted:false,canonicalVerified:false};
}
if(require.main === module) {
  try {
    if(process.argv.length !== 4 || process.argv[2] !== 'validate') throw Error('Use validate <exact-writer-json-file>');
    const raw = fs.readFileSync(process.argv[3]);
    if(raw.length > 2000000) throw Error('WRITER_ARTIFACT_TOO_LARGE');
    console.log(JSON.stringify(validate(JSON.parse(new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(raw)))));
  } catch(e) { console.error(e.message); process.exitCode = 1; }
}
// Fresh exact field observation required. Missing compact/externalized fields are
// UNKNOWN, not blank. Metadata-only refreshes are not useful write progress.
const META = new Set(['DEGREE_ASOF','SALARY_ASOF','FIT_ASOF','SALARY_CONF','FIT_CONF','REQUIREMENTS_REVIEWED']);
const normalize=value=>String(value??'').replace(/\s+/g,' ').replace(/; /g,', ').replace(/ \| /g,' / ').trim();
const missing=value=>value==null||['','UNKNOWN','NOT_STATED','NOT_AVAILABLE','N/A','NONE'].includes(normalize(value).toUpperCase());
function novelFields(proposed, observed) {
  if(!object(proposed)||!object(observed))throw Error('CURRENT_FIELD_OBSERVATION_REQUIRED');
  const out={};
  for(const [key,value] of Object.entries(proposed)) {
    if(!KEYS.has(key))throw Error('UNSUPPORTED_OR_PROTECTED_FIELD');
    if(!Object.hasOwn(observed,key))throw Error('CURRENT_FIELD_UNKNOWN');
    const before=observed[key];
    if(normalize(before)===normalize(value))continue;
    if(!META.has(key)&&!missing(before))throw Error('CURRENT_VALUE_CONFLICT');
    out[key]=value;
  }
  if(!Object.keys(out).some(k=>!META.has(k)))return {};
  if(Object.keys(out).some(k=>k==='FIT_EVIDENCE'||k==='FIT_BASIS')) {
    for(const key of ['FIT_EVIDENCE','FIT_BASIS','FIT_ASOF','FIT_CONF']) {
      if(!Object.hasOwn(proposed,key))throw Error('COMPLETE_OBSERVED_FIT_EVIDENCE_REQUIRED');
      out[key]=proposed[key];
    }
  }
  return out;
}
module.exports = {validate,novelFields};
