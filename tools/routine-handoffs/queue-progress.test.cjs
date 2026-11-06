'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm');
const S=require('../programmed-coordinator/store.cjs'),G=require('./mail-connector.cjs'),M=require('./mail.cjs'),Content=require('./mail-content.cjs'),Q=require('./exceptions.cjs'),W=require('./exception-work.cjs');
function dir(t){const p=fs.mkdtempSync(path.join(os.tmpdir(),'forge-queue-progress-'));t.after(()=>fs.rmSync(p,{recursive:true,force:true}));return p;}
function raw(id,extra={}){return{id,thread_id:id,internal_date:String(Date.now()-1000),payload:{mime_type:'text/plain',headers:[],body:{content:'Complete original source text.'}},...extra};}
function patchTool(files){return async patch=>{const lines=patch.split('\n'),file=lines[1].slice('*** Add File: '.length);files.set(file,JSON.parse(lines.slice(2,-1).map(s=>s.slice(1)).join('\n')));return{};};}
test('serialized connector and canonical normalization share the same full-MIME contract',async()=>{
 const messages=[raw('aaa'),raw('bbb',{truncated:true}),raw('ccc',{payload:{mime_type:'multipart/alternative',parts:[{mime_type:'text/plain',body:{attachment_id:'unread-handle'}}]}}),raw('ddd',{payload:{mime_type:'text/html',body:{content:'<script>hidden</script>&nbsp;'}}})];
 const files=new Map(),tools={apply_patch:patchTool(files),mcp__codex_apps__gmail_batch_read_email:async()=>({structuredContent:{responses:messages}})},cfg={directory:'/private/gmail',inbox:'/private/inbox',request:{id:'test',pendingIds:[],query:'test',through:new Date().toISOString()},pages:[{page:0,requestToken:null,messageIds:messages.map(x=>x.id),nextPageToken:null}],cachedIds:[]};
 const serialized='('+G.host.toString()+')(tools,cfg,('+Content.toString()+'))',report=await vm.runInNewContext(serialized,{tools,cfg});
 a.equal(report.read,1);a.equal(report.pending,3);a.deepEqual(Array.from(report.captureFailures,x=>x.messageId),['bbb','ccc','ddd']);
 const capture=[...files.values()].find(x=>x.schema==='forge.gmail-source-capture.v1');a.equal(capture.responses.length,4);
 for(const source of capture.responses)a.equal(Content(source).fullBody,M.normalize(source).fullBody);
 a.equal(files.get('/private/gmail/inventories/test.json').readFailures.length,3);
});
test('bound enumeration advances only collection progress while incomplete bodies and historical semantic gaps remain pending',async t=>{
 const root=dir(t),privateDir=dir(t),old=new Date(Date.now()-10*86400000).toISOString(),enumerated=new Date(Date.now()-2*3600000).toISOString(),cursor={fullyReadThrough:old,enumeratedThrough:enumerated,pendingMessageIds:['aaa'],processedMessageIds:[],queryPagesPending:0,historicalCoverage:'UNPROVEN'};
 S.save(root,'state/APPLICATION_TRACKER_CURSOR.json',cursor);
 const cfg=G.prepare({repositoryDirectory:root,privateDirectory:privateDir});
 a.equal(Number(cfg.request.query.match(/after:(\d+)/)[1]),Math.floor((Date.parse(enumerated)-48*3600000)/1000));
 const files=new Map(),tools={apply_patch:patchTool(files),mcp__codex_apps__gmail_search_email_ids:async()=>({structuredContent:{message_ids:[],next_page_token:null}}),mcp__codex_apps__gmail_batch_read_email:async()=>({structuredContent:{responses:[raw('aaa',{truncated:true})]}})};
 a.equal((await G.host(tools,cfg)).pending,1);
 for(const [file,value]of files)S.save(path.dirname(file),path.basename(file),value);
 G.ingest(root,privateDir);const next=S.read(root,'state/APPLICATION_TRACKER_CURSOR.json');
 a.equal(next.collectionThrough,cfg.request.through);a.equal(next.fullyReadThrough,old);a.equal(next.historicalCoverage,'UNPROVEN');a.deepEqual(next.pendingMessageIds,['aaa']);a.equal(next.collectionProof.fullBodyCoverageClaimed,false);
 const following=G.prepare({repositoryDirectory:root,privateDirectory:privateDir});a.equal(Number(following.request.query.match(/after:(\d+)/)[1]),Math.floor((Date.parse(next.collectionThrough)-48*3600000)/1000));a.deepEqual(following.cachedIds,[]);
 // A source capture is not a semantic disposition, even when there are no
 // remaining result pages in this collection window.
 require('./mail-pipeline.cjs').updateCursor(root,{messages:{},transactions:{},exceptions:{}});
 const after=S.read(root,'state/APPLICATION_TRACKER_CURSOR.json');a.equal(after.fullyReadThrough,old);a.equal(after.collectionThrough,next.collectionThrough);
});
function workFixture(t){
 const root=dir(t),work=W.empty(),now=Date.now()-1000;
 for(const [i,kind]of ['SOURCE','SOURCE','MAIL','WRITER','IDENTITY','HISTORICAL'].entries()){
  const binding={key:'case-'+i,sourceVersion:'source-'+i},exceptionId=S.hash(binding);
  work.cases[exceptionId]={exceptionId,binding,kind,status:'ACTION_REQUIRED',firstSeen:new Date(now-i*1000).toISOString(),owner:'ChatGPT',taskKey:W.OWNER};
 }
 S.save(root,W.FILE,work);
 const review=(item,offset=0,extra={})=>({schema:'forge.ai-exception-review.v1',exceptionId:item.exceptionId,sourceVersion:item.binding.sourceVersion,reviewedBy:'CHATGPT',taskKey:W.OWNER,reviewedAt:new Date(now+offset).toISOString(),runId:'FORGE-EXCEPTION-CHATGPT-TEST'+offset,disposition:'WAITING_SOURCE_CHANGE',reason:'SOURCE_EVIDENCE_UNAVAILABLE',retryCondition:'NEW_ORIGINAL_SOURCE_EVIDENCE',evidenceSha256:'a'.repeat(64),...extra});
 return{root,work,now,review};
}
test('mixed exception chunks rotate classes durably after accepted reviews without hiding obligations or imposing a run cap',t=>{
 const f=workFixture(t),before=fs.readFileSync(path.join(f.root,W.FILE),'utf8'),initial=Q.queue(f.root,{size:2});
 a.deepEqual(initial.items.map(x=>x.kind),['MAIL','WRITER']);a.equal(initial.hasMore,true);a.equal(initial.actionable,6);a.equal(Q.queue(f.root).items.length,6);a.equal(fs.readFileSync(path.join(f.root,W.FILE),'utf8'),before);
 const mail=initial.items[0];W.publishReview(f.root,f.review(mail),Date.now());
 let q=Q.queue(f.root,{size:1});a.equal(q.items[0].kind,'WRITER');a.equal(q.waiting.find(x=>x.exceptionId===mail.exceptionId).status,'WAITING_SOURCE_CHANGE');a.equal(q.dispatchCursor.lastReviewedKind,'MAIL');
 const writer=q.items[0];W.publishReview(f.root,f.review(writer,1),Date.now());q=Q.queue(f.root,{size:1});a.equal(q.items[0].kind,'SOURCE');
 const source=q.items[0],proposal=f.review(source,2,{disposition:'SOURCE_EVIDENCE',reason:undefined,retryCondition:undefined,sourceEvidence:{company:'Factory',title:'Plant Manager',location:'Austin, TX',url:'https://careers.factory.com/job/123',quote:'Lead the exact manufacturing operations team.',observedAt:new Date(f.now).toISOString()}});
 W.publishReview(f.root,proposal,Date.now());q=Q.queue(f.root,{size:1});a.equal(q.items[0].kind,'IDENTITY');
 const sources=Q.queue(f.root).items.filter(x=>x.kind==='SOURCE');a.equal(sources.length,2);a.notEqual(sources[0].exceptionId,source.exceptionId);a.equal(sources[1].exceptionId,source.exceptionId);a.equal(sources[1].status,'ACTION_REQUIRED');a.equal(sources[1].canonicalCompletion,undefined);
 // Publication of an older review cannot move the durable cursor backward.
 W.publishReview(f.root,f.review(mail,-1),Date.now());a.equal(Q.queue(f.root).dispatchCursor.lastReviewedKind,'SOURCE');
 const held=S.read(f.root,W.FILE);a.equal(held.cases[mail.exceptionId].review.reviewedAt,f.review(mail).reviewedAt);
 a.equal(S.files(path.join(f.root,W.REVIEWS)).length,4);a.throws(()=>Q.queue(f.root,{size:0}),/CHUNK/);
});
test('a rejected exception review cannot advance dispatch or remove pending work',t=>{
 const f=workFixture(t),item=Q.queue(f.root).items[0],before=S.read(f.root,W.FILE);
 a.throws(()=>W.publishReview(f.root,f.review(item,0,{sourceVersion:'stale'}),Date.now()),/SOURCE_BOUND/);
 a.deepEqual(S.read(f.root,W.FILE),before);a.equal(Q.queue(f.root).actionable,6);
});
test('capture-only scheduled executions cannot claim AI review completion and repeated stalls expose the next exact case',t=>{
 const f=workFixture(t),P=require('./exception-progress.cjs');
 for(const [i,runId]of ['FORGE-EXCEPTION-CHATGPT-CAPTURE01','FORGE-EXCEPTION-CHATGPT-CAPTURE02'].entries()){
  const manifest=P.start(f.root,runId,2,f.now+i);a.equal(manifest.selected.length,2);a.equal(Q.queue(f.root).progress.uncheckpointedRuns.some(r=>r.runId===runId),true);
  const input={runId,completedAt:new Date(f.now+10+i).toISOString(),sourceCaptures:100,attempts:[]},receipt=P.checkpoint(f.root,input,Date.now());
  a.equal(receipt.attempted,0);a.equal(receipt.reviewed,0);a.equal(receipt.resolved,0);a.equal(receipt.status,'NO_REVIEW_PROGRESS');a.equal(receipt.stalled,i===1);a.ok(receipt.nextCase.exceptionId);
  a.deepEqual(P.checkpoint(f.root,input,Date.now()),receipt);a.equal(P.snapshot(f.root).consecutiveNoReviewProgress,i+1);
 }
 a.equal(Q.queue(f.root).progress.status,'AI_REVIEW_STALLED');a.deepEqual(Q.queue(f.root).progress.uncheckpointedRuns,[]);
});
test('source-bound attempts rotate service even without a completed disposition and reject invented or stale attempts',t=>{
 const f=workFixture(t),P=require('./exception-progress.cjs'),runId='FORGE-EXCEPTION-CHATGPT-ATTEMPT01',manifest=P.start(f.root,runId,1,f.now),selected=manifest.selected[0],attempt={exceptionId:selected.exceptionId,sourceVersion:selected.binding.sourceVersion,observedAt:new Date(f.now+1).toISOString(),evidenceSha256:'b'.repeat(64),reason:'Exact source examined; identity remains unresolved',nextAction:'Read the original employer requisition evidence'};
 a.equal(selected.kind,'MAIL');a.equal(P.start(f.root,runId,20,f.now+1).selected.length,1);
 const input={runId,completedAt:new Date(f.now+10).toISOString(),attempts:[attempt]};
 a.throws(()=>P.checkpoint(f.root,{...input,attempts:[{...attempt,sourceVersion:'changed'}]},Date.now()),/SOURCE_EXAMINATION/);
 a.throws(()=>P.checkpoint(f.root,{...input,attempts:[{...attempt,reviewPath:W.REVIEWS+'/missing.json'}]},Date.now()),/IMMUTABLE_PROGRESS_REVIEW/);
 const r=P.checkpoint(f.root,input,Date.now());a.equal(r.attempted,1);a.equal(r.reviewed,0);a.equal(r.resolved,0);a.equal(r.status,'NO_REVIEW_PROGRESS');a.equal(Q.queue(f.root).items[0].kind,'WRITER');
 const work=S.read(f.root,W.FILE);a.equal(work.cases[selected.exceptionId].status,'ACTION_REQUIRED');a.equal(work.cases[selected.exceptionId].lastAttempt.sourceVersion,selected.binding.sourceVersion);
 a.throws(()=>P.checkpoint(f.root,{...input,sourceCaptures:2},Date.now()),/IMMUTABLE_EXCEPTION_PROGRESS_CHANGED/);
});
test('accepted source-bound dispositions advance scheduled progress but waiting never becomes canonical completion',t=>{
 const f=workFixture(t),P=require('./exception-progress.cjs'),runId='FORGE-EXCEPTION-CHATGPT-REVIEW01',manifest=P.start(f.root,runId,1,f.now),selected=manifest.selected[0],record=f.review(f.work.cases[selected.exceptionId],1,{runId}),published=W.publishReview(f.root,record,Date.now());
 const receipt=P.checkpoint(f.root,{runId,completedAt:new Date(f.now+10).toISOString(),attempts:[{exceptionId:selected.exceptionId,sourceVersion:selected.binding.sourceVersion,observedAt:record.reviewedAt,evidenceSha256:record.evidenceSha256,reason:record.reason,nextAction:'Wait for independently changed source evidence',reviewPath:published.path}]},Date.now());
 a.equal(receipt.reviewed,1);a.equal(receipt.waiting,1);a.equal(receipt.resolved,0);a.equal(receipt.canonicalCompletionsClaimed,0);a.equal(receipt.status,'AI_REVIEW_DISPOSITIONS_RECORDED');a.equal(Q.queue(f.root).items[0].kind,'WRITER');
});
test('failure -> exact source review -> independent verification -> original Writer proof -> resolved exception progresses end to end',async t=>{
 const root=dir(t),privateDir=dir(t),P=require('./exception-progress.cjs'),Run=require('../programmed-coordinator/run.cjs'),Source=require('../programmed-coordinator/source.cjs'),T=require('../programmed-coordinator/transactions.cjs'),pid='V2I-ABC123',row={PRIMARY_ID:pid,COMPANY:'Factory',TITLE:'Plant Manager',LOCATION:'Austin, TX',BUCKET:'SCOUT_INTAKE',p:{},line:'current exact canonical row'};
 const original={primaryId:pid,recommendation:'NEEDS_SOURCE_EVIDENCE',writerSubmitted:false,sourceEvidence:{company:row.COMPANY,title:row.TITLE,location:row.LOCATION,url:'https://careers.factory.com/old',quote:''}},batch='receipts/CHATGPT_HELPERS/FORGE_CHATGPT_ENRICHMENT_RESEARCH/PROGRESS-TEST.json',key='FORGE_CHATGPT_ENRICHMENT_RESEARCH:'+pid,item={key,itemKey:pid,taskKey:'FORGE_CHATGPT_ENRICHMENT_RESEARCH',batch,version:S.hash(original),status:'EXCEPTION',attempts:2};
 S.save(root,batch,{items:[original]});S.save(root,'state/EMAIL_RECOVERY_QUEUE.json',{jobs:{},sources:{}});
 const state={items:{[key]:item},batches:{[batch]:{status:'VALIDATED'}},transactions:{},exceptions:{[key]:{key,owner:'CODE',reason:'SOURCE_HTTP_404',itemVersion:item.version}}},report=()=>({runId:'FORGE-CODE-PROGRESS',codeExceptions:Object.values(state.exceptions),aiExceptions:[]});
 W.sync({root,state,report:report(),apply:true});const runId='FORGE-EXCEPTION-CHATGPT-ENDTOEND01',manifest=P.start(root,runId,20),job=manifest.selected.find(i=>i.kind==='SOURCE');a.ok(job);
 const quote="Bachelor's degree in manufacturing engineering is required.",at=new Date().toISOString(),review={schema:'forge.ai-exception-review.v1',exceptionId:job.exceptionId,sourceVersion:job.binding.sourceVersion,reviewedBy:'CHATGPT',taskKey:W.OWNER,reviewedAt:at,runId,disposition:'SOURCE_EVIDENCE',evidenceSha256:'c'.repeat(64),sourceEvidence:{company:row.COMPANY,title:row.TITLE,location:row.LOCATION,url:'https://careers.factory.com/jobs/123',quote,observedAt:at}},published=W.publishReview(root,review);
 W.applySourceReviews({root,state});const raw='<script type="application/ld+json">'+JSON.stringify({'@type':'JobPosting',title:row.TITLE,hiringOrganization:{name:row.COMPANY},jobLocation:{address:{addressLocality:'Austin',addressRegion:'TX'}},description:quote+' Lead the manufacturing operations team safely and improve production quality. '.repeat(10)})+'</script>';
 await Run.inspectReturns({root,privateDir,state,snapshot:{rows:[row],archiveRows:[]},apply:true,sourceVerify:args=>Source.verify({...args,fetchPage:async()=>({url:review.sourceEvidence.url,raw})})});a.equal(item.status,'READY_ENRICHMENT');
 let payload;const deps={checkLock:()=>{},snapshot:async()=>({rows:[row],status:{freeze:null,level:'OK',errors:[],unverified:{}}}),exists:async()=>false,post:async p=>{payload=p;return{ok:true,mode:'BATCH_RULING_SINGLE_COMMIT',writeId:'W-PROGRESS',results:p.requests.map(x=>({ok:true,requestId:x.ruling.requestId,primaryId:x.ruling.primaryId}))};}};
 const tx=await T.submit({root,privateDir,state,jobs:[{...item.prepared,itemKey:key}],runId:'FORGE-CODE-PROGRESS',deps});
 deps.index=async()=>({sha:'a'.repeat(40),index:{requests:Object.fromEntries(tx.requests.map(r=>[r.requestId,{s:'COMPLETE',w:'W-PROGRESS',items:[{pid}]}]))}});
 deps.rows=async()=>({startedAt:new Date().toISOString(),rows:[{...row,p:{...payload.requests[0].ruling.fields},line:'independently read exact updated canonical row'}]});
 a.equal(await T.reconcile({root,privateDir,state,tx,deps}),'VERIFIED');W.sync({root,state,report:report(),apply:true});a.equal(S.read(root,W.FILE).cases[job.exceptionId].status,'NO_LONGER_OPEN');
 const receipt=P.checkpoint(root,{runId,completedAt:new Date().toISOString(),attempts:[{exceptionId:job.exceptionId,sourceVersion:job.binding.sourceVersion,observedAt:at,evidenceSha256:review.evidenceSha256,reason:'Exact source recovered and proposed through the existing coordinator',nextAction:'Retain original verified Writer proof; no replay',reviewPath:published.path}]});
 a.equal(receipt.attempted,1);a.equal(receipt.reviewed,1);a.equal(receipt.resolved,1);a.equal(receipt.awaitingIndependentCode,0);a.equal(receipt.resolutions[0].kind,'VERIFIED_CANONICAL_EFFECT');a.equal(receipt.canonicalCompletionsClaimed,0);
});
test('withdrawn or superseded selections are explicit stale work, never invented resolution or a review-stall blocker',t=>{
 const f=workFixture(t),P=require('./exception-progress.cjs'),runId='FORGE-EXCEPTION-CHATGPT-SUPERSEDED01',manifest=P.start(f.root,runId,1,f.now),selected=manifest.selected[0],work=S.read(f.root,W.FILE);
 work.cases[selected.exceptionId].status='NO_LONGER_OPEN';S.save(f.root,W.FILE,work);
 const input={runId,completedAt:new Date(f.now+10).toISOString(),attempts:[]};
 a.throws(()=>P.checkpoint(f.root,{...input,attempts:[{exceptionId:selected.exceptionId,sourceVersion:selected.binding.sourceVersion,observedAt:new Date(f.now+1).toISOString(),evidenceSha256:'a'.repeat(64),reason:'Old source inspected',nextAction:'Read current binding'}]},Date.now()),/SOURCE_EXAMINATION/);
 const receipt=P.checkpoint(f.root,input,Date.now());a.equal(receipt.status,'STALE_SELECTION');a.equal(receipt.resolved,0);a.equal(receipt.superseded.length,1);a.equal(receipt.stalled,false);a.equal(receipt.stillActionable,0);a.notEqual(receipt.nextCase.exceptionId,selected.exceptionId);
});
test('progress publication uses the existing accounting route and excludes arbitrary private payloads',t=>{
 const f=workFixture(t),P=require('./exception-progress.cjs'),Publish=require('../programmed-coordinator/publish.cjs'),runId='FORGE-EXCEPTION-CHATGPT-PRIVACY01',manifest=P.start(f.root,runId,1,f.now),selected=manifest.selected[0],input={runId,completedAt:new Date(f.now+10).toISOString(),attempts:[]};
 a.equal(Publish.allowed(P.FILE),true);a.equal(Publish.allowed(P.DIRECTORY+'/'+runId+'_START.json'),true);a.equal(Publish.allowed(P.DIRECTORY+'/'+runId+'_CHECKPOINT.json'),true);a.equal(Publish.allowed(P.DIRECTORY+'/private-message.json'),false);a.equal(Publish.allowed('receipts/FORGE-MAIL-CHATGPT-'+ 'a'.repeat(32)+'-A2_CHECKPOINT.json'),true);a.equal(Publish.allowed('receipts/FORGE-MAIL-CHATGPT-'+ 'a'.repeat(32)+'-A2_NOT_ACCEPTED.json'),true);a.equal(Publish.allowed('receipts/FORGE-MAIL-CHATGPT-'+ 'a'.repeat(32)+'-A0_VERIFIED.json'),false);
 a.throws(()=>P.checkpoint(f.root,{...input,body:'Private mail text'},Date.now()),/SOURCE_BOUND_EXCEPTION_PROGRESS/);
 a.throws(()=>P.checkpoint(f.root,{...input,attempts:[{exceptionId:selected.exceptionId,sourceVersion:selected.binding.sourceVersion,observedAt:new Date(f.now+1).toISOString(),evidenceSha256:'a'.repeat(64),reason:'Examined source',nextAction:'Retry with current source',body:'Private mail text'}]},Date.now()),/SOURCE_EXAMINATION/);
});
