'use strict';
const {test}=require('node:test'),a=require('node:assert/strict');
const G=require('./grant-extract.cjs'), R=require('./recovery');
const now=Date.parse('2026-11-22T18:00:00Z'), url='https://example.org/job';
const row={PRIMARY_ID:'V2I-ATS-GRANT',COMPANY:'Acme',TITLE:'Director',LOCATION:'Dayton, OH',BUCKET:'SCOUT_INTAKE',
  p:{SOURCE_URL:url,SALARY_BASE_LOW:'',SALARY_BASE_HIGH:'',SALARY_BASIS:'',DEGREE_REQ:'',DEGREE_TEXT:'',PRIVATE_NOTE:'never send'}};
const quote='Annual base salary: $180,000 to $230,000.';
const degree="Bachelor's degree required.";
const text='Lead manufacturing quality operations. '.repeat(10)+'\n'+quote+'\n'+degree;
const capture=R.saveEvidence({},row,url,{identityVerified:true,sourceIdentity:{company:row.COMPANY,title:row.TITLE,location:row.LOCATION},basis:'EMPLOYER_POSTED',text},now-60000);
const proposal={fields:{SALARY_BASE_LOW:180000,SALARY_BASE_HIGH:230000,SALARY_BASIS:'EMPLOYER_POSTED',DEGREE_REQ:'REQUIRED',DEGREE_TEXT:degree},
  quotes:{SALARY:quote,DEGREE:degree},degree:{requirement:'REQUIRED',equivalence:'UNKNOWN',confidence:'HIGH',quote:degree}};
const payOnly={...proposal,fields:Object.fromEntries(Object.entries(proposal.fields).filter(([k])=>k.startsWith('SALARY'))),quotes:{SALARY:quote}};
const proof=()=>({schema:'forge.ats-grant-only-account.v1',source:'SIGNED_IN_ACCOUNT_OPERATOR',observedAt:new Date(now-600000).toISOString(),
 organizationId:'org-test',projectId:'proj_test',projectName:'Default',keyName:'forge-enrichment-responses',keySuffix:'T123',keyPermissions:'All',
 grant:{availableMicrousd:11000000,expiresAt:new Date(now+172800000).toISOString()},noPaidBillingPlan:true,noPurchasedCredits:true,autoRechargeEnabled:false});
const wrapped=result=>new Response(JSON.stringify({status:'completed',model:'gpt-6-luna',service_tier:'default',usage:{input_tokens:550,output_tokens:50},
 output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(result)}]}]}));
