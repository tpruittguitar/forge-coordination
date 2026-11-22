'use strict';
const {test}=require('node:test'),a=require('node:assert/strict');
const G=require('./grant-extract.cjs'), R=require('./recovery'), C=require('../grant-backlog/windows-credential.cjs');
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
const proof=()=>({schema:'forge.grant-funding-observation.v1',source:'AUTHORIZED_ACCOUNT_VERIFIER',observedAt:new Date(now-1000).toISOString(),evidenceSha256:'a'.repeat(64),
 project:{name:'Default',id:'proj_test',responsesOnly:true,credentialTarget:C.TARGET},funding:{kind:'PROMOTIONAL_ONLY',paidFallbackEnabled:false,autoRechargeEnabled:false,noPaidFallbackVerified:true,
 availableMicrousd:11000000,otherConsumersReservedMicrousd:0,expiresAt:new Date(now+172800000).toISOString()}});
const wrapped=result=>new Response(JSON.stringify({status:'completed',model:'gpt-6-luna',service_tier:'default',usage:{input_tokens:550,output_tokens:50},
 output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(result)}]}]}));
const c=fields=>({row,capture,needs:['SALARY','DEGREE'],fields:fields||{},ledger:{},checkpoint(){}});
test('exact allowed ATS posting only; protected, wrong or missing source and already-filled facts do not spend',()=>{
  const i=G.input(row,capture,['SALARY','DEGREE'],{},now);
  a.deepEqual(i?.groups,['SALARY']);
  a.equal(G.input(row,capture,['DEGREE'],{},now),null);
  for(const r of [{...row,p:{...row.p,DO_NOT_REWORK:'YES'}},{...row,TITLE:'Different'},
    {...row,p:{...row.p,SOURCE_URL:'https://example.org/other'}}])a.equal(G.input(r,capture,['SALARY'],{},now),null);
  a.equal(G.input(row,capture,['SALARY','DEGREE'],{SALARY_BASE_LOW:1,DEGREE_REQ:'REQUIRED'},now),null);
});
test('funded transport writes durable attempt before request and returns only exact ATS fields, with no replay',async()=>{
  let reads=0,calls=0,checkpoints=0;
  const g=G.create({now:()=>now,readFunding:async()=>{reads++;return proof()},openCredential:()=>({secureRuntime:fn=>fn('fixture')}),
   transport:async(u,opts)=>{calls++;a.equal(checkpoints,1);a.match(u,/^https:\/\/api\.openai\.com\/v1\/responses$/);a.doesNotMatch(opts.body,/PRIVATE_NOTE|never send|V2I-ATS/);return wrapped(payOnly)}});
  const args={...c(),checkpoint:()=>checkpoints++};
  const f=await g.extract(args);
  a.deepEqual(f,{SALARY_BASE_LOW:180000,SALARY_BASE_HIGH:230000,SALARY_BASIS:'EMPLOYER_POSTED',SALARY_SOURCE:url,SALARY_ASOF:'2026-11-22',SALARY_CONF:'HIGH'});
  a.equal(Object.values(args.ledger.grantExtractionAttempts)[0].status,'FACTS_ACCEPTED');
  a.deepEqual(await g.extract(args),{});
  a.equal(reads,1);a.equal(calls,1);
});
test('no paid fallback, ambiguous figures and unknown outcomes cannot produce fields or replay',async()=>{
  let calls=0;
  const bad=proof();bad.funding.paidFallbackEnabled=true;
  const g=G.create({now:()=>now,readFunding:async()=>bad,openCredential:()=>{throw Error('must not read')},transport:()=>{calls++}});
  await a.rejects(g.extract(c()),/GRANT_FUNDING_OR_HOST_BLOCKED/);a.equal(calls,0);
  const i=G.input(row,capture,['SALARY'],{},now);a.throws(()=>G.resultFields({...payOnly,fields:{...payOnly.fields,SALARY_BASE_HIGH:600000}},i.e,i.groups,row),/SALARY_NOT_IN_QUOTE/);
  const u=G.create({now:()=>now,readFunding:async()=>proof(),openCredential:()=>({secureRuntime:fn=>fn('fixture')}),transport:async()=>{calls++;throw Error('unknown')}});
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
  const options={now:()=>now,readFunding:async()=>proof(),openCredential:()=>({secureRuntime:fn=>fn('fixture')}),
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
test('grant mode is off by default and old enabled or running GitHub ATS authority blocks launch',async()=>{
  a.equal(G.configured({env:{}}),null);
  const check=(state,n)=>G.assertGithubOwnerStopped({token:'fixture',repo:'tpruittguitar/forge-coordination',
    transport:async u=>new Response(JSON.stringify(u.includes('/runs?')?{total_count:n,workflow_runs:n?[{}]:[]}:{state}))});
  await a.rejects(check('active',0),/NOT_DISABLED/);
  await a.rejects(check('disabled_manually',1),/NOT_DRAINED/);
  await check('disabled_manually',0);
});
