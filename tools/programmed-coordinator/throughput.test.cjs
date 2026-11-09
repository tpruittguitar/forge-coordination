'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const Run=require('./run.cjs'),T=require('./transactions.cjs'),S=require('./store.cjs'),C=require('./collect.cjs'),Source=require('./source.cjs');
function dir(t){const p=fs.mkdtempSync(path.join(os.tmpdir(),'forge-throughput-'));t.after(()=>fs.rmSync(p,{recursive:true,force:true}));return p;}
function fixture(t,count=3) {
  const root=dir(t),privateDir=dir(t),state=C.empty(),rows=[],posts=[],index={requests:{}};
  state.batches['batch.json']={status:'VALIDATED'};
  for(let n=0;n<count;n++) {
    const row={PRIMARY_ID:'ROW-'+n,COMPANY:'Factory',TITLE:'Plant Manager',LOCATION:'Austin, TX',BUCKET:'SCOUT_INTAKE',p:{},line:'row '+n};rows.push(row);
    const key='item-'+n;state.items[key]={key,status:'READY_ENRICHMENT',batch:'batch.json',prepared:{itemKey:key,primaryId:row.PRIMARY_ID,identity:T.identity(row),fields:{DEGREE_REQ:'PREFERRED'},sourceSha256:'a'.repeat(64)}};
  }
  const deps={checkLock(){},snapshot:async()=>({rows,status:{freeze:null,level:'OK',errors:[],unverified:{count:0}}}),exists:async()=>false,original:async()=>null,
    post:async payload=>{
      posts.push(payload);const writeId='W-'+posts.length;
      for(const {ruling:r} of payload.requests){index.requests[r.requestId]={s:'COMPLETE',w:writeId,items:[{pid:r.primaryId}]};Object.assign(rows.find(x=>x.PRIMARY_ID===r.primaryId).p,r.fields);}
      return {writeId,results:payload.requests.map(({ruling:r})=>({requestId:r.requestId,primaryId:r.primaryId,ok:true}))};
    },index:async()=>({sha:'b'.repeat(40),index}),rows:async(_rid,ids)=>({startedAt:new Date().toISOString(),rows:rows.filter(r=>ids.includes(r.PRIMARY_ID))})};
  return{root,privateDir,state,rows,posts,index,deps,runId:'THROUGHPUT-TEST'};
}
test('61 eligible rows drain in bounded 25/25/11 single-commit envelopes, with exact child proofs',async t=>{
  const f=fixture(t,61);await Run.submitEnrichment(f);
  a.deepEqual(f.posts.map(p=>p.requests.length),[25,25,11]);
  a.equal(Object.values(f.state.items).filter(i=>i.status==='VERIFIED').length,61);
  a.equal(Object.values(f.state.transactions).filter(tx=>tx.status==='VERIFIED').length,3);
  for(const tx of Object.values(f.state.transactions)) {
    const proof=S.read(f.root,'receipts/'+tx.requestId+'_VERIFIED.json');a.equal(proof.proofs.length,tx.ids.length);a.equal(proof.claimedCompletedJobs,0);
    a.equal(new Set(proof.proofs.map(p=>p.requestId)).size,tx.ids.length);
    for(const p of proof.proofs)a.ok(tx.requests.some(r=>r.requestId===p.requestId&&r.primaryId===p.primaryId));
  }
  await Run.submitEnrichment({...f,state:S.read(f.root,'state/PROGRAMMED_COORDINATOR.json')});a.equal(f.posts.length,3);
});
test('bad fresh identity, protection, conflict and old original fence exclude only their own rows before POST',async t=>{
  const f=fixture(t,7);f.rows[0].TITLE='Other';f.rows[1].BUCKET='DECLINED_BY_TIM';f.rows[2].p.DEGREE_REQ='REQUIRED';
  S.save(f.root,'receipts/OLD_CHECKPOINT.json',{ids:['ROW-3']});
  f.state.items['item-4'].prepared.fields={ADJUSTED_FIT:'90'};
  await Run.submitEnrichment(f);a.deepEqual(f.posts[0].requests.map(r=>r.ruling.primaryId),['ROW-5','ROW-6']);
  for(let n=0;n<5;n++){a.equal(f.state.items['item-'+n].status,'EXCEPTION');a.equal(f.state.items['item-'+n].transactionId,undefined);}
  a.equal(f.state.items['item-5'].status,'VERIFIED');a.equal(f.posts.length,1);
});
test('an uncertain 25-row send is never split or replayed and independent next envelopes continue',async t=>{
  const f=fixture(t,27);f.deps.post=async p=>{f.posts.push(p);throw Error('timeout');};await Run.submitEnrichment(f);
  a.deepEqual(f.posts.map(p=>p.requests.length),[25,2]);
  const restarted=S.read(f.root,'state/PROGRAMMED_COORDINATOR.json');
  a.equal(Object.values(restarted.items).filter(i=>i.status==='POST_IN_FLIGHT_UNKNOWN').length,27);
  await Run.submitEnrichment({...f,state:restarted});
  for(const tx of Object.values(restarted.transactions))a.equal(await T.reconcile({...f,state:restarted,tx}),'POST_IN_FLIGHT_UNKNOWN');
  a.equal(f.posts.length,2);a.equal(T.fenced(f.root,restarted,'ROW-0'),true);
});
test('partial Writer acceptance verifies exact successful siblings, retains original fence and survives restart',async t=>{
  const f=fixture(t),post=f.deps.post;
  f.deps.post=async p=>{const response=await post(p);response.results[1]={index:1,ok:false,primaryId:'ROW-1',error:'rejected'};delete f.index.requests[p.requests[1].ruling.requestId];return response;};
  await Run.submitEnrichment(f);const tx=Object.values(f.state.transactions)[0];
  a.equal(tx.status,'PARTIALLY_VERIFIED');a.equal(f.state.items['item-0'].status,'VERIFIED');a.equal(f.state.items['item-1'].status,'HELD_WRITER_REVIEW');a.equal(f.state.items['item-2'].status,'VERIFIED');
  a.equal(fs.existsSync(path.join(f.root,'receipts/'+tx.requestId+'_VERIFIED.json')),false);
  a.equal(T.fenced(f.root,f.state,'ROW-1'),true);
  const restarted=S.read(f.root,'state/PROGRAMMED_COORDINATOR.json');await Run.submitEnrichment({...f,state:restarted});
  a.equal(await T.reconcile({...f,state:restarted,tx:restarted.transactions[tx.requestId]}),'PARTIALLY_VERIFIED');a.equal(f.posts.length,1);
});
test('late COMPLETE child receipt finishes an original partial batch without another POST',async t=>{
  const f=fixture(t),post=f.deps.post;let delayed;
  f.deps.post=async p=>{const response=await post(p);delayed=p.requests[1].ruling.requestId;f.index.requests[delayed].s='PENDING';return response;};
  await Run.submitEnrichment(f);const tx=Object.values(f.state.transactions)[0];a.equal(tx.status,'PARTIALLY_VERIFIED');
  a.equal(f.state.items['item-1'].status,'POST_IN_FLIGHT_UNKNOWN');f.index.requests[delayed].s='COMPLETE';
  a.equal(await T.reconcile({...f,tx}),'VERIFIED');a.equal(f.posts.length,1);
  a.equal(S.read(f.root,'receipts/'+tx.requestId+'_VERIFIED.json').proofs.length,3);
});
test('wrong write ID and mismatched canonical effects stay unverified without holding a proven sibling',async t=>{
  const f=fixture(t),post=f.deps.post;
  f.deps.post=async p=>{const response=await post(p);f.index.requests[p.requests[1].ruling.requestId].w='WRONG';f.rows[2].p.DEGREE_REQ='REQUIRED';return response;};
  await Run.submitEnrichment(f);a.equal(f.state.items['item-0'].status,'VERIFIED');
  a.notEqual(f.state.items['item-1'].status,'VERIFIED');a.notEqual(f.state.items['item-2'].status,'VERIFIED');
  a.equal(f.state.exceptions['item-2'].reason,'EXACT_ROW_EFFECT_NOT_PROVEN');a.equal(f.posts.length,1);
});
test('duplicate canonical IDs never share an envelope or bypass an earlier uncertain original',async t=>{
  const f=fixture(t);f.state.items['item-1'].prepared={...f.state.items['item-0'].prepared,itemKey:'item-1'};
  f.deps.post=async p=>{f.posts.push(p);throw Error('timeout');};await Run.submitEnrichment(f);
  a.deepEqual(f.posts[0].requests.map(r=>r.ruling.primaryId),['ROW-0','ROW-2']);a.equal(f.posts.length,1);
  a.equal(f.state.exceptions['item-1'].reason,'CANONICAL_IDENTITY_OR_TRANSACTION_FENCE');
});
test('global Writer gates stop all further envelopes, while explicit selection remains narrow',async t=>{
  const f=fixture(t,27),snapshot=f.deps.snapshot;f.deps.snapshot=async()=>({...await snapshot(),status:{freeze:{reason:'freeze'},level:'OK',errors:[],unverified:{}}});
  await Run.submitEnrichment(f);a.equal(f.posts.length,0);a.equal(f.state.items['item-25'].status,'READY_ENRICHMENT');
  const g=fixture(t);await Run.submitEnrichment({...g,select:i=>i.key==='item-1'});a.equal(g.posts[0].requests.length,1);a.equal(g.state.items['item-0'].status,'READY_ENRICHMENT');
});
test('lost lock after durable checkpoint retains every original fence without POST or fallback',async t=>{
  const f=fixture(t);let checks=0;f.deps.checkLock=()=>{if(++checks===2)throw Error('LOCK_LOST');};await Run.submitEnrichment(f);
  a.equal(f.posts.length,0);const tx=Object.values(f.state.transactions)[0];a.equal(tx.status,'POST_IN_FLIGHT_UNKNOWN');
  for(const item of Object.values(f.state.items)){a.equal(item.transactionId,tx.requestId);a.equal(item.status,'POST_IN_FLIGHT_UNKNOWN');}
  await Run.submitEnrichment(f);a.equal(f.posts.length,0);a.equal(Object.keys(f.state.transactions).length,1);
});
test('missing or duplicated result binding and early readback never verify a batch row',async t=>{
  const f=fixture(t),post=f.deps.post;f.deps.post=async p=>{const response=await post(p);response.results[1]=response.results[0];return response;};
  f.deps.rows=async()=>({startedAt:'2000-01-01T00:00:00Z',rows:f.rows});await Run.submitEnrichment(f);
  a.equal(Object.values(f.state.items).filter(i=>i.status==='VERIFIED').length,0);a.equal(f.posts.length,1);
});
test('host backoff propagates exact Retry-After, never fetches early and resumes after expiry',async t=>{
  const privateDir=dir(t),now=Date.parse('2026-11-09T10:00:00Z'),until=now+20*60000;let calls=0;
  const options={privateDir,now,expected:{company:'Factory',title:'Plant Manager',location:'Austin, TX'},item:{sourceEvidence:{url:'https://careers.factory.com/1'}},fetchPage:async()=>{calls++;throw Object.assign(Error('SOURCE_HTTP_429'),{retryAfter:until});}};
  await a.rejects(Source.verify(options),e=>e.message==='SOURCE_HTTP_429'&&e.retryAfter===until);a.equal(calls,1);
  await a.rejects(Source.verify({...options,now:now+60000}),e=>e.message==='SOURCE_ROUTE_BACKOFF'&&e.retryAfter===until);a.equal(calls,1);
  await a.rejects(Source.verify({...options,now:until+1}),e=>e.message==='SOURCE_HTTP_429'&&e.retryAfter===until+1+15*60000);a.equal(calls,2);
});
test('per-item scheduling uses source host pause without widening it to six hours or retrying in a loop',async t=>{
  const f=fixture(t,1),now=Date.parse('2026-11-09T10:00:00Z'),until=now+15*60000;let calls=0;
  const evidence={primaryId:'ROW-0',recommendation:'ENRICHMENT_EVIDENCE_READY',sourceEvidence:{...T.identity(f.rows[0]),url:'https://careers.factory.com/1'}};
  S.save(f.root,'batch.json',{items:[evidence]});Object.assign(f.state.items['item-0'],{taskKey:'FORGE_GROK_ENRICHMENT',itemKey:'ROW-0',attempts:0,status:'RETURNED'});
  const options={...f,snapshot:{rows:f.rows},now,apply:true,sourceVerify:async()=>{calls++;throw Object.assign(Error('SOURCE_ROUTE_BACKOFF'),{retryAfter:until});}};
  await Run.inspectReturns(options);a.equal(f.state.items['item-0'].retryAfter,new Date(until).toISOString());
  await Run.inspectReturns({...options,now:now+60000});a.equal(calls,1);
  await Run.inspectReturns({...options,now:until+1});a.equal(calls,2);
});
test('backoff migration reevaluates only deferred access once, never resets ambiguity or an original transaction',async t=>{
  const f=fixture(t,3),now=Date.parse('2026-11-09T10:00:00Z'),until=now+15*60000;let calls=0;
  const items=f.rows.map(row=>({primaryId:row.PRIMARY_ID,recommendation:'ENRICHMENT_EVIDENCE_READY',sourceEvidence:{...T.identity(row),url:'https://careers.factory.com/'+row.PRIMARY_ID}}));
  S.save(f.root,'batch.json',{items});
  for(let n=0;n<3;n++) {
    Object.assign(f.state.items['item-'+n],{taskKey:'FORGE_GROK_ENRICHMENT',itemKey:'ROW-'+n,sourceParserVersion:Source.PARSER_VERSION,attempts:0,status:'EXCEPTION',retryAfter:new Date(now+6*3600000).toISOString()});
    f.state.exceptions['item-'+n]={reason:n===1?'SOURCE_IDENTITY_AMBIGUOUS':'SOURCE_ROUTE_BACKOFF'};
  }
  f.state.items['item-2'].transactionId='ORIGINAL';
  const options={...f,snapshot:{rows:f.rows},now,apply:true,sourceVerify:async()=>{calls++;throw Object.assign(Error('SOURCE_ROUTE_BACKOFF'),{retryAfter:until});}};
  await Run.inspectReturns(options);a.equal(calls,1);a.equal(f.state.items['item-0'].retryAfter,new Date(until).toISOString());
  await Run.inspectReturns({...options,now:now+60000});a.equal(calls,1);
  a.equal(f.state.items['item-1'].attempts,0);a.equal(f.state.items['item-2'].attempts,0);a.equal(f.state.items['item-2'].transactionId,'ORIGINAL');
});
test('a consumption-accounting failure preserves verified effects and repairs from original child proofs without reposting',async t=>{
  const f=fixture(t,2);S.save(f.root,'control/ENRICHMENT_HELPER_WORK.json',{items:f.rows.map(row=>({primaryId:row.PRIMARY_ID,taskKey:'FORGE_GROK_ENRICHMENT',missingFields:['DEGREE'],status:'RETURNED_PENDING_REVIEW'}))});
  const save=S.save;let fail=true;t.mock.method(S,'save',(...args)=>{if(fail&&args[1]==='control/ENRICHMENT_HELPER_WORK.json')throw Error('ACCOUNTING_IO_FAILURE');return save(...args);});
  await Run.submitEnrichment(f);const tx=Object.values(f.state.transactions)[0];a.equal(tx.status,'VERIFICATION_ACCOUNTING_PENDING');
  for(const item of Object.values(f.state.items))a.equal(item.status,'VERIFIED');a.equal(f.posts.length,1);
  a.equal(fs.existsSync(path.join(f.root,'receipts/'+tx.requestId+'_VERIFIED.json')),false);
  fail=false;a.equal(await T.reconcile({...f,tx}),'VERIFIED');a.equal(f.posts.length,1);
  for(const item of S.read(f.root,'control/ENRICHMENT_HELPER_WORK.json').items)a.equal(item.status,'CONSUMED');
});
