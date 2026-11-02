'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),S=require('../programmed-coordinator/store.cjs'),Q=require('./connector-queue.cjs'),B=require('./connector-bridge.cjs'),G=require('./mail-connector.cjs'),M=require('./mail.cjs'),W=require('./mail-writer.cjs');
function dir(t){const d=fs.mkdtempSync(path.join(os.tmpdir(),'forge-connectors-'));t.after(()=>fs.rmSync(d,{recursive:true,force:true}));return d;}
function raw(id='abc123'){return{id,thread_id:id,internal_date:String(Date.now()),payload:{mime_type:'text/plain',headers:[{name:'From',value:'notifications@github.com'}],body:{content:'Repository: Example. workflow run completed'}}};}
function patchTool(files){return async patch=>{const lines=patch.split('\n'),file=lines[1].slice('*** Add File: '.length);files.set(file,JSON.parse(lines.slice(2,-1).map(s=>s.slice(1)).join('\n')));return{};};}
test('Gmail host traverses all real page tokens, bisects oversized reads and retains every failed message',async()=>{
 const files=new Map(),calls=[],tools={apply_patch:patchTool(files),mcp__codex_apps__gmail_search_email_ids:async q=>{calls.push(q);return{structuredContent:q.next_page_token?{message_ids:['ccc'],next_page_token:null}:{message_ids:['aaa','bbb'],next_page_token:'opaque-token'}};},mcp__codex_apps__gmail_batch_read_email:async({message_ids:ids})=>{if(ids.length>1||ids[0]==='bbb')throw Error('size or unavailable');return{structuredContent:{responses:ids.map(id=>raw(id))}};}};
 const result=await G.host(tools,{directory:'private/gmail',inbox:'private/inbox',request:{id:'test',query:'after:1 before:2',through:'2026-11-01T00:00:00Z',pendingIds:['ddd']},pages:[]});
 a.equal(calls.length,2);a.equal(calls[1].next_page_token,'opaque-token');a.equal(result.enumerated,4);a.equal(result.read,3);a.equal(result.pending,1);a.deepEqual(files.get('private/gmail/inventories/test.json').readFailures,['bbb']);
});
test('repeated Gmail page token cannot close an inventory or advance source coverage',async()=>{
 const files=new Map(),tools={apply_patch:patchTool(files),mcp__codex_apps__gmail_search_email_ids:async()=>({structuredContent:{message_ids:['abc'],next_page_token:'same'}})};
 await a.rejects(G.host(tools,{directory:'private/gmail',request:{id:'test',query:'x',pendingIds:[]},pages:[]}),/REPEATED/);a.equal(files.has('private/gmail/inventories/test.json'),false);
});
test('mail hashes ignore mutable labels; partial MIME can recover but immutable completed mail cannot change',async t=>{
 const msg=raw(),normalized=M.normalize(msg);a.equal(normalized.sourceSha256,M.normalize({...msg,label_ids:['UNREAD']}).sourceSha256);a.equal(M.normalize({...msg,truncated:true}).fullBody,false);
 const root=dir(t),privateDir=dir(t),state=W.empty(),deps={checkLock:()=>{}};
 a.equal(await W.process({root,privateDir,state,message:{...normalized,fullBody:false},deps}),'PENDING');
 a.equal(await W.process({root,privateDir,state,message:normalized,deps}),'VERIFIED_NOT_RECRUITING');
 await a.rejects(W.process({root,privateDir,state,message:{...normalized,sourceSha256:'changed'},deps}),/IMMUTABLE/);
});
test('browser queue strictly binds observed source/filter/cursor/control and rejects invalid JSON privately',t=>{
 const directory=dir(t),url='https://www.linkedin.com/jobs/search-results/?keywords=operations&geoId=1',id=Q.enqueue(directory,{type:'RESULTS_PAGE',sourceId:'source',url}),job=S.read(directory,'jobs/'+id+'.json'),at=new Date().toISOString();
 const page=(url,jobId)=>({schema:'forge.result-page-observation.v1',browser:'TinyFish',complete:true,url,at,jobs:[{jobId,paragraphs:['Plant Manager','Example','Austin, TX']}],next:{available:true,kind:'RESULTS_NEXT',proof:'results-next'},endConfirmed:false});
 const result={schema:'forge.browser-pagination-capture.v1',sourceId:'source',complete:true,before:page(url,'1'),after:page(url+'&start=25','2'),clickedControl:'RESULTS_NEXT'};
 a.throws(()=>Q.accept(directory,job,{...result,after:page(url+'&start=25&geoId=2','2')},'12345678-1234-1234-1234-123456789012'),/CHANGED/);
 a.throws(()=>Q.accept(directory,job,{...result,before:{...result.before,at:'Page 1'}},'12345678-1234-1234-1234-123456789012'),/CHANGED|TIME_CONFLICT/);
 Q.accept(directory,job,result,'12345678-1234-1234-1234-123456789012');a.equal(Q.packets(directory,'RESULTS_PAGE').length,1);
 const bad=Q.enqueue(directory,{type:'RESULTS_PAGE',sourceId:'other',url});S.save(directory,'incoming/'+bad+'.json',{jobId:bad,runId:'12345678-1234-1234-1234-123456789012',result:{status:'completed',result:'{"broken'}});a.equal(B.consume({directory}).failures.length,1);a.ok(S.read(directory,'failures/'+bad+'.json'));a.equal(B.pending(directory).length,0);
});
test('one malformed message does not suppress independent mail and cursor only clears durable dispositions',async t=>{
 const root=dir(t),privateDir=dir(t),good=raw('abc'),bad={...raw('def'),internal_date:'not a date'};
 S.save(root,'state/APPLICATION_TRACKER_CURSOR.json',{processedMessageIds:[],pendingMessageIds:['abc','def'],enumeratedThrough:'2026-11-01T00:00:00Z',fullyReadThrough:'2026-10-31T00:00:00Z',queryPagesPending:0});
 S.save(privateDir,'mail-inbox/batch.json',{schema:'forge.gmail-source-capture.v1',transport:'SUPPORTED_GMAIL_CONNECTOR',capturedAt:new Date().toISOString(),request:{format:'full',ids:['abc','def']},responses:[bad,good]});
 const result=await require('./mail-pipeline.cjs').run({root,privateDir,runId:'FORGE-CODE-CHATGPT-TEST',deps:{checkLock:()=>{}},apply:true});
 a.equal(result.processed,1);a.equal(result.exceptions.length,1);a.deepEqual(S.read(root,'state/APPLICATION_TRACKER_CURSOR.json').pendingMessageIds,['def']);a.equal(S.read(root,'state/APPLICATION_TRACKER_CURSOR.json').fullyReadThrough,'2026-10-31T00:00:00Z');
});
test('a pending browser capture is reused across refresh windows and provider polling stays in code',async t=>{
 const directory=dir(t),request={type:'RESULTS_PAGE',sourceId:'source',url:'https://www.linkedin.com/jobs/search-results/?keywords=operations'};
 const id=Q.enqueue(directory,{...request,refreshWindow:1});a.equal(Q.enqueue(directory,{...request,refreshWindow:2}),id);
 const files=new Map();let launches=0,polls=0;
 const tools={apply_patch:patchTool(files),mcp__codex_apps__tinyfish_run_web_automation:async()=>{launches++;return{structuredContent:{runId:'12345678-1234-1234-1234-123456789012'}};},mcp__codex_apps__tinyfish_wait_for_run:async()=>({structuredContent:++polls===1?{status:'running'}:{status:'completed',result:{complete:false,reason:'SOURCE_ACCESS_BLOCKED'}}})};
 const job={...S.read(directory,'jobs/'+id+'.json'),instructions:'read only'},config={directory,profileId:'existing',jobs:[job]};await B.host(tools,config);a.equal(launches,1);a.equal(polls,1);a.equal(files.has(directory+'/incoming/'+id+'.json'),false);await B.host(tools,{...config,jobs:[{...job,run:files.get(directory+'/runs/'+id+'.json')}]});a.equal(launches,1);a.equal(polls,2);a.ok(files.get(directory+'/incoming/'+id+'.json'));
 await B.host(tools,{...config,jobs:[{...job,run:{status:'POST_IN_FLIGHT_UNKNOWN'}}]});a.equal(launches,1);
});
