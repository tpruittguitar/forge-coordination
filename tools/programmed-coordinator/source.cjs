'use strict';
const fs = require('node:fs'), path = require('node:path'), dns = require('node:dns/promises'), net = require('node:net');
const S = require('./store.cjs'), L = require('../enrich-ats-pay/lib.js');
const PARSER_VERSION='20261111-captured-source-evidence-v5+'+require('../enrich-ats-pay/qualification').VERSION;
const RETRY_VERSION='20261109-host-backoff-v1';
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
  if(expected.reqId&&norm(job.identifier?.value||job.identifier)!==norm(expected.reqId))throw Error('SOURCE_REQUISITION_ID_CONFLICT');
  if (description.length < 300 || /captcha|sign in to view|verify you are human/i.test(description)) throw Error('INCOMPLETE_POSTING');
  if (job.validThrough && (!Number.isFinite(Date.parse(job.validThrough)) || Date.parse(job.validThrough) < now)) throw Error('POSTING_EXPIRED');
  if (quote && !norm(description).includes(norm(quote))) throw Error('HELPER_QUOTE_NOT_IN_POSTING');
  const degree = require('./posting-formats.cjs').degree(job.description,text), sal = job.baseSalary, val = sal?.value;
  // Reuse exact posting text only when no declared structured salary was rejected.
  // Explicit currency, annual period and base basis remain mandatory for scoring.
  const Pay=require('../enrich-ats-pay/pay-values'),structured=Pay.structured(sal);
  const candidate=structured||(!sal&&!job.forgePayRejected?Pay.employerText(description,L.payFromText):null);
  const safe=candidate&&!Pay.conflicts(description,candidate,L.payFromText)&&!Pay.estimatedPay(description,candidate,L.payFromText)?candidate:null;
  const payFacts=Pay.fact(safe,structured?'STRUCTURED_ANNUAL_BASE':'EXPLICIT_ANNUAL_BASE_TEXT'),pay=Pay.range(payFacts);
  return {description, degree:degree?.text !== 'NOT_STATED' ? degree : null, pay,payFacts,payAmbiguous:!pay&&(!!sal||/\$\s*\d|\b(?:USD|CAD|AUD|NZD|EUR|GBP)\s*\d/i.test(description)),identityVerified:true,sourceIdentity:{company:expected.company,title:expected.title,location:expected.location},postingFacts:{url:job.url||null,title:job.title,company:job.hiringOrganization?.name,reqId:job.identifier?.value||null,datePosted:job.datePosted||null,validThrough:job.validThrough||null,employmentType:job.employmentType||null,workArrangement:job.jobLocationType||null}};
}
// Recorded discovery artifacts are source facts, not a new live-page check. Their
// exact identity, URL, content hash and original observation date remain bound.
function capturedSource({root=path.resolve(__dirname,'../..'),discovery,item,expected,sourceUrls=[],now=Date.now(),requireRoleText=false,validateClaims=true}) {
  discovery=discovery||require('../source-intake/discovery-inputs').index(root);
  const e=item.sourceEvidence||{},urls=[e.url,...sourceUrls].filter(Boolean);
  for(const field of ['company','title','location'])if(e[field]&&(field==='location'?location(e[field])!==location(expected[field]):field==='company'?employer(e[field])!==employer(expected[field]):norm(e[field])!==norm(expected[field])))throw Error('CONFLICTING_SOURCE_IDENTITY');
  const matches=urls.map(url=>discovery.find({...expected,url},{now})).filter(Boolean);
  const blocked=matches.find(c=>c.blocked);if(blocked)throw Error(blocked.reason);
  matches.sort((a,b)=>Number(!!b.card.description)-Number(!!a.card.description));
  for(const capture of matches){
    const card=capture.card,description=card.description;
    const validThrough=card.validThrough||null;
    if(validThrough&&(!Number.isFinite(Date.parse(validThrough))||Date.parse(validThrough)<=now))throw Error('POSTING_EXPIRED');
    if(requireRoleText&&!description)continue;
    // A metadata-only lead makes no quotation, fit, degree or salary claim.
    if(validateClaims&&description&&e.quote&&!norm(description).includes(norm(e.quote)))throw Error('HELPER_QUOTE_NOT_IN_POSTING');
    const Pay=require('../enrich-ats-pay/pay-values'),PostedPay=require('../source-trial/posted-pay'),postedPay=card.postedPay;
    const candidate=PostedPay.eligible(card)||(description?Pay.employerText(description,L.payFromText):null);
    const compatible=!postedPay||PostedPay.bound(postedPay,card)&&postedPay.status==='POSTED'&&(postedPay.currency==null||postedPay.currency==='USD')&&(postedPay.period==null||Pay.annualUnit(postedPay.period))&&(postedPay.basis==null||postedPay.basis==='BASE')&&(postedPay.low==null||postedPay.low===candidate?.low)&&(postedPay.high==null||postedPay.high===candidate?.high);
    const pay=candidate&&compatible&&!Pay.conflicts(description,candidate,L.payFromText)&&!Pay.estimatedPay(description,candidate,L.payFromText)?candidate:null;
    const degree=description?require('./posting-formats.cjs').degree(description,text):null;
    const result={format:'CAPTURED_DISCOVERY',sourceCaptured:true,discoveryEvidence:capture,description,fullPosting:card.fullPosting,
      contentBasis:card.contentBasis,sourceUrl:card.url,sourceSha256:S.hash(description||card),observedAt:capture.observedAt,
      identityVerified:true,independentlyVerified:false,sourceIdentity:{company:expected.company,title:expected.title,location:expected.location},
      postingStatus:'UNVERIFIED',postingFacts:{validThrough},degree:degree?.text!=='NOT_STATED'?degree:null,pay,payFacts:Pay.fact(pay,'EXPLICIT_ANNUAL_BASE_TEXT'),payAmbiguous:!pay&&(!!postedPay||/\$\s*\d|\b(?:USD|CAD|AUD|NZD|EUR|GBP)\s*\d/i.test(description))};
    return helperEvidence(result,description&&validateClaims?item:{sourceEvidence:{}});
  }
  return null;
}
async function verify({item, expected, privateDir,root=path.resolve(__dirname,'../..'),discovery,sourceUrls=[],requireRoleText=false,validateClaims=true,fetchPage = page, now = Date.now()}) {
  const captured=capturedSource({root,discovery,item,expected,sourceUrls,now,requireRoleText,validateClaims});if(captured)return captured;
  const url = publicUrl(item.sourceEvidence.url), key = S.hash({url, expected, quote:item.sourceEvidence.quote || ''}),F=require('./posting-formats.cjs');
  const context=S.read(path.resolve(__dirname,'../..'),'reference/COMPANY_SITE_CONTEXT.json',{companies:[]}),company=context.companies.find(c=>[c.company,...c.aliases||[]].some(n=>employer(n)===employer(expected.company)));
  expected={...expected,companyAliases:[...expected.companyAliases||[],...company?[company.company,...company.aliases||[]]:[]]};
  const cache = path.join(privateDir, 'sources', key + '.json');
  if (fs.existsSync(cache)) {
    const c = JSON.parse(fs.readFileSync(cache, 'utf8'));
    if (Number.isFinite(Date.parse(c.observedAt)) && now >= Date.parse(c.observedAt) && S.hash(c.raw) === c.sourceSha256 && (!c.companyRaw||S.hash(c.companyRaw)===c.companySourceSha256)) {
      const facts=c.format==='LINKEDIN_GUEST'?inspectLinkedIn(c.raw,c.route,c.finalUrl,expected,item.sourceEvidence.quote,now):c.format==='ATS_API'?inspectJobs([F.apiPosting(c.route,JSON.parse(c.raw),c.companyRaw?JSON.parse(c.companyRaw):c.boardCompany)],expected,item.sourceEvidence.quote,now):inspect(c.raw,expected,item.sourceEvidence.quote,now);
      return helperEvidence({...c,...facts,postingStatus:'UNVERIFIED'},item); // Recompute helper bindings even on cache hits.
    }
  }
  const sourceRoutes=S.read(privateDir,'source-routes.json',{}),errors=[];
  async function get(target) {
    publicUrl(target);const host=new URL(target).hostname,until=Date.parse(sourceRoutes[host]?.retryAfter);
    if(until>now)throw Object.assign(Error('SOURCE_ROUTE_BACKOFF'),{retryAfter:until});
    try{return await fetchPage(target);}catch(e) {
      if(/^SOURCE_HTTP_(?:403|429)$/.test(e.message)) {
        e.retryAfter=Number.isFinite(e.retryAfter)&&e.retryAfter>now?e.retryAfter:now+15*60000;
        sourceRoutes[host]={reason:e.message,retryAfter:new Date(e.retryAfter).toISOString()};S.save(privateDir,'source-routes.json',sourceRoutes);
      }
      throw e;
    }
  }
  const LinkedIn=require('./linkedin-guest.cjs'),guestRoutes=LinkedIn.routes([url,...sourceUrls]),apiRoutes=F.routes([url,...sourceUrls]),candidates=[...apiRoutes.map(route=>({route,format:'ATS_API',url:route.api})),...guestRoutes.map(route=>({route,format:'LINKEDIN_GUEST',url:route.api})),...[url,...sourceUrls].map(url=>({url,format:'HTML'}))],seen=new Set();
  for(const candidate of candidates){if(seen.has(candidate.url))continue;seen.add(candidate.url);
    try{
      const got=await get(candidate.url);let facts,companyRaw,boardCompany;
      if(candidate.format==='LINKEDIN_GUEST')facts=inspectLinkedIn(got.raw,candidate.route,got.url,expected,item.sourceEvidence.quote,now);
      else if(candidate.route){const route=candidate.route,board=new URL(route.api).pathname.split('/');if(route.companyApi)companyRaw=(await get(route.companyApi)).raw;else if(board.some(token=>[expected.company,...expected.companyAliases].some(n=>norm(token)===norm(n))))boardCompany={name:expected.company};
        facts=inspectJobs([F.apiPosting(route,JSON.parse(got.raw),companyRaw?JSON.parse(companyRaw):boardCompany)],expected,item.sourceEvidence.quote,now);
      }else facts=inspect(got.raw,expected,item.sourceEvidence.quote,now);
      const result={...facts,format:candidate.format,route:candidate.route,companyRaw,boardCompany,raw:got.raw,sourceUrl:candidate.route?.page||candidate.url,finalUrl:got.url,expected,sourceSha256:S.hash(got.raw),observedAt:new Date(now).toISOString(),...(companyRaw?{companySourceSha256:S.hash(companyRaw)}:{})};
      S.save(privateDir,'sources/'+key+'.json',result);return helperEvidence(result,item);
    }catch(e){errors.push(e);}
  }
  const conflict=errors.find(e=>/IDENTITY|QUOTE|CONFLICT/.test(e.message));
  const deferred=errors.filter(e=>Number.isFinite(e.retryAfter)&&e.retryAfter>now).sort((a,b)=>a.retryAfter-b.retryAfter)[0];
  throw conflict||deferred||errors[0]||Error('WORKING_SOURCE_ROUTE_REQUIRED');
}
// ATS adapters historically accept embedded host strings. Do not reuse that
// permissive routing as proof that a user-facing URL belongs to the ATS.
function exactAtsLink(source) {
  const route=source.route,link=publicUrl(source.postingFacts?.url),u=new URL(link),page=new URL(publicUrl(route.page));
  const id=String(source.postingFacts?.reqId||'');let match;
  if(route.kind==='lever'){
    if(page.hostname!=='jobs.lever.co'||u.hostname!=='jobs.lever.co')return null;
    match=u.pathname.match(/^\/([^/]+)\/([0-9a-f-]{36})\/?$/i);
    if(!match||match[2]!==id||new URL(route.api).origin!=='https://api.lever.co'||new URL(route.api).pathname!==`/v0/postings/${match[1]}/${id}`)return null;
  }else if(route.kind==='greenhouse'){
    const hosts=['boards.greenhouse.io','job-boards.greenhouse.io'];
    if(!hosts.includes(page.hostname)||!hosts.includes(u.hostname))return null;
    match=u.pathname.match(/^\/([^/]+)\/jobs\/(\d+)\/?$/);
    if(!match||match[2]!==id||String(route.id)!==id||new URL(route.api).origin!=='https://boards-api.greenhouse.io'||new URL(route.api).pathname!==`/v1/boards/${match[1]}/jobs/${id}`)return null;
  }else if(route.kind==='ashby'){
    if(page.hostname!=='jobs.ashbyhq.com'||u.hostname!=='jobs.ashbyhq.com')return null;
    match=u.pathname.match(/^\/([^/]+)\/([0-9a-f-]{36})\/?$/i);
    if(!match||match[2]!==id||route.id!==id||new URL(route.api).origin!=='https://api.ashbyhq.com'||new URL(route.api).pathname!==`/posting-api/job-board/${match[1]}`)return null;
  }else if(route.kind==='workday'){
    if(!/^[a-z0-9-]+\.wd\d+\.myworkdayjobs\.com$/.test(u.hostname)||u.origin!==page.origin||u.pathname!==page.pathname)return null;
    const slug=u.pathname.split('/').filter(Boolean).at(-1),m=slug.match(/_((?:R-?\d+|JR\d+))(-\d+)?$/i),req=v=>String(v).replace(/-/g,'').toUpperCase();
    const raw=JSON.parse(source.raw).jobPostingInfo;
    if(!m||!raw?.externalUrl||publicUrl(raw.externalUrl)!==link||req(raw.jobReqId)!==req(id)||
      (req(id)!==req(m[1]+(m[2]||''))&&!(m[2]&&req(id)===req(m[1])&&raw.jobPostingId===slug)))return null;
    const derived=L.atsApi(link);if(!derived||derived.api!==route.api)return null;
  }else return null;
  // Same exact board/path, not a different posting sharing title and location.
  if(page.pathname.replace(/\/$/,'')!==u.pathname.replace(/\/$/,''))return null;
  if(publicUrl(source.finalUrl)!==publicUrl(route.api))return null;
  return link;
}
// Helpers identify evidence; they never supply trusted score outputs or resume facts.
function inspectLinkedIn(raw,route,finalUrl,expected,quote,now){
  const job=require('./linkedin-guest.cjs').posting(raw,route,finalUrl);
  return inspectJobs([job],expected,quote,now);
}
function helperEvidence(source,item,profile) {
  const out={...source};delete out.fitEvidence;delete out.exactLink;delete out.helperFields;
  // Job-text facts a helper quoted. Each quote must be in this posting's own text.
  const quoted=require('../helper-routing/helper-fields.cjs').verified(item.sourceEvidence,source);
  if(Object.keys(quoted).length)out.helperFields=quoted;
  const fit=item.sourceEvidence?.fit;
  if(fit){
    const Resume=require('../source-trial/resume-match');profile=profile||Resume.load();
    if(!Resume.valid(profile)||fit.resumeTextSha256!==undefined&&fit.resumeTextSha256!==profile.source.textSha256)throw Error('CURRENT_RESUME_EVIDENCE_REQUIRED');
    if(!Array.isArray(fit.requirements)||!fit.requirements.length||fit.requirements.length>20)throw Error('FIT_REQUIREMENTS_REQUIRED');
    const literal=s=>String(s||'').normalize('NFKC').replace(/\s+/g,' ').trim();
    const requirements=fit.requirements.map(r=>{
      if(typeof r.quote!=='string'||r.quote.length<30||r.quote.length>1500||!literal(source.description).includes(literal(r.quote)))throw Error('FIT_QUOTE_NOT_IN_POSTING');
      const overlap=Resume.match({description:r.quote},profile);
      // Optional bindings are computed from the current resume, never helper prose.
      // An explicit empty array preserves an observed requirement with no support claim.
      const ids=r.competencyIds===undefined?overlap.matches.map(m=>m.competencyId):r.competencyIds;
      if(!Array.isArray(ids)||new Set(ids).size!==ids.length)throw Error('FIT_RESUME_MAPPING_REQUIRED');
      if(ids.some(id=>!overlap.matches.some(m=>m.competencyId===id)))throw Error('FIT_RESUME_MAPPING_NOT_IN_REQUIREMENT');
      return{quote:literal(r.quote),competencyIds:ids.slice().sort()};
    });
    out.fitEvidence={resumeTextSha256:profile.source.textSha256,requirements};
  }
  // A homepage/search URL with an embedded posting is not an exact job link.
  // JSON-LD self-binds to the fetch. ATS URLs additionally bind exact host,
  // path and ID against independently fetched API posting fields.
  try {
    const link=publicUrl(source.format==='LINKEDIN_GUEST'?require('./linkedin-guest.cjs').exactLink(source):source.format==='ATS_API'?exactAtsLink(source):source.finalUrl),u=new URL(link);
    const unsigned=![...u.searchParams.keys()].some(k=>/^(utm_|trk|tracking|token|sig|auth|lipi|eid|ref|source|tk$|alid$|bb$|qd$|rd$)/i.test(k));
    if(u.pathname!=='/'&&unsigned&&(['ATS_API','LINKEDIN_GUEST'].includes(source.format)||publicUrl(source.postingFacts?.url)===link))out.exactLink=link;
  }catch{}
  return out;
}
// meta.replace lists the groups whose stored values this read replaces (Tim's rule below).
function enrichmentFields(source, row, meta={}) {
  const fields = {}, p = row.p || {};if(!Number.isFinite(Date.parse(source.observedAt)))return fields;const date = source.observedAt.slice(0,10);
  const bound=source.identityVerified===true&&source.sourceIdentity&&['company','title','location'].every(k=>source.sourceIdentity[k]===row[{company:'COMPANY',title:'TITLE',location:'LOCATION'}[k]]);
  const replace=new Set(),lit=s=>String(s??'').normalize('NFKC').replace(/\s+/g,' ').trim();
  // A group is open when nothing is stored, or when Tim's newer-employer-data rule lets this read replace it.
  const open=(group,same)=>{const stored=REPLACE_GROUPS[group].slice(0,2).some(k=>known(p[k]));if(!stored)return true;if(same||!replaceable(source,p,group,date))return false;replace.add(group);return true;};
  const degreeFields=(text,req,reviewed)=>({DEGREE_TEXT:text, DEGREE_REQ:req, DEGREE_EVIDENCE_URL:source.sourceUrl, DEGREE_ASOF:date,...(reviewed?{REQUIREMENTS_REVIEWED:'YES'}:{})});
  const salaryFields=pay=>({SALARY_BASE_LOW:pay.low, SALARY_BASE_HIGH:pay.high, SALARY_MIDPOINT:Math.round((pay.low+pay.high)/2),
    SALARY_BASIS:'EMPLOYER_POSTED', SALARY_SOURCE:source.sourceUrl, SALARY_ASOF:date, SALARY_CONF:'HIGH'});
  const sameDegree=d=>lit(p.DEGREE_TEXT)===lit(d.text)&&String(p.DEGREE_REQ||'')===d.req;
  const samePay=pay=>Number(p.SALARY_BASE_LOW)===pay.low&&Number(p.SALARY_BASE_HIGH)===pay.high;
  // Code-read values first.
  if (source.degree && open('DEGREE',sameDegree(source.degree))) Object.assign(fields, degreeFields(source.degree.text,source.degree.req,!(source.sourceCaptured&&source.fullPosting!==true)));
  if (source.pay && bound && open('SALARY',samePay(source.pay))) Object.assign(fields, salaryFields(source.pay));
  if(bound&&source.exactLink&&!known(p.SOURCE_URL))fields.SOURCE_URL=source.exactLink;
  if(bound&&source.exactLink&&source.format==='ATS_API'&&!known(p.COMPANY_SOURCE_URL))fields.COMPANY_SOURCE_URL=source.exactLink;
  if(bound&&source.fitEvidence&&!known(p.FIT_EVIDENCE)&&!known(p.FIT_BASIS)){
    const fit=source.fitEvidence;
    Object.assign(fields,{FIT_EVIDENCE:fit.requirements.map(r=>r.quote).join(' / '),
      FIT_BASIS:'Observed requirement overlap only, not final fit; resume '+fit.resumeTextSha256+'; '+fit.requirements.map(r=>r.competencyIds.length?r.competencyIds.join(','):'NO_OBSERVED_RESUME_OVERLAP').join(' / '),FIT_ASOF:date,FIT_CONF:'LOW'});
  }
  // Helper-quoted facts (already checked against this posting's text) fill what code could not read.
  const h=bound&&source.helperFields||{};
  if(h.DEGREE_REQ&&h.DEGREE_TEXT&&fields.DEGREE_TEXT===undefined){
    const Q=require('../enrich-ats-pay/qualification'),d={text:h.DEGREE_TEXT,req:h.DEGREE_REQ};
    // "Not stated" needs the whole posting and code's own read of it to agree.
    const ok=d.req==='NOT_STATED'?Q.parse(source.description)?.text==='NOT_STATED'&&(!source.sourceCaptured||source.fullPosting===true)
      :/\b(?:degree|bachelor|master|associate|mba|ph\.?\s?d|b\.?\s?[sa]\b|m\.?\s?s\b)/i.test(d.text)&&(r=>!r||r.text==='NOT_STATED'||r.req===d.req)(Q.parse(h.DEGREE__QUOTE));
    if(ok&&(d.req==='NOT_STATED'?!known(p.DEGREE_TEXT)&&!known(p.DEGREE_REQ)&&String(p.REQUIREMENTS_REVIEWED||'').toUpperCase()!=='YES':open('DEGREE',sameDegree(d))))Object.assign(fields,degreeFields(d.text,d.req,true));
  }
  if(h.SALARY_BASE_LOW!==undefined&&fields.SALARY_BASE_LOW===undefined){
    const Pay=require('../enrich-ats-pay/pay-values'),pay=Pay.values(h.SALARY_BASE_LOW,h.SALARY_BASE_HIGH),q=h.SALARY__QUOTE,parsed=L.payFromText(q);
    const ok=pay&&!Pay.mixed.test(q)&&(!parsed||parsed.low===pay.low&&parsed.high===pay.high)&&!Pay.conflicts(source.description,pay,L.payFromText)&&!Pay.estimatedPay(source.description,pay,L.payFromText);
    if(ok&&open('SALARY',samePay(pay)))Object.assign(fields,salaryFields(pay));
  }
  // These carry no as-of date, so a newer read cannot be proven: fill blanks only.
  for(const k of ['WORK_ARRANGEMENT','REMOTE_HYBRID','REQ_ID','POSTING_DATE','CLIENT_EMPLOYER'])if(h[k]!==undefined&&!known(p[k]))fields[k]=h[k];
  const groups=[...replace].filter(g=>fields[REPLACE_GROUPS[g][0]]!==undefined);
  if(groups.length)meta.replace=groups;
  return fields;
}
// Tim (standing rule): newer data from the employer's own site replaces older stored
// values. Employer-owned = an ATS API read or the employer's own page, never an
// aggregator page or a captured discovery card. Only degree and salary carry an as-of
// date, so only those two groups can be proven newer and replaced.
const REPLACE_GROUPS={DEGREE:['DEGREE_TEXT','DEGREE_REQ','DEGREE_EVIDENCE_URL','DEGREE_ASOF','REQUIREMENTS_REVIEWED'],
  SALARY:['SALARY_BASE_LOW','SALARY_BASE_HIGH','SALARY_MIDPOINT','SALARY_BASIS','SALARY_SOURCE','SALARY_ASOF','SALARY_CONF']};
const AGGREGATOR_HOST=/(?:^|\.)(?:linkedin|indeed|ziprecruiter|glassdoor|monster|careerbuilder|simplyhired|dice)\.com$/i;
function employerOwned(source){
  if(source.sourceCaptured||source.format==='LINKEDIN_GUEST')return false;
  if(source.format==='ATS_API')return true;
  const url=source.finalUrl||source.sourceUrl;let host='';try{host=new URL(url).hostname;}catch{}
  return source.format==='HTML'&&!!host&&!L.aggregatorPage(url)&&!AGGREGATOR_HOST.test(host);
}
function replaceable(source,p,group,date){const was=Date.parse(p[group+'_ASOF']);return employerOwned(source)&&Number.isFinite(was)&&was<Date.parse(date);}
function known(value){return value!=null&&!/^(?:UNKNOWN|NOT_STATED|NOT_AVAILABLE|N\/A|NONE|)$/i.test(String(value).trim());}
module.exports = {RETRY_VERSION,PARSER_VERSION,norm,employer, location, publicUrl, page, text, postings, inspect,inspectJobs, capturedSource,verify, helperEvidence, enrichmentFields,known,employerOwned,REPLACE_GROUPS};
