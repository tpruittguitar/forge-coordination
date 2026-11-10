'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),S=require('./prepared-source.cjs'),P=require('./prepared.cjs'),Store=require('../programmed-coordinator/store.cjs'),R=require('./recovery');
const now=Date.parse('2026-11-10T01:00:00Z');
const row={PRIMARY_ID:'V2I-SOURCE',COMPANY:'Acme',TITLE:'Director',LOCATION:'Dayton, OH',BUCKET:'SCOUT_INTAKE',p:{PRIVATE_NOTE:'never publish'}};
const evidence=()=>R.saveEvidence({},row,'https://example.org/job',{identityVerified:true,sourceIdentity:{company:row.COMPANY,title:row.TITLE,location:row.LOCATION},text:'Lead manufacturing quality operations. '.repeat(20)+'Bachelor degree preferred.'},now-3600000);
function fixture(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'public-pay-source-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const file=S.save(dir,{row,postingEvidence:{...evidence(),privateCanonicalSource:{fileId:'PRIVATE'}}},now);return{dir,file,record:Store.read(dir,file),opts:{rows:[row],blocked:new Set(),needsSalary:()=>true,now}};}
test('producer emits only explicit public-source keys and nonreversible canonical binding',t=>{
 const{dir,file,record,opts}=fixture(t);assert.equal(S.save(dir,{row,postingEvidence:evidence()},now),file);
 assert.deepEqual(Object.keys(record).sort(),['schema','primaryId','rowSha256','parserVersion','source'].sort());
 assert.deepEqual(Object.keys(record.source).sort(),['url','text','observedAt','identity','validThrough'].sort());
 assert.doesNotMatch(JSON.stringify(record),/PRIVATE|"(?:degree|salary|canonicalSource|fields|policy|inputs)":/);
 const loaded=S.load(dir,opts);assert.equal(loaded.size,1);const source=loaded.get(row.PRIMARY_ID);assert.equal(source.at,evidence().at);assert.equal(source.pay,null);assert.equal(source.degree.req,'PREFERRED');
 assert.equal(P.load(dir,{...opts,hints:true}).length,0,'source artifact is not a salary preparation');
});
test('source-only consumer fails closed on changed, protected, blocked and fenced roles',t=>{
 const{dir,opts}=fixture(t);
 for(const delta of [{rows:[]},{rows:[{...row,TITLE:'Other'}]},{rows:[{...row,p:{DO_NOT_REWORK:'YES'}}]},{rows:[{...row,p:{TIM_DECISION:'DECLINE'}}]},{blocked:new Set([row.PRIMARY_ID])},{needsSalary:()=>false},{now:now+7*86400000}])assert.equal(S.load(dir,{...opts,...delta}).size,0);
});
test('strict source schema rejects extra fields, changed identity, parser, age, pay and hash',t=>{
 const{dir,file,record,opts}=fixture(t);
 for(const mutate of [r=>r.fields={SALARY_BASE_LOW:1},r=>r.source.degree={req:'NONE'},r=>r.source.identity.company='Other',r=>r.parserVersion='old',r=>r.source.observedAt='2026-11-11',r=>r.source.validThrough='2026-11-01',r=>r.source.text+=' Salary USD 180000-200000.',r=>r.source.text='snippet',r=>r.rowSha256='bad']){const bad=structuredClone(record);mutate(bad);assert.equal(S.parse(row,bad,now),null);}
 const changed=structuredClone(record);changed.source.text+=' added';fs.writeFileSync(path.join(dir,file),JSON.stringify(changed));assert.equal(S.load(dir,opts).size,0);
 assert.throws(()=>S.save(dir,{row,postingEvidence:{...evidence(),structuredBaseSalary:{currency:'CAD'}}},now),/no-pay/);
 assert.throws(()=>S.save(dir,{row:{...row,p:{DO_NOT_REWORK:'YES'}},postingEvidence:evidence()},now),/Protected/);
});
