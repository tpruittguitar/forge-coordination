'use strict';
// Card cs-b83a4249: a rediscovered deleted job comes in as new (Tim 2026-11-25).
const {test}=require('node:test'),assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {requestId,runIntake,reviewedCandidate}=require('./production-executor');
const {nextGeneration,forPick}=require('./request-generation');
const {pick,partitionExisting}=require('./auto-run');
const role={company:'Factory',title:'Director Manufacturing',location:'Austin, TX',url:'https://jobs.example.com/roles/101',place:'TX',level:'DIRECTOR_PLUS'};
const record={COMPANY:'Factory',TITLE:role.title,LOCATION:role.location,SOURCE_URL:role.url};
const row={PRIMARY_ID:'V2I-1',COMPANY:role.company,TITLE:role.title,LOCATION:role.location,p:{SOURCE_URL:role.url}};
const snapshot=rows=>({source:'WRITER',authenticated:true,writerReadAt:new Date().toISOString(),rows});
const base=requestId(record);
const g=n=>base+'-G'+n;
const generationFor=({master=[],archive=[],requests})=>{
 const {identityIndex}=partitionExisting([role],{master:snapshot(master),archive:snapshot(archive)});
 return forPick({identityIndex,requests});
};

test('request ID format: generation 1 unchanged, 2..9 suffixed, anything else refused',()=>{
 assert.match(base,/^FORGE-SOURCE-[0-9A-F]{24}$/);
 assert.equal(requestId({...record,REQUEST_GENERATION:2}),base+'-G2');
 assert.equal(requestId({...record,REQUEST_GENERATION:9}),base+'-G9');
 for(const bad of [0,1,10,'2',2.5,null])assert.throws(()=>requestId({...record,REQUEST_GENERATION:bad}),/invalid request generation/);
});

test('COMPLETE but absent from master and archive gets a new G2 id (G3 when G2 is also COMPLETE and absent)',()=>{
 const gen=generationFor({requests:{[base]:{s:'COMPLETE'}}});
 assert.equal(gen(record,role),2);
 assert.equal(generationFor({requests:{[base]:{s:'COMPLETE'},[g(2)]:{s:'COMPLETE'}}})(record,role),3);
 // A generation still in flight keeps its own id, so the executor fences it exactly as today.
 assert.equal(generationFor({requests:{[base]:{s:'COMPLETE'},[g(2)]:{s:'PENDING'}}})(record,role),2);
 // Exhausted generations are never reused.
 const all={[base]:{s:'COMPLETE'}};for(let n=2;n<=9;n++)all[g(n)]={s:'COMPLETE'};
 assert.equal(generationFor({requests:all})(record,role),null);
 assert.deepEqual(pick({new_roles:[role]},{max:5,sent:new Set(),generation:generationFor({requests:all})}),[]);
});

test('COMPLETE and present in master or archive keeps the original id',()=>{
 const requests={[base]:{s:'COMPLETE'}};
 assert.equal(generationFor({master:[row],requests})(record,role),1);
 assert.equal(generationFor({archive:[row],requests})(record,role),1);
 // Ambiguous / unresolved canonical identity is not proof of absence.
 assert.equal(nextGeneration([record],{requests,presence:'AMBIGUOUS'}),1);
 assert.equal(nextGeneration([record],{requests,presence:'UNRESOLVED'}),1);
 const out=pick({new_roles:[role]},{max:5,sent:new Set([base]),generation:generationFor({master:[row],requests})});
 assert.deepEqual(out,[]);
});

test('not COMPLETE (or not in the index) keeps the original id unchanged',()=>{
 for(const s of ['PENDING','NEEDS_RESOLUTION','FAILED'])assert.equal(generationFor({requests:{[base]:{s}}})(record,role),1);
 assert.equal(generationFor({requests:{}})(record,role),1);
 const out=pick({new_roles:[role]},{max:5,sent:new Set(),generation:generationFor({requests:{}})});
 assert.equal(out.length,1);assert.equal(out[0].record.REQUEST_GENERATION,undefined);assert.equal(requestId(out[0].record),base);
 // An uncertain original under the raw employer name also keeps today's fence.
 const raw={...role,company:'Factory | Industrial Automation'},rawId=requestId({...record,COMPANY:raw.company});
 assert.equal(forPick({identityIndex:partitionExisting([raw],{master:snapshot([]),archive:snapshot([])}).identityIndex,requests:{[base]:{s:'COMPLETE'},[rawId]:{s:'PENDING'}}})(record,raw),1);
});

test('pick sends a rediscovered deleted role under G2 even though the original id was sent before',()=>{
 const out=pick({new_roles:[role]},{max:5,sent:new Set([base]),generation:generationFor({requests:{[base]:{s:'COMPLETE'}}})});
 assert.equal(out.length,1);assert.equal(out[0].record.REQUEST_GENERATION,2);assert.equal(requestId(out[0].record),g(2));
 // G2 itself already attempted: the normal sent fence applies to the new id.
 assert.deepEqual(pick({new_roles:[role]},{max:5,sent:new Set([base,g(2)]),generation:generationFor({requests:{[base]:{s:'COMPLETE'}}})}),[]);
 // Without a generation callback (replay index unavailable) behavior is exactly today's.
 assert.deepEqual(pick({new_roles:[role]},{max:5,sent:new Set([base])}),[]);
});

