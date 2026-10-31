#!/usr/bin/env node
'use strict';
/* READ-ONLY reconciliation probe for halted AUTO intake runs (Claude 2026-10-26).
 * For each accepted / unconfirmed / held request of the named run(s): receipt_index first; request_result and an exact
 * row_readback only when the index says COMPLETE (same order and checks as durable-readback.js). Never POSTs, never
 * edits a run file, never retries. Writes a public-safe summary (statuses, IDs, match counts; no row text, no key).
 * Run: FORGE_WRITER_KEY=... node tools/source-intake/reconcile-probe.js --run FORGE-AUTO-20261024T0502Z [--run ...] --out F */
const fs=require('node:fs'),path=require('node:path');
const {read}=require('./writer-reader');
const {stableId}=require('./transaction-preflight');
const {inspectDurableReadback}=require('./durable-readback');
const {stoppedAt}=require('./auto-latch');
const DIR='receipts/auto-intake';

// Requests worth proving: every accepted insert, every HOLD/UNKNOWN outcome, and the request the run stopped on.
function targets(state){
 const ids=new Set();
 for(const [rid,r] of Object.entries(state.results||{}))if(r?.WRITE_ACCEPTED===true)ids.add(rid);
 for(const o of state.halts?.at(-1)?.outcomes||[])if(['HOLD','UNKNOWN','PENDING_VERIFICATION'].includes(o.status))ids.add(o.requestId);
 const s=stoppedAt(state);if(s&&!Object.hasOwn(state.results||{},s))ids.add(s);
 return [...ids];
}
async function probeOne(rid,candidate,state,{key,transport}){
 const out={requestId:rid,capturedResponse:Object.hasOwn(state.results||{},rid),capturedPrimaryIds:state.results?.[rid]?.receipt?.NEW_PRIMARY_IDS||[]};
 const index=await read('receipt_index',{key,transport,requestId:rid});
 out.receiptIndex={source:index.data.source,exists:index.data.exists,sha:index.data.sha,updatedAt:index.data.updatedAt,
  requestState:index.data.request?index.data.request.s||'UNSTATED':'NO_ENTRY',
  indexPrimaryIds:Array.isArray(index.data.request?.items)?index.data.request.items.map(x=>x?.pid):[],
  entryKeys:index.data.request?Object.keys(index.data.request).sort():[],
  itemsType:Array.isArray(index.data.request?.items)?'array:'+index.data.request.items.length:typeof index.data.request?.items,
  itemKeys:Array.isArray(index.data.request?.items)?[...new Set(index.data.request.items.flatMap(x=>x&&typeof x==='object'?Object.keys(x):[typeof x]))].sort():[]};
 if(!index.data.request){out.verdict='NOT_IN_RECEIPT_INDEX';return out}
 if(index.data.request.s!=='COMPLETE'){out.verdict='INDEX_NOT_COMPLETE';return out}
 if(!candidate){out.verdict='COMPLETE_NO_CANDIDATE_RECORD';return out}
 const rec=candidate.record,proposal={record:rec,identityHash:stableId(rec)};
 const d=await inspectDurableReadback(proposal,rid,{key,transport});
 out.durable={status:d.status,matchedPrimaryId:d.matchedPrimaryId||null,receiptPrimaryIds:d.receiptPrimaryIds||null,matchedCount:d.matchedCount??null,proofReads:d.proofReads||[]};
 out.verdict=d.status==='CONSISTENT_PENDING_PROVENANCE_VALIDATION'?'COMPLETE_AND_EXACT_ROW_MATCH':d.status;
 if(out.verdict==='COMPLETE_AND_EXACT_ROW_MATCH')return out;
 // Fallback evidence (weaker): the index says COMPLETE but no longer binds row IDs. Read request_result shape, then read
 // back the PRIMARY_ID the Writer returned at write time and compare it to the record. Booleans only; no row text.
 const detail=(await read('request_result',{key,transport,requestId:rid})).data;
 out.requestResult={found:detail.found,source:detail.source,status:detail.status,durable:detail.durable,
  entryKeys:detail.entry?Object.keys(detail.entry).sort():[],itemsType:Array.isArray(detail.entry?.items)?'array:'+detail.entry.items.length:typeof detail.entry?.items,
  primaryIds:Array.isArray(detail.entry?.items)?detail.entry.items.map(x=>x?.pid||x?.PRIMARY_ID||null):[]};
 const pids=out.capturedPrimaryIds.filter(x=>/^V2[A-Z]-[A-Za-z0-9_-]+$/.test(x));
 if(pids.length!==1){out.fallback={status:'NO_CAPTURED_PRIMARY_ID'};return out}
 const rb=(await read('row_readback',{key,transport,requestId:rid,primaryIds:pids})).data;
 const row=(rb.rows||[])[0]||{},c=String(row.line||'').split(' | '),n=require('./writer-cell').normalizeCell;
 out.fallback={primaryId:pids[0],endMarker:rb.master?.endMarkerPresent===true,found:row.found===true,matches:row.matches??null,
  companyMatch:n(c[2])===n(rec.COMPANY),titleMatch:n(c[3])===n(rec.TITLE),locationMatch:n(c[8])===n(rec.LOCATION),
  reqIdMatch:!rec.REQ_ID||!c[7]||n(c[7])===n(rec.REQ_ID),columns:c.length};
 const f=out.fallback;
 out.verdict=f.endMarker&&f.found&&f.matches===1&&f.companyMatch&&f.titleMatch&&f.locationMatch&&f.reqIdMatch&&f.columns>=10?
  'COMPLETE_CAPTURED_ID_ROW_MATCH':'COMPLETE_CAPTURED_ID_ROW_MISMATCH';
 return out;
}
async function main(argv=process.argv.slice(2)){
 const runs=[];for(let i=0;i<argv.length;i++)if(argv[i]==='--run')runs.push(argv[++i]);
 const outPath=argv[argv.indexOf('--out')+1];
 if(!runs.length||!outPath||argv.indexOf('--out')<0)throw Error('usage: --run ID [--run ID] --out FILE');
 const key=process.env.FORGE_WRITER_KEY;if(!key)throw Error('BLOCKED: FORGE_WRITER_KEY not set');
 const report={schema:'forge.auto-intake-probe.v1',at:new Date().toISOString(),readOnly:true,writerSubmissions:0,runs:[]};
 for(const run of runs){
  if(!/^FORGE-AUTO-\d{8}T\d{4}Z$/.test(run))throw Error('bad run id '+run);
  const state=JSON.parse(fs.readFileSync(path.join(DIR,run+'.json'),'utf8'));
  let cands=[];try{cands=JSON.parse(fs.readFileSync(path.join(DIR,run+'.candidates.json'),'utf8'))}catch{}
  const byRid=new Map(cands.map(c=>[require('./production-executor').requestId(c.record),c]));
  const entry={run,lastHalt:state.halts?.at(-1)?.message||null,requests:[]};
  for(const rid of targets(state)){
   try{entry.requests.push(await probeOne(rid,byRid.get(rid),state,{key}))}
   catch(e){entry.requests.push({requestId:rid,verdict:'PROBE_BLOCKED',error:String(e.message).slice(0,200)})}
  }
  report.runs.push(entry);
 }
 fs.mkdirSync(path.dirname(outPath),{recursive:true});
 fs.writeFileSync(outPath,JSON.stringify(report,null,1)+'\n');
 for(const r of report.runs)for(const q of r.requests)console.log(r.run,q.requestId,q.verdict);
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1});
module.exports={targets,probeOne};
