'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),crypto=require('node:crypto');
const bundle=require('../../reference/EMPLOYER_BUSINESS_CLASSIFICATIONS.json');
const {review}=require('./review.cjs');
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const processCategories=['BULK_CHEMICALS','REFINING','RAW_MATERIAL_PRODUCTION'];
const policy={status:'ACTIVE',revision:bundle.policyRevision,rules:bundle.ruleBindings.map(r=>({...r,active:true}))};
const now=Date.parse('2026-11-12T23:15:00Z');
function fact(category){const b=bundle.ruleBindings.find(r=>r.category===category);return {...bundle.entries[0],company:'Synthetic process employer',category,ruleId:b.id,definitionSha256:b.definitionSha256};}
test('process categories have unique canonical bindings with validated definition digests',()=>{
 a.match(bundle.policyRevision,/^[a-f0-9]{40}$/);a.equal(new Set(bundle.ruleBindings.map(r=>r.category)).size,bundle.ruleBindings.length);
 for(const category of processCategories){const b=bundle.ruleBindings.find(r=>r.category===category);a.equal(b.id,'TIM-20261112-PROCESS-INDUSTRY');a.equal(b.section,'GLOBAL_PROCESS_INDUSTRY_EXCLUSION');a.equal(hash(b.definition),b.definitionSha256);a.match(b.definition,/PRIMARY business/);}
});
test('all existing facts remain bound, source-digest valid, and no process employers are inferred',()=>{
 a.deepEqual(bundle.entries.map(f=>f.company).sort(),['AbbVie','Amgen','Medtronic','Stryker']);
 for(const f of bundle.entries){a.equal(f.policyRevision,bundle.policyRevision);a.ok(!processCategories.includes(f.category));a.ok(bundle.ruleBindings.some(r=>r.id===f.ruleId&&r.category===f.category&&r.definitionSha256===f.definitionSha256));for(const s of f.sources){a.equal(hash(s.capturedText),s.contentSha256);a.ok(s.capturedText.includes(s.quote));}}
});
test('actual process bindings require exact evidence and preserve protected decisions',()=>{
 for(const category of processCategories){const f=fact(category),row={COMPANY:f.company,PRIMARY_ID:'SYNTHETIC',BUCKET:'SCOUT_INTAKE',p:{}};
 a.equal(review(row,{fact:f,policy,now}).status,'PROPOSE_WRITER_DISPOSITION');
 a.equal(review(row,{policy,now}).status,'REVIEW_NEEDED');
 a.equal(review({...row,p:{TIM_RULING:'Keep'}},{fact:f,policy,now}).suppressActiveConsideration,false);
 a.equal(review({...row,BUCKET:'APPLIED'},{fact:f,policy,now}).status,'PRESERVE_HISTORY');
 a.equal(review(row,{fact:{...f,policyRevision:'old'},policy,now}).status,'REVIEW_NEEDED');}
});
test('new process binding does not exclude discrete businesses, suppliers or unknowns',()=>{
 const f=fact('BULK_CHEMICALS'),row={COMPANY:f.company,TITLE:'Chemical materials process director',p:{}};
 for(const category of ['DISCRETE_STAMPING','DISCRETE_MOLDING','DISCRETE_MACHINING','INDUSTRIAL_SUPPLIER','DIVERSIFIED_INDUSTRIAL'])a.equal(review(row,{fact:{...f,category},policy,now}).status,'NO_EXCLUSION');
 const unknown=review(row,{policy,now});a.equal(unknown.status,'REVIEW_NEEDED');a.notEqual(unknown.suppressActiveConsideration,true);a.equal(unknown.requiresNewResearch,false);a.equal(unknown.canonicalWrites,0);
});
