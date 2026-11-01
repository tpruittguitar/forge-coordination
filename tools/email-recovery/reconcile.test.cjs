const test=require('node:test'),assert=require('node:assert/strict'),{reconcile}=require('./reconcile.cjs');
test('parent brand annotations require the exact unique employer posting and exact title',()=>{
 const url='https://acme.wd1.myworkdayjobs.com/Careers/job/Site/Director_R123',j={key:'linkedin:123',jobId:'123',company:'The Acme, LLC',title:'Director',location:'Other, TX',url:'https://www.linkedin.com/jobs/view/123/',status:'HELD_IDENTITY',employerPosting:{url,sourceUrl:'https://www.linkedin.com/jobs/view/123/',observedAt:'2026-11-01T08:00:00Z',method:'SIGNED_IN_BROWSER_APPLY_DESTINATION',browser:'Edge'}};
 const line='1 | V2I-OLD | Acme (Parent) | Director | APPLIED | OPEN | P | R | Site, GA | COMPANY_SOURCE_URL='+url;
 for(const [text,count]of [[line,1],[line.replace('_R123','_R999'),0],[line.replace(' | Director |',' | Junior Director |'),0],[line.replace('Acme (Parent)','Other'),0],[line+'\n'+line.replace('V2I-OLD','V2I-OTHER'),0]]){
 const l={jobs:{[j.key]:structuredClone(j)},sources:{}};assert.equal(reconcile(l,{masterText:text+'\nEND V2_CURRENT_POPULATION_MASTER',archiveText:'',at:'2026-11-01T09:00:00Z',proof:'receipts/proof.json'}).resolved.length,count);
 }
});
test('authorized decided repeats close only compatible unique roles and never an uncertain transaction',()=>{
 const j={key:'linkedin:222',jobId:'222',company:'Acme',title:'Director',location:'Austin, TX',status:'HELD_IDENTITY'};
 const line='1 | V2I-OLD | Acme | Director | APPLIED | CLOSED | P | R | NOT_STATED | SOURCE_URL=https://www.linkedin.com/jobs/view/111/;';
 const input={masterText:line+'\nEND V2_CURRENT_POPULATION_MASTER',archiveText:'',at:'2026-11-01T07:00:00Z',proof:'receipts/proof.json',appliedRepeatRule:true};
 for(const [status,loc,extra,count]of [['HELD_IDENTITY','NOT_STATED',{},1],['POST_IN_FLIGHT_UNKNOWN','NOT_STATED',{},0],['HELD_WRITER_REVIEW','NOT_STATED',{},0],['HELD_WRITER_REVIEW','NOT_STATED',{disposition:{batchStatus:'COMPLETE',originalCandidateOutcome:'WRITE_FAILED'}},1],['HELD_IDENTITY','Boston, MA',{},0]]){
  const l={jobs:{[j.key]:{...j,status,...extra}},sources:{}};const r=reconcile(l,{...input,masterText:input.masterText.replace('NOT_STATED',loc)});assert.equal(r.resolved.length,count);if(count)assert.match(l.jobs[j.key].disposition.reason,/Tim repeat directive/);
 }
 const l={jobs:{[j.key]:{...j}},sources:{}};assert.equal(reconcile(l,{...input,masterText:input.masterText.replace('APPLIED','DECLINED_BY_TIM')}).resolved.length,0);
 assert.equal(reconcile(l,{...input,decidedRepeatRule:true,masterText:input.masterText.replace('APPLIED','DECLINED_BY_TIM')}).resolved.length,1);
});
test('a different employer requisition is a different role despite a missing old site',()=>{
 const posting={url:'https://www.amazon.jobs/jobs/222222/director',sourceUrl:'https://www.linkedin.com/jobs/view/222/',recordedAt:'2026-11-01T06:00:00Z',method:'SIGNED_IN_CHROME_APPLY_DESTINATION'};
 const j={key:'linkedin:222',jobId:'222',company:'Amazon',title:'Director',location:'Austin, TX',url:posting.sourceUrl,status:'HELD_IDENTITY',employerPosting:posting},l={jobs:{[j.key]:j},sources:{}};
 assert.equal(reconcile(l,{masterText:'1 | V2I-OLD | Amazon | Director | APPLIED | CLOSED | P | R | NOT_STATED | COMPANY_SOURCE_URL=https://www.amazon.jobs/jobs/111111/director\nEND V2_CURRENT_POPULATION_MASTER',archiveText:'',at:'2026-11-01T07:00:00Z',proof:'receipts/proof.json',appliedRepeatRule:true}).resolved.length,0);
});
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
test('a verified employer-posting alias is reused against fresh canonical presence, but conflicting aliases are not guessed',()=>{
 const posting={url:'https://boards.greenhouse.io/acme/jobs/1234567',observedAt:'2026-11-01T06:00:00Z',method:'SIGNED_IN_CHROME_APPLY_DESTINATION'};
 const prior={key:'linkedin:111',jobId:'111',company:'Acme',title:'Director',url:'https://www.linkedin.com/jobs/view/111/',status:'VERIFIED_EXISTING',employerPosting:{...posting,sourceUrl:'https://www.linkedin.com/jobs/view/111/'},disposition:{primaryId:'V2I-OLD',proof:'receipts/old.json'}};
 const next={...prior,key:'linkedin:222',jobId:'222',url:'https://www.linkedin.com/jobs/view/222/',status:'HELD_IDENTITY',location:'Different city',disposition:null,employerPosting:{...posting,sourceUrl:'https://www.linkedin.com/jobs/view/222/'}};
 const input={masterText:'1 | V2I-OLD | Acme | Legacy Director | APPLIED | CLOSED | P | R | Unknown | SOURCE_URL=https://old.example/job\nEND V2_CURRENT_POPULATION_MASTER',archiveText:'',at:'2026-11-01T06:00:00Z',proof:'receipts/new.json'};
 const l={jobs:{[prior.key]:structuredClone(prior),[next.key]:structuredClone(next)},sources:{}};assert.equal(reconcile(l,input).resolved.length,1);
 const conflict={jobs:{[prior.key]:structuredClone(prior),[next.key]:structuredClone(next),'linkedin:333':{...structuredClone(prior),key:'linkedin:333',disposition:{primaryId:'V2I-OTHER',proof:'receipts/other.json'}}},sources:{}};assert.equal(reconcile(conflict,input).resolved.length,0);
});
