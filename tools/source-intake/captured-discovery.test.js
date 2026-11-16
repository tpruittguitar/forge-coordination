'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),C=require('./captured-discovery'),{runIntake,requestId}=require('./production-executor');
const raw='canonical rules fixture',rulesHash=C.hash(raw),proof={path:'state/source-trial-report.json',sha256:C.hash('saved report bytes')};
function candidate(patch={}){
 const card={company:'Acme | Industrial Division',title:'Plant Manager',location:'Austin, TX',url:'https://example.com/jobs/1',source:'JOBSPY:indeed',description:'',...patch};
 const discoveryEvidence=C.capture(card,{proof,observedAt:'2020-01-01T00:00:00.000Z'});
 return{record:{COMPANY:'Acme',TITLE:card.title,LOCATION:card.location,SOURCE_URL:card.url},discoveryEvidence,evidenceSource:'CAPTURED_DISCOVERY',evidenceVerified:false,businessEvidenceApproved:false,reviewedNeverConsider:false,evidenceUrl:card.url,primaryBusiness:card.description,rulesHash,expectedOutcome:'NEW'};
}
function fixture({pending=false}={}){
 const writes=[],store={};
 return{writes,options:{key:'fixture',expectedMode:'AUTO',sourceRunId:'FORGE-CAPTURED-TEST',recorder:{check:async()=>true,record:async(id,v)=>{store[id]=structuredClone(v)},read:async id=>store[id]},switchTransport:async()=>({ok:true,json:async()=>({enabled:true,mode:'AUTO',revision:'SOURCE_INTAKE_AUTO_V1',maxBatch:25,approvedBy:'Tim'})}),transport:async(url,options)=>{
  if(options.method==='POST'){const body=JSON.parse(options.body);writes.push(body);return{ok:true,json:async()=>({ok:true,receipt:{REQUEST_ID:body.requestId,NEW_PRIMARY_IDS:[]},results:[{result:'WRITE_FAILED'}]})};}
  const action=new URL(url).searchParams.get('action');let data;
  if(action==='writer_status')data={level:'OK',errors:[]};
  else if(action==='receipt_index')data={source:'GITHUB',exists:true,sha:'fixture',...(pending?{request:{s:'PENDING'}}:{})};
  else if(action==='archive')data={archiveId:'A',mode:'MIGRATED',text:'V2_TERMINAL_ARCHIVE\n1 | V2A-9 | Other | Director | ARCHIVE | REJECTED | P | R0 | TX | N'};
  else if(action==='rules')data={rules:{status:'ACTIVE',id:'fixture',raw,rules:[{id:'NC-1'}]}};
  else throw Error('Unexpected read '+action);
  return{ok:true,json:async()=>({ok:true,...data})};
 }}};
}
test('metadata-only saved card keeps unknown business and original age without claiming live posting',()=>{
 const c=candidate();a.equal(C.validate(c),true);a.equal(c.discoveryEvidence.observedAt,'2020-01-01T00:00:00.000Z');a.equal(c.discoveryEvidence.postingStatus,'UNVERIFIED');a.equal(c.discoveryEvidence.businessStatus,'UNKNOWN');a.equal(c.discoveryEvidence.card.fullPosting,false);
 const missing=C.capture({...c.discoveryEvidence.card},{proof});a.equal(missing.observedAt,null);a.equal(C.validEnvelope(missing),true);
});
test('short JobSpy and HiringCafe job text remains source text while explicit partial boundaries survive',()=>{
 for(const source of ['JOBSPY:indeed','JOBSPY:linkedin','HIRINGCAFE','BOARD:workday','LINKEDIN','RECRUITING:Example Staffing']){
  const c=candidate({source,description:'Lead production.'});a.equal(C.validate(c),true);a.equal(c.discoveryEvidence.card.fullPosting,true);a.equal(c.discoveryEvidence.businessStatus,'SOURCE_TEXT');
  for(const patch of [{fullPosting:false},{discoveryReview:{fullPosting:false}},{contentBasis:'PREVIOUSLY_CAPTURED_QUOTES'}])a.equal(candidate({source,description:'Lead production.',...patch}).discoveryEvidence.card.fullPosting,false);
 }
});
test('tampered content, identity, URLs, origin, dates and proof formats fail closed',()=>{
 const original=candidate({description:'Lead production.'});
 for(const mutate of [c=>{c.discoveryEvidence.card.description+='changed'},c=>{c.record.COMPANY='Other'},c=>{c.record.LOCATION='Dallas, TX'},c=>{c.record.TITLE='Other'},c=>{c.record.SOURCE_URL='https://example.com/jobs/2'},c=>{c.evidenceUrl='https://example.com/jobs/2'},c=>{c.primaryBusiness='metadata serialized'},c=>{c.discoveryEvidence.proof.sha256='bad'},c=>{c.discoveryEvidence.proof.path='../state/source-trial-report.json'},c=>{c.discoveryEvidence.proof.path='state/discovery-evidence/'+C.hash('other')+'.json'},c=>{c.discoveryEvidence.observedAt='2999-01-01T00:00:00Z'},c=>{c.discoveryEvidence.postingStatus='LIVE'},c=>{c.businessEvidenceApproved=true},c=>{c.evidenceVerified=true}]){const c=structuredClone(original);mutate(c);a.equal(C.validate(c),false);}
 for(const patch of [{url:'https://127.0.0.1/jobs/1'},{url:'https://user:password@example.com/jobs/1'},{url:'http://example.com/jobs/1'},{source:'SAVED_DISCOVERY'},{source:'INTAKE_DRAIN'},{source:'UNKNOWN'},{source:''}])a.equal(C.capture({...original.discoveryEvidence.card,...patch},{proof}),null);
 const incomplete=candidate({description:'A selected quote.',contentBasis:'PREVIOUSLY_CAPTURED_QUOTES'});incomplete.discoveryEvidence.card.fullPosting=true;incomplete.discoveryEvidence.cardSha256=C.hash(incomplete.discoveryEvidence.card);a.equal(C.validate(incomplete),false);
});
test('AUTO sends blank business for metadata with source audit and unknown field; no refresh fetch required',async()=>{
 const c=candidate(),f=fixture();await runIntake([c],f.options);a.equal(f.writes.length,1);const r=f.writes[0].records[0];a.equal(r.EMPLOYER_PRIMARY_BUSINESS,'');a.equal(r.SOURCE_PROVIDER,'JOBSPY:indeed');a.ok(r.INITIAL_UNKNOWN_FIELDS.includes('EMPLOYER_PRIMARY_BUSINESS'));a.equal(f.writes[0].requestId,requestId(c.record));
});
test('posting text is not written as EMPLOYER_PRIMARY_BUSINESS and the rest of the intake record stays',async()=>{
 const posting='We manufacture industrial machinery. '.repeat(12).trim();
 const c=candidate({source:'HIRINGCAFE',description:posting}),f=fixture();
 await runIntake([c],f.options);
 const wrote=f.writes[0].records[0];
 a.equal(wrote.EMPLOYER_PRIMARY_BUSINESS,'');
 a.ok(!JSON.stringify(wrote).includes(posting));
 const empty=candidate({source:'HIRINGCAFE',description:''}),g=fixture();
 await runIntake([empty],g.options);
 const rest=row=>{const {EMPLOYER_PRIMARY_BUSINESS,...other}=row;return other;};
 a.deepEqual(rest(wrote),rest(g.writes[0].records[0]));
 a.deepEqual(wrote.INITIAL_UNKNOWN_FIELDS,g.writes[0].records[0].INITIAL_UNKNOWN_FIELDS);
});
test('captured branch is AUTO-only and rejects tampering before network',async()=>{
 for(const patch of [{expectedMode:'STAGE'},{}]){const c=candidate(),f=fixture();if(!patch.expectedMode)c.primaryBusiness='fake';await a.rejects(()=>runIntake([c],{...f.options,...patch}),/reviewed intake candidates/);a.equal(f.writes.length,0);}
});
test('fresh rules binding is still required, and refresh cannot corrupt captured provenance',async()=>{
 const c=candidate();c.rulesHash='old';let f=fixture();await a.rejects(()=>runIntake([c],f.options),/fresh canonical rules/);a.equal(f.writes.length,0);
 f=fixture();await a.rejects(()=>runIntake([c],{...f.options,refreshReview:async()=>({rulesHash,primaryBusiness:'unsupported business'})}),/invalid captured discovery/);a.equal(f.writes.length,0);
});
test('pending original request and uncertain prior response still fence captured cards without replay',async()=>{
 const c=candidate();let f=fixture({pending:true});await runIntake([c],f.options);a.equal(f.writes.length,0);
 f=fixture();await runIntake([c],{...f.options,priorResults:{[requestId(c.record)]:{status:'POST_IN_FLIGHT_UNKNOWN'}}});a.equal(f.writes.length,0);
});

