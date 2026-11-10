'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{validate}=require('./direct-writer.cjs');
const fixture=()=>({action:'batch',requestId:'FORGE-GROK-DIRECT-20261110-B001',requests:[{action:'ruling',ruling:{requestId:'FORGE-GROK-DIRECT-20261110-B001-R001',primaryId:'V2I-EXAMPLE',kind:'ENRICH',actor:'GROK',fields:{DEGREE_TEXT:'Bachelor degree or equivalent relevant experience.',DEGREE_EVIDENCE_URL:'https://employer.example/jobs/123'}}}]});
test('valid exact Writer payload is syntax only, never proof or a submission',()=>{
 const p=fixture(),before=JSON.stringify(p),r=validate(p);assert.equal(JSON.stringify(p),before);
 assert.equal(r.status,'SYNTAX_VALID');assert.equal(r.requests,1);
 for(const k of ['sourceVerified','ownershipVerified','originalRequestsReconciled','writerSubmitted','canonicalVerified'])assert.equal(r[k],false);
});
test('never accept helper envelopes or credentials at any payload level',()=>{
 assert.throws(()=>validate({schema:'forge.shared-helper-batch.v1',items:[]}),/EXACT_WRITER_BATCH/);
 for(const target of ['root','request','ruling']){const p=fixture();(target==='root'?p:target==='request'?p.requests[0]:p.requests[0].ruling).key='not-a-real-secret';assert.throws(()=>validate(p),/EXACT_/);}
});
test('reject protected identity, decisions, applications, calculated scores and arbitrary fields',()=>{
 for(const key of ['COMPANY','TITLE','LOCATION','REQ_ID','BUCKET','DISPOSITION','PRIMARY_ID','TIM_DECISION','SCOPE_FIT_RAW','SALARY_SCORE','OVERALL_RATING','APPLICATION_STATE','anything']){
  const p=fixture();p.requests[0].ruling.fields[key]='forbidden';assert.throws(()=>validate(p),/UNSUPPORTED_OR_PROTECTED/);
 }
 for(const mutation of [p=>p.action='intake',p=>p.requests[0].action='upsert_application',p=>p.requests[0].ruling.kind='DECLINE',p=>p.requests[0].ruling.actor='CLAUDE']){const p=fixture();mutation(p);assert.throws(()=>validate(p),/GROK_ENRICH/);}
});
test('each file has one to 25 distinct rows and request identities',()=>{
 for(const n of [0,26]){const p=fixture();p.requests=Array.from({length:n},(_,i)=>({...p.requests[0],ruling:{...p.requests[0].ruling,requestId:`FORGE-GROK-REQ-${i}`,primaryId:`V2I-ROW-${i}`}}));assert.throws(()=>validate(p),/GROK_ENRICH_BATCH/);}
 const p=fixture();p.requests.push(structuredClone(p.requests[0]));assert.throws(()=>validate(p),/DUPLICATE/);
 p.requests[1].ruling.requestId+='-OTHER';assert.throws(()=>validate(p),/DUPLICATE/);
 p.requests[1].ruling.primaryId='V2I-OTHER';assert.equal(validate(p).requests,2);
 p.requests[1].ruling.requestId=p.requestId;assert.throws(()=>validate(p),/DUPLICATE/);
});
test('reject missing fields, nonfinite data, objects and malformed source URLs',()=>{
 for(const fields of [{},{DEGREE_TEXT:''},{SALARY_BASE_LOW:NaN},{FIT_EVIDENCE:{}},{SOURCE_URL:'javascript:alert(1)'},{SOURCE_URL:'https://site/a b'},{DEGREE_TEXT:'x'.repeat(12001)}]){
  const p=fixture();p.requests[0].ruling.fields=fields;assert.throws(()=>validate(p));
 }
});
