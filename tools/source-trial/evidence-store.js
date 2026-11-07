'use strict';
// Public job-posting facts only. Never store private mail bodies or resume text here.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const Source=require('../programmed-coordinator/source.cjs'),L=require('../enrich-ats-pay/lib');
const PostedPay=require('./posted-pay'),Pay=require('../enrich-ats-pay/pay-values');
const hash=x=>crypto.createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex');
const identity=r=>[Source.employer(r.company||r.COMPANY),Source.norm(r.title||r.TITLE),Source.location(r.location||r.LOCATION)];
function annualBase(text){
 const pay=require('../enrich-ats-pay/pay-values').employerText(text,L.payFromText);return pay?{...pay,quote:text.split(/\n+/).find(s=>/base (?:salary|pay)/i.test(s))||text}:null;
}
function capture(root,card,{observedAt,proof,fullPosting=false}={}){
 const text=Source.text(card.description||''),url=card.url||card.SOURCE_URL,ids=identity(card);
 if(!/^state\/(?:source-trial-report|board-discovery-report)\.json(?:@[a-f0-9]{40})?$/.test(proof||'')||(!text&&!card.postedPay)||text.length>500000||!ids[0]||!ids[1]||!/^https:\/\//.test(url||'')||!Number.isFinite(Date.parse(observedAt))||!proof)return null;
 const complete=fullPosting&&text.length>=300&&!/captcha|sign in to view|verify you are human/i.test(text);
 const derived=complete?annualBase(text):null,p=card.postedPay||PostedPay.capture(card,{observedAt});
 const compatible=!p||PostedPay.bound(p,card)&&p.status==='POSTED'&&(p.currency==null||p.currency==='USD')&&(p.period==null||Pay.annualUnit(p.period))&&(p.basis==null||p.basis==='BASE')&&(p.low==null||p.low===derived?.low)&&(p.high==null||p.high===derived?.high);
 const payFacts=PostedPay.eligible({...card,postedPay:p})||(derived&&compatible?Pay.fact(derived,'EXPLICIT_ANNUAL_BASE_TEXT'):null);
 let postedPay=PostedPay.capture({...card,postedPay:p,...(!p&&payFacts?{payFacts,salaryText:derived?.quote||card.salaryText||card.pay||''}: {})},{observedAt});
 if(postedPay&&payFacts&&!PostedPay.eligible(card))postedPay={...postedPay,low:payFacts.low,high:payFacts.high,currency:payFacts.currency,period:payFacts.period,basis:payFacts.basis};
 const doc={postedPay,payFacts,schema:'forge.discovery-evidence.v1',company:card.company||card.COMPANY,title:card.title||card.TITLE,location:card.location||card.LOCATION||'',url,identity:ids,text,textSha256:hash(text),fullPosting:!!complete,facts:{degree:complete?L.degreeFromText(text):null,pay:payFacts||null,payAmbiguous:complete&&!annualBase(text)&&/\$\s*\d|USD\s*\d/i.test(text)},canonicalWrites:0};
 const sha=hash(doc),file='state/discovery-evidence/'+sha+'.json',full=path.join(root,file);fs.mkdirSync(path.dirname(full),{recursive:true});
 if(!fs.existsSync(full))fs.writeFileSync(full,JSON.stringify(doc)+'\n',{flag:'wx'});
 else if(hash(JSON.parse(fs.readFileSync(full)))!==sha)throw Error('DISCOVERY_EVIDENCE_CHANGED');
 return {path:file,sha256:sha,observedAt,proof,fullPosting:doc.fullPosting};
}
function read(root,ref){
 if(!/^state\/discovery-evidence\/[a-f0-9]{64}\.json$/.test(ref?.path||'')||!ref.path.endsWith(ref.sha256+'.json'))return null;
 try{const d=JSON.parse(fs.readFileSync(path.join(root,ref.path)));return hash(d)===ref.sha256&&d.schema==='forge.discovery-evidence.v1'&&hash(d.text)===d.textSha256?d:null;}catch{return null;}
}
function index(root,ledger){
 if(!ledger)try{const m=JSON.parse(fs.readFileSync(path.join(root,'state/discovery-evidence/manifest.json')));if(m.schema!=='forge.discovery-evidence-manifest.v1')throw Error('manifest');ledger={entries:m.entries};}catch{try{ledger=JSON.parse(fs.readFileSync(path.join(root,'state/UPSTREAM_LEDGER.json')));}catch{ledger={entries:{}};}}
 const byUrl=new Map(),key=u=>require('../pipeline-observability/upstream-flow').key(u),memo=new Map();
 for(const e of Object.values(ledger.entries||{}))for(const ref of e.evidenceRefs||[]){const k=key(e.sourceUrl);if(k){if(!byUrl.has(k))byUrl.set(k,[]);byUrl.get(k).push(ref);}}
 return {find(card,{now=Date.now(),maxAgeMs=6*3600000,payOnly=false}={}){
  const ids=identity(card),newer=[];if(ids.some(x=>!x))return null;
  for(const ref of (byUrl.get(key(card.url||card.SOURCE_URL))||[]).slice().sort((a,b)=>Date.parse(b.observedAt)-Date.parse(a.observedAt))){
   const age=now-Date.parse(ref.observedAt);if(!Number.isFinite(age)||age<0||age>maxAgeMs)continue;
   if(!memo.has(ref.sha256))memo.set(ref.sha256,read(root,ref));const doc=memo.get(ref.sha256);
   if(!doc||!doc.identity.every((x,n)=>x===ids[n])||key(doc.url)!==key(card.url||card.SOURCE_URL))continue;
   if(!payOnly){if(doc.fullPosting)return{doc,ref};continue;}
   const pay=PostedPay.eligible(doc)||(!doc.postedPay&&doc.fullPosting?annualBase(doc.text):null);
   if(pay){const conflict=newer.find(x=>{const p=x.doc.postedPay;return p.status==='POSTED'&&((p.low!=null&&p.low!==pay.low)||(p.high!=null&&p.high!==pay.high)||(p.currency!=null&&p.currency!=='USD')||(p.period!=null&&!Pay.annualUnit(p.period))||(p.basis!=null&&p.basis!=='BASE'));});return conflict||{doc,ref};}
   if(doc.postedPay&&PostedPay.bound(doc.postedPay,doc))newer.push({doc,ref});
  }return null;
 }};
}
function forRow(store,row,now=Date.now()){
 const urls=require('../enrich-ats-pay/recovery').urls(row),salaries=[],postings=[];
 for(const url of urls){const card={...row,SOURCE_URL:url},salary=store.find(card,{now,maxAgeMs:Infinity,payOnly:true}),full=store.find(card,{now,maxAgeMs:7*86400000});if(salary)salaries.push(salary);if(full)postings.push(full);}
 const latest=xs=>xs.sort((a,b)=>Date.parse(b.doc.postedPay?.observedAt||b.ref.observedAt)-Date.parse(a.doc.postedPay?.observedAt||a.ref.observedAt))[0];
 const salary=latest(salaries),full=postings.sort((a,b)=>Date.parse(b.ref.observedAt)-Date.parse(a.ref.observedAt))[0],found=salary||full;if(!found)return null;
 const doc=found.doc,text=full?.doc.text||doc.text,pay=salary?(PostedPay.eligible(doc)||(!doc.postedPay?annualBase(doc.text):null)):null;
 return{identity:JSON.stringify([row.COMPANY,row.TITLE,row.LOCATION]),at:doc.postedPay?.observedAt||found.ref.observedAt,url:doc.url,fullPosting:!!full,text,postedPay:doc.postedPay||null,payFacts:salary?PostedPay.eligible(doc):null,degree:full?L.degreeFromText(full.doc.text):null,degreeAt:full?.ref.observedAt||null,degreeUrl:full?.doc.url||null,pay,payAmbiguous:!pay&&/\$\s*\d|USD\s*\d/i.test(text),basis:'EMPLOYER_POSTED',discoveryEvidence:found.ref.path,factsVersion:Pay.VERSION};
}
module.exports={capture,read,index,forRow,annualBase,identity,hash};