const c=fields=>({row,capture,needs:['SALARY'],fields:fields||{},ledger:{},checkpoint(){}});
test('exact allowed ATS posting only; protected, wrong or missing source and already-filled facts do not spend',()=>{
  const i=G.input(row,capture,['SALARY'],{},now);
  a.deepEqual(i?.groups,['SALARY']);
  a.equal(G.input(row,capture,[],{},now),null);
  for(const r of [{...row,p:{...row.p,DO_NOT_REWORK:'YES'}},{...row,TITLE:'Different'},
    {...row,p:{...row.p,SOURCE_URL:'https://example.org/other'}}])a.equal(G.input(r,capture,['SALARY'],{},now),null);
  a.equal(G.input(row,capture,['SALARY','DEGREE'],{SALARY_BASE_LOW:1,DEGREE_REQ:'REQUIRED'},now),null);
});
test('funded transport writes durable attempt before request and returns only exact ATS fields, with no replay',async()=>{
  let reads=0,calls=0,checkpoints=0;
  const g=G.create({now:()=>now,readFunding:async()=>{reads++;return proof()},openCredential:()=>({secureRuntime:fn=>fn('fixture-T123')}),
   transport:async(u,opts)=>{calls++;a.equal(checkpoints,1);a.match(u,/^https:\/\/api\.openai\.com\/v1\/responses$/);a.equal(opts.headers['OpenAI-Organization'],'org-test');a.equal(opts.headers['OpenAI-Project'],'proj_test');a.doesNotMatch(opts.body,/PRIVATE_NOTE|never send|V2I-ATS/);return wrapped(payOnly)}});
  const args={...c(),checkpoint:()=>checkpoints++};
  const f=await g.extract(args);
  a.deepEqual(f,{SALARY_BASE_LOW:180000,SALARY_BASE_HIGH:230000,SALARY_BASIS:'EMPLOYER_POSTED',SALARY_SOURCE:url,SALARY_ASOF:'2026-11-22',SALARY_CONF:'HIGH'});
  a.equal(Object.values(args.ledger.grantExtractionAttempts)[0].status,'FACTS_ACCEPTED');
  a.deepEqual(await g.extract(args),{});
  a.equal(reads,1);a.equal(calls,1);
});
test('no paid fallback, ambiguous figures and unknown outcomes cannot produce fields or replay',async()=>{
  let calls=0;
  const bad=proof();bad.noPaidBillingPlan=false;
  const g=G.create({now:()=>now,readFunding:async()=>bad,openCredential:()=>{throw Error('must not read')},transport:()=>{calls++}});
  await a.rejects(g.extract(c()),/GRANT_FUNDING_OR_HOST_BLOCKED/);a.equal(calls,0);
  const i=G.input(row,capture,['SALARY'],{},now);a.throws(()=>G.resultFields({...payOnly,fields:{...payOnly.fields,SALARY_BASE_HIGH:600000}},i.e,i.groups,row),/SALARY_NOT_IN_QUOTE/);
  const u=G.create({now:()=>now,readFunding:async()=>proof(),openCredential:()=>({secureRuntime:fn=>fn('fixture-T123')}),transport:async()=>{calls++;throw Error('unknown')}});
  const args=c();await a.rejects(u.extract(args),/GRANT_RESPONSE_UNVERIFIED/);
  a.equal(Object.values(args.ledger.grantExtractionAttempts)[0].status,'POSTING_OR_UNKNOWN');
  a.deepEqual(await u.extract(args),{});a.equal(calls,1);a.equal(u.accounting.unknownReservedMicrousd,2048);
});
test('conflicting location pay stays unresolved and independently parsed degree stays intact',async()=>{
  const original=c(degreeFields()), conflict={...capture,pay:null,payAmbiguous:true,text:text+'\nOhio: annual base salary $170,000 to $190,000. California: annual base salary $210,000 to $250,000.'};
  const fields=original.fields;
  const g=G.create({now:()=>now,readFunding:async()=>{throw Error('must not read funding')}});
  a.deepEqual(await g.extract({...original,capture:conflict}),{});
  a.deepEqual(await g.extract({...original,payUnresolved:true}),{});
  const i=G.input(row,capture,['SALARY'],{},now);
  a.deepEqual(G.resultFields(payOnly,i.e,i.groups,row,{ambiguousPay:true}),{});
  a.deepEqual(fields,degreeFields());
});
function degreeFields(){return {DEGREE_REQ:'REQUIRED',DEGREE_TEXT:degree,DEGREE_EVIDENCE_URL:url,DEGREE_ASOF:'2026-11-22'};}
test('one smoke, verified receipt for bulk, per-pass 50 and a cumulative $37.47 reservation ceiling',async()=>{
  let calls=0;
  const options={now:()=>now,readFunding:async()=>proof(),openCredential:()=>({secureRuntime:fn=>fn('fixture-T123')}),
    transport:async()=>{calls++;return wrapped(payOnly)}};
  const args=c(),rowArgs=j=>({...args,row:{...row,PRIMARY_ID:'V2I-ATS-'+j}});
  const bulk=G.create({...options,maxAttempts:50}),smoke=G.create(options);
  await a.rejects(bulk.extract(rowArgs(0)),/SMOKE_WRITE_UNVERIFIED/);
  await smoke.extract(rowArgs(0));await smoke.extract(rowArgs(1));
  a.equal(calls,1);
  a.deepEqual(smoke.accounting,{reportedCostMicrousd:80,unknownAttempts:0,unknownReservedMicrousd:0,cumulativeCapMicrousd:37470000});
  const record=Object.values(args.ledger.grantExtractionAttempts)[0];
  a.equal(record.phase,'SMOKE');a.equal(record.status,'FACTS_ACCEPTED');
  await a.rejects(bulk.extract(rowArgs(1)),/SMOKE_WRITE_UNVERIFIED/);
  a.equal(calls,1);
  Object.assign(record,{status:'WRITER_VERIFIED',writerRequestId:'GRANT-WRITER-1'});
  for(let j=1;j<=52;j++)await bulk.extract(rowArgs(j));
  a.equal(calls,51);
  const reserve=require('../grant-backlog/worker.cjs').LIMITS.reservationMicrousd;
  a.ok(reserve<=10000);
  const entries=args.ledger.grantExtractionAttempts;
  for(let j=Object.keys(entries).length;j<Math.floor(37470000/reserve);j++)entries['spent-'+j]={status:'POSTING_OR_UNKNOWN'};
  await a.rejects(G.create({...options,maxAttempts:50}).extract(rowArgs(100)),/ATS_GRANT_CAP_REACHED/);
  a.equal(calls,51);
  a.throws(()=>G.create({maxAttempts:5}),/ATS_GRANT_ROW_LIMIT_INVALID/);
});
test('bounded operator proof accepts the linked All key but wrong suffix, paid fallback, stale proof and depletion never fall through',async()=>{
  let calls=0;
  const options={now:()=>now,readFunding:async()=>proof(),openCredential:()=>({secureRuntime:fn=>fn('wrong-suffix')}),
    transport:async()=>{calls++;return new Response('',{status:429})}};
  await a.rejects(G.create(options).extract(c()),/GRANT_RESPONSE_UNVERIFIED/);a.equal(calls,0);
  const paid={...proof(),noPurchasedCredits:false},stale={...proof(),observedAt:new Date(now-31*60000).toISOString()};
  for(const p of [paid,stale])await a.rejects(G.create({...options,readFunding:async()=>p}).extract(c()),/GRANT_FUNDING_OR_HOST_BLOCKED/);
  a.equal(calls,0);
  const g=G.create({...options,openCredential:()=>({secureRuntime:fn=>fn('fixture-T123')})});
  const args=c();await a.rejects(g.extract(args),/GRANT_RESPONSE_UNVERIFIED/);
  a.deepEqual(await g.extract({...args,row:{...row,PRIMARY_ID:'V2I-ANOTHER'}}),{});a.equal(calls,1);
});
test('grant mode is off by default and old enabled or running GitHub ATS authority blocks launch',async()=>{
  a.equal(G.configured({env:{}}),null);
  const check=(state,n)=>G.assertGithubOwnerStopped({token:'fixture',repo:'tpruittguitar/forge-coordination',
    transport:async u=>new Response(JSON.stringify(u.includes('/runs?')?{total_count:n,workflow_runs:n?[{}]:[]}:{state}))});
  await a.rejects(check('active',0),/NOT_DISABLED/);
  await a.rejects(check('disabled_manually',1),/NOT_DRAINED/);
  await check('disabled_manually',0);
});

