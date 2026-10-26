#!/usr/bin/env node
'use strict';
/* Shared Writer verification service (Claude 2026-10-26, Tim: yes). READ-ONLY.
 * Any lane that sent work through the Writer (Drive WRITER_QUEUE or a direct route) but cannot run the Writer's
 * authenticated reads itself creates verify/requests/<ACTOR>-<YYYYMMDD-HHMM>-<slug>.json:
 *   {"schema":"forge.writer-verify-request.v1","requested_by":"<PROVIDER> <RUN_ID>",
 *    "requests":[{"requestId":"<RUN_ID>-B01","primaryIds":["V2I-..."]}]}
 * primaryIds come from the Writer's own RESULT file (receipt.NEW_PRIMARY_IDS, or results[].PRIMARY_ID): receipt_index
 * entries no longer list row IDs, so the row binding must come from the Writer's acceptance.
 * For each request: receipt_index first; request_result only when the index says COMPLETE (a pending request_result
 * can trigger Writer-side verification); exact row_readback of the supplied IDs. Never POSTs, never retries a write.
 * Answer: verify/results/<same name>.json with one verdict per request:
 *   VERIFIED            index COMPLETE + durable request_result COMPLETE + every ID read back exactly (matches=1)
 *   COMPLETE_UNBOUND    index and result COMPLETE but no primaryIds supplied (a no-op, or the lane must send IDs)
 *   PENDING             index entry not COMPLETE yet; rechecked by later runs for 24 h
 *   NOT_IN_INDEX        no index entry: the Writer has no master transaction for this request
 *   HELD                index state NEEDS_RESOLUTION / NOT_PERSISTED / FALSE_COMPLETE, or result not durable
 *   ROWS_MISSING        COMPLETE, but an ID is absent or not exactly once in the master
 *   REJECTED            malformed request (reason given)
 *   CHECK_FAILED        the read itself failed (reason given); rechecked by later runs
 * Row fields returned: PRIMARY_ID, COMPANY, TITLE, LOCATION, BUCKET (this repo is public; nothing else).
 * Run: FORGE_WRITER_KEY=... node tools/writer-verify/verify.js [--root .] */
const fs=require('node:fs'),path=require('node:path');
const {read}=require('../source-intake/writer-reader');

const REQ_DIR='verify/requests',RES_DIR='verify/results';
const NAME=/^[A-Z][A-Z0-9_-]{1,40}-\d{8}-\d{4}[A-Za-z0-9_.-]*\.json$/;
const RID=/^[A-Za-z0-9_-]{3,160}$/,PID=/^V2[A-Z]-[A-Za-z0-9_-]+$/;
const TERMINAL_BAD=new Set(['NEEDS_RESOLUTION','NOT_PERSISTED','FALSE_COMPLETE']);
const RECHECK=new Set(['PENDING','CHECK_FAILED']),RECHECK_MS=24*3600e3;

function validate(doc){
 if(!doc||doc.schema!=='forge.writer-verify-request.v1')return 'schema must be forge.writer-verify-request.v1';
 if(typeof doc.requested_by!=='string'||!doc.requested_by.trim())return 'requested_by required';
 if(!Array.isArray(doc.requests)||!doc.requests.length||doc.requests.length>50)return 'requests must hold 1-50 entries';
 for(const r of doc.requests){
  if(!r||!RID.test(r.requestId||''))return 'bad requestId '+JSON.stringify(r?.requestId);
  const ids=r.primaryIds===undefined?[]:r.primaryIds;
  if(!Array.isArray(ids)||ids.length>25||ids.some(x=>!PID.test(x))||new Set(ids).size!==ids.length)return 'bad primaryIds for '+r.requestId+' (0-25 distinct V2X-... IDs)';
 }
 return null;
}
const cells=line=>{const c=String(line||'').split(' | ');return c.length>=10?{PRIMARY_ID:c[1],COMPANY:c[2],TITLE:c[3],BUCKET:c[4],LOCATION:c[8]}:null};

