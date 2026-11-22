'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const E=require('./research-eligibility.cjs'),S=require('../programmed-coordinator/store.cjs'),patterns=require('../source-trial/never-consider-patterns.json').rules;
function sample(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'research-admit-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const readAt='2026-11-22T04:00:00Z',row={PRIMARY_ID:'V2I-SYNTHETIC',COMPANY:'Factory',TITLE:'Plant Manager',LOCATION:'Ohio',BUCKET:'SCOUT_INTAKE',p:{},line:'synthetic canonical line'};
 const rules={source:'TIM_PIPELINE_RULES_CANONICAL',status:'ACTIVE',raw:'SECTION=NEVER_CONSIDER\n'+patterns.map(r=>'- '+r.id+' '+r.category+': '+r.match).join('\n'),rules:patterns.map(r=>({RULE_ID:r.id,CATEGORY:r.category,MATCH:r.match,active:true,ACTION:'DO_NOT_ADD'}))};
 const quote='We manufacture industrial metal fasteners.',text=quote+' '+ 'The plant manager leads manufacturing operations and quality improvement. '.repeat(7);
 const evidence={businessScopeReviewed:true,posting:{kind:'PUBLIC_JOB_POSTING_EXCERPT',publicReviewed:true,identityVerified:true,company:'Factory',title:'Plant Manager',location:'Ohio',url:'https://example.com/jobs/plant-manager',observedAt:readAt,text,sha256:S.hash(text),fullPosting:true},employerBusinessQuote:quote};
 return{root,row,rules,policyProof:{rawSha256:S.hash(rules.raw),commit:'a'.repeat(40)},evidence,readAt,now:Date.parse(readAt),classifyNeverConsider:()=>({outcome:'ALLOW'})};
}
function changeText(f,text){f.evidence.posting.text=text;f.evidence.posting.sha256=S.hash(text);}
test('positive existing screen plus complete explicit business evidence grants research only',t=>{
 const f=sample(t);let calls=0;f.classifyNeverConsider=(rec,rules)=>{calls++;a.equal(rec.EMPLOYER_PRIMARY_BUSINESS,f.evidence.employerBusinessQuote);a.equal(rules,f.rules);return{outcome:'ALLOW'};};
 const p=E.evaluate(f);a.equal(calls,1);a.equal(p.status,'RESEARCH_ADMITTED');a.equal(p.canonicalEligibility,false);a.equal(p.writerAuthorized,false);
 a.ok(E.validate(p,f.row,{source:{readAt:f.readAt},policyProof:f.policyProof}));
});
test('bare ALLOW, missing facts, incomplete or old capture and private metadata never grant admission',t=>{
 for(const edit of [f=>delete f.evidence.businessScopeReviewed,f=>f.evidence.employerBusinessQuote='',f=>{changeText(f,'We are hiring a manager. '.repeat(20));f.evidence.employerBusinessQuote='We are hiring a manager.';},f=>f.evidence.posting.fullPosting=false,f=>f.evidence.posting.observedAt='2020-01-01',f=>f.evidence.posting.resume='private']){
  const f=sample(t);edit(f);a.throws(()=>E.evaluate(f));
 }
});
test('exclusion and protected-supplier REVIEW stay held, never converted to positive or declined',t=>{
 for(const quote of ['We manufacture medical devices.','We manufacture food products for consumers.','We manufacture medical devices for the equipment industry.']){
  const f=sample(t);f.evidence.employerBusinessQuote=quote;changeText(f,quote+' '+f.evidence.posting.text);a.throws(()=>E.evaluate(f),/REVIEW_OR_EXCLUSION/);
 }
 for(const outcome of ['REVIEW','EXCLUDE']){const f=sample(t);f.classifyNeverConsider=()=>({outcome});a.throws(()=>E.evaluate(f),/WRITER_CLASSIFIER/);}
});
test('missing, changed and unknown active rules hold instead of silently narrowing policy',t=>{
 for(const edit of [f=>f.rules.rules.pop(),f=>f.rules.rules[0].MATCH+=' changed',f=>f.rules.rules.push({RULE_ID:'NC-999',CATEGORY:'NEW',MATCH:'new',active:true,ACTION:'DO_NOT_ADD'})]){const f=sample(t);edit(f);a.throws(()=>E.evaluate(f));}
});
test('existing title exclusion remains a hold and changed row/policy invalidates proof',t=>{
 const f=sample(t),role={ruleId:'NC-005',category:'FINANCIAL_AND_ACCOUNTING_ROLES',definitionSha256:S.hash('- NC-005 FINANCIAL_AND_ACCOUNTING_ROLES: finance.'),patterns:['^Accountant$']};
 S.save(f.root,'reference/EXCLUSION_TITLE_RULES.json',{schema:'forge.title-exclusion-rules.v1',rules:[role]});f.row.TITLE='Accountant';f.evidence.posting.title='Accountant';
 a.throws(()=>E.evaluate(f),/TITLE_HOLD/);
 const g=sample(t),p=E.evaluate(g);a.throws(()=>E.validate(p,{...g.row,line:'changed'},{source:{readAt:g.readAt},policyProof:g.policyProof}));
 a.throws(()=>E.validate({...p,writerAuthorized:true},g.row,{source:{readAt:g.readAt},policyProof:g.policyProof}));
});
