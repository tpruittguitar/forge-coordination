'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const canonical=x=>JSON.stringify(x&&typeof x==='object'?Array.isArray(x)?x.map(v=>JSON.parse(canonical(v))):Object.fromEntries(Object.keys(x).sort().map(k=>[k,JSON.parse(canonical(x[k]))])):x),digest=x=>crypto.createHash('sha256').update(canonical(x)).digest('hex');
const terminal=new Set(['APPLIED','REJECTED_BY_EMPLOYER','DECLINED_BY_TIM','CLOSED_DEAD','DUPLICATE']);
function fields(line){const out={};for(const part of String(line||'').split(/;\s*/)){const m=part.match(/(?:^|[ |])([A-Z][A-Z0-9_]*)=([^;]*)$/);if(m)out[m[1]]=m[2].trim();}return out;}
function safeRead(root,file){if(!/^(receipts|verify\/recovery\/bindings)\/[A-Za-z0-9_./-]+\.json$/.test(file||'')||file.includes('..'))throw Error('Invalid closure evidence path');return JSON.parse(fs.readFileSync(path.join(root,file)));}
async function closeCase(root,c,index,readRows){
 if(!c.entry||!['FALSE_COMPLETE','NOT_PERSISTED','NEEDS_RESOLUTION'].includes(c.entry.s))return null;
 let registry;try{registry=JSON.parse(fs.readFileSync(path.join(root,'verify/recovery/dispositions.json')));}catch{return null;}
 if(registry.schema!=='forge.receipt-dispositions.v1')return null;const rule=(registry.cases||[]).find(r=>r.requestIds?.includes(c.requestId)&&r.sourceEntryDigest===digest(c.entry));if(!rule)return null;
 // A retired failed transaction stays retired. A later job reopening creates new work, never a replay of this old write.
 for(const reason of ['CURRENT_OBLIGATION_SATISFIED','CONFIRMED_NO_MASTER_WRITE']){
  const file=path.join(root,'verify/recovery/resolutions',digest([c.requestId,c.entry,'CLOSED_NO_ACTIVE_WORK',reason])+'.json');let p;try{p=JSON.parse(fs.readFileSync(file));}catch{continue;}
  if(p.status!=='CLOSED_NO_ACTIVE_WORK'||canonical(p.sourceEntry)!==canonical(c.entry)||p.writerSubmissions!==0||p.masterMutations!==0||p.source?.repo!=='tpruittguitar/forge-writer-state'||!/^[a-f0-9]{40}$/.test(p.source.sha||'')||!p.closure)continue;
  const rowsValid=Array.isArray(p.rows)&&p.rows.length>0&&p.rows.every(r=>/^[a-f0-9]{64}$/.test(r.sha256||'')&&Date.parse(r.readAt)>Date.parse(c.entry.at)&&(r.status==='TERMINAL_NO_REWORK'&&terminal.has(r.bucket)||['SUPERSEDED_BY_VERIFIED_REFRESH','CURRENT_INTENT_ALREADY_PRESENT'].includes(r.status)&&Object.keys(r.fieldProofs||{}).length>0&&Object.values(r.fieldProofs).every(v=>v===true)));
  if(p.closure.kind==='CURRENT_OBLIGATION_SATISFIED'&&!rowsValid)continue;
  if(p.closure.kind==='CONFIRMED_NO_MASTER_WRITE'&&(c.entry.s!=='NOT_PERSISTED'||p.closure.error!=='INTENT_READBACK_FAILED: no master write attempted'))continue;
  return {...p,rows:(p.rows||[]).map(r=>({...r,fields:undefined})),historicalResolution:true,proofRecordedAt:p.checkedAt};
 }
 if(rule.confirmedNoWrite){const p=safeRead(root,rule.confirmedNoWrite),r=p.results?.[c.requestId];if(c.entry.s!=='NOT_PERSISTED'||r?.ok!==false||!/^INTENT_READBACK_FAILED: no master write attempted$/.test(r.error||'')||p.reconciliation?.status!=='RECONCILED_READ_ONLY')return null;return {status:'CLOSED_NO_ACTIVE_WORK',reason:'CONFIRMED_NO_MASTER_WRITE',closure:{kind:'CONFIRMED_NO_MASTER_WRITE',sourceFile:rule.confirmedNoWrite,error:r.error},rows:[],nextAction:'Original non-write was already reconciled. Retain history and replay fence; do not resubmit.'};}
 const specs=rule.rows;if(!Array.isArray(specs)||!specs.length||specs.length>200||new Set(specs.map(r=>r.primaryId)).size!==specs.length)return null;
 const indexed=c.entry.items||[];if(indexed.length&&indexed.some(i=>!specs.some(r=>r.primaryId===i.pid)))return null;
 for(const s of specs){if(indexed.some(i=>i.pid===s.primaryId))continue;const b=safeRead(root,s.bindingFile);if(b.schema!=='forge.writer-event-binding.v1'||b.event?.requestId!==c.requestId||b.event?.primaryId!==s.primaryId||!b.event.after)return null;}
 const rows=await readRows(c.requestId,specs.map(s=>s.primaryId)),proofs=[];
 for(let n=0;n<specs.length;n++){const s=specs[n],r=rows[n];if(!r||r.error||r.missing||r.primaryId!==s.primaryId||!Number.isFinite(Date.parse(r.readAt))||Date.parse(r.readAt)<=Date.parse(c.entry.at))return null;
  if(terminal.has(r.bucket)){proofs.push({...r,fields:undefined,status:'TERMINAL_NO_REWORK'});continue;}
  let expected;if(s.successor){const e=index.requests[s.successor.requestId],b=safeRead(root,s.successor.bindingFile),event=b.event;if(e?.s!=='COMPLETE'||e.w!==s.successor.writeId||Date.parse(e.at)<=Date.parse(c.entry.at)||event?.requestId!==s.successor.requestId||event.primaryId!==s.primaryId||event.kind!=='ENRICH'||Date.parse(event.ts)<=Date.parse(c.entry.at))return null;
   const after=fields(event.after),before=fields(event.before);expected=Object.fromEntries(Object.entries(after).filter(([k,v])=>/^(SALARY_|DEGREE_)/.test(k)&&v!==before[k]));if(!Object.hasOwn(expected,'SALARY_BASE_HIGH'))return null;
  }else{const b=safeRead(root,s.bindingFile),after=fields(b.event.after),before=fields(b.event.before);expected=Object.fromEntries(Object.entries(after).filter(([k,v])=>(/^FIT_/.test(k)||k==='SCOPE_FIT_RAW')&&v!==before[k]));}
  if(!Object.keys(expected).length)return null;const matches=Object.fromEntries(Object.entries(expected).map(([k,v])=>[k,r.fields?.[k]===v]));if(Object.values(matches).some(x=>!x))return null;
  proofs.push({...r,fields:undefined,status:s.successor?'SUPERSEDED_BY_VERIFIED_REFRESH':'CURRENT_INTENT_ALREADY_PRESENT',fieldProofs:matches,expectedFields:expected,successor:s.successor?{requestId:s.successor.requestId,writeId:s.successor.writeId,receiptState:'COMPLETE'}:null});
 }
 return {status:'CLOSED_NO_ACTIVE_WORK',reason:'CURRENT_OBLIGATION_SATISFIED',closure:{kind:'CURRENT_OBLIGATION_SATISFIED',requestIds:rule.requestIds,sourceEntryDigest:rule.sourceEntryDigest},rows:proofs,nextAction:'No further work: exact jobs are protected/terminal or intended fields are already present under verified evidence. Original failure remains historical; no receipt success or throughput is invented.'};
}
module.exports={fields,closeCase,digest};
