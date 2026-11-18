'use strict';
const test=require('node:test'),assert=require('node:assert');
const B=require('./business-label');
test('manufacturer that serves construction customers is not a construction contractor',()=>{
 assert.equal(B.label('Acme Steel is a manufacturer of structural steel. We serve construction customers and general contractors across the Southeast.'),'GENERAL_MANUFACTURING');
 assert.notEqual(B.label('We supply rebar to construction contractors in Florida.'),'CONSTRUCTION_CONTRACTOR');
 assert.notEqual(B.label('Our pumps are sold to construction companies and EPC contractors.'),'CONSTRUCTION_CONTRACTOR');
});
test('self-described contractor gets the label',()=>{
 assert.equal(B.label('Mt. Carmel Stabilization Group is a soil stabilization contractor working on highways and airports.'),'CONSTRUCTION_CONTRACTOR');
 assert.equal(B.label('We are a general contractor delivering commercial projects.'),'CONSTRUCTION_CONTRACTOR');
});
test('single match only, no prose',()=>{
 assert.equal(B.label('We are a food and beverage company that also builds aerospace parts.'),null);
 assert.equal(B.label('A leading bottler of beverages.'),'FOOD_BEVERAGE');
 assert.equal(B.label('Our factory makes devices used in hospitals and clinics.'),'GENERAL_MANUFACTURING');
 assert.equal(B.label(''),null);
});
test('plan fills blank or boilerplate business only, merges into existing ruling, respects slots',()=>{
 const text='About the company:\nMt. Carmel Stabilization Group is a soil stabilization contractor.\n\nResponsibilities\nLead quality.';
 const rows=[
  {PRIMARY_ID:'A',p:{}},
  {PRIMARY_ID:'B',p:{EMPLOYER_PRIMARY_BUSINESS:'Acme in Tampa. Full-time Director role. See responsibilities and qualifications on LinkedIn.'}},
  {PRIMARY_ID:'C',p:{EMPLOYER_PRIMARY_BUSINESS:'Industrial gas producer'}},
  {PRIMARY_ID:'D',p:{}},
 ];
 const requests=[{action:'ruling',ruling:{primaryId:'B',fields:{SALARY_BASE_LOW:1}}}];
 const out=B.plan({rows,requests,saved:r=>r.PRIMARY_ID==='D'?{text:'Responsibilities only'}:{text},runId:'R',slots:2});
 assert.equal(out.stats.merged,1);assert.equal(out.stats.added,1);assert.equal(out.stats.has_business,1);assert.equal(out.stats.no_overview,1);
 assert.equal(requests[0].ruling.fields.EMPLOYER_PRIMARY_BUSINESS,'CONSTRUCTION_CONTRACTOR');
 assert.equal(requests[1].ruling.fields.EMPLOYER_PRIMARY_BUSINESS,'CONSTRUCTION_CONTRACTOR');
});
test('guard drops the label when the row gained a business value',()=>{
 const f={EMPLOYER_PRIMARY_BUSINESS:'FOOD_BEVERAGE'},row={COMPANY:'X',TITLE:'T',LOCATION:'L',p:{}};
 assert.equal(B.guard({...f},row,row),false);
 const g={...f};assert.equal(B.guard(g,row,{...row,p:{EMPLOYER_PRIMARY_BUSINESS:'Bottler'}}),true);assert.equal('EMPLOYER_PRIMARY_BUSINESS' in g,false);
});
