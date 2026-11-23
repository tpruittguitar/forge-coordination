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
test('exactly two known no-facts attempts, never a third or unknown replay',async()=>{
 const opens={now:()=>now,readFunding:async()=>proof(),openCredential:()=>({secureRuntime:fn=>fn('fixture-T123')}),maxAttempts:50};
 const setup=()=>({...c(),ledger:{grantExtractionAttempts:{smoke:{phase:'SMOKE',status:'WRITER_VERIFIED',writerRequestId:'SMOKE'}}}});
 let calls=0;
 const g=G.create({...opens,transport:async()=>{calls++;return wrapped(calls===1?{...payOnly,fields:{},quotes:{}}:payOnly)}});
 const args=setup();
 a.deepEqual(await g.extract(args),{});
 const f=await g.extract({...args,retryKnownNoFacts:true});
 a.equal(f.SALARY_BASE_LOW,180000);
 a.equal(g.acceptedBulkResearch(row,capture,args.ledger).fields.SALARY_BASE_LOW,180000);
 a.deepEqual(await g.extract({...args,retryKnownNoFacts:true}),{});
 a.equal(calls,2);
 let unknown=0;
 const u=G.create({...opens,transport:async()=>{unknown++;throw Error('unknown')}});
 const x=setup(); await a.rejects(u.extract(x),/GRANT_RESPONSE_UNVERIFIED/);
 a.deepEqual(await G.create({...opens,transport:async()=>{unknown++}}).extract({...x,retryKnownNoFacts:true}),{});
 a.equal(unknown,1);
});
test('reopens only old incomplete or no-facts exactly once and never Writer tracked',()=>{
 const {open}=require('./grant-first-pass.cjs');
 const ledger={pendingWrites:{p:{ids:['pending']}},submitted:{submitted:'x'},grantFirstPass:{schema:'forge.ats-grant-first-pass.v1',partition:'split',rows:{
  ok:{status:'INCOMPLETE'},no:{status:'NO_SUPPORTED_FIELDS'},pending:{status:'INCOMPLETE'},submitted:{status:'NO_SUPPORTED_FIELDS'},
  old:{status:'LEGACY_GRANT_ATTEMPT'},uncertain:{status:'INCOMPLETE',writerAttempt:{batch:'test'}},hung:{status:'IN_PROGRESS'}
 }}};
 const start=run=>open({ledger,scope:{partition:'split',size:7},isEligible:()=>true,run,checkpoint(){}});
 const p=start('a');
 for(const id of ['pending','submitted','old','uncertain','hung'])a.equal(p.claim(id),false,id);
 a.equal(p.claim('ok'),true);p.finish('ok','FIELDS_PLANNED',{plan:{fields:{WORK_ARRANGEMENT:'ONSITE'}}});
 a.equal(p.claim('no'),true);p.finish('no','NO_SUPPORTED_FIELDS');
 const later=start('b');a.equal(later.claim('no'),false);a.deepEqual(later.planned('ok').fields,{WORK_ARRANGEMENT:'ONSITE'});
});
test('source-supported subset passes planning and fresh Writer guard without model acceptance; conflict blocks',()=>{
 const js=require('fs').readFileSync(require('path').join(__dirname,'run.js'),'utf8');
 const plan=js.slice(js.indexOf('      if(!Object.keys(f).length){\n        const productOnly='),js.indexOf('      addGrantRequest(r,f);')+'      addGrantRequest(r,f);'.length);
 a.match(plan,/addGrantRequest\(r,f\)/);a.doesNotMatch(plan,/!acceptedGrant/);
 const selected={WORK_ARRANGEMENT:'ONSITE'};
 const verified=require('./source-blanks.cjs').project({row,capture,product:null,Products:{},now});
 a.equal(verified.DEGREE_REQ,'REQUIRED');
 const result=new Function('f','missing','firstPass','coverage','completeGrantBatch','r','Store','capture','productEvidence','addGrantRequest','for(const _ of [0]){'+plan+'return coverage.partialPlanned;}');
 let observed;
 a.equal(result(selected,['products (what they make)'],null,{},true,{}, {hash:()=>""}, null,()=>null,(_r,f)=>{observed=f}),1);
 a.deepEqual(observed,selected);
 const guard=js.slice(js.indexOf('        if(broadGrant){\n          const selected=GrantSalary.liveFields'),js.indexOf('        if(f.PRODUCT){const entry=Products.lookup'));
 a.doesNotMatch(guard,/projectedGrantMissing/);
 const live=new Function('broadGrant','GrantSalary','cur','f','completeGrantBatch','require','stats','q',guard);
 const q={ruling:{fields:{...selected}}};
 a.equal(live(true,{liveFields:(_r,f)=>f},{p:{}},selected,true,require,{},q),true);
 a.equal(live(true,{liveFields:(_r,f)=>f},{p:{WORK_ARRANGEMENT:'REMOTE'}},selected,true,require,{},q),false);
});
