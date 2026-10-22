'use strict';
/* REV-156 (Tim 2026-10-21 18:09 ET "Build the free trial job for target-company job lists and JobSpy ...yes"):
   pure helpers for the read-only source trial. Nothing here writes to the Writer or the master. */
const P = require('../enrich-ats-pay/lib.js');

/* Tim 18:09 ET: "quality leadership, manufacturing and production leadership and manufacturing engineering leadership". */
const LEADER_RE = /\b(director|head of|head,|vice president|vp\b|v\.p\.|svp|evp|chief\b|plant manager|general manager|gm[\s,]+plant|site (?:lead|leader|director)|plant leader|senior manager|sr\.? manager|senior staff|sr\.? staff|staff(?:\s+\w+)?\s+engineer|principal(?:\s+(?:manufacturing|production|process|industrial|quality))?\s+engineer)\b/i;
const NOT_LEADER_RE = /\b(assistant|associate|intern|coordinator|specialist|analyst|technician|administrator)\b/i;
const MFG_ENG_RE = /\b(manufacturing engineering|manufacturing engineer|process engineering|process engineer|industrial engineering|industrial engineer|production engineering|production engineer)\b/i;
const TRANSFORM_RE = /\b(npi|new product introduction|new product development|continuous improvement|operational excellence|industrializ\w*|commissioning)\b/i;
const LAUNCH_RE = /\b(launch|ramp(?:-?up)?)\b/i;
const LAUNCH_CONTEXT_RE = /\b(manufactur\w*|production|plant|factory|assembly|industrializ\w*|npi)\b/i;
const QUALITY_RE = /\bquality\b/i;
const MFG_PROD_RE = /\b(manufactur\w*|production|plant|factory|assembly|fabrication|operations|ops)\b/i;
const OFF_TOPIC_RE = /\b(software|data quality|quality of service|clinical|regulatory affairs|sales|marketing|finance|financial|it operations|security operations|network operations|devops|revenue operations|people operations|hr operations|business operations|legal|flight operations|launch operations|launch site|launch vehicle|launch control|mission operations|mission control|mission director|mission production|space operations|fleet operations|store|restaurant|hospital|nursing|patient)\b/i;

/** Title -> 'QUALITY' | 'MFG_PROD' | 'MFG_ENG' | null. Only leadership titles in Tim's three families count. */
function family(title) {
  const t = String(title || '');
  if (!LEADER_RE.test(t) || NOT_LEADER_RE.test(t) || OFF_TOPIC_RE.test(t)) return null;
  if (MFG_ENG_RE.test(t)) return 'MFG_ENG';
  if (QUALITY_RE.test(t) || /\bmission assurance\b/i.test(t)) return 'QUALITY';
  if (/\bcustomer\b/i.test(t)) return null;
  if (TRANSFORM_RE.test(t) || (LAUNCH_RE.test(t) && LAUNCH_CONTEXT_RE.test(t))) return 'MFG_PROD';
  if (/\bgm[\s,]+plant\b/i.test(t)) return 'MFG_PROD';
  if (/\b(plant manager|plant leader|general manager)\b/i.test(t)) return /\bgeneral manager\b/i.test(t) && !MFG_PROD_RE.test(t.replace(/general manager/i, '')) ? null : 'MFG_PROD';
  if (MFG_PROD_RE.test(t)) return 'MFG_PROD';
  return null;
}

/** US location? state code, 'REMOTE_US', or '' (abroad / unknown). */
function usPlace(loc) {
  const st = P.stateFrom(loc);
  if (st) return st;
  const t = String(loc || '');
  if (/\b(united states|usa|u\.s\.)\b/i.test(t) && !/\b(canada|mexico|india|germany|united kingdom)\b/i.test(t)) return /remote/i.test(t) ? 'REMOTE_US' : 'US';
  if (/^\s*remote\s*$/i.test(t)) return 'REMOTE_US';
  return '';
}

