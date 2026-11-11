'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),P=require('./prepared.cjs');
const source=row=>require('./recovery').saveEvidence({},row,row.p.SOURCE_URL||'https://example.org/job',{identityVerified:true,sourceIdentity:{company:row.COMPANY,title:row.TITLE,location:row.LOCATION},text:'Lead manufacturing quality operations. '.repeat(20)},Date.parse('2026-11-10T00:00:00Z'));
test('prepared salary is exact-bound, immutable, guarded and not a replay payload',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pay-prepared-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const row={PRIMARY_ID:'V2I-X',COMPANY:'Acme',TITLE:'Director',LOCATION:'Dayton, OH',BUCKET:'READY_TO_PURSUE',p:{SOURCE_URL:'https://example.org/job'}};
 const fields={SALARY_BASE_LOW:100000,SALARY_BASE_HIGH:150000,SALARY_SOURCE:'comparables:V2I-A',SALARY_ASOF:'2026-11-10'};
 const value={row,fields,policy:'policy1',inputs:'inputs1',evidence:{anchors:['V2I-A'],postingEvidence:source(row)}};
 const file=P.save(dir,value);assert.equal(P.save(dir,value),file);
 const opts={rows:[row],policy:'policy1',inputs:'inputs1',blocked:new Set(),needsSalary:()=>true,now:Date.parse('2026-11-10')};
 assert.equal(P.load(dir,opts).length,1);assert.equal(P.load(dir,{...opts,rows:[],inputs:r=>{assert.ok(r);return 'inputs1';}}).length,0);assert.equal(P.load(dir,opts)[0].requestId,undefined);
 for(const delta of [{policy:'policy2'},{inputs:'inputs2'},{blocked:new Set(['V2I-X'])},{needsSalary:()=>false},{rows:[{...row,TITLE:'Different'}]},{rows:[{...row,p:{...row.p,DO_NOT_REWORK:'YES'}}]},{now:Date.parse('2026-11-18')}])assert.equal(P.load(dir,{...opts,...delta}).length,0);
 const bad=JSON.parse(fs.readFileSync(path.join(dir,file)));bad.fields.SALARY_BASE_LOW=1;fs.writeFileSync(path.join(dir,file),JSON.stringify(bad));assert.equal(P.load(dir,opts).length,0);
});
test('unchanged source gaps wait for row, policy or saved-input change; changed inputs remain live hints only',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pay-attempt-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const row={PRIMARY_ID:'V2I-X',COMPANY:'Acme',TITLE:'Director',LOCATION:'Dayton, OH',BUCKET:'READY_TO_PURSUE',p:{}};
 assert.equal(P.attempted(dir,row,'p','i'),false);P.rememberAttempt(dir,row,'p','i');assert.equal(P.attempted(dir,row,'p','i'),true);assert.equal(P.attempted(dir,row,'p','changed'),false);assert.equal(P.attempted(dir,{...row,TITLE:'Changed'},'p','i'),false);
 const fields={SALARY_BASE_LOW:100000,SALARY_SOURCE:'comparables:X',SALARY_ASOF:'2026-11-10'};P.save(dir,{row,fields,policy:'p',inputs:'i',evidence:{postingEvidence:source(row)}});
 const opts={rows:[row],policy:'new-policy',inputs:'new-inputs',blocked:new Set(),needsSalary:()=>true,now:Date.parse('2026-11-10')};assert.equal(P.load(dir,opts).length,0);assert.equal(P.load(dir,{...opts,hints:true}).length,1);
 assert.throws(()=>P.save(dir,{row,fields:{...fields,TIM_DECISION:'YES'},policy:'p',inputs:'i',evidence:{postingEvidence:source(row)}}),/Unsafe/);
});

test('new exact ledger or discovery posting evidence reopens a saved source gap without a row change',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pay-new-evidence-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const r={PRIMARY_ID:'V2I-X',COMPANY:'Acme',TITLE:'Director',LOCATION:'Dayton, OH',BUCKET:'READY_TO_PURSUE',p:{SOURCE_URL:'https://example.org/role'}};
 const baseline=P.sourceInputs('same-comparison-inputs',{});P.rememberAttempt(dir,r,'policy',baseline);assert.equal(P.attempted(dir,r,'policy',baseline),true);
 const exact={identity:'Acme|Director|Dayton, OH',sourceUrl:r.p.SOURCE_URL,fullPosting:true,pay:{low:180000,high:220000},observedAt:'2026-11-10T01:00:00Z'};
 for(const evidence of [{ledger:exact},{discovery:exact}]){const changed=P.sourceInputs('same-comparison-inputs',evidence);assert.notEqual(changed,baseline);assert.equal(P.attempted(dir,r,'policy',changed),false);P.rememberAttempt(dir,r,'policy',changed);assert.equal(P.attempted(dir,r,'policy',changed),true);}
});

