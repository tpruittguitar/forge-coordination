'use strict';
// Public job-posting facts only. Never store private mail bodies or resume text here.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const Source=require('../programmed-coordinator/source.cjs'),L=require('../enrich-ats-pay/lib');
const hash=x=>crypto.createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex');
const identity=r=>[Source.employer(r.company||r.COMPANY),Source.norm(r.title||r.TITLE),Source.location(r.location||r.LOCATION)];
function annualBase(text){
 const hits=[];
 for(const quote of text.split(/\n+/))if(/\b(?:base salary|base pay|salary range)\b/i.test(quote)&&/\b(?:annual|annually|year|yearly)\b|\/yr\b/i.test(quote)&&!/\b(?:hourly|per hour|total compensation|equity|bonus|estimated|OTE)\b/i.test(quote)){const p=L.payFromText(quote);if(p)hits.push({...p,quote});}
 const unique=new Map(hits.map(p=>[p.low+':'+p.high,p]));return unique.size===1?[...unique.values()][0]:null;
}
function capture(root,card,{observedAt,proof,fullPosting=false}={}){
 const text=Source.text(card.description||''),url=card.url||card.SOURCE_URL,ids=identity(card);
 if(!/^state\/(?:source-trial-report|board-discovery-report)\.json(?:@[a-f0-9]{40})?$/.test(proof||'')||!text||text.length>500000||!ids[0]||!ids[1]||!/^https:\/\//.test(url||'')||!Number.isFinite(Date.parse(observedAt))||!proof)return null;
 const complete=fullPosting&&text.length>=300&&!/captcha|sign in to view|verify you are human/i.test(text);
 const doc={schema:'forge.discovery-evidence.v1',company:card.company||card.COMPANY,title:card.title||card.TITLE,location:card.location||card.LOCATION||'',url,identity:ids,text,textSha256:hash(text),fullPosting:!!complete,facts:{degree:complete?L.degreeFromText(text):null,pay:complete?annualBase(text):null,payAmbiguous:complete&&!annualBase(text)&&/\$\s*\d|USD\s*\d/i.test(text)},canonicalWrites:0};
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
 return {find(card,{now=Date.now(),maxAgeMs=6*3600000}={}){
  const ids=identity(card);if(ids.some(x=>!x))return null;
  for(const ref of (byUrl.get(key(card.url||card.SOURCE_URL))||[]).slice().sort((a,b)=>Date.parse(b.observedAt)-Date.parse(a.observedAt))){
   const age=now-Date.parse(ref.observedAt);if(!ref.fullPosting||!Number.isFinite(age)||age<0||age>maxAgeMs)continue;
   if(!memo.has(ref.sha256))memo.set(ref.sha256,read(root,ref));const doc=memo.get(ref.sha256);
   if(doc?.fullPosting&&doc.identity.every((x,n)=>x===ids[n])&&key(doc.url)===key(card.url||card.SOURCE_URL))return {doc,ref};
  }return null;
 }};
}
function forRow(store,row,now=Date.now()){
 const urls=require('../enrich-ats-pay/recovery').urls(row);
 for(const url of urls){const found=store.find({...row,SOURCE_URL:url},{now,maxAgeMs:7*86400000});if(found)return{identity:JSON.stringify([row.COMPANY,row.TITLE,row.LOCATION]),at:found.ref.observedAt,url:found.doc.url,fullPosting:true,degree:found.doc.facts.degree,pay:found.doc.facts.pay,payAmbiguous:found.doc.facts.payAmbiguous,basis:'EMPLOYER_POSTED',discoveryEvidence:found.ref.path};}return null;
}
module.exports={capture,read,index,forRow,annualBase,identity,hash};