async function verifyOne({requestId,primaryIds=[]},{key,transport}){
 const out={requestId,primaryIds};
 const idx=(await read('receipt_index',{key,transport,requestId})).data;
 if(idx.source!=='GITHUB'||idx.exists!==true||!idx.sha)return {...out,verdict:'CHECK_FAILED',reason:'receipt index not authoritative'};
 out.receiptIndex={sha:idx.sha,updatedAt:idx.updatedAt||null,state:idx.request?(idx.request.s||'UNSTATED'):'NO_ENTRY'};
 if(!idx.request)return {...out,verdict:'NOT_IN_INDEX'};
 if(TERMINAL_BAD.has(idx.request.s))return {...out,verdict:'HELD',reason:'index state '+idx.request.s};
 if(idx.request.s!=='COMPLETE')return {...out,verdict:'PENDING'};
 const rr=(await read('request_result',{key,transport,requestId})).data;
 out.requestResult={found:rr.found===true,source:rr.source||null,status:rr.status||null,durable:rr.durable===true};
 if(!rr.found||rr.requestId!==requestId||rr.status!=='COMPLETE'||rr.durable!==true)return {...out,verdict:'HELD',reason:'request_result not durable COMPLETE'};
 if(!primaryIds.length)return {...out,verdict:'COMPLETE_UNBOUND'};
 const rb=(await read('row_readback',{key,transport,requestId,primaryIds})).data;
 const rows=Array.isArray(rb.rows)?rb.rows:[];
 out.rows=primaryIds.map(id=>{const r=rows.find(x=>x.primaryId===id);return {primaryId:id,found:r?.found===true,matches:r?.matches??0,row:r?cells(r.line):null}});
 const ok=rb.master?.endMarkerPresent===true&&out.rows.every(r=>r.found&&r.matches===1&&r.row?.PRIMARY_ID===r.primaryId);
 return {...out,verdict:ok?'VERIFIED':'ROWS_MISSING'};
}
// Files with no result, or whose result still has PENDING / CHECK_FAILED verdicts younger than 24 h.
function due(root,now=Date.now()){
 const dir=path.join(root,REQ_DIR);if(!fs.existsSync(dir))return [];
 return fs.readdirSync(dir).filter(f=>f.endsWith('.json')).sort().filter(f=>{
  const rp=path.join(root,RES_DIR,f);if(!fs.existsSync(rp))return true;
  let res;try{res=JSON.parse(fs.readFileSync(rp,'utf8'))}catch{return true}
  return now-Date.parse(res.firstCheckedAt||res.checkedAt||0)<RECHECK_MS&&(res.results||[]).some(x=>RECHECK.has(x.verdict));
 });
}
async function processFile(root,f,{key,transport,now=new Date()}){
 const rp=path.join(root,RES_DIR,f);let prev=null;try{prev=JSON.parse(fs.readFileSync(rp,'utf8'))}catch{}
 const base={schema:'forge.writer-verify-result.v1',request:REQ_DIR+'/'+f,checkedAt:now.toISOString(),firstCheckedAt:prev?.firstCheckedAt||now.toISOString(),readOnly:true,writerSubmissions:0};
 let doc,err=null;
 if(!NAME.test(f))err='file name must be <ACTOR>-<YYYYMMDD>-<HHMM>[-slug].json';
 else{try{doc=JSON.parse(fs.readFileSync(path.join(root,REQ_DIR,f),'utf8'))}catch(e){err='bad JSON'}}
 if(!err)err=validate(doc);
 let result;
 if(err)result={...base,status:'REJECTED',reason:err,results:[]};
 else{
  const results=[];
  for(const r of doc.requests){
   const prior=prev?.results?.find(x=>x.requestId===r.requestId);
   if(prior&&!RECHECK.has(prior.verdict)){results.push(prior);continue}
   try{results.push(await verifyOne(r,{key,transport}))}
   catch(e){results.push({requestId:r.requestId,primaryIds:r.primaryIds||[],verdict:'CHECK_FAILED',reason:String(e.message).slice(0,200)})}
  }
  result={...base,requested_by:doc.requested_by,status:'CHECKED',results};
 }
 fs.mkdirSync(path.dirname(rp),{recursive:true});
 fs.writeFileSync(rp,JSON.stringify(result,null,1)+'\n');
 return result;
}
async function main(argv=process.argv.slice(2)){
 const root=argv.includes('--root')?argv[argv.indexOf('--root')+1]:'.';
 const key=process.env.FORGE_WRITER_KEY;if(!key)throw Error('BLOCKED: FORGE_WRITER_KEY not set');
 const files=due(root);
 for(const f of files){
  const r=await processFile(root,f,{key});
  console.log(f+' '+r.status+' '+(r.results||[]).map(x=>x.requestId+'='+x.verdict).join(' ')+(r.reason?' '+r.reason:''));
 }
 if(!files.length)console.log('nothing due');
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1});
module.exports={validate,verifyOne,due,processFile};