test('preparation rejects missing, legacy, mismatched, explicitly expired and unresolved no-pay evidence',()=>{
 const row={PRIMARY_ID:'X',COMPANY:'Acme',TITLE:'Director',LOCATION:'Dayton, OH',p:{}};
 const now=Date.parse('2026-11-10T01:00:00Z'),e=source(row),fields={SALARY_BASIS:'FORGE-ESTIMATE'};
 assert.equal(P.sourceValid(row,fields,{postingEvidence:e},now),true);assert.equal(P.sourceValid(row,fields,{postingEvidence:{...e,at:'2026-10-01'}},now),true);
 for(const bad of [null,{...e,identityVerified:false},{...e,text:'snippet'},{...e,sourceIdentity:{...e.sourceIdentity,title:'Other'}},{...e,payAmbiguous:true},{...e,pay:{low:100000,high:200000}},{...e,postingFacts:{validThrough:'2026-11-01'}}])assert.equal(P.sourceValid(row,fields,{postingEvidence:bad},now),false);
});

test('live source handoff reparses full no-pay text and reuses older captures but rejects altered or monetary sources',()=>{
 const row={PRIMARY_ID:'X',COMPANY:'Acme',TITLE:'Director',LOCATION:'Dayton, OH',p:{}};
 const now=Date.parse('2026-11-10T01:00:00Z'),e=source(row);
 const record=raw=>({fields:{SALARY_BASE_LOW:1},evidence:{postingEvidence:raw,postingEvidenceSha256:P.fingerprint(raw)}});
 const forged={...e,degree:{req:'REQUIRED',text:'fabricated'},qualificationVersion:require('./qualification').VERSION};
 const result=P.noPaySource(row,record(forged),now);assert.ok(result);assert.equal(result.at,e.at);assert.equal(result.pay,null);assert.notDeepEqual(result.degree,forged.degree);
 for(const bad of [{...e,factsVersion:'old'},{...e,at:'2026-11-11'},{...e,postingFacts:{validThrough:'2026-11-01'}},{...e,pay:{low:1,high:2}},{...e,payAmbiguous:true},{...e,structuredBaseSalary:{currency:'CAD'}},{...e,text:e.text+' Salary USD 180000 to 200000.'},{...e,sourceIdentity:{...e.sourceIdentity,title:'Different'}},{...e,basis:'THIRD_PARTY_ESTIMATE'}])assert.equal(P.noPaySource(row,record(bad),now),null);
 assert.equal(P.noPaySource(row,record({...e,at:'2026-10-01'}),now).at,'2026-10-01T00:00:00.000Z');
 const altered=record(e);altered.evidence.postingEvidenceSha256='bad';assert.equal(P.noPaySource(row,altered,now),null);
});

test('live pre-submit source guard rejects protected, changed, pending and fenced rows',()=>{
 const row={PRIMARY_ID:'X',COMPANY:'Acme',TITLE:'Director',LOCATION:'Dayton, OH',BUCKET:'SCOUT_INTAKE',p:{}};
 assert.equal(P.liveAllowed(row,structuredClone(row)),true);
 for(const current of [null,{...row,TITLE:'Other'},{...row,p:{DO_NOT_REWORK:'YES'}},{...row,p:{TIM_DECISION:'DECLINE'}},{...row,BUCKET:'APPLIED'}])assert.equal(P.liveAllowed(row,current),false);
 for(const options of [{blocked:true},{fenced:true}])assert.equal(P.liveAllowed(row,row,options),false);
});

test('retained no-pay preparation cannot erase newer posted or unresolved pay',()=>{
 const R=require('./recovery'),row={PRIMARY_ID:'X',COMPANY:'Acme',TITLE:'Director',LOCATION:'Dayton, OH',p:{}},raw=source(row),now=Date.parse('2026-11-10T02:00:00Z');
 const retained=P.noPaySource(row,{evidence:{postingEvidence:raw,postingEvidenceSha256:P.fingerprint(raw)}},now);
 const newer={...raw,at:'2026-11-10T01:00:00Z',pay:{low:150000,high:190000}};
 assert.deepEqual(R.combine(newer,retained).pay,newer.pay);
 const ambiguous=R.combine({...newer,pay:null,payAmbiguous:true},retained);assert.equal(ambiguous.pay,null);assert.equal(ambiguous.payAmbiguous,true);
});