test('one real model request can emit only a quoted work blank from a long payless posting, not deterministic fallback',async()=>{
 const text='Lead the manufacturing operations team. '.repeat(140)+'\nThis role will be hybrid requiring a minimum of 3 days in office.';
 const e=require('./source-blanks.cjs').exactStoredPosting({find:()=>({doc:{text,url,fullPosting:true},ref:{observedAt:new Date(now-1000).toISOString()},fullPosting:true})},row,now);
 let requests=0;
 const g=G.create({now:()=>now,readFunding:async()=>proof(),openCredential:()=>({secureRuntime:fn=>fn('fixture-T123')}),
  transport:async(_url,opts)=>{requests++;const request=JSON.parse(opts.body),[instruction,data]=request.input;a.equal(instruction.role,'developer');a.match(instruction.content,/^Return JSON\./);a.equal(data.role,'user');a.equal(request.text.format.type,'json_object');a.equal(request.max_output_tokens,1024);const input=JSON.parse(data.content);a.deepEqual(input.missingGroups,['WORK_ARRANGEMENT']);a.equal(input.posting,'This role will be hybrid requiring a minimum of 3 days in office.');
   return wrapped({fields:{WORK_ARRANGEMENT:'HYBRID'},quotes:{WORK_ARRANGEMENT:'This role will be hybrid requiring a minimum of 3 days in office.'}});}});
 const args={...c(),row:{...row,p:{...row.p,WORK_ARRANGEMENT:'HYBRID'}},capture:e,needs:['WORK_ARRANGEMENT','DEGREE']};
 const fields=await g.extract(args);
 a.deepEqual(fields,{REMOTE_HYBRID:'HYBRID'});a.equal(requests,1);
 const bad=G.create({now:()=>now,readFunding:async()=>proof(),openCredential:()=>({secureRuntime:fn=>fn('fixture-T123')}),
  transport:async()=>wrapped({fields:{WORK_ARRANGEMENT:'REMOTE'},quotes:{WORK_ARRANGEMENT:'This role will be hybrid requiring a minimum of 3 days in office.'}})});
 a.deepEqual(await bad.extract({...args,ledger:{}}),{});
});

