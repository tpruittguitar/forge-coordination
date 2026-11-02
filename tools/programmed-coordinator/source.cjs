'use strict';
const fs = require('node:fs'), path = require('node:path'), dns = require('node:dns/promises'), net = require('node:net');
const S = require('./store.cjs'), L = require('../enrich-ats-pay/lib.js');
const norm = s => String(s || '').normalize('NFKC').toLowerCase().replace(/[^a-z0-9]/g, '');
const location = s => norm(String(s || '').replace(/,?\s*(USA|United States(?: of America)?)\s*$/i, ''));
function publicUrl(raw) {
  if(typeof raw !== 'string' || /\s/.test(raw)) throw Error('INVALID_PUBLIC_SOURCE_URL');
  const u = new URL(raw);
  if (u.protocol !== 'https:' || u.username || u.password || u.port && u.port !== '443' || !u.hostname.includes('.') || net.isIP(u.hostname) || /(?:^|\.)(?:localhost|local|internal|test|invalid)$/.test(u.hostname)) throw Error('INVALID_PUBLIC_SOURCE_URL');
  u.hash = ''; return u.href;
}
const denied = new net.BlockList();
for (const [ip,bits] of [['0.0.0.0',8],['10.0.0.0',8],['100.64.0.0',10],['127.0.0.0',8],['169.254.0.0',16],['172.16.0.0',12],['192.168.0.0',16],['224.0.0.0',4],['240.0.0.0',4]]) denied.addSubnet(ip,bits,'ipv4');
for (const [ip,bits] of [['::',128],['::1',128],['fc00::',7],['fe80::',10],['ff00::',8]]) denied.addSubnet(ip,bits,'ipv6');
async function page(raw, {transport = fetch, lookup = dns.lookup} = {}) {
  let url = publicUrl(raw);
  for (let redirects = 0; redirects <= 5; redirects++) {
    const addresses = await lookup(new URL(url).hostname, {all:true});
    if (!addresses.length || addresses.some(a => denied.check(a.address, a.family === 6 ? 'ipv6' : 'ipv4'))) throw Error('NON_PUBLIC_SOURCE_ADDRESS');
    const r = await transport(url, {redirect:'manual', signal:AbortSignal.timeout(30000), headers:{'User-Agent':'Forge-source-inspector/1.0', 'Accept':'text/html'}});
    if ([301,302,303,307,308].includes(r.status)) { url = publicUrl(new URL(r.headers.get('location'), url).href); continue; }
    if (!r.ok) {const error=Error('SOURCE_HTTP_' + r.status),retry=r.headers.get('retry-after');error.retryAfter=/^\d+$/.test(retry||'')?Date.now()+Number(retry)*1000:Date.parse(retry||'');throw error;}
    if (Number(r.headers.get('content-length')) > 4e6) throw Error('SOURCE_TOO_LARGE');
    const reader = r.body.getReader(); let size = 0, chunks = [];
    try { for (;;) { const {done,value} = await reader.read(); if (done) break; size += value.length; if (size > 4e6) throw Error('SOURCE_TOO_LARGE'); chunks.push(Buffer.from(value)); } }
    finally { await reader.cancel(); }
    return {url, raw:Buffer.concat(chunks).toString('utf8')};
  }
  throw Error('SOURCE_REDIRECT_LIMIT');
}
function text(html) {
  return String(html || '').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<\/(?:p|div|li|h[1-6])>|<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&rsquo;/g,"'")
    .replace(/&#(\d+);/g, (_, n) => Number(n) <= 0x10ffff ? String.fromCodePoint(Number(n)) : '').replace(/[ \t]+/g,' ').trim();
}
function postings(html) {
  const found = [];
  function walk(x) { if (Array.isArray(x)) x.forEach(walk); else if (x && typeof x === 'object') {
    if ([].concat(x['@type'] || []).includes('JobPosting')) found.push(x);
    if (x['@graph']) walk(x['@graph']);
  } }
  for (const m of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) { try { walk(JSON.parse(m[1])); } catch {} }
  return found;
}
function inspect(raw, expected, quote = '', now = Date.now()) {
  const jobs=postings(raw);if(!jobs.length)throw Error('STRUCTURED_POSTING_UNAVAILABLE');
  const matches = jobs.filter(j => norm(j.title) === norm(expected.title) && norm(j.hiringOrganization?.name) === norm(expected.company) &&
    [].concat(j.jobLocation || []).some(l => {
      const a = l.address || {}, parts = [a.addressLocality, a.addressRegion].filter(Boolean).join(', ');
      return parts && location(parts) === location(expected.location);
    }));
  if (matches.length !== 1) throw Error('SOURCE_IDENTITY_AMBIGUOUS');
  const job = matches[0], description = text(job.description);
  if (description.length < 300 || /captcha|sign in to view|verify you are human/i.test(description)) throw Error('INCOMPLETE_POSTING');
  if (job.validThrough && (!Number.isFinite(Date.parse(job.validThrough)) || Date.parse(job.validThrough) < now)) throw Error('POSTING_EXPIRED');
  if (quote && !norm(description).includes(norm(quote))) throw Error('HELPER_QUOTE_NOT_IN_POSTING');
  const degree = L.degreeFromText(description), sal = job.baseSalary, val = sal?.value;
  // A generic dollar range may be bonus/total compensation. Only structured,
  // explicitly annual USD base salary is eligible for automatic posted pay.
  const low = Number(val?.minValue ?? val?.value), high = Number(val?.maxValue ?? val?.value);
  const pay = sal?.currency === 'USD' && val?.unitText === 'YEAR' && low >= 40000 && high >= low && high <= 2000000 ? {low, high} : null;
  return {description, degree:degree?.text !== 'NOT_STATED' ? degree : null, pay};
}
async function verify({item, expected, privateDir, fetchPage = page, now = Date.now()}) {
  const url = publicUrl(item.sourceEvidence.url), key = S.hash({url, expected, quote:item.sourceEvidence.quote || ''});
  const cache = path.join(privateDir, 'sources', key + '.json');
  if (fs.existsSync(cache)) {
    const c = JSON.parse(fs.readFileSync(cache, 'utf8'));
    if (now - Date.parse(c.observedAt) < 86400000 && now >= Date.parse(c.observedAt) && S.hash(c.raw) === c.sourceSha256) return c;
  }
  const host=new URL(url).hostname,routes=S.read(privateDir,'source-routes.json',{}),route=routes[host];
  if(route&&Date.parse(route.retryAfter)>now)throw Error('SOURCE_ROUTE_BACKOFF');
  let got;
  try{got=await fetchPage(url);}
  catch(e){if(/^SOURCE_HTTP_(?:403|429)$/.test(e.message)){routes[host]={reason:e.message,retryAfter:new Date(Number.isFinite(e.retryAfter)&&e.retryAfter>now?e.retryAfter:now+15*60000).toISOString()};S.save(privateDir,'source-routes.json',routes);}throw e;}
  const facts = inspect(got.raw, expected, item.sourceEvidence.quote, now);
  const result = {...facts, raw:got.raw, sourceUrl:url, finalUrl:got.url, expected, sourceSha256:S.hash(got.raw), observedAt:new Date(now).toISOString()};
  S.save(privateDir, 'sources/' + key + '.json', result); return result;
}
function enrichmentFields(source, row) {
  const fields = {}, p = row.p || {}, date = source.observedAt.slice(0,10);
  if (source.degree && !known(p.DEGREE_TEXT) && !known(p.DEGREE_REQ)) Object.assign(fields, {DEGREE_TEXT:source.degree.text, DEGREE_REQ:source.degree.req, DEGREE_EVIDENCE_URL:source.sourceUrl, DEGREE_ASOF:date, REQUIREMENTS_REVIEWED:'YES'});
  if (source.pay && require('../enrich-ats-pay/source-search').firstParty(source.sourceUrl, row.COMPANY) && !known(p.SALARY_BASE_LOW)) Object.assign(fields, {
    SALARY_BASE_LOW:source.pay.low, SALARY_BASE_HIGH:source.pay.high, SALARY_MIDPOINT:Math.round((source.pay.low+source.pay.high)/2),
    SALARY_BASIS:'EMPLOYER_POSTED', SALARY_SOURCE:source.sourceUrl, SALARY_ASOF:date, SALARY_CONF:'HIGH'
  });
  return fields;
}
function known(value){return value!=null&&!/^(?:UNKNOWN|NOT_STATED|NOT_AVAILABLE|N\/A|NONE|)$/i.test(String(value).trim());}
module.exports = {norm, location, publicUrl, page, text, postings, inspect, verify, enrichmentFields,known};
