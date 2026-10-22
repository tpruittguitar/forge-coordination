'use strict';
/* REV-156 (Tim 2026-10-21 18:09 ET "Build the free trial job for target-company job lists and JobSpy ...yes"):
   pure helpers for the read-only source trial. Nothing here writes to the Writer or the master. */
const P = require('../enrich-ats-pay/lib.js');

/* Tim 18:09 ET: "quality leadership, manufacturing and production leadership and manufacturing engineering leadership". */
const LEADER_RE = /\b(director|head of|head,|vice president|vp\b|v\.p\.|svp|evp|chief\b|plant manager|general manager|site (?:lead|leader|director)|plant leader|senior manager|sr\.? manager|senior staff|sr\.? staff|staff engineer|principal(?:\s+(?:manufacturing|production|process|industrial))?\s+engineer)\b/i;
const NOT_LEADER_RE = /\b(assistant|associate|intern|coordinator|specialist|analyst|technician|administrator)\b/i;
const MFG_ENG_RE = /\b(manufacturing engineering|manufacturing engineer|process engineering|process engineer|industrial engineering|industrial engineer|production engineering|production engineer)\b/i;
const QUALITY_RE = /\bquality\b/i;
const MFG_PROD_RE = /\b(manufactur\w*|production|plant|factory|assembly|fabrication|operations|ops)\b/i;
const OFF_TOPIC_RE = /\b(software|data quality|quality of service|clinical|regulatory affairs|sales|marketing|finance|financial|it operations|security operations|network operations|devops|revenue operations|people operations|hr operations|business operations|customer|legal|flight operations|launch operations|mission operations|space operations|fleet operations|store|restaurant|hospital|nursing|patient)\b/i;

/** Title -> 'QUALITY' | 'MFG_PROD' | 'MFG_ENG' | null. Only leadership titles in Tim's three families count. */
function family(title) {
  const t = String(title || '');
  if (!LEADER_RE.test(t) || NOT_LEADER_RE.test(t) || OFF_TOPIC_RE.test(t)) return null;
  if (MFG_ENG_RE.test(t)) return 'MFG_ENG';
  if (QUALITY_RE.test(t)) return 'QUALITY';
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

/** Index of what the master already holds: company+title keys and posting URLs. */
function masterIndex(rows) {
  const keys = new Set(), urls = new Set(), companies = new Set();
  rows.forEach(r => {
    const co = P.normCo(r.COMPANY || (r.p && r.p.COMPANY)), ti = normTitle(r.TITLE || (r.p && r.p.TITLE));
    if (co) companies.add(co);
    if (co && ti) keys.add(co + '|' + ti);
    const p = r.p || {};
    P.ATS_URL_KEYS.forEach(k => { if (p[k]) urls.add(normUrl(p[k])); });
  });
  return { keys, urls, companies };
}

/** 'EXISTING' (same posting URL or same company + title) or 'NEW'. */
function novelty(idx, company, title, url) {
  if (url && idx.urls.has(normUrl(url))) return 'EXISTING';
  if (idx.keys.has(P.normCo(company) + '|' + normTitle(title))) return 'EXISTING';
  return 'NEW';
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
  if (/\b(senior staff|sr\.? staff|staff engineer|principal engineer)\b/i.test(t)) return 'SR_STAFF';
  if (/\b(senior manager|sr\.? manager)\b/i.test(t)) return 'SR_MANAGER';
  return 'DIRECTOR_PLUS';
}
module.exports = { level, family, usPlace, normTitle, normUrl, masterIndex, novelty, boardFromCareers, slugGuesses, parsePriority };
