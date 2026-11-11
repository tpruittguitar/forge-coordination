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
 for(const mutation of [p=>p.action='intake',p=>p.requests[0].action='upsert_application',p=>p.requests[0].ruling.kind='DECLINE',p=>p.requests[0].ruling.actor='CLAUDE']){const p=fixture();mutation(p);assert.throws(()=>validate(p),/GROK_DIRECT|EXACT_DECLINE/);}
});
test('each file has one to 25 distinct rows and request identities',()=>{
 for(const n of [0,26]){const p=fixture();p.requests=Array.from({length:n},(_,i)=>({...p.requests[0],ruling:{...p.requests[0].ruling,requestId:`FORGE-GROK-REQ-${i}`,primaryId:`V2I-ROW-${i}`}}));assert.throws(()=>validate(p),/GROK_DIRECT_BATCH/);}
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
test('reject JavaScript object coercion even when already serialized',()=>{
 const p=fixture();p.requests[0].ruling.fields={FIT_EVIDENCE:'[object Object],[object Object]'};assert.throws(()=>validate(p),/INVALID_FIELD_VALUE/);
 const p2=fixture();p2.requests[0].ruling.fields={FIT_REQUIREMENTS:[{quote:'Exact quote'}]};assert.throws(()=>validate(p2),/UNSUPPORTED_OR_PROTECTED_FIELD/);
});
test('fresh missing-field selection rejects conflict and unknown compact fields, ignores metadata-only churn',()=>{
 const {novelFields}=require('./direct-writer.cjs');
 assert.deepEqual(novelFields({DEGREE_TEXT:'same',DEGREE_ASOF:'today'},{DEGREE_TEXT:'same',DEGREE_ASOF:'yesterday'}),{});
 assert.deepEqual(novelFields({DEGREE_TEXT:'new',DEGREE_ASOF:'today'},{DEGREE_TEXT:null,DEGREE_ASOF:null}),{DEGREE_TEXT:'new',DEGREE_ASOF:'today'});
 assert.throws(()=>novelFields({DEGREE_TEXT:'new'},{DEGREE_TEXT:'other'}),/CURRENT_VALUE_CONFLICT/);
 assert.throws(()=>novelFields({FIT_EVIDENCE:'quote'},{}),/CURRENT_FIELD_UNKNOWN/);
});
test('respect actual Writer 1500 character scalar limit instead of silent truncation',()=>{
 const p=fixture();p.requests[0].ruling.fields={FIT_EVIDENCE:'x'.repeat(1501)};assert.throws(()=>validate(p),/INVALID_FIELD_VALUE/);
 p.requests[0].ruling.fields={FIT_EVIDENCE:'x'.repeat(1500),FIT_BASIS:'Observed overlap',FIT_ASOF:'2026-11-10',FIT_CONF:'LOW'};assert.equal(validate(p).status,'SYNTAX_VALID');
});
test('fit quartet is bounded readable text, no numeric evidence or confidence-only claims',()=>{
 for(const fields of [{FIT_CONF:'HIGH'},{FIT_EVIDENCE:1},{FIT_EVIDENCE:'quote',FIT_BASIS:'basis',FIT_ASOF:'today',FIT_CONF:'LOW'}]){
 const p=fixture();p.requests[0].ruling.fields=fields;assert.throws(()=>validate(p));}
});

test('Writer normalization and explicit missing sentinels do not cause false conflicts',()=>{const {novelFields}=require('./direct-writer.cjs');assert.deepEqual(novelFields({DEGREE_TEXT:'A; B | C\nD'},{DEGREE_TEXT:'A, B / C D'}),{});assert.deepEqual(novelFields({DEGREE_TEXT:'Degree'},{DEGREE_TEXT:'UNKNOWN'}),{DEGREE_TEXT:'Degree'});});
const decline=()=>({action:'batch',requestId:'FORGE-GROK-DECLINE-20261110-B001',requests:[{action:'ruling',ruling:{requestId:'FORGE-GROK-DECLINE-20261110-B001-R001',primaryId:'V2I-EXAMPLE',kind:'DECLINE',actor:'GROK',code:'NEVER_CONSIDER — PHARMA_MEDICAL',evidence:'https://employer.example/about',authorizedBy:'TIM',authorizationRef:'Tim authorized the pharma exclusion 2026-11-10'}}]});
test('Tim-authorized DECLINE is syntax-valid only with a canonical code, employer URL and Tim authorization',()=>{
 const p=decline(),before=JSON.stringify(p),r=validate(p);assert.equal(JSON.stringify(p),before);assert.equal(r.status,'SYNTAX_VALID');assert.equal(r.kind,'DECLINE');assert.equal(r.canonicalVerified,false);
 p.requests[0].ruling.code='PAY_BELOW_FLOOR';assert.equal(validate(p).status,'SYNTAX_VALID');
 for(const mutation of [q=>q.requests[0].ruling.code='NEVER_CONSIDER - PHARMA_MEDICAL',q=>q.requests[0].ruling.code='NOT_A_RULE',q=>q.requests[0].ruling.evidence='http://employer.example/about',q=>q.requests[0].ruling.authorizedBy='GROK',q=>q.requests[0].ruling.authorizationRef='2026-11-10',q=>q.requests[0].ruling.fields={DEGREE_TEXT:'x'},q=>q.requests[0].ruling.supersede=true]){
  const bad=decline();mutation(bad);assert.throws(()=>validate(bad));
 }
 const mixed=decline();mixed.requests.push(fixture().requests[0]);assert.throws(()=>validate(mixed),/MIXED_ENRICH_AND_DECLINE/);
 const two=decline();two.requests.push(structuredClone(two.requests[0]));two.requests[1].ruling.requestId='FORGE-GROK-DECLINE-20261110-B001-R002';two.requests[1].ruling.primaryId='V2I-OTHER';assert.equal(validate(two).requests,2);
 two.requests[1].ruling.requestId=two.requests[0].ruling.requestId;assert.throws(()=>validate(two),/DUPLICATE/);
});
