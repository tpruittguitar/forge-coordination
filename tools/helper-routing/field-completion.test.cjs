'use strict';
const {test}=require('node:test'),a=require('node:assert/strict');
const F=require('./field-completion.cjs');
const degree={DEGREE_TEXT:'Bachelor degree or equivalent experience.',DEGREE_EVIDENCE_URL:'https://employer.example/jobs/123'};
const request='FORGE-GROK-SHARED-20261110T210000Z-B001-R001';
const item=()=>({primaryId:'V2I-ONE',kind:'ENRICHMENT',status:'ASSIGNED',sourceVersion:'a'.repeat(64),missingFields:['DEGREE','SALARY']});
const submission=(at,mode,fields=degree)=>({requestId:request,primaryId:'V2I-ONE',at,ok:true,mode,noWrite:mode==='BATCH_RULING_NO_WRITE'||mode==='ALREADY_APPLIED',fields,evidence:null,complete:mode==='SUCCESS'});
test('a field moves pending to submitted to satisfied when a later row matches',()=>{
 const work=item(),blank={PRIMARY_ID:'V2I-ONE',p:{}};
 F.advance(work,{needs:['DEGREE'],row:blank,readAt:'2026-11-10T21:00:00.000Z',now:'2026-11-10T21:00:00.000Z'});
 a.equal(work.fieldState.fields.DEGREE.status,'pending');a.equal(work.fieldState.role,'pending');a.equal(work.status,'ASSIGNED');
 F.advance(work,{needs:['DEGREE'],row:blank,readAt:'2026-11-10T21:00:00.000Z',now:'2026-11-10T21:01:00.000Z',submissions:[submission('2026-11-10T21:02:00.000Z','SUCCESS')]});
 a.equal(work.fieldState.fields.DEGREE.status,'submitted');a.equal(work.fieldState.fields.DEGREE.flag,null);a.equal(work.status,'AWAITING_FIELD_READBACK');
 F.advance(work,{needs:[],row:{PRIMARY_ID:'V2I-ONE',p:degree},readAt:'2026-11-10T21:05:00.000Z',now:'2026-11-10T21:05:00.000Z',submissions:[submission('2026-11-10T21:02:00.000Z','SUCCESS')]});
 a.equal(work.fieldState.fields.DEGREE.status,'satisfied');a.equal(work.fieldState.role,'satisfied');a.equal(work.status,'ALREADY_COMPLETE');
});
test('SUCCESS with a still-blank later row keeps the field pending and flags the no-op',()=>{
 const work=item();
 F.advance(work,{needs:['DEGREE'],row:{PRIMARY_ID:'V2I-ONE',p:{}},readAt:'2026-11-10T21:05:00.000Z',now:'2026-11-10T21:05:00.000Z',submissions:[submission('2026-11-10T21:02:00.000Z','SUCCESS')]});
 a.equal(work.fieldState.fields.DEGREE.status,'pending');a.equal(work.fieldState.fields.DEGREE.flag,'SUCCESS_NO_OP');a.equal(work.status,'ASSIGNED');
 const explicit=item();
 F.advance(explicit,{needs:['DEGREE'],row:{PRIMARY_ID:'V2I-ONE',p:{}},readAt:'2026-11-10T21:00:00.000Z',now:'2026-11-10T21:00:00.000Z',submissions:[submission('2026-11-10T21:02:00.000Z','BATCH_RULING_NO_WRITE')]});
 a.equal(explicit.fieldState.fields.DEGREE.status,'pending');a.equal(explicit.fieldState.fields.DEGREE.flag,'SUCCESS_NO_OP');
 const sameHash=F.parseReceipts({index:{requests:{[request]:{s:'COMPLETE',at:'2026-11-10T21:02:00.000Z',items:[{pid:'V2I-ONE',op:'REPLACE',b:'a:10',a:'a:10',fields:degree}]}},pending:[]}});
 a.equal(sameHash.submissions[0].noWrite,true);
});
test('a mismatched later row keeps the field pending and flags the mismatch',()=>{
 const work=item();
 F.advance(work,{needs:['DEGREE'],row:{PRIMARY_ID:'V2I-ONE',p:{DEGREE_TEXT:'MBA required',DEGREE_EVIDENCE_URL:'https://employer.example/jobs/123'}},readAt:'2026-11-10T21:05:00.000Z',now:'2026-11-10T21:05:00.000Z',submissions:[submission('2026-11-10T21:02:00.000Z','SUCCESS')]});
 a.equal(work.fieldState.fields.DEGREE.status,'pending');a.equal(work.fieldState.fields.DEGREE.flag,'READBACK_MISMATCH');a.equal(work.fieldState.role,'pending');a.equal(work.status,'ASSIGNED');
});
test('one pending field keeps the role pending while a submitted field is recorded',()=>{
 const work=item();
 F.advance(work,{needs:['SALARY','DEGREE'],row:{PRIMARY_ID:'V2I-ONE',p:{}},readAt:'2026-11-10T21:00:00.000Z',now:'2026-11-10T21:00:00.000Z',submissions:[submission('2026-11-10T21:02:00.000Z','SUCCESS')]});
 a.equal(work.fieldState.fields.DEGREE.status,'submitted');a.equal(work.fieldState.fields.SALARY.status,'pending');
 a.equal(work.fieldState.role,'pending');a.equal(work.status,'ASSIGNED');a.deepEqual(work.missingFields,['SALARY']);
});
test('captured field evidence is reused and the source is fetched once',()=>{
 const work=item();F.seed(work,['SALARY','DEGREE']);
 const text='Employer posting extract. '.repeat(20)+'Base salary $180,000.';
 let fetches=0;
 const first=F.evidenceFor(work,'SALARY',()=>{fetches++;return {url:'https://employer.example/jobs/123',quote:'Base salary $180,000',observedAt:'2026-11-10T20:00:00.000Z',text};});
 const second=F.evidenceFor(work,'SALARY',()=>{fetches++;throw Error('fetch');});
 a.equal(fetches,1);a.equal(first.fetched,true);a.equal(second.fetched,false);
 a.equal(second.evidence.text,text);a.equal(second.evidence.sha256,first.evidence.sha256);
 const other=item();other.fieldState=work.fieldState;
 a.equal(F.evidenceFor(other,'SALARY',()=>{fetches++;throw Error('fetch');}).fetched,false);a.equal(fetches,1);
});
test('a complete receipt without a field map flags blanks and leaves them pending',()=>{
 const parsed=F.parseReceipts({index:{requests:{[request]:{s:'COMPLETE',at:'2026-11-10T21:02:00.000Z',items:[{pid:'V2I-ONE',op:'REPLACE',b:'a:10',a:'b:10'}]},'FORGE-CODE-CHATGPT-20261110T210000Z-B001-R001':{s:'COMPLETE',at:'2026-11-10T21:02:00.000Z',items:[{pid:'V2I-ONE'}]}},pending:[]},submissions:[]});
 a.equal(parsed.unbound.length,1);a.equal(parsed.submissions.length,0);
 const work=item();
 F.advance(work,{needs:['DEGREE','SALARY'],row:{PRIMARY_ID:'V2I-ONE',p:{}},readAt:'2026-11-10T21:05:00.000Z',now:'2026-11-10T21:05:00.000Z',unbound:parsed.unbound});
 a.equal(work.status,'ASSIGNED');a.equal(work.fieldState.fields.DEGREE.flag,'SUCCESS_NO_OP');a.equal(work.fieldState.fields.SALARY.status,'pending');
 const legacy=item();legacy.status='DIRECT_REQUEST_SUBMITTED';
 F.advance(legacy,{needs:['DEGREE'],row:{PRIMARY_ID:'V2I-ONE',p:{}},readAt:'2026-11-10T21:05:00.000Z',now:'2026-11-10T21:05:00.000Z',unbound:parsed.unbound});
 a.equal(legacy.status,'ASSIGNED');a.equal(legacy.fieldState.role,'pending');
});
