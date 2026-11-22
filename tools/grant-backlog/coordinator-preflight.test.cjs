'use strict';
const {test}=require('node:test'),a=require('node:assert/strict');
const P=require('./coordinator-preflight.cjs'),V=require('./verified-classifier.cjs');
const {fixture}=require('../helper-routing/api-grant-fixture.cjs'),API=require('../helper-routing/api-grant.cjs'),S=require('../programmed-coordinator/store.cjs'),H=require('../helper-routing/shared.cjs');
const at='2026-11-22T04:00:00Z',sid='S-1-5-21-1-2-3-1001';
function observation(){return {schema:'forge.grant-funding-observation.v1',source:'AUTHORIZED_ACCOUNT_VERIFIER',observedAt:at,evidenceSha256:'e'.repeat(64),project:{name:'Default',id:'proj_synthetic',responsesOnly:true,credentialTarget:'Forge/OpenAI/Default/Responses'},funding:{kind:'PROMOTIONAL_ONLY',paidFallbackEnabled:false,autoRechargeEnabled:false,noPaidFallbackVerified:true,availableMicrousd:37470000,otherConsumersReservedMicrousd:0,expiresAt:'2026-11-30T00:00:00Z'}};}
function setup(t){const f=fixture(t,5),p=API.plan(f);S.save(f.root,H.FILE,p.work);const view={readAt:at,instructionCommit:'a'.repeat(40),publishedInstructionCommit:'a'.repeat(40),publishedWorkSha256:S.hash(p.work),state:f.state,snapshot:f.snapshot};return {...f,view,options:{root:f.root,ids:f.ids,now:()=>f.now,readView:async()=>view,readFundingObservation:async()=>observation(),expectedSid:sid,readNativeContext:async()=>({host:'TIMMAY',sid,impersonating:false}),credentialObservation:{target:'Forge/OpenAI/Default/Responses',installed:true,sid,observedAt:at}}};}
test('five-job coordinator preflight remains disabled with zero keys/model/Writer/claims',async t=>{
 const f=setup(t),before=H.load(f.root),r=await P.inspect(f.options);a.deepEqual(r.blockers,['LIVE_RELEASE_DISABLED']);a.equal(r.jobs.filter(j=>j.status==='ELIGIBLE').length,5);a.equal(r.reservationMicrousd,10240);a.equal(r.credentialReads,0);a.equal(r.modelCalls,0);a.deepEqual(H.load(f.root),before);a.throws(()=>P.launch(f.options),/LIVE_RELEASE_DISABLED/);
});
test('protected and unresolved jobs are skipped without replacement or replay',async t=>{
 const f=setup(t);f.view.snapshot.neverConsiderById[f.ids[0]]={status:'HOLD'};f.view.state.transactions.X={status:'POST_IN_FLIGHT_UNKNOWN',ids:[f.ids[1]]};
 const r=await P.inspect(f.options);a.equal(r.jobs.filter(j=>j.status==='SKIP').length,2);a.equal(r.jobs.filter(j=>j.status==='ELIGIBLE').length,3);a.deepEqual(r.jobs.map(j=>j.primaryId),f.ids);
});
test('absent route or extra IDs blocks before funding/native capability invocation',async t=>{
 const f=setup(t),w=H.load(f.root);w.apiGrantBinding.enabled=false;S.save(f.root,H.FILE,w);let calls=0;f.options.readFundingObservation=async()=>{calls++;};f.options.readNativeContext=async()=>{calls++;};
 const r=await P.inspect(f.options);a.ok(r.blockers.includes('API_ROUTE_DISABLED_OR_UNBOUND'));a.equal(calls,0);
 const extra=await P.inspect({...f.options,ids:[...f.ids,'V2I-OTHER']});a.ok(extra.blockers.includes('EXACTLY_FIVE_DISTINCT_IDS_REQUIRED'));a.equal(calls,0);
});
test('budget-only, payment fallback, stale balance and unbounded other consumers fail closed',()=>{
 for(const edit of [g=>g.funding.budgetOnly=true,g=>g.funding.paidFallbackEnabled=true,g=>g.funding.autoRechargeEnabled=true,g=>delete g.funding.otherConsumersReservedMicrousd,g=>g.funding.availableMicrousd=10000000,g=>g.observedAt='2020-01-01',g=>g.project.responsesOnly=false,g=>g.funding.expiresAt='2026-11-22T05:00:00Z']){const g=observation();edit(g);a.ok(P.funding(g,Date.parse(at)).length);}
 a.ok(P.funding(observation(),Date.parse('2026-11-29T00:00:00Z')).includes('GRANT_EXPIRY_CUTOFF'));
});
test('missing native installation and funding verifiers never substitute credentials or print errors',async t=>{
 const f=setup(t);f.options.readFundingObservation=async()=>{throw Error('private verifier output');};f.options.readNativeContext=async()=>({host:'OTHER',sid,impersonating:false});delete f.options.credentialObservation;
 const r=await P.inspect(f.options);a.ok(r.blockers.includes('FUNDING_VERIFIER_UNAVAILABLE'));a.ok(r.blockers.includes('RESTRICTED_CREDENTIAL_INSTALLATION_UNVERIFIED'));a.equal(JSON.stringify(r).includes('private verifier output'),false);
});
test('only the exact clean deployed Writer revision loads the existing classifier',()=>{
 const sha='b'.repeat(40),status={build:{commit:sha}},fn=()=>({outcome:'ALLOW'});let loads=0;
 const git=args=>args[0]==='remote'?'https://github.com/tpruittguitar/foreman-cockpit.git':args[0]==='rev-parse'?sha:'';
 const inject={git,loadModule:()=>{loads++;return{classifyNeverConsider:fn};}};
 a.equal(V.load({root:'/synthetic',writerStatus:status},inject).classifyNeverConsider,fn);a.equal(loads,1);
 for(const command of ['remote','rev-parse','status']){a.throws(()=>V.load({root:'/synthetic',writerStatus:status},{...inject,git:args=>args[0]===command?'wrong':git(args)}));}a.equal(loads,1);
 a.throws(()=>V.load({root:'/synthetic',writerStatus:{build:{commit:'short'}}},inject),/EXACT_WRITER_BUILD/);
});