test('ATS diagnostics project only allowlisted failure categories, HTTP status and provider code; unknown spend stays fenced',async()=>{
 const setup=(transport,more={})=>G.create({now:()=>now,readFunding:async()=>proof(),openCredential:()=>({secureRuntime:fn=>fn('fixture-T123')}),transport,...more});
 const admitted=await (await wrapped(payOnly)).json();
 const options=[
   [setup(async()=>{throw Object.assign(Error('PRIVATE MESSAGE'),{cause:{code:'ENOTFOUND'}})}),{category:'TRANSPORT_DNS'}],
   [setup(async()=>new Response(JSON.stringify({error:{code:'credit_balance_exhausted',message:'PRIVATE BODY'}}),{status:429})),{category:'HTTP_REJECTION',httpStatus:429,providerCode:'credit_balance_exhausted'}],
   [setup(async()=>new Response(JSON.stringify({error:{code:'PRIVATE_BODY_FRAGMENT',param:'input'}}),{status:400})),{category:'HTTP_REJECTION',httpStatus:400,providerParam:'input'}],
   [setup(async()=>new Response('PRIVATE MALFORMED JSON')),{category:'RESPONSE_JSON'}],
   [setup(async()=>new Response(JSON.stringify({...admitted,model:'PRIVATE_ALIAS'}))),{category:'RESPONSE_MODEL'}],
   [setup(async()=>new Response(JSON.stringify({...admitted,service_tier:'priority'}))),{category:'RESPONSE_SERVICE_TIER'}],
   [setup(()=>{throw Error('must not transport')},{openCredential:()=>({secureRuntime:fn=>fn('wrong')})}),{category:'NATIVE_KEY_LINK_MISMATCH'}]
 ];
 for(const [g,want] of options){const args=c();await a.rejects(g.extract(args),/GRANT_RESPONSE_UNVERIFIED/);a.deepEqual(g.diagnostic,want);
   a.equal(Object.values(args.ledger.grantExtractionAttempts)[0].status,'POSTING_OR_UNKNOWN');}
 const good=setup(async()=>wrapped(payOnly));await good.extract(c());a.equal(good.diagnostic.category,'FACTS_ACCEPTED');a.equal(good.accounting.reportedCostMicrousd,80);
});

