'use strict';
// Public job-posting facts only. Never store private mail bodies or resume text here.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const Source=require('../programmed-coordinator/source.cjs'),L=require('../enrich-ats-pay/lib');
const PostedPay=require('./posted-pay'),Pay=require('../enrich-ats-pay/pay-values'),Identity=require('./job-identity');
const hash=x=>crypto.createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex');
const identity=r=>[Source.employer(r.company||r.COMPANY),Source.norm(r.title||r.TITLE),Source.location(r.location||r.LOCATION)||Source.norm(r.location||r.LOCATION)];
// Requisition IDs are additional constraints, never a substitute for exact URL and identity.
const requisitions=c=>[...new Set([...(Array.isArray(c?.requisitionIds)?c.requisitionIds:[]),...Identity.fields(c||{}).reqs])].map(x=>String(x).trim().toLowerCase()).filter(Boolean).sort();
const constraintOrder=(a,b)=>(Date.parse(b.observedAt)||0)-(Date.parse(a.observedAt)||0)||Number(Number.isFinite(Date.parse(a.validThrough)))-Number(Number.isFinite(Date.parse(b.validThrough)))||Date.parse(a.validThrough)-Date.parse(b.validThrough);
const sameRequisition=(a,b)=>{const left=requisitions(a),right=requisitions(b);return !left.length||!right.length||left.some(x=>right.includes(x));};
function annualBase(text){
 const pay=require('../enrich-ats-pay/pay-values').employerText(text,L.payFromText);return pay?{...pay,quote:text.split(/\n+/).find(s=>/base (?:salary|pay)/i.test(s))||text}:null;
}
function postingComplete(card){
 const text=Source.text(card.description??card.text??''),basis=card.contentBasis||card.discoveryReview?.contentBasis||'CAPTURED_ROLE_CONTENT';
 return basis==='CAPTURED_ROLE_CONTENT'&&card.fullPosting!==false&&card.discoveryReview?.fullPosting!==false&&text.length>=300&&text.length<=500000&&!/captcha|sign in to view|verify you are human|access denied|enable javascript/i.test(text);
}
function completeDocument(doc){return doc.fullPosting===true||doc.contentBasis==='CAPTURED_ROLE_CONTENT'&&postingComplete({...doc,fullPosting:undefined});}
function document(card,{observedAt,proof,fullPosting}={}){
 const text=Source.text(card.description||''),url=card.url||card.SOURCE_URL,ids=identity(card);
 if(!/^state\/(?:source-trial-report|board-discovery-report)\.json(?:@[a-f0-9]{40})?$/.test(proof||'')||(!text&&!card.postedPay)||text.length>500000||!ids[0]||!ids[1]||!/^https:\/\//.test(url||'')||!Number.isFinite(Date.parse(observedAt))||!proof)return null;
 const contentBasis=card.contentBasis||card.discoveryReview?.contentBasis||'CAPTURED_ROLE_CONTENT';
 const complete=fullPosting!==false&&postingComplete(card);
 const derived=complete?annualBase(text):null,p=card.postedPay||PostedPay.capture(card,{observedAt});
 const compatible=!p||PostedPay.bound(p,card)&&p.status==='POSTED'&&(p.currency==null||p.currency==='USD')&&(p.period==null||Pay.annualUnit(p.period))&&(p.basis==null||p.basis==='BASE')&&(p.low==null||p.low===derived?.low)&&(p.high==null||p.high===derived?.high);
 const payFacts=PostedPay.eligible({...card,postedPay:p})||(derived&&compatible?Pay.fact(derived,'EXPLICIT_ANNUAL_BASE_TEXT'):null);
 let postedPay=PostedPay.capture({...card,postedPay:p,...(!p&&payFacts?{payFacts,salaryText:derived?.quote||card.salaryText||card.pay||''}: {})},{observedAt});
 if(postedPay&&payFacts&&!PostedPay.eligible(card))postedPay={...postedPay,low:payFacts.low,high:payFacts.high,currency:payFacts.currency,period:payFacts.period,basis:payFacts.basis};
 const doc={postedPay,payFacts,schema:'forge.discovery-evidence.v1',...((card.postingFacts?.validThrough??card.validThrough)!=null?{validThrough:card.postingFacts?.validThrough??card.validThrough}:{}),source:card.source||null,...(requisitions(card).length?{requisitionIds:requisitions(card)}:{}),company:card.company||card.COMPANY,title:card.title||card.TITLE,location:card.location||card.LOCATION||'',url,identity:ids,contentBasis:contentBasis==='CAPTURED_ROLE_CONTENT'&&(fullPosting===false||card.fullPosting===false||card.discoveryReview?.fullPosting===false)?'INCOMPLETE_ROLE_CONTENT':contentBasis,text,textSha256:hash(text),fullPosting:!!complete,facts:{degree:complete?L.degreeFromText(text):null,pay:payFacts||null,payAmbiguous:complete&&!annualBase(text)&&/\$\s*\d|USD\s*\d/i.test(text)},canonicalWrites:0};
 return doc;
}
function capture(root,card,options={}){
 const doc=document(card,options);if(!doc)return null;const {observedAt,proof}=options;
 const sha=hash(doc),file='state/discovery-evidence/'+sha+'.json',full=path.join(root,file);fs.mkdirSync(path.dirname(full),{recursive:true});
 if(!fs.existsSync(full))fs.writeFileSync(full,JSON.stringify(doc)+'\n',{flag:'wx'});
 else if(hash(JSON.parse(fs.readFileSync(full)))!==sha)throw Error('DISCOVERY_EVIDENCE_CHANGED');
 return {path:file,sha256:sha,observedAt,proof,fullPosting:doc.fullPosting};
}
function read(root,ref){
 if(!/^state\/discovery-evidence\/[a-f0-9]{64}\.json$/.test(ref?.path||'')||!ref.path.endsWith(ref.sha256+'.json'))return null;
 try{const d=JSON.parse(fs.readFileSync(path.join(root,ref.path)));return hash(d)===ref.sha256&&d.schema==='forge.discovery-evidence.v1'&&hash(d.text)===d.textSha256?d:null;}catch{return null;}
}
// Intake needs sourced positive business facts, not proof that every requirement was
// reviewed. Do not promote source summaries to full postings or infer absent facts.
function roleText(doc,ref){
 return /^state\/(?:source-trial-report|board-discovery-report)\.json(?:@[a-f0-9]{40})?$/.test(ref?.proof||'')&&
  (!doc.contentBasis||doc.contentBasis==='CAPTURED_ROLE_CONTENT'||doc.contentBasis==='INCOMPLETE_ROLE_CONTENT')&&doc.text.length>0&&doc.text.length<=500000&&
  !/captcha|sign in to view|verify you are human|access denied|enable javascript/i.test(doc.text);
}
function reportEvidence(root){
 const out=[];
 for(const file of ['state/source-trial-report.json','state/board-discovery-report.json']){
  let raw,report;try{raw=fs.readFileSync(path.join(root,file),'utf8');report=JSON.parse(raw);}catch{continue;}
  const reportSha256=hash(raw);
  for(const card of ['new_roles','existing_roles','protected_roles','identity_held_roles'].flatMap(k=>Array.isArray(report?.[k])?report[k]:[])){
   if(!card||typeof card!=='object')continue;
   const review=card.discoveryReview,text=Source.text(card.description||'');
   if(review?.schema!=='forge.discovery-review.v1'||review.detailStatus!=='SOURCE_CONTENT_REVIEWED'||review.sourceSha256!==hash(text)||
      review.source!==card.source||typeof card.source!=='string'||!card.source.trim()||/^(?:SAVED_DISCOVERY|INTAKE_DRAIN|UNKNOWN)$/.test(card.source))continue;
   const key=require('../pipeline-observability/upstream-flow').key;
   if(!key(card.url)||key(review.sourceUrl)!==key(card.url))continue;
   const bound=review.preliminaryScreen?.atsGate?.sourceIdentity;
   if(bound&&JSON.stringify(identity(bound))!==JSON.stringify(identity(card)))continue;
   const observedAt=review.observedAt,doc=document(card,{observedAt,proof:file,fullPosting:postingComplete(card)});
   const ref={path:file,proof:file,sha256:doc&&hash(doc),reportSha256,observedAt,fullPosting:!!doc?.fullPosting,origin:'DISCOVERY_REPORT'};
   if(doc&&roleText(doc,ref))out.push({doc,ref,fullPosting:doc.fullPosting});
  }
 }
 return out;
}
function index(root,ledger){
 if(!ledger)try{const m=JSON.parse(fs.readFileSync(path.join(root,'state/discovery-evidence/manifest.json')));if(m.schema!=='forge.discovery-evidence-manifest.v1')throw Error('manifest');ledger={entries:m.entries};}catch{try{ledger=JSON.parse(fs.readFileSync(path.join(root,'state/UPSTREAM_LEDGER.json')));}catch{ledger={entries:{}};}}
 const byUrl=new Map(),key=u=>require('../pipeline-observability/upstream-flow').key(u),memo=new Map();
 for(const e of Object.values(ledger.entries||{}))for(const ref of e.evidenceRefs||[]){const k=key(e.sourceUrl);if(k){if(!byUrl.has(k))byUrl.set(k,[]);byUrl.get(k).push(ref);}}
 function find(card,{now=Date.now(),maxAgeMs=6*3600000,payOnly=false,allowRoleText=false}={}){
  const ids=identity(card),newer=[];if(ids.some(x=>!x))return null;
  for(const ref of (byUrl.get(key(card.url||card.SOURCE_URL))||[]).slice().sort((a,b)=>Date.parse(b.observedAt)-Date.parse(a.observedAt))){
   const age=now-Date.parse(ref.observedAt);if(!Number.isFinite(age)||age<0||age>maxAgeMs)continue;
   if(!memo.has(ref.sha256))memo.set(ref.sha256,read(root,ref));const doc=memo.get(ref.sha256);
   if(!doc||!identity(doc).every((x,n)=>x===ids[n])||key(doc.url)!==key(card.url||card.SOURCE_URL)||!sameRequisition(doc,card))continue;
   if(!payOnly){const fullPosting=completeDocument(doc);if(fullPosting||allowRoleText&&roleText(doc,ref))return{doc,ref,fullPosting};continue;}
   const pay=PostedPay.eligible(doc)||(!doc.postedPay&&doc.fullPosting?annualBase(doc.text):null);
   if(pay){const conflict=newer.find(x=>{const p=x.doc.postedPay;return p.status==='POSTED'&&((p.low!=null&&p.low!==pay.low)||(p.high!=null&&p.high!==pay.high)||(p.currency!=null&&p.currency!=='USD')||(p.period!=null&&!Pay.annualUnit(p.period))||(p.basis!=null&&p.basis!=='BASE'));});return conflict||{doc,ref};}
   if(doc.postedPay&&PostedPay.bound(doc.postedPay,doc))newer.push({doc,ref});
  }return null;
 }
 // Expiry is a separate recorded fact: an unknown newer card cannot erase it,
 // and selecting richer older text must not assign that text's proof to expiry.
 let reportConstraints;
 function constraints(card,{now=Date.now()}={}){
  const ids=identity(card),urlKey=key(card.url||card.SOURCE_URL),out=[];
  if(ids.some(x=>!x)||!urlKey)return out;
  const add=(doc,ref)=>{
   if(doc.validThrough==null||!identity(doc).every((x,n)=>x===ids[n])||key(doc.url)!==urlKey||!sameRequisition(doc,card))return;
   const at=ref.observedAt??null;if(at!==null&&(!Number.isFinite(Date.parse(at))||Date.parse(at)>now))return;
   out.push({validThrough:doc.validThrough,company:doc.company,title:doc.title,location:doc.location,url:doc.url,source:typeof doc.source==='string'&&doc.source.trim()&&!/^(?:SAVED_DISCOVERY|INTAKE_DRAIN|UNKNOWN)$/i.test(doc.source.trim())?doc.source:'URL:'+new URL(doc.url).hostname,
    ...(requisitions(doc).length?{requisitionIds:requisitions(doc)}:{}),observedAt:at,proof:{path:ref.path,sha256:ref.reportSha256||ref.sha256}});
  };
  for(const ref of byUrl.get(urlKey)||[]){
   if(!/^state\/(?:source-trial-report|board-discovery-report)\.json(?:@[a-f0-9]{40})?$/.test(ref.proof||''))continue;
   if(!memo.has(ref.sha256))memo.set(ref.sha256,read(root,ref));const doc=memo.get(ref.sha256);if(doc)add(doc,ref);
  }
  if(!reportConstraints){reportConstraints=[];
   for(const file of ['state/source-trial-report.json','state/board-discovery-report.json']){
    let raw,report;try{raw=fs.readFileSync(path.join(root,file),'utf8');report=JSON.parse(raw);}catch{continue;}
    for(const c of ['new_roles','existing_roles','protected_roles','identity_held_roles'].flatMap(k=>Array.isArray(report?.[k])?report[k]:[])){
     if(!c||typeof c!=='object'||(c.postingFacts?.validThrough??c.validThrough)==null)continue;
     const url=c.url||c.sourceUrl||c.SOURCE_URL,review=c.discoveryReview,text=Source.text(c.description||''),bound=review?.preliminaryScreen?.atsGate?.sourceIdentity;
     if(!/^https:\/\//.test(url||'')||!key(url)||review?.sourceUrl&&key(review.sourceUrl)!==key(url)||review?.sourceSha256&&hash(text)!==review.sourceSha256||bound&&JSON.stringify(identity(bound))!==JSON.stringify(identity(c)))continue;
     reportConstraints.push({doc:{...c,company:c.company||c.COMPANY,title:c.title||c.TITLE,location:c.location||c.LOCATION,url,validThrough:c.postingFacts?.validThrough??c.validThrough},
      ref:{path:file,reportSha256:hash(raw),observedAt:review?.observedAt||c.observedAt||report.summary?.at||null}});
    }
   }
  }
  for(const {doc,ref}of reportConstraints)add(doc,ref);
  return out.sort(constraintOrder);
 }
 // Read the saved report directly when intake starts before the asynchronous
 // evidence publisher. No source fetch, file mutation or Writer action occurs.
 let reports;
 return {find,constraints,forIntake(card,{now=Date.now(),maxAgeMs=Infinity}={}){
  const ids=identity(card);if(ids.some(x=>!x))return null;
  const cached=find(card,{now,maxAgeMs,allowRoleText:true}),candidates=cached?[cached]:[];
  if(!reports){reports=new Map();for(const found of reportEvidence(root)){const k=key(found.doc.url);if(!reports.has(k))reports.set(k,[]);reports.get(k).push(found);}}
  for(const found of reports.get(key(card.url||card.SOURCE_URL))||[]){const age=now-Date.parse(found.ref.observedAt);
   if(Number.isFinite(age)&&age>=0&&age<=maxAgeMs&&found.doc.identity.every((x,n)=>x===ids[n])&&key(found.doc.url)===key(card.url||card.SOURCE_URL)&&sameRequisition(found.doc,card))candidates.push(found);
  }
  return candidates.sort((a,b)=>Date.parse(b.ref.observedAt)-Date.parse(a.ref.observedAt))[0]||null;
 }};
}
function forRow(store,row,now=Date.now()){
 const urls=require('../enrich-ats-pay/recovery').urls(row),salaries=[],postings=[],constraintsByUrl=new Map();
 const unexpired=found=>found&&(found.doc.validThrough==null||Number.isFinite(Date.parse(found.doc.validThrough))&&Date.parse(found.doc.validThrough)>now);
 for(const url of urls){const card={...row,SOURCE_URL:url},constraint=store.constraints?.(card,{now})[0];
  if(constraint){constraintsByUrl.set(Identity.urlKey(url),constraint);if(!Number.isFinite(Date.parse(constraint.validThrough))||Date.parse(constraint.validThrough)<=now)continue;}
  const salary=store.find(card,{now,maxAgeMs:Infinity,payOnly:true}),full=store.find(card,{now,maxAgeMs:Infinity});
  if(constraint?!!salary&&sameRequisition(constraint,salary.doc):unexpired(salary))salaries.push(salary);if(constraint?!!full&&sameRequisition(constraint,full.doc):unexpired(full))postings.push(full);
 }
 const latest=xs=>xs.sort((a,b)=>Date.parse(b.doc.postedPay?.observedAt||b.ref.observedAt)-Date.parse(a.doc.postedPay?.observedAt||a.ref.observedAt))[0];
 const salary=latest(salaries),full=postings.sort((a,b)=>Date.parse(b.ref.observedAt)-Date.parse(a.ref.observedAt))[0],found=salary||full;if(!found)return null;
 const doc=found.doc,text=full?.doc.text||doc.text,constraint=constraintsByUrl.get(Identity.urlKey(doc.url)),pay=salary?(PostedPay.eligible(doc)||(!doc.postedPay?annualBase(doc.text):null)):null;
 return{identity:JSON.stringify([row.COMPANY,row.TITLE,row.LOCATION]),at:doc.postedPay?.observedAt||found.ref.observedAt,url:doc.url,fullPosting:!!full,text,postedPay:doc.postedPay||null,payFacts:salary?PostedPay.eligible(doc):null,degree:full?L.degreeFromText(full.doc.text):null,degreeAt:full?.ref.observedAt||null,degreeUrl:full?.doc.url||null,pay,payAmbiguous:!pay&&/\$\s*\d|USD\s*\d/i.test(text),basis:'EMPLOYER_POSTED',postingStatus:'UNVERIFIED',...(constraint?{postingFacts:{validThrough:constraint.validThrough},validThroughEvidence:constraint}:{}),discoveryEvidence:found.ref.path,factsVersion:Pay.VERSION};
}
module.exports={capture,read,index,forRow,annualBase,identity,hash,postingComplete,requisitions,sameRequisition,constraintOrder};