test('captured discovery never relaxes protected archive identity requirements',async()=>{
 const c=candidate(),f=fixture();c.expectedOutcome='PROTECTED_NOOP';c.protectedPrimaryId='V2A-9';await a.rejects(()=>runIntake([c],f.options),/protected archive identity unproven/);a.equal(f.writes.length,0);
});

test('separate expiry provenance is hashed and bound to exact identity URL requisition and observation date',()=>{
 const c=candidate({description:'Saved job text.',requisitionIds:['req-1'],validThrough:'2030-01-01T00:00:00Z',validThroughEvidence:{company:'Acme',title:'Plant Manager',location:'Austin, TX',url:'https://example.com/jobs/1',source:'HIRINGCAFE',requisitionIds:['req-1'],validThrough:'2030-01-01T00:00:00Z',observedAt:'2026-01-01T00:00:00Z',proof:{path:'state/board-discovery-report.json',sha256:C.hash('expiry report')}}});a.ok(C.validate(c));
 for(const patch of [{company:'Other'},{url:'https://example.com/jobs/2'},{requisitionIds:['req-2']},{validThrough:'2031-01-01T00:00:00Z'},{observedAt:'2099-01-01T00:00:00Z'},{proof:{path:'../other',sha256:C.hash('wrong')}}]){
  const changed=structuredClone(c);Object.assign(changed.discoveryEvidence.card.validThroughEvidence,patch);changed.discoveryEvidence.cardSha256=C.hash(changed.discoveryEvidence.card);a.equal(C.validate(changed),false);
 }
 const wrongReq=structuredClone(c);wrongReq.record.REQ_ID='REQ-2';a.equal(C.validate(wrongReq),false);
});

test('email initiation remains distinct from posting provider and automatic processor on Writer payload',async()=>{
 const c=candidate(),f=fixture();c.record.DISCOVERY_SOURCE='EMAIL';
 await runIntake([c],{...f.options,sourceRunId:'FORGE-AUTO-ORIGIN-TEST'});
 a.equal(f.writes[0].records[0].DISCOVERY_SOURCE,'EMAIL');
 a.equal(f.writes[0].records[0].SOURCE_PROVIDER,'JOBSPY:indeed');
 a.equal(f.writes[0].run.SCOUT_RUN_ID,'FORGE-AUTO-ORIGIN-TEST-C1');
});