test('explicit one-time unknown smoke retry uses a distinct pinned job and preserves original accounting',async()=>{
 const prior='V2I-PRIOR',target='V2I-RETRY',third='V2I-THIRD';
 const original={primaryId:prior,phase:'SMOKE',status:'POSTING_OR_UNKNOWN',at:new Date(now-100).toISOString()};
 const ledger={grantExtractionAttempts:{old:structuredClone(original)}}, args={...c(),row:{...row,PRIMARY_ID:target},ledger};
 let calls=0;
 const options={now:()=>now,readFunding:async()=>proof(),openCredential:()=>({secureRuntime:fn=>fn('fixture-T123')}),
    transport:async()=>{calls++;return wrapped(payOnly)}};
 const retry={retryPriorId:prior,retryTargetId:target};
 await a.rejects(G.create(options).extract(args),/ALREADY_ATTEMPTED/);
 await a.rejects(G.create({...options,...retry}).extract({...args,ledger:{...ledger,pendingWrites:{batch:{ids:[prior]}}}}),/ALREADY_ATTEMPTED/);
 await a.rejects(G.create({...options,...retry}).extract({...args,row:{...row,PRIMARY_ID:prior}}),/ALREADY_ATTEMPTED/);
 a.equal(calls,0);
 a.equal((await G.create({...options,...retry}).extract(args)).SALARY_BASE_LOW,180000);
 a.deepEqual(ledger.grantExtractionAttempts.old,original);
 a.equal(Object.values(ledger.grantExtractionAttempts).find(r=>r.primaryId===target).retryOf,'old');
 await a.rejects(G.create({...options,retryPriorId:prior,retryTargetId:third}).extract({...args,row:{...row,PRIMARY_ID:third}}),/ALREADY_ATTEMPTED/);
 a.equal(calls,1);
});

test('corrected final smoke requires both pinned unknown ancestors, no Writer evidence, a third distinct row and no fourth',async()=>{
 const [original,previous,target,fourth]=['V2I-FIRST','V2I-SECOND','V2I-THIRD','V2I-FOURTH'];
 const records={old:{primaryId:original,phase:'SMOKE',status:'POSTING_OR_UNKNOWN'},later:{primaryId:previous,phase:'SMOKE',status:'POSTING_OR_UNKNOWN',retryOf:'old'}};
 const ledger={grantExtractionAttempts:structuredClone(records)};
 const args={...c(),row:{...row,PRIMARY_ID:target},ledger};
 let calls=0;
 const options={now:()=>now,readFunding:async()=>proof(),openCredential:()=>({secureRuntime:fn=>fn('fixture-T123')}),
    transport:async()=>{calls++;return wrapped(payOnly)}};
 const retry={retryOriginalId:original,retryPriorId:previous,retryTargetId:target};
 for(const invalid of [
   {...args,ledger:{grantExtractionAttempts:{old:{...records.old,writerRequestId:'EXACT-RECEIPT'},later:records.later}}},
   {...args,ledger:{grantExtractionAttempts:{old:records.old,later:{...records.later,writerRequestId:'EXACT-RECEIPT'}}}},
   {...args,ledger:{grantExtractionAttempts:{old:records.old,later:{...records.later,retryOf:'different'}}}}
 ])await a.rejects(G.create({...options,...retry}).extract(invalid),/ALREADY_ATTEMPTED/);
 await a.rejects(G.create({...options,retryPriorId:previous,retryTargetId:target}).extract(args),/ALREADY_ATTEMPTED/);
 a.equal(calls,0);
 a.equal((await G.create({...options,...retry}).extract(args)).SALARY_BASE_LOW,180000);
 a.deepEqual(ledger.grantExtractionAttempts.old,records.old);a.deepEqual(ledger.grantExtractionAttempts.later,records.later);
 a.equal(Object.values(ledger.grantExtractionAttempts).find(r=>r.primaryId===target).retryOf,'later');
 a.equal(Object.keys(ledger.grantExtractionAttempts).length*2048,6144);
 await a.rejects(G.create({...options,...retry,retryTargetId:fourth}).extract({...args,row:{...row,PRIMARY_ID:fourth}}),/ALREADY_ATTEMPTED/);
 a.equal(calls,1);
});


