'use strict';
// Read-only discovery identity. This is NOT Writer-result or mutation verification.
const crypto = require('node:crypto');
const P = require('../enrich-ats-pay/lib');
const norm = value => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const TITLE_WORDS = {sr:'senior',jr:'junior',mgr:'manager',dir:'director',vp:'vice president',svp:'senior vice president',evp:'executive vice president',mfg:'manufacturing',ops:'operations',asst:'assistant',assoc:'associate',dept:'department'};
const normTitle = value => norm(value).replace(/\b(s|e) v p\b/g, (_, prefix) => prefix === 's' ? 'senior vice president' : 'executive vice president').replace(/\bv p\b/g, 'vice president').replace(/\b[a-z]+\b/g, word => TITLE_WORDS[word] || word);
function normCompany(value) {
 let text = norm(String(value || '').replace(/\s*\((?:formerly|previously|fka)\b[^)]*\)/gi, '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/&/g, ' and ')).replace(/^the\s+/, '');
 // Remove only trailing business suffixes, never parenthetical divisions or words in the name.
 for (;;) { const next = text.replace(/\s+(?:inc|incorporated|llc|ltd|limited|corp|corporation|company|co|plc|holdings|group|usa|us|na)$/, '').trim(); if (next === text) return text; text = next; }
}
const unknown = value => !norm(value) || /^(?:unknown|uncaptured|unverified|unresolved|not captured|not available|not provided|not specified|not disclosed|none|n a|na|tbd|unspecified|0)$/i.test(norm(value));
const REQ_FIELDS = ['REQ', 'REQ_ID', 'REQUISITION_ID', 'ATS_REQ_ID', 'JOB_ID'];
// Only job-identity fields, never salary anchors or review/comparable evidence URLs.
const URL_FIELDS = ['SOURCE_URL', 'INITIATING_URL', 'COMPANY_SOURCE_URL', 'CANONICAL_URL', 'JOB_URL', 'ATS_POSTING_URL', 'DIRECT_JOB_URL', 'LINKEDIN_URL', 'INTAKE_SOURCE_URL', 'MANUAL_INTAKE_URL', 'SOURCE'];
const EVIDENCE_FIELDS=[...URL_FIELDS,...REQ_FIELDS,'url','sourceUrl','source_url','postingUrl','reqId','requisitionId','REMOTE_HYBRID','workArrangement','workMode','OPERATING_SCOPE','operatingScope','LOCATION_SCOPE','worksiteScope','OPERATING_SCOPE_EVIDENCE','operatingScopeEvidence','scopeEvidence','IDENTITY_EVIDENCE_CONFLICT'];
// Project only identity/scope evidence through discovery adapters, not unrelated payloads.
function carry(row={}) {
 const p=row.p||row.payload||{};
 return Object.fromEntries(EVIDENCE_FIELDS.map(k=>[k,row[k]||p[k]]).filter(([,v])=>typeof v==='string'&&v.trim()));
}
function usPlace(loc) {
 const st = P.stateFrom(loc); if (st) return st;
 const text = String(loc || '');
 if (/\b(united states|usa|u\.s\.)\b/i.test(text) && !/\b(canada|mexico|india|germany|united kingdom)\b/i.test(text)) return /remote/i.test(text) ? 'REMOTE_US' : 'US';
 return /^\s*remote\s*$/i.test(text) ? 'REMOTE_US' : '';
}
function locKey(loc) {
 const raw = String(loc || '').trim().replace(/,?\s+(?:United States(?: of America)?|USA|US|U\.S\.(?:A\.?)?)\s*$/i, '').trim().replace(/(^|[, ]+)([a-z]{2})(?=$|,)/g, (_, prefix, code) => prefix + code.toUpperCase());
 // A multi-worksite string must not turn into its first city.
 if (/[;/]|\s(?:or|and)\s/i.test(raw) || raw.split(',').length > 2) return '';
 const shortSuffix = raw.match(/^(.+?)\s+([A-Z]{2})$/);
 const state = usPlace(raw) || (/^[A-Z]{2}$/.test(raw) ? P.stateFrom('City, ' + raw) : shortSuffix ? P.stateFrom('City, ' + shortSuffix[2]) : '');
 if (!state) return '';
 let city = raw.includes(',') ? raw.split(',')[0] : '';
 if (!city && shortSuffix && P.stateFrom('City, ' + shortSuffix[2]) === state) city = shortSuffix[1];
 if (!city && !raw.includes(',') && state !== 'REMOTE_US' && state !== 'US') {
  const words=raw.split(/\s+/);for(let i=words.length-1;i>0;i--)if(P.stateFrom(words.slice(i).join(' '))===state){city=words.slice(0,i).join(' ');break;}
 }
 city = norm(city.replace(/\b(remote|hybrid|onsite|on-site)\b/gi, ''));
 return city && !/^(united states|usa|us|[a-z]{2})$/.test(city) ? city + ',' + state : state;
}
const identityKey = (company, title, location) => normCompany(company) + '|' + normTitle(title) + '|' + locKey(location);
function urlKey(url) {
 try {
  const u = new URL(url); if (!/^https?:$/.test(u.protocol)) return null;
  const li = /(^|\.)linkedin\.com$/.test(u.hostname) && u.pathname.match(/\/jobs\/view\/(?:[^/]*-)?(\d+)\/?$/);
  if (li) return 'linkedin:' + li[1];
  if (/(^|\.)indeed\.com$/.test(u.hostname) && u.searchParams.get('jk')) return 'indeed:' + u.searchParams.get('jk');
  for (const k of [...u.searchParams.keys()]) if (/^(utm_|trk|tracking|ref|source|token|sig|lipi|eid)/i.test(k)) u.searchParams.delete(k);
  u.hash = ''; u.hostname = u.hostname.toLowerCase(); u.pathname = u.pathname.replace(/\/$/, ''); u.searchParams.sort();
  return 'url:' + crypto.createHash('sha256').update(u.href).digest('hex').slice(0, 24);
 } catch { return null; }
}
function atsIdentity(url) {
 try {
  const u = new URL(url); let m;
  if (/^(?:job-boards|boards)\.greenhouse\.io$/.test(u.hostname) && (m = u.pathname.match(/^\/([^/]+)\/jobs\/(\d+)\/?$/i))) return {scope: 'greenhouse:' + m[1].toLowerCase(), id: m[2].toLowerCase()};
  if (/^jobs\.(?:lever\.co|ashbyhq\.com)$/.test(u.hostname) && (m = u.pathname.match(/^\/([^/]+)\/([a-f0-9-]{20,})\/?$/i))) return {scope: u.hostname + ':' + m[1].toLowerCase(), id: m[2].toLowerCase()};
  if (/(^|\.)myworkdayjobs\.com$/.test(u.hostname) && (m = u.pathname.match(/\/job\/[^?#]*\/([A-Za-z0-9_-]+)\/?$/))) return {scope: u.hostname, id: m[1].toLowerCase()};
  return null;
 } catch { return null; }
}
const atsId = url => atsIdentity(url)?.id || '';
const normUrl = url => urlKey(url) || '';
function fields(row) {
 const p = row.p || row.payload || {}, value = (...keys) => keys.map(k => row[k] || p[k]).find(Boolean) || '';
 const company = normCompany(value('COMPANY', 'company')), title = normTitle(value('TITLE', 'title'));
 const rawLocation = value('LOCATION', 'location'), location = locKey(rawLocation), raw = unknown(rawLocation) ? '' : norm(rawLocation);
 const multi = /[;/]|\s(?:or|and)\s/i.test(rawLocation) || String(rawLocation).split(',').length > 3;
 const precise = !multi && location.includes(',');
 const broad = /\b(remote|hybrid|onsite|on site|nationwide|multiple|various|flexible|anywhere)\b/.test(raw) || /^(us|usa|united states)$/.test(raw);
 const concrete = !!raw && !broad && (precise || !location && !multi);
 const scopeText=[value('TITLE','title'),value('REMOTE_HYBRID','workArrangement','workMode'),value('OPERATING_SCOPE','operatingScope','LOCATION_SCOPE','worksiteScope'),value('OPERATING_SCOPE_EVIDENCE','operatingScopeEvidence','scopeEvidence')].join(' ').replace(/[_-]/g,' ');
 const scopeUncertain=/\b(remote|hybrid|regional|national|nationwide|global|multi\s*(sites?|locations?|facility|facilities|plants?)|multiple\s+(sites?|locations?|facilities|plants?)|location\s*(open|flexible|independent)|open\s+location|any\s+(office|location)|across\s+(sites|locations|facilities|plants))\b/i.test(scopeText);
 const singleWorksite=precise&&!scopeUncertain&&!/\b(remote|hybrid|greater|metro|metropolitan|region|regional|area|coast|central|northern|southern|eastern|western|nationwide|multiple|various)\b|[&|()]|\s[-–—]\s/i.test(rawLocation);
 const urls = new Set(), ats = new Map(), reqs = new Set();
 if (/^(?:linkedin:[0-9]+|indeed:[a-zA-Z0-9]+|url:[a-f0-9]{24})$/.test(row.key || '')) urls.add(row.key);
 for (const name of ['url', 'sourceUrl', 'source_url', 'postingUrl', ...URL_FIELDS]) for (const text of [row[name], p[name]]) {
  if (typeof text !== 'string') continue;
  for (const url of text.match(/https?:\/\/[^\s;|]+/g) || []) { const key = urlKey(url); if (key) urls.add(key); const a = atsIdentity(url); if (a) { if (!ats.has(a.scope)) ats.set(a.scope, new Set()); ats.get(a.scope).add(a.id); } }
 }
 for (const name of ['reqId', 'requisitionId', ...REQ_FIELDS]) for (const value of [row[name], p[name]]) {
  if (unknown(value)) continue;
  const li = String(value).match(/^LI[ -]?(\d{8,})$/i);
  if (li) urls.add('linkedin:' + li[1]); else reqs.add(String(value).trim().toLowerCase());
 }
 return {company, title, location, raw, precise, concrete, singleWorksite, scopeUncertain, multi, urls, ats, reqs, evidenceConflict:!!value('IDENTITY_EVIDENCE_CONFLICT'), primaryId: value('PRIMARY_ID', 'primaryId', 'claimedPid') || null};
}
const overlap = (a, b) => [...a].some(x => b.has(x));
function locationConflict(a, b) {
 if (!a.raw || !b.raw) return false;
 if (a.multi || b.multi) return a.raw !== b.raw;
 if (a.location && b.location) {
  const [ac, as] = a.location.includes(',') ? a.location.split(',') : ['', a.location];
  const [bc, bs] = b.location.includes(',') ? b.location.split(',') : ['', b.location];
  if (['US', 'REMOTE_US'].includes(as) || ['US', 'REMOTE_US'].includes(bs)) return false;
  return as !== bs || !!(ac && bc && ac !== bc);
 }
 if (a.location.includes(',') && b.concrete) return a.location.split(',')[0] !== b.raw;
 if (b.location.includes(',') && a.concrete) return b.location.split(',')[0] !== a.raw;
 return a.concrete && b.concrete && a.raw !== b.raw;
}
function reqConflict(a, b) {
 const atsIds = f => new Set([...f.ats.values()].flatMap(x => [...x]));
 if (a.reqs.size && b.reqs.size && !overlap(a.reqs, b.reqs)) return true;
 if (a.reqs.size && !b.reqs.size && b.ats.size && !overlap(a.reqs, atsIds(b))) return true;
 if (b.reqs.size && !a.reqs.size && a.ats.size && !overlap(b.reqs, atsIds(a))) return true;
 return [...a.ats].some(([scope, ids]) => [...b.ats].some(([otherScope, otherIds]) =>
  scope === otherScope ? !overlap(ids, otherIds) : scope.split(':')[0] === otherScope.split(':')[0]));
}
function postingConflict(a,b) {
 // Different listing IDs may be reposts, but names/site alone do not prove that.
 const atsIds=f=>new Set([...f.ats.values()].flatMap(x=>[...x]));
 if(overlap(a.reqs,b.reqs)||overlap(a.reqs,atsIds(b))||overlap(b.reqs,atsIds(a))||[...a.ats].some(([scope,ids])=>b.ats.has(scope)&&overlap(ids,b.ats.get(scope))))return false;
 return ['linkedin:','indeed:'].some(prefix=>{const left=new Set([...a.urls].filter(x=>x.startsWith(prefix))),right=new Set([...b.urls].filter(x=>x.startsWith(prefix)));return left.size&&right.size&&!overlap(left,right);});
}
// A no-replay fence protects its original job, not every common title at an employer.
// Shared posting/requisition/primary-ID evidence outranks different location labels.
// City labels alone cannot distinguish metro aliases; the generic escape requires different states.
function fenceApplies(candidate, original) {
 const a=fields(candidate||{}),b=fields(original||{});
 if(overlap(a.urls,b.urls)||a.primaryId&&a.primaryId===b.primaryId)return true;
 if(!a.company||a.company!==b.company)return false;
 const atsIds=f=>new Set([...f.ats.values()].flatMap(x=>[...x]));
 if(overlap(a.reqs,b.reqs)||overlap(a.reqs,atsIds(b))||overlap(b.reqs,atsIds(a))||[...a.ats].some(([scope,ids])=>b.ats.has(scope)&&overlap(ids,b.ats.get(scope))))return true;
 if(!a.title||a.title!==b.title)return false;
 if(a.evidenceConflict||b.evidenceConflict)return true;
 if([candidate,original].some(row=>String(row?.BUCKET||row?.bucket||'').toUpperCase()==='DUPLICATE'))return true;
 return !(a.singleWorksite&&b.singleWorksite&&a.location.split(',')[1]!==b.location.split(',')[1]);
}
function index(rows) {
 const records = rows.map((row, i) => ({row, fields: fields(row), identity: row.PRIMARY_ID || row.primaryId || '#row:' + i}));
 const byCompanyTitle = new Map(), byUrl = new Map(), byReq = new Map(), byAts = new Map(), byAtsId = new Map(), byPid = new Map();
 const put = (map, key, item) => { if (!key) return; if (!map.has(key)) map.set(key, new Set()); map.get(key).add(item); };
 for (const item of records) { const f = item.fields;
  if (f.company && f.title) put(byCompanyTitle, f.company + '|' + f.title, item);
  for (const url of f.urls) put(byUrl, url, item);
  for (const req of f.reqs) if (f.company) put(byReq, f.company + '|' + req, item);
  for (const [scope, ids] of f.ats) for (const id of ids) if (f.company) { put(byAts, f.company + '|' + scope + '|' + id, item); put(byAtsId, f.company + '|' + id, item); }
  if (f.primaryId) put(byPid, f.primaryId, item);
 }
 return {records, byCompanyTitle, byUrl, byReq, byAts, byAtsId, byPid};
}
function match(idx, candidate) {
 const c=fields(candidate);
 if(c.evidenceConflict)return {status:'UNRESOLVED',primaryId:null,rows:[],basis:['CONFLICTING_SOURCE_EVIDENCE']};
 const strong = new Map(), add = (items, basis) => { for (const item of items || []) { if (!strong.has(item)) strong.set(item, new Set()); strong.get(item).add(basis); } };
 for (const url of c.urls) add(idx.byUrl.get(url), 'POSTING_URL');
 if (c.company) {
  for (const req of c.reqs) { add(idx.byReq.get(c.company + '|' + req), 'REQUISITION'); add(idx.byAtsId.get(c.company + '|' + req), 'REQUISITION'); }
  for (const [scope, ids] of c.ats) for (const id of ids) { add(idx.byAts.get(c.company + '|' + scope + '|' + id), 'ATS_POSTING'); add(idx.byReq.get(c.company + '|' + id), 'REQUISITION'); }
 }
 if (c.primaryId) add(idx.byPid.get(c.primaryId), 'CLAIMED_PRIMARY_ID');
 const peers = idx.byCompanyTitle.get(c.company + '|' + c.title) || new Set();
 const conflicts = (r) => !!(c.company && r.company && c.company !== r.company || c.title && r.title && c.title !== r.title || locationConflict(c, r) || reqConflict(c, r) || postingConflict(c, r));
 const hits = new Map(), uncertain = new Set(), uncertainBasis=new Set();
 const result = (status, entries, basis) => ({status, primaryId: status === 'PRESENT' ? entries[0].fields.primaryId : null, rows: [...new Set(entries.map(x => x.row))], basis});
 for (const [item, basis] of strong) {
  if (conflicts(item.fields) || !c.company || !c.title) uncertain.add(item); else hits.set(item, [...basis]);
 }
 if (strong.size) {
  if (uncertain.size || new Set([...hits.keys()].map(x => x.identity)).size !== 1) return result('AMBIGUOUS', [...strong.keys()], ['CONFLICTING_OR_MULTIPLE_IDENTITIES']);
  return result('PRESENT', [...hits.keys()], [...new Set([...hits.values()].flat())]);
 }
 for (const item of peers) {
  const r = item.fields; if (reqConflict(c, r)) continue;
  // A location-open/regional job may be advertised at one city. Names and a city
  // cannot prove either presence or independence without the posting identity.
  if (c.scopeUncertain || r.scopeUncertain || c.precise && !c.singleWorksite || r.precise && !r.singleWorksite) {
   uncertain.add(item); uncertainBasis.add('UNCERTAIN_WORKSITE_SCOPE'); continue;
  }
  if (locationConflict(c, r)) continue;
  if(postingConflict(c,r)){uncertain.add(item);uncertainBasis.add('CONFLICTING_POSTING_IDS');continue;}
  if (c.precise && r.precise && c.location === r.location) hits.set(item, ['COMPANY_TITLE_LOCATION']);
  else {uncertain.add(item);uncertainBasis.add('INCOMPLETE_LOCATION');}
 }
 const ids = new Set([...hits.keys()].map(x => x.identity));
 if (ids.size > 1 || ids.size && (uncertain.size || c.primaryId && !idx.byPid.has(c.primaryId))) return result('AMBIGUOUS', [...hits.keys(), ...uncertain], ['CONFLICTING_OR_MULTIPLE_IDENTITIES']);
 if (ids.size === 1) return result('PRESENT', [...hits.keys()], ['COMPANY_TITLE_LOCATION']);
 return result(uncertain.size ? 'UNRESOLVED' : 'ABSENT', [...uncertain], [...uncertainBasis]);

}
module.exports = {index, match, fields, fenceApplies, carry, normCompany, normTitle, normUrl, urlKey, atsId, usPlace, locKey, identityKey, URL_FIELDS};