// ---- executor: the G2 request proceeds; COMPLETE original still stalls as before ----
const RULES_RAW='RULES v1',RULES_HASH=crypto.createHash('sha256').update(RULES_RAW).digest('hex');
const AUTO=async()=>({ok:true,json:async()=>({enabled:true,mode:'AUTO',maxBatch:25,revision:'SOURCE_INTAKE_AUTO_V1',approvedBy:'Tim'})});
const memRecorder=(store={})=>({store,check:async()=>true,record:async(rid,r)=>{store[rid]=JSON.parse(JSON.stringify(r))},read:async rid=>store[rid]});
const candidate=rec=>({record:rec,evidenceVerified:true,evidenceSource:'INDEPENDENT_VERIFIED',evidenceUrl:'https://jobs.example.com/about',primaryBusiness:'Industrial automation',
 reviewedNeverConsider:false,expectedOutcome:'NEW',rulesHash:RULES_HASH,businessEvidenceApproved:true});
function writer(index,log,posts){
 return async(url,o)=>{
  const u=new URL(url),action=o.method==='POST'?'POST':u.searchParams.get('action');log.push(action);
  const d={ok:true};
  if(action==='writer_status')Object.assign(d,{freeze:null,level:'OK',errors:[]});
  else if(action==='receipt_index')Object.assign(d,{source:'GITHUB',exists:true,sha:'s',request:index[u.searchParams.get('requestId')]||null});
  else if(action==='rules')Object.assign(d,{rules:{status:'ACTIVE',rules:[1],raw:RULES_RAW,id:'r'}});
  else if(action==='POST'){const b=JSON.parse(o.body);posts.push(b);const pid='V2I-NEW';
   return {ok:true,json:async()=>({ok:true,WRITE_ACCEPTED:true,writeId:'W1',COMPLETION_STATUS:'PENDING_VERIFICATION',results:[{result:'SCOUT_INTAKE_WRITTEN',PRIMARY_ID:pid}],receipt:{REQUEST_ID:b.requestId,NEW_PRIMARY_IDS:[pid]}})};}
  else throw Error('unapproved operation '+action);
  return {ok:true,json:async()=>d};
 };
}
const run=(rec,index)=>{const log=[],posts=[],recorder=memRecorder();
 return runIntake([candidate(rec)],{key:'fixture',sourceRunId:'FORGE-AUTO-TEST',expectedMode:'AUTO',switchTransport:AUTO,transport:writer(index,log,posts),recorder})
  .then(outcomes=>({outcomes,log,posts,store:recorder.store}),e=>({error:e,outcomes:e.outcomes,log,posts,store:recorder.store}));};

test('executor: a G2 request for a COMPLETE-but-absent original proceeds to one Writer POST and saves no id list',async()=>{
 const rec={...record,REQUEST_GENERATION:2};
 assert.ok(reviewedCandidate(candidate(rec),true));
 const r=await run(rec,{[base]:{s:'COMPLETE'}});
 assert.equal(r.posts.length,1);
 assert.equal(r.posts[0].requestId,g(2));
 assert.equal('REQUEST_GENERATION' in r.posts[0].records[0],false,'generation is never sent to the Writer');
 assert.deepEqual(Object.keys(r.store),[g(2)],'only the new request is recorded; no list of original or deleted ids');
 assert.equal(r.outcomes.find(o=>o.requestId===g(2)).status,'PENDING_VERIFICATION');
});

test('executor: the original id with a COMPLETE replay entry still stalls exactly as before (no POST)',async()=>{
 const r=await run(record,{[base]:{s:'COMPLETE'}});
 assert.equal(r.posts.length,0);
 assert.deepEqual(r.outcomes.map(o=>[o.requestId,o.status,o.reason]),[[base,'DEFERRED','ORIGINAL_REQUEST_RECONCILIATION_REQUIRED']]);
 assert.equal(r.store[base].status,'EXISTING_REQUEST_UNCERTAIN');
});

test('executor: a not-COMPLETE original keeps its id and its fence; an index-free original posts under the unchanged id',async()=>{
 const held=await run(record,{[base]:{s:'PENDING'}});
 assert.equal(held.posts.length,0);assert.equal(held.outcomes[0].reason,'ORIGINAL_REQUEST_RECONCILIATION_REQUIRED');
 const fresh=await run(record,{});
 assert.equal(fresh.posts.length,1);assert.equal(fresh.posts[0].requestId,base);
});

test('executor: an invalid generation is refused before any network call',async()=>{
 let calls=0;
 await assert.rejects(()=>runIntake([candidate({...record,REQUEST_GENERATION:1})],{key:'fixture',sourceRunId:'FORGE-AUTO-TEST',expectedMode:'AUTO',switchTransport:async()=>{calls++},transport:async()=>{calls++},recorder:memRecorder()}),/reviewed intake candidates/);
 assert.equal(calls,0);
});