test('final distinct smoke ignores unrelated older-row ATS history without dropping either exact grant hold',async()=>{
 const [original,previous,target]=['V2I-FIRST','V2I-SECOND','V2I-THIRD'];
 const records={first:{primaryId:original,phase:'SMOKE',status:'POSTING_OR_UNKNOWN'},
  second:{primaryId:previous,phase:'SMOKE',status:'POSTING_OR_UNKNOWN',retryOf:'first'}};
 const historical='unrelated ordinary ATS row history',ledger={grantExtractionAttempts:structuredClone(records),
   submitted:{[previous]:historical},pendingWrites:{older:{ids:[original]}}};
 const args={...c(),row:{...row,PRIMARY_ID:target},ledger};
 let calls=0;
 const g=G.create({now:()=>now,readFunding:async()=>proof(),openCredential:()=>({secureRuntime:fn=>fn('fixture-T123')}),
  retryOriginalId:original,retryPriorId:previous,retryTargetId:target,transport:async()=>{calls++;return wrapped(payOnly)}});
 a.equal((await g.extract(args)).SALARY_BASE_LOW,180000);
 a.equal(ledger.submitted[previous],historical);
 a.deepEqual(ledger.pendingWrites.older,{ids:[original]});
 a.deepEqual(ledger.grantExtractionAttempts.first,records.first);
 a.deepEqual(ledger.grantExtractionAttempts.second,records.second);
 a.equal(calls,1);
});

test('one frozen fresh product proposal uses literal model evidence and existing aggregate smoke cap',async()=>{
 const lo=Array.from({length:1582},(_,i)=>'V2I-'+i.toString(16).toUpperCase().padStart(12,'0'));
 const hi=Array.from({length:1582},(_,i)=>'V2I-'+(0x8e2e8e000000+i).toString(16).toUpperCase().padStart(12,'0'));
 const target=hi[0],queue={schema:'forge.waiting-queues.v1',reconciled:true,ids:{enrichment:[...lo,...hi]}};
 G.requireFrozenApiId(target,queue);a.throws(()=>G.requireFrozenApiId(lo[0],queue),/FROZEN_API_ID/);
 a.throws(()=>G.requireFrozenApiId('V2I-FFFFFFFFFFFF',queue),/FROZEN_API_ID/);
 const product='industrial traction converters', quote='This team makes industrial traction converters for transit.';
 const r={...row,PRIMARY_ID:target},body='Own this engineering program. '.repeat(20)+'\n'+quote;
 const cover=R.saveEvidence({},r,url,{text:body,fullPosting:true,identityVerified:true,basis:'EMPLOYER_POSTED',
  sourceIdentity:{company:r.COMPANY,title:r.TITLE,location:r.LOCATION}},now-1000);
 let calls=0;
 const records=Object.fromEntries([1,2,3].map(n=>['old'+n,{primaryId:'V2I-OLD'+n,phase:'SMOKE',status:'POSTING_OR_UNKNOWN'}]));
 const ledger={grantExtractionAttempts:structuredClone(records)};
 const make=()=>G.create({productId:target,now:()=>now,readFunding:async()=>proof(),
  openCredential:()=>({secureRuntime:fn=>fn('fixture-T123')}),transport:async(_url,o)=>{
   calls++;const req=JSON.parse(o.body),data=JSON.parse(req.input[1].content);
   a.deepEqual(data.missingGroups,['PRODUCT']);a.equal(data.posting,body);a.equal(data.product,undefined);
   return wrapped({product,quote});
  }});
 const options={row:r,capture:cover,ledger,checkpoint(){}};
 const got=await make().extract(options);
 a.deepEqual([got.primaryId,got.product,got.quote,got.sourceUrl],[target,product,quote,url]);
 a.equal(Object.values(ledger.grantExtractionAttempts).find(x=>x.primaryId===target).status,'PRODUCT_PROPOSED');
 for(const [k,v] of Object.entries(records))a.deepEqual(ledger.grantExtractionAttempts[k],v);
 a.deepEqual(await make().extract(options),{});a.equal(calls,1);
 const capped={grantExtractionAttempts:{...ledger.grantExtractionAttempts,extra:{primaryId:'V2I-EXTRA',phase:'SMOKE',status:'POSTING_OR_UNKNOWN'}}};
 delete capped.grantExtractionAttempts[Object.keys(capped.grantExtractionAttempts).find(k=>capped.grantExtractionAttempts[k].primaryId===target)];
 await a.rejects(make().extract({...options,ledger:capped}),/CAP_REACHED/);a.equal(calls,1);
});

