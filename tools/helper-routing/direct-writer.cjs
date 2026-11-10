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
        typeof value === 'string' && (!value.trim() || value.length > (key === 'DEGREE_TEXT' ? 12000 : 20000))) throw Error('INVALID_FIELD_VALUE');
      if(key.endsWith('_URL') && !/^https:\/\/[^\s]+$/.test(value)) throw Error('EXACT_SOURCE_URL_REQUIRED');
    }
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
module.exports = {validate};
