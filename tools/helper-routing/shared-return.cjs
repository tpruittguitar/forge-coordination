'use strict';
// Optional deliver-time tooling. Reads assignments and exact return bytes only;
// never publishes, changes reservations, repairs evidence, or invokes Writer.
const fs=require('node:fs'),H=require('./shared.cjs'),S=require('../programmed-coordinator/store.cjs');
function template(work,taskKey,instructionCommit,runId,after=null,now=Date.now()){
 const page=H.next(work,taskKey,after,now),provider=H.TASKS[taskKey];
 if(!/^[a-f0-9]{40}$/.test(instructionCommit||'')||!new RegExp('^FORGE-'+provider.toUpperCase()+'-[A-Za-z0-9_-]+$').test(runId||''))throw Error('INVALID_SHARED_RETURN_IDENTITY');
 if(!page.items.length)throw Error('NO_ELIGIBLE_SHARED_ITEMS');
 // Nulls deliberately fail validation until real research is supplied. Assigned
 // identity is a starting point, not independently verified source evidence.
 return{schema:'forge.shared-helper-batch.v1',provider,taskKey,assignmentId:page.assignmentId,runId,instructionCommit,writerSubmitted:false,
  items:page.items.map(i=>({kind:i.kind,...(i.primaryId?{primaryId:i.primaryId}:{key:i.key}),assignmentVersion:i.assignmentVersion,sourceVersion:i.sourceVersion,writerSubmitted:false,recommendation:null,
   sourceEvidence:{company:i.company||i.sourceEvidence?.company||null,title:i.title||i.sourceEvidence?.title||null,location:i.location||i.sourceEvidence?.location||null,url:null,observedAt:null,quote:null,capture:{kind:'TEXT_EXTRACT',text:null}}}))};
}
function preflight(bytes,work){
 if(!Buffer.isBuffer(bytes))throw Error('EXACT_SHARED_RETURN_BYTES_REQUIRED');
 if(bytes.length>2000000)throw Error('SHARED_BATCH_TOO_LARGE');
 const batch=JSON.parse(new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes));
 const validation=H.validateBatch(batch,work);
 return{...validation,sha256:S.hash(bytes),bytes:bytes.length,deliveryVerified:false};
}
function guidance(error){
 if(error instanceof SyntaxError)return 'Save the complete JSON object, without Markdown, placeholder text or truncation.';
 return ({
  INVALID_SHARED_HELPER_ENVELOPE:'Use the actual batch schema, provider/task, assignment ID, instruction SHA, unique run ID and 1–20 researched items.',
  HELPER_WRITER_SUBMISSION_FORBIDDEN:'Use false only for an evidence return with no Writer submission. Each present flag must be false; an omitted item flag needs explicit batch false.',
  INVALID_SHARED_RECOMMENDATION:'Replace template nulls with the actual research outcome. Do not invent ready evidence.',
  STALE_OR_UNASSIGNED_SHARED_ITEM:'Refresh current ownership and assignment/source versions. Preserve the original artifact; do not relabel stale research as current.',
  SHARED_SOURCE_PROOF_REQUIRED:'Supply the actual observation time, exact quote and real source hash or verbatim capture. Never invent missing source facts.',
  SHARED_CAPTURE_REQUIRED:'Include 300+ characters of verbatim source text, at most 200,000 UTF-8 bytes, or report the actual source blocker.',
  SHARED_CAPTURE_QUOTE_REQUIRED:'Use one exact contiguous source quote, not a summary or joined snippets. Do not rewrite the capture to fit the quote.',
  SHARED_CAPTURE_HASH_MISMATCH:'Keep the original source bytes and their real hash. Never replace a mismatched hash with a fabricated value.',
  SHARED_EXCEPTION_ACCOUNTING_REQUIRED:'Report the actual reason, research owner and retry condition for each non-ready item.',
  SHARED_BATCH_TOO_LARGE:'Split into smaller complete artifacts. Never truncate evidence.'
 })[error.message]||'Fix the reported contract error in a new complete artifact; validation never proves source truth, delivery or Writer completion.';
}
if(require.main===module){try{
 const [command,...args]=process.argv.slice(2),work=H.load();
 if(command==='template'&&args.length>=3&&args.length<=4)console.log(JSON.stringify(template(work,...args),null,2));
 else if(command==='validate'&&args.length===1)console.log(JSON.stringify(preflight(fs.readFileSync(args[0]),work)));
 else throw Error('Usage: shared-return.cjs template <TASK_KEY> <instructionCommit> <runId> [nextAfter] | validate <file>');
}catch(e){console.error(e.message+'\n'+guidance(e));process.exitCode=1;}}
module.exports={template,preflight,guidance};