// cs-4c70ac05 B (Tim 2026-11-25 11:15 ET): GitHub Actions runner, Actions-secret key, no Windows or funding file.
const fixtureKey='sk-proj-'+'f'.repeat(24)+'T123';
const actionsEnv=(more={})=>({GITHUB_ACTIONS:'true',FORGE_ATS_GRANT_ACTIONS:'1',FORGE_ATS_GRANT_KEY:fixtureKey,
  FORGE_ATS_GRANT_ORG_ID:'org-test',FORGE_ATS_GRANT_PROJECT_ID:'proj_test',RUNNER_TEMP:require('node:os').tmpdir(),...more});
const actionsAccount={organizationId:'org-test',projectId:'proj_test',keySuffix:'T123'};
test('Actions mode is explicit and a missing or malformed key fails closed before any request',async()=>{
  const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'grant-actions-'));
  const go=env=>G.configured({root,live:true,writerPostLock:{},env});
  a.equal(go({GITHUB_ACTIONS:'true',FORGE_ATS_GRANT_KEY:''}),null); // scheduled/chained runs: normal producer
  a.throws(()=>go({GITHUB_ACTIONS:'true',FORGE_ATS_GRANT_KEY:fixtureKey}),/ATS_GRANT_RUNTIME_REQUIRED/); // key without opt-in
  for(const k of [undefined,'','not-a-key'])a.throws(()=>go(actionsEnv({FORGE_ATS_GRANT_KEY:k})),/ATS_GRANT_ACTIONS_KEY_REQUIRED/);
  a.throws(()=>go(actionsEnv({GITHUB_ACTIONS:undefined})),/ATS_GRANT_RUNTIME_REQUIRED/);
  a.throws(()=>go(actionsEnv({RUNNER_TEMP:undefined})),/ATS_GRANT_RUNTIME_REQUIRED/);
  a.throws(()=>go(actionsEnv({FORGE_ATS_GRANT_FUNDING_FILE:path.join(root,'f.json')})),/ATS_GRANT_RUNTIME_REQUIRED/);
  a.throws(()=>G.configured({root,live:false,writerPostLock:{},env:actionsEnv()}),/ATS_GRANT_RUNTIME_REQUIRED/);
  a.throws(()=>go(actionsEnv({FORGE_ATS_GRANT_ORG_ID:''})),/ATS_GRANT_ACTIONS_ACCOUNT_INVALID/);
  a.throws(()=>go(actionsEnv({FORGE_ATS_GRANT_PROJECT_ID:'x'})),/ATS_GRANT_ACTIONS_ACCOUNT_INVALID/);
  a.throws(()=>go(actionsEnv({FORGE_ATS_GRANT_MAX_ROWS:'5'})),/ATS_GRANT_ROW_LIMIT_INVALID/);
  a.throws(()=>G.create({actionsAccount,readFunding:async()=>proof()}),/ATS_GRANT_ACTIONS_ACCOUNT_INVALID/);
  // Valid Actions config: smoke scope, no GitHub owner call (concurrency group is the owner), lock under RUNNER_TEMP.
  const saved=globalThis.fetch;globalThis.fetch=async()=>{throw Error('must not call network')};
  try{
    const g=go(actionsEnv({RUNNER_TEMP:root}));
    a.equal(g.smoke,true);a.equal(g.rowLimit,1);
    await g.acquire();a.ok(fs.readdirSync(root).some(f=>f.endsWith('.ats-run-lock')));
    await g.verifyExclusive();g.release();g.close();
  }finally{globalThis.fetch=saved;}
});
test('Actions key comes only from env, pinned to org/project, with no funding read and no fallback',async()=>{
  let calls=0;const cred=G.envCredential({FORGE_ATS_GRANT_KEY:fixtureKey});a.equal(cred.suffix,'T123');
  const g=G.create({now:()=>now,actionsAccount,openCredential:cred.open,transport:async(u,opts)=>{calls++;
    a.equal(u,'https://api.openai.com/v1/responses');a.equal(opts.headers.Authorization,'Bearer '+fixtureKey);
    a.equal(opts.headers['OpenAI-Organization'],'org-test');a.equal(opts.headers['OpenAI-Project'],'proj_test');
    a.match(opts.body,/"model":"gpt-6-luna"/);return wrapped(payOnly);}});
  const args=c();
  a.equal((await g.extract(args)).SALARY_BASE_LOW,180000);a.equal(calls,1);
  const record=Object.values(args.ledger.grantExtractionAttempts)[0];a.equal(record.phase,'SMOKE');a.equal(record.status,'FACTS_ACCEPTED');
  a.doesNotMatch(JSON.stringify(args.ledger),/sk-proj|ffff/);
  // A failed request stops the lane; there is no second key, model or retry.
  let failed=0;const bad=G.create({now:()=>now,actionsAccount,openCredential:cred.open,transport:async()=>{failed++;return new Response('{}',{status:402})}});
  await a.rejects(bad.extract(c()),/GRANT_RESPONSE_UNVERIFIED/);await a.deepEqual(await bad.extract({...c(),row:{...row,PRIMARY_ID:'V2I-OTHER'}}),{});a.equal(failed,1);
  // Grant stop date still fails closed without a funding receipt.
  const late=G.create({now:()=>Date.parse('2026-11-29T00:00:00Z'),actionsAccount,openCredential:cred.open,transport:()=>{throw Error('must not transport')}});
  await a.rejects(late.extract(c()),/GRANT_FUNDING_OR_HOST_BLOCKED/);
});
test('Actions mode keeps the one-row smoke fence and the cumulative ledger cap',async()=>{
  let calls=0;const options={now:()=>now,actionsAccount,openCredential:G.envCredential({FORGE_ATS_GRANT_KEY:fixtureKey}).open,
    transport:async()=>{calls++;return wrapped(payOnly)}};
  const args=c(),rowArgs=j=>({...args,row:{...row,PRIMARY_ID:'V2I-ACT-'+j}});
  await G.create(options).extract(rowArgs(0));a.equal(calls,1);
  await a.rejects(G.create(options).extract(rowArgs(1)),/ATS_GRANT_SMOKE_ALREADY_ATTEMPTED/);a.equal(calls,1); // next run, same ledger
  await a.rejects(G.create({...options,maxAttempts:50}).extract(rowArgs(2)),/ATS_GRANT_SMOKE_WRITE_UNVERIFIED/);a.equal(calls,1);
  const reserve=require('../grant-backlog/worker.cjs').LIMITS.reservationMicrousd,entries=args.ledger.grantExtractionAttempts;
  Object.assign(Object.values(entries)[0],{status:'WRITER_VERIFIED',writerRequestId:'GRANT-WRITER-1'});
  for(let j=Object.keys(entries).length;j<Math.floor(37470000/reserve);j++)entries['spent-'+j]={status:'POSTING_OR_UNKNOWN'};
  await a.rejects(G.create({...options,maxAttempts:50}).extract(rowArgs(3)),/ATS_GRANT_CAP_REACHED/);a.equal(calls,1);
});
