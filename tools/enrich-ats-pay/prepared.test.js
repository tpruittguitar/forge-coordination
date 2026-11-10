'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),P=require('./prepared.cjs');
test('prepared salary is exact-bound, immutable, guarded and not a replay payload',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pay-prepared-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const row={PRIMARY_ID:'V2I-X',COMPANY:'Acme',TITLE:'Director',LOCATION:'Dayton, OH',BUCKET:'READY_TO_PURSUE',p:{SOURCE_URL:'https://example.org/job'}};
 const fields={SALARY_BASE_LOW:100000,SALARY_BASE_HIGH:150000,SALARY_SOURCE:'comparables:V2I-A',SALARY_ASOF:'2026-11-10'};
 const value={row,fields,policy:'policy1',inputs:'inputs1',evidence:{anchors:['V2I-A']}};
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
 const fields={SALARY_BASE_LOW:100000,SALARY_SOURCE:'comparables:X',SALARY_ASOF:'2026-11-10'};P.save(dir,{row,fields,policy:'p',inputs:'i',evidence:{}});
 const opts={rows:[row],policy:'new-policy',inputs:'new-inputs',blocked:new Set(),needsSalary:()=>true,now:Date.parse('2026-11-10')};assert.equal(P.load(dir,opts).length,0);assert.equal(P.load(dir,{...opts,hints:true}).length,1);
 assert.throws(()=>P.save(dir,{row,fields:{...fields,TIM_DECISION:'YES'},policy:'p',inputs:'i',evidence:{}}),/Unsafe/);
});

test('new exact ledger or discovery posting evidence reopens a saved source gap without a row change',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pay-new-evidence-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const r={PRIMARY_ID:'V2I-X',COMPANY:'Acme',TITLE:'Director',LOCATION:'Dayton, OH',BUCKET:'READY_TO_PURSUE',p:{SOURCE_URL:'https://example.org/role'}};
 const baseline=P.sourceInputs('same-comparison-inputs',{});P.rememberAttempt(dir,r,'policy',baseline);assert.equal(P.attempted(dir,r,'policy',baseline),true);
 const exact={identity:'Acme|Director|Dayton, OH',sourceUrl:r.p.SOURCE_URL,fullPosting:true,pay:{low:180000,high:220000},observedAt:'2026-11-10T01:00:00Z'};
 for(const evidence of [{ledger:exact},{discovery:exact}]){const changed=P.sourceInputs('same-comparison-inputs',evidence);assert.notEqual(changed,baseline);assert.equal(P.attempted(dir,r,'policy',changed),false);P.rememberAttempt(dir,r,'policy',changed);assert.equal(P.attempted(dir,r,'policy',changed),true);}
});
