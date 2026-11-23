'use strict';
// Hermes supplies research, never Writer directives. Only the scheduled
// coordinator opens this inbox, and only its verified fields may be submitted.
const fs=require('node:fs'),path=require('node:path');
const S=require('./store.cjs'), F=require('../helper-routing/helper-fields.cjs');
const SCHEMA='forge.hermes-enrichment-return.v1', TASK='FORGE_HERMES_FROZEN_ENRICHMENT';
const PARTITION='control/ENRICHMENT_WORKER_PARTITION.json', DIR='hermes-verified-ingress';
const run=/^FORGE-HERMES-[A-Za-z0-9_-]{8,100}$/;
const id=/^V2I-[A-F0-9]{12}$/;
const object=o=>!!o&&typeof o==='object'&&!Array.isArray(o);
const only=(o,keys)=>object(o)&&Object.keys(o).every(k=>keys.includes(k));
const nonempty=(s,n)=>typeof s==='string'&&s.trim().length>0&&s.length<=n;
const requireThat=(ok,error)=>{if(!ok)throw Error(error);};
const privatePath=p=>typeof p==='string'&&p.startsWith(DIR+'/')&&p.endsWith('.json')&&run.test(p.slice(DIR.length+1,-5));
function membership(p){
 const all=new Set(),workers=new Map();
 requireThat(p?.schema==='forge.enrichment-worker-partition.v1'&&p.sourcePath==='state/PIPELINE_WAITING_QUEUES.json'&&/^[a-f0-9]{40}$/.test(p.sourceCommit)&&Array.isArray(p.workers),'HERMES_INVALID_FROZEN_PARTITION');
 for(const w of p.workers){
  requireThat(['Hermes','ChatGPT'].includes(w?.provider)&&!workers.has(w.provider)&&Array.isArray(w.primaryIds),'HERMES_INVALID_FROZEN_PARTITION');
  for(const primaryId of w.primaryIds){requireThat(id.test(primaryId)&&!all.has(primaryId),'HERMES_INVALID_FROZEN_PARTITION');all.add(primaryId);}
  workers.set(w.provider,new Set(w.primaryIds));
 }
 requireThat(workers.size===2,'HERMES_INVALID_FROZEN_PARTITION');
 return workers.get('Hermes');
}
function validate(b,p,filename){
 requireThat(only(b,['schema','provider','taskKey','runId','instructionCommit','partitionSha256','writerSubmitted','items'])&&
  b.schema===SCHEMA&&b.provider==='Hermes'&&b.taskKey===TASK&&run.test(b.runId)&&(!filename||filename===b.runId+'.json')&&
  /^[a-f0-9]{40}$/.test(b.instructionCommit)&&b.partitionSha256===S.hash(p)&&b.writerSubmitted===false&&Array.isArray(b.items)&&b.items.length>=1&&b.items.length<=20,'HERMES_INVALID_RETURN_ENVELOPE');
 const allowed=membership(p),seen=new Set();
 for(const i of b.items){
  requireThat(only(i,['kind','primaryId','recommendation','sourceEvidence'])&&i.kind==='ENRICHMENT'&&i.recommendation==='ENRICHMENT_EVIDENCE_READY'&&allowed.has(i.primaryId)&&!seen.has(i.primaryId),'HERMES_ROW_NOT_IN_FROZEN_ASSIGNMENT');
  seen.add(i.primaryId);
  const e=i.sourceEvidence;
  requireThat(only(e,['company','title','location','url','observedAt','quote','proposedRawFields','fieldQuotes'])&&
   ['company','title','location'].every(k=>nonempty(e[k],500))&&nonempty(e.url,2000)&&/^https:\/\/\S+$/.test(e.url)&&
   Number.isFinite(Date.parse(e.observedAt))&&nonempty(e.quote,1500)&&!/(?:\.\.\.|…)/.test(e.quote),'HERMES_EXACT_POSTING_EVIDENCE_REQUIRED');
  const groups=F.check(e);
  requireThat(groups.length&&Object.keys(e.proposedRawFields).every(k=>groups.some(g=>F.GROUPS[g].includes(k)))&&
   groups.every(g=>Object.hasOwn(e.fieldQuotes||{},g)),'HERMES_QUOTED_RAW_FACTS_REQUIRED');
 }
}
function history(root,b,show){
 const p=S.read(root,PARTITION);
 validate(b,p);
 requireThat(S.hash(JSON.parse(show(root,b.instructionCommit,PARTITION)))===b.partitionSha256,'HERMES_STALE_FROZEN_PARTITION');
}
function read(root,privateDir,rel){
 if(privatePath(rel)){
  requireThat(privateDir,'HERMES_PRIVATE_RECEIPTS_REQUIRED');
  return S.read(privateDir,rel);
 }
 return S.read(root,rel);
}
function capture({root,privateDir,inbox=path.join(process.env.USERPROFILE||'','My Drive','Hermes_Workspace','outputs'),routing}){
 const report={imported:0,invalid:0};
 if(!path.isAbsolute(inbox)||!fs.existsSync(inbox))return {...report,available:false};
 for(const e of fs.readdirSync(inbox,{withFileTypes:true})){
  if(!e.isFile()||!e.name.endsWith('.json')||!run.test(e.name.slice(0,-5)))continue;
  try{
   const f=path.join(inbox,e.name);requireThat(fs.statSync(f).size<=350_000,'HERMES_RETURN_TOO_LARGE');
   const bytes=fs.readFileSync(f);requireThat(bytes.length<=350_000,'HERMES_RETURN_TOO_LARGE');
   const b=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
   requireThat(b.runId+'.json'===e.name,'HERMES_RETURN_FILENAME_MISMATCH');
   const rel=DIR+'/'+e.name,exists=fs.existsSync(path.join(privateDir,rel));
   if(exists){requireThat(S.hash(S.read(privateDir,rel))===S.hash(b),'HERMES_IMMUTABLE_RETURN_CHANGED');continue;}
   routing(root,b);
   S.immutable(privateDir,rel,b);report.imported++;
  }catch{report.invalid++;}
 }
 return {...report,available:true};
}
// Restrict the network route to URLs already on the exact canonical row, and
// pass neither captured text nor a helper's arbitrary extra URL to the fetcher.
function trustedUrl(returned,urls){
 return urls.find(u=>u===returned);
}
function blanks(fields,row,evidence,Source){
 const claims=evidence.sourceEvidence.proposedRawFields,groups=evidence.sourceEvidence.fieldQuotes;
 const keys=new Set(Object.keys(claims));
 for(const g of ['DEGREE','SALARY'])if(groups[g])for(const k of Source.REPLACE_GROUPS[g])keys.add(k);
 const conflicted=new Set(Object.entries(fields).filter(([k,v])=>keys.has(k)&&Source.known(row.p?.[k])&&String(row.p[k]).trim()!==String(v).trim()).map(([k])=>Object.keys(Source.REPLACE_GROUPS).find(g=>Source.REPLACE_GROUPS[g].includes(k))||F.GROUP_OF[k]||k));
 for(const k of Object.keys(fields))if(!keys.has(k)||Source.known(row.p?.[k])||conflicted.has(Object.keys(Source.REPLACE_GROUPS).find(g=>Source.REPLACE_GROUPS[g].includes(k))||F.GROUP_OF[k]||k))delete fields[k];
 return fields;
}
module.exports={blanks,SCHEMA,TASK,PARTITION,DIR,privatePath,membership,validate,history,read,capture,trustedUrl};