const normTitle = s => String(s || '').toLowerCase().replace(/\(.*?\)/g, ' ').replace(/[^a-z0-9 ]+/g, ' ').replace(/\b(sr|senior)\b/g, 'senior').replace(/\s+/g, ' ').trim();
const normUrl = u => String(u || '').toLowerCase().replace(/^https?:\/\//, '').replace(/[?#].*$/, '').replace(/\/+$/, '');

/** ATS IDs are scoped to the employer; third-party URLs must not be treated as canonical IDs. */
function atsId(url) {
  const u = String(url || '');
  let m = u.match(/(?:job-boards|boards)\.greenhouse\.io\/[^/]+\/jobs\/(\d+)/i)
    || u.match(/jobs\.lever\.co\/[^/]+\/([a-f0-9-]{20,})/i)
    || u.match(/jobs\.ashbyhq\.com\/[^/]+\/([a-f0-9-]{20,})/i)
    || u.match(/(?:myworkdayjobs\.com|wd\d+\.myworkdayjobs\.com)\/[^?#]*?\/job\/[^?#]*?\/([A-Za-z0-9_-]+)(?:[?#]|$)/i);
  return m ? m[1].toLowerCase() : '';
}
const PROTECTED_RE = /\b(applied|rejected(?:_by_employer)?|declined(?:_by_tim)?|withdrawn|interviewed)\b/i;
const rowState = r => ['BUCKET','DISPOSITION','ANTI_RESURRECTION','DO_NOT_REWORK','STATUS','APP_STATE','APPLICATION_STATE'].map(k => [r[k],r.p && r.p[k]]).flat().filter(Boolean).join(' ');
const protectedRow = r => PROTECTED_RE.test(rowState(r)) || ['ANTI_RESURRECTION','DO_NOT_REWORK'].some(k => [r[k],r.p && r.p[k]].some(v => !!String(v || '').trim() && !/^(false|no|0|none|unknown)$/i.test(String(v).trim())));
const locKey = loc => {
  const raw = String(loc || '').trim();
  const shortSuffix = raw.match(/^(.+?)\\s+([A-Z]{2})$/);
  const state = usPlace(raw) || (/^[A-Z]{2}$/.test(raw) ? P.stateFrom('City, ' + raw) :
    shortSuffix ? P.stateFrom('City, ' + shortSuffix[2]) : '');
  if (!state) return '';
  let city = raw.includes(',') ? raw.split(',')[0] : '';
  if (!city && shortSuffix && P.stateFrom('City, ' + shortSuffix[2]) === state) city = shortSuffix[1];
  if (!city && !raw.includes(',') && state !== 'REMOTE_US' && state !== 'US') {
    const m = raw.match(/^(.+?)\\s+([A-Z][a-z]+(?:\\s+[A-Z][a-z]+)*)$/);
    if (m && P.stateFrom(m[2]) === state) city = m[1];
  }
  city = city.replace(/\\b(remote|hybrid|onsite|on-site)\\b/gi, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  return city && !/^(united states|usa|us|[a-z]{2})$/.test(city) ? city + ',' + state : state;
};
const identityKey = (company, title, location) => P.normCo(company) + '|' + normTitle(title) + '|' + locKey(location);
function masterIndex(rows) {
  const keys = new Map(), urls = new Map(), reqIds = new Map(), locations = new Map(), companies = new Set();
  for (const r of rows) {
    const co = P.normCo(r.COMPANY || (r.p && r.p.COMPANY)), ti = normTitle(r.TITLE || (r.p && r.p.TITLE));
    const status = PROTECTED_RE.test(rowState(r)) ? 'EXISTING_PROTECTED' : 'EXISTING';
    if (co) companies.add(co);
    const put = (map, key) => { if (key) map.set(key, (map.get(key) === 'EXISTING_PROTECTED' || status === 'EXISTING_PROTECTED') ? 'EXISTING_PROTECTED' : status); };
    if (!locKey(r.LOCATION || (r.p && r.p.LOCATION))) put(keys, co && ti ? co + '|' + ti : '');
    put(locations, co && ti ? identityKey(co, ti, r.LOCATION || (r.p && r.p.LOCATION)) : '');
    const p = r.p || {};
    P.ATS_URL_KEYS.forEach(k => {
      const url = p[k]; if (!url) return;
      put(urls, normUrl(url));
      const id = atsId(url); if (id) put(reqIds, co + '|' + id);
    });
    for (const k of ['REQ','REQ_ID','REQUISITION_ID','ATS_REQ_ID','JOB_ID']) {
      const id = String(p[k] || r[k] || '').trim().toLowerCase();
      if (id) put(reqIds, co + '|' + id);
    }
  }
  return { keys, urls, reqIds, locations, companies };
}
/** Provisional new is a discovery candidate, NOT a verified unique requisition. */
function novelty(idx, company, title, url, location = '', explicitReqId = '') {
  const co = P.normCo(company), ti = normTitle(title), id = String(explicitReqId || atsId(url)).toLowerCase();
  const matches = [url && idx.urls.get(normUrl(url)), id && idx.reqIds.get(co + '|' + id),
    idx.locations.get(identityKey(company,title,location)), idx.keys.get(co + '|' + ti)].filter(Boolean);
  return matches.includes('EXISTING_PROTECTED') ? 'EXISTING_PROTECTED' : matches[0] || 'NEW';
}

/** A board from a careers link written as the board root (the digest lists e.g. job-boards.greenhouse.io/aevexaerospace). */
function boardFromCareers(url) {
  const u = String(url || ''); let m;
  if ((m = u.match(/(?:boards|job-boards)\.greenhouse\.io\/([^/?#]+)\/?$/i))) return { kind: 'greenhouse', key: 'greenhouse:' + m[1].toLowerCase(), board: m[1] };
  if ((m = u.match(/jobs\.lever\.co\/([^/?#]+)\/?$/i))) return { kind: 'lever', key: 'lever:' + m[1].toLowerCase(), board: m[1] };
  if ((m = u.match(/jobs\.ashbyhq\.com\/([^/?#]+)\/?$/i))) return { kind: 'ashby', key: 'ashby:' + m[1].toLowerCase(), board: m[1] };
  return P.boardOf({ SOURCE_URL: u });
}

/** Slugs to probe for a company with no known board: "Shield AI" -> ['shieldai', 'shield-ai', 'shield']. */
function slugGuesses(name) {
  const w = String(name || '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9 ]+/g, ' ').trim().split(/\s+/).filter(Boolean);
  const out = [w.join(''), w.join('-'), w[0]].filter((s, i, a) => s && s.length >= 3 && a.indexOf(s) === i);
  return out;
}

/** The priority digest -> [{ tier, name, careers }]. */
function parsePriority(text) {
  let tier = ''; const out = [];
  String(text || '').split('\n').forEach(l => {
    const t = l.match(/^(DREAM|P\d)\b/); if (t) { tier = t[1]; return; }
    const m = l.match(/^- ([^|]+?)\s*\|\s*careers:\s*(\S+)/); if (m && tier) out.push({ tier, name: m[1].trim(), careers: m[2] === 'UNKNOWN' ? '' : m[2] });
  });
  return out;
}

function level(title) {
  const t = String(title || '');
  if (/\b(senior staff|sr\.? staff|staff(?:\s+\w+)?\s+engineer|principal(?:\s+(?:manufacturing|production|process|industrial|quality))?\s+engineer)\b/i.test(t)) return 'SR_STAFF';
  if (/\b(senior manager|sr\.? manager)\b/i.test(t)) return 'SR_MANAGER';
  return 'DIRECTOR_PLUS';
}
module.exports = { level, family, usPlace, normTitle, normUrl, identityKey, atsId, masterIndex, novelty, boardFromCareers, slugGuesses, parsePriority };
