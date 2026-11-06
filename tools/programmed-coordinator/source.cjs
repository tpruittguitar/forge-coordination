'use strict';
const fs = require('node:fs'), path = require('node:path'), dns = require('node:dns/promises'), net = require('node:net');
const S = require('./store.cjs'), L = require('../enrich-ats-pay/lib.js');
const PARSER_VERSION='20261106-context-bound-facts-v2';
const norm = s => String(s || '').normalize('NFKC').toLowerCase().replace(/[^a-z0-9]/g, '');
const employer=s=>norm(String(s||'').replace(/(?:,?\s+)(?:incorporated|inc\.?|llc|ltd\.?|corp\.?|corporation|plc)\s*$/i,''));
function location(s){
 const clean=String(s||'').normalize('NFKC').trim().replace(/,?\s*\b(?:USA|US|United States(?: of America)?)\s*,?\s*(?:\d{5}(?:-\d{4})?)?\s*$/i,'').replace(/\s+\d{5}(?:-\d{4})?\s*$/,'').replace(/,\s*$/,'').trim(),parts=clean.split(',').map(x=>x.trim());
 const state=L.stateFrom(clean);
 // Existing shared US-state mappings normalize spelling, never another city,
 // multiple sites, remote scope or foreign-country evidence.
 if(parts.length===2&&parts[0]&&state&&L.stateFrom('City, '+parts[1])===state)return norm(parts[0])+state.toLowerCase();
 return norm(clean);
}
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
  return String(html || '').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<\/(?:p|div|li|h[1-6])>|<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&rsquo;/g,"'")
    .replace(/&#(\d+);/g, (_, n) => Number(n) <= 0x10ffff ? String.fromCodePoint(Number(n)) : '').replace(/[ \t]+/g,' ').trim();
}
function postings(html) {
  const found = [];
  function walk(x) { if (Array.isArray(x)) x.forEach(walk); else if (x && typeof x === 'object') {
    if ([].concat(x['@type'] || []).includes('JobPosting')) found.push(x);
    for(const [key,value] of Object.entries(x)) if(key!=='@type'&&value&&typeof value==='object') walk(value);
  } }
  for (const m of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) { try { walk(JSON.parse(m[1])); } catch {} }
  return found;
}
function inspect(raw, expected, quote = '', now = Date.now()) {
  let jobs=postings(raw);
  if(!jobs.length&&/itemtype\s*=\s*["'][^"']*JobPosting/i.test(raw)){
    try{jobs=JSON.parse(require('node:child_process').execFileSync(process.env.FORGE_PYTHON||'python',[path.join(__dirname,'html-posting.py')],{input:raw,encoding:'utf8',maxBuffer:5e6,windowsHide:true}));}catch{throw Error('MICRODATA_SOURCE_EXTRACTION_FAILED');}
  }
  return inspectJobs(jobs,expected,quote,now);
}
function inspectJobs(jobs,expected,quote='',now=Date.now()){
  if(!jobs.length)throw Error('STRUCTURED_POSTING_UNAVAILABLE');
  const us=v=>/^(?:US|USA|United States(?: of America)?)$/i.test(typeof v==='string'?v:v?.name||'');
  const usRemote=/^(?:Remote[,\s]+(?:US|USA|United States(?: of America)?)|(?:US|USA|United States(?: of America)?)[,\s]+Remote)$/i.test(String(expected.location||'').trim());
  const remoteScope=j=>j.jobLocationType==='TELECOMMUTE'&&[].concat(j.applicantLocationRequirements||[]).some(us)||[].concat(j.jobLocation||[]).some(l=>/^remote$/i.test(l.address?.addressLocality||'')&&us(l.address?.addressCountry));
  const matches = jobs.filter(j => norm(j.title) === norm(expected.title) && [expected.company,...expected.companyAliases||[]].some(name=>employer(j.hiringOrganization?.name)===employer(name)) &&
    (usRemote?remoteScope(j):[].concat(j.jobLocation || []).some(l => {
      const a = l.address || {}, parts = [a.addressLocality, a.addressRegion].filter(Boolean).join(', ');
      return parts && location(parts) === location(expected.location);
    })));
  if (matches.length !== 1) throw Error('SOURCE_IDENTITY_AMBIGUOUS');
  const job = matches[0], description = text(job.description);
  if (description.length < 300 || /captcha|sign in to view|verify you are human/i.test(description)) throw Error('INCOMPLETE_POSTING');
  if (job.validThrough && (!Number.isFinite(Date.parse(job.validThrough)) || Date.parse(job.validThrough) < now)) throw Error('POSTING_EXPIRED');
  if (quote && !norm(description).includes(norm(quote))) throw Error('HELPER_QUOTE_NOT_IN_POSTING');
  const degree = require('./posting-formats.cjs').degree(job.description,text), sal = job.baseSalary, val = sal?.value;
  // A generic dollar range may be bonus/total compensation. Only structured,
  // explicitly annual USD base salary is eligible for automatic posted pay.
  const Pay=require('../enrich-ats-pay/pay-values'),structured=Pay.structured(sal);
  const pay=structured&&!Pay.conflicts(description,structured,L.payFromText)?Pay.range(structured):null;
  return {description, degree:degree?.text !== 'NOT_STATED' ? degree : null, pay,postingFacts:{title:job.title,company:job.hiringOrganization?.name,reqId:job.identifier?.value||null,datePosted:job.datePosted||null,validThrough:job.validThrough||null,employmentType:job.employmentType||null,workArrangement:job.jobLocationType||null}};
}
async function verify({item, expected, privateDir,sourceUrls=[], fetchPage = page, now = Date.now()}) {
  const url = publicUrl(item.sourceEvidence.url), key = S.hash({url, expected, quote:item.sourceEvidence.quote || ''}),F=require('./posting-formats.cjs');
  const context=S.read(path.resolve(__dirname,'../..'),'reference/COMPANY_SITE_CONTEXT.json',{companies:[]}),company=context.companies.find(c=>[c.company,...c.aliases||[]].some(n=>employer(n)===employer(expected.company)));
  expected={...expected,companyAliases:[...expected.companyAliases||[],...company?[company.company,...company.aliases||[]]:[]]};
  const cache = path.join(privateDir, 'sources', key + '.json');
  if (fs.existsSync(cache)) {
    const c = JSON.parse(fs.readFileSync(cache, 'utf8'));
    if (now - Date.parse(c.observedAt) < 86400000 && now >= Date.parse(c.observedAt) && S.hash(c.raw) === c.sourceSha256 && (!c.companyRaw||S.hash(c.companyRaw)===c.companySourceSha256)) {
      const facts=c.format==='ATS_API'?inspectJobs([F.apiPosting(c.route,JSON.parse(c.raw),c.companyRaw?JSON.parse(c.companyRaw):c.boardCompany)],expected,item.sourceEvidence.quote,now):inspect(c.raw,expected,item.sourceEvidence.quote,now);
      return{...c,...facts}; // Reuse raw source, recompute facts under current parser.
    }
  }
  const sourceRoutes=S.read(privateDir,'source-routes.json',{}),errors=[];
  async function get(target){publicUrl(target);const host=new URL(target).hostname;if(Date.parse(sourceRoutes[host]?.retryAfter)>now)throw Error('SOURCE_ROUTE_BACKOFF');try{return await fetchPage(target);}catch(e){if(/^SOURCE_HTTP_(?:403|429)$/.test(e.message)){sourceRoutes[host]={reason:e.message,retryAfter:new Date(Number.isFinite(e.retryAfter)&&e.retryAfter>now?e.retryAfter:now+15*60000).toISOString()};S.save(privateDir,'source-routes.json',sourceRoutes);}throw e;}}
  const apiRoutes=F.routes([url,...sourceUrls]),candidates=[...apiRoutes.map(route=>({route,format:'ATS_API',url:route.api})),...[url,...sourceUrls].map(url=>({url,format:'HTML'}))],seen=new Set();
  for(const candidate of candidates){if(seen.has(candidate.url))continue;seen.add(candidate.url);
    try{
      const got=await get(candidate.url);let facts,companyRaw,boardCompany;
      if(candidate.route){const route=candidate.route,board=new URL(route.api).pathname.split('/');if(route.companyApi)companyRaw=(await get(route.companyApi)).raw;else if(board.some(token=>[expected.company,...expected.companyAliases].some(n=>norm(token)===norm(n))))boardCompany={name:expected.company};
        facts=inspectJobs([F.apiPosting(route,JSON.parse(got.raw),companyRaw?JSON.parse(companyRaw):boardCompany)],expected,item.sourceEvidence.quote,now);
      }else facts=inspect(got.raw,expected,item.sourceEvidence.quote,now);
      const result={...facts,format:candidate.format,route:candidate.route,companyRaw,boardCompany,raw:got.raw,sourceUrl:candidate.route?.page||candidate.url,finalUrl:got.url,expected,sourceSha256:S.hash(got.raw),observedAt:new Date(now).toISOString(),...(companyRaw?{companySourceSha256:S.hash(companyRaw)}:{})};
      S.save(privateDir,'sources/'+key+'.json',result);return result;
    }catch(e){errors.push(e);}
  }
  const conflict=errors.find(e=>/IDENTITY|QUOTE|CONFLICT/.test(e.message));throw conflict||errors[0]||Error('WORKING_SOURCE_ROUTE_REQUIRED');
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
module.exports = {PARSER_VERSION,norm,employer, location, publicUrl, page, text, postings, inspect,inspectJobs, verify, enrichmentFields,known};
