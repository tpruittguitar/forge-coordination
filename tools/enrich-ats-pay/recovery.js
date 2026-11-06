'use strict';
const crypto=require('node:crypto'),L=require('./lib'),P=require('./public-posting');
const KEYS=['ATS_POSTING_URL','DIRECT_JOB_URL','CLAUDE_REVIEW_EVIDENCE_URL','DEGREE_EVIDENCE_URL','SALARY_EVIDENCE_URL','LIVENESS_EVIDENCE_URL','SOURCE_URL','SOURCE','COMPANY_SOURCE_URL','INTAKE_SOURCE_URL','INITIATING_URL'];
function unwrap(raw){try{const u=new URL(raw);if(!/(^|\.)recruitics\.com$/i.test(u.hostname))return null;const target=P.publicUrl(u.searchParams.get('rx_url'));if(!target)return null;const t=new URL(target);if(/(^|\.)metacareers\.com$/i.test(t.hostname)&&/^\/jobs\/\d+\/?$/.test(t.pathname)){t.search='';t.hash='';}return t.href;}catch{return null;}}
function urls(row){return [...new Set(KEYS.flatMap(k=>(String(row.p[k]||'').match(/https:\/\/[^\s;|"<>]+/g)||[]).flatMap(x=>{const u=P.publicUrl(x.replace(/[),.]+$/,''));return u?[unwrap(u),u].filter(Boolean):[];})))].sort((a,b)=>rank(a)-rank(b));}
function rank(u){return /email\.|\.sendgrid\.net|t\.ladders|recruitics\.com|\.indeed\.com\/jobs\?|giga-texas|\/cmp\//i.test(u)?3:L.atsApi(u)?0:L.aggregatorPage(u)?2:1;}
function readableRoute(url,off=[]){const host=new URL(url).hostname;if(/(^email\.|\.sendgrid\.net$|^t\.ladders|(^|\.)recruitics\.com$)/i.test(host))return false;if(off.includes('indeed')&&/(^|\.)indeed\.com$/i.test(host))return false;return true;}
function exactApi(row,api,data){
 try{
  const Source=require('../programmed-coordinator/source.cjs'),F=require('../programmed-coordinator/posting-formats.cjs');
  const route=F.routes([api.page||api.api])[0];if(!route||route.kind!==api.kind)return null;
  const tokens=new URL(route.api).pathname.split('/'),expected={company:row.COMPANY,title:row.TITLE,location:row.LOCATION};
  // A board slug may establish its employer only when it exactly names the
  // expected employer. Generic/missing board identities remain unresolved.
  const company=tokens.some(t=>Source.norm(t)===Source.norm(row.COMPANY))?{name:row.COMPANY}:undefined;
  const posting=F.apiPosting(route,data,company),facts=Source.inspectJobs([posting],expected);
  const parsed=L.parseAts(api.kind,data,route.id);return parsed?{...parsed,text:facts.description,identityVerified:true,sourceIdentity:expected,postingFacts:facts.postingFacts}:null;
 }catch{return null;}
}
function boardMatch(row,postings){const norm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim(),hits=postings.filter(p=>norm(p.title)===norm(row.TITLE)&&norm(p.location)===norm(row.LOCATION));return hits.length===1?hits[0]:null;}
function fingerprint(row,needs){return crypto.createHash('sha256').update(JSON.stringify([row.COMPANY,row.TITLE,row.LOCATION,needs,urls(row)])).digest('hex');}
function due(row,needs,ledger,now=Date.now()){const p=ledger.progress?.[row.PRIMARY_ID];if(!p||p.fingerprint!==fingerprint(row,needs))return true;return now>=Date.parse(p.retryAt||'');}
function order(rows,ledger){return rows.map((row,i)=>({row,i,last:Date.parse(ledger.progress?.[row.PRIMARY_ID]?.lastAttemptAt||'')||0})).sort((a,b)=>a.last-b.last||a.i-b.i).map(x=>x.row);}
function remember(ledger,row,needs,status,attempts,now=Date.now()){ledger.progress=ledger.progress||{};const prior=ledger.progress[row.PRIMARY_ID]||{},at=new Date(now).toISOString(),fp=fingerprint(row,needs),failures=prior.fingerprint===fp?(prior.failures||0)+1:1;ledger.progress[row.PRIMARY_ID]={fingerprint:fp,lastAttemptAt:at,retryAt:new Date(now+Math.min(status==='EVIDENCE_FOUND'?1:24,Math.pow(2,Math.min(failures,4)))*3600000).toISOString(),status,failures,attempts:attempts.slice(-8)};return ledger.progress[row.PRIMARY_ID];}
function cached(ledger,row,now=Date.now()){
 const e=ledger.postingEvidence?.[row.PRIMARY_ID],Pay=require('./pay-values');
 if(!e||e.identity!==JSON.stringify([row.COMPANY,row.TITLE,row.LOCATION])||e.fullPosting!==true||now<Date.parse(e.at)||now-Date.parse(e.at)>=7*86400000)return null;
 const bound=e.identityVerified===true&&e.sourceIdentity&&JSON.stringify([e.sourceIdentity.company,e.sourceIdentity.title,e.sourceIdentity.location])===e.identity;
 if(!bound)return null;
 if(e.factsVersion===Pay.VERSION)return e;
 // Old derived values are not evidence. Reuse retained raw text conservatively;
 // a cache without raw text must return to source recovery, not keep old claims.
 if(typeof e.text!=='string'||e.text.length<300)return null;
 return {...e,factsVersion:Pay.VERSION,degree:L.degreeFromText(e.text),pay:Pay.employerText(e.text,L.payFromText,{currency:L.stateFrom(row.LOCATION)?'USD':undefined}),payAmbiguous:true};
}
function saveEvidence(ledger,row,url,parsed,now=Date.now()){const degree=L.degreeFromText(parsed.text);ledger.postingEvidence=ledger.postingEvidence||{};return ledger.postingEvidence[row.PRIMARY_ID]={identity:JSON.stringify([row.COMPANY,row.TITLE,row.LOCATION]),at:new Date(now).toISOString(),url,fullPosting:true,text:parsed.text,identityVerified:parsed.identityVerified===true,sourceIdentity:parsed.sourceIdentity||null,factsVersion:require('./pay-values').VERSION,degree,basis:parsed.basis||'EMPLOYER_POSTED',pay:parsed.pay||null,payFacts:parsed.payFacts||null};}
function unresolved(row,needs,ledger,status){const p=ledger.progress?.[row.PRIMARY_ID];return {id:row.PRIMARY_ID,company:row.COMPANY,title:row.TITLE,needs,status:status||p?.status||'NOT_YET_ATTEMPTED',lastAttemptAt:p?.lastAttemptAt||null,retryAt:p?.retryAt||null,attempts:p?.attempts||[],next:!urls(row).length?'Find an exact employer posting; preserve identity and missing fields.':'Reuse saved posting evidence; try untried exact URLs, then targeted employer research. Never infer absent degree from an unreadable page.'};}
module.exports={urls,readableRoute,exactApi,boardMatch,fingerprint,due,order,remember,cached,saveEvidence,unresolved};

