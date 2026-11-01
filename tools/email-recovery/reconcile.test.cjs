const test=require('node:test'),assert=require('node:assert/strict'),{reconcile}=require('./reconcile.cjs');
test('only exact unique canonical identity resolves captured work, preserving unknown writes and other candidates',()=>{
 const j={key:'linkedin:123',jobId:'123',company:'Acme',title:'Director',location:'TX',status:'PLANNED'},line='1 | V2I-ABC | Acme | Director | SCOUT_INTAKE | OPEN | P | R | TX | SOURCE_URL=https://www.linkedin.com/jobs/view/123/;';
 const input={masterText:line+'\nEND V2_CURRENT_POPULATION_MASTER',archiveText:'',at:'2026-10-31T18:55:00Z',proof:'receipts/proof.json'};
 for(const [status,text,expected]of [['PLANNED',input.masterText,1],['SUBMITTED',input.masterText,0],['HELD_WRITER_REVIEW',input.masterText,0],['PLANNED',input.masterText.replace('Acme','Other'),0],['PLANNED',line.replace('V2I-ABC','V2I-DEF')+'\n'+input.masterText,0]]){
 const ledger={jobs:{[j.key]:{...j,status}},sources:{}};assert.equal(reconcile(ledger,{...input,masterText:text}).resolved.length,expected);
 }
 assert.throws(()=>reconcile({jobs:{},sources:{}},{...input,masterText:line}),/Complete/);
});
test('country suffix and work-mode labels resolve only with the same exact posting, employer and title',()=>{
 const j={key:'linkedin:123',jobId:'123',company:'Acme',title:'Senior Manager',location:'Austin, TX',status:'HELD_IDENTITY'};
 for(const [loc,title,id,count] of [['Austin, TX, USA','Senior Manager','123',1],['Austin, TX (hybrid)','Senior Manager','123',1],['Round Rock, TX','Senior Manager','123',0],['Austin, TX','Manager','123',0],['Austin, TX','Senior Manager','1234',0]]){
  const l={jobs:{[j.key]:{...j}},sources:{}};
  assert.equal(reconcile(l,{masterText:`1 | V2I-ABC | Acme | ${title} | DECLINED_BY_TIM | CLOSED | P | R | ${loc} | SOURCE_URL=https://www.linkedin.com/jobs/view/${id}/;\nEND V2_CURRENT_POPULATION_MASTER`,archiveText:'',at:'2026-11-01T06:00:00Z',proof:'receipts/proof.json'}).resolved.length,count);
 }
});
