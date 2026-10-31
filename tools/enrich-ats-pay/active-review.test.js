'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),R=require('./active-review');
const now=Date.parse('2026-10-31T23:00:00Z');
const row=(id,conf='LOW',extra={})=>({PRIMARY_ID:id,COMPANY:'Acme',TITLE:'Director of Quality',LOCATION:'Dayton, OH',BUCKET:'READY_TO_PURSUE',p:{SALARY_BASIS:'FORGE-ESTIMATE',SALARY_CONF:conf,SALARY_SOURCE:'comparables:A,B',SALARY_ASOF:'2026-09-01',...extra}});
test('review targets only active estimates, prioritizes weak evidence and excludes in-flight jobs',()=>{
 const low=row('L'),med=row('M','MED'),high=row('H','HIGH');
 const excluded=['APPLIED','DECLINED_BY_TIM','REJECTED','ARCHIVED'].map(b=>({...row(b),BUCKET:b}));
 const guarded=[row('closed','LOW',{LIVENESS:'CLOSED'}),row('protected','LOW',{ANTI_RESURRECTION:'YES'}),row('no','LOW',{DO_NOT_REWORK:'YES'}),row('posted','HIGH',{SALARY_BASIS:'EMPLOYER_POSTED'})];
 assert.deepEqual(R.order([high,...excluded,med,...guarded,low,row('pending')],{},new Set(['pending']),now).map(r=>r.PRIMARY_ID),['L','M','H']);
});
test('review cooldown survives numeric readback, unchanged failures back off, changed source is reconsidered',()=>{
 const h={},r=row('A');R.remember(h,r,'NO_STRONGER_EVIDENCE',{now});assert.equal(R.order([r],h,new Set(),now+3600000).length,0);
 assert.equal(R.order([r],h,new Set(),now+25*3600000).length,1);
 const changed={...r,p:{...r.p,ATS_POSTING_URL:'https://job-boards.greenhouse.io/acme/jobs/42'}};assert.equal(R.order([changed],h,new Set(),now+3600000).length,1);
 R.remember(h,r,'STRONGER_ESTIMATE_PLANNED',{now,hours:168,fields:{SALARY_BASE_HIGH:200000,SALARY_NOTE:'Stronger evidence; base estimate'}});
 assert.equal(R.order([{...r,p:{...r.p,SALARY_BASE_HIGH:'200000',SALARY_NOTE:'Stronger evidence, base estimate'}}],h,new Set(),now+3600000).length,0);
});
test('numerical changes alone and confidence downgrades are not improved estimates',()=>{
 const r=row('A','MED');assert.equal(R.improved(r,{conf:'LOW',source:'SAME_EMPLOYER'}),false);assert.equal(R.improved(r,{conf:'MED',source:'COMPARABLES',high:500000}),false);assert.equal(R.improved(r,{conf:'MED',source:'SAME_EMPLOYER'}),true);assert.equal(R.improved(r,{conf:'HIGH',source:'COMPARABLES'}),true);
});
test('exact ATS replacement requires returned job ID, title, city/state and USD annual structured pay',()=>{
 const r=row('A'),api={kind:'greenhouse',api:'https://boards-api.greenhouse.io/v1/boards/acme/jobs/42?pay_transparency=true'},j={id:42,title:r.TITLE,location:{name:r.LOCATION},content:'Full job description. '.repeat(30),pay_input_ranges:[{min_cents:18000000,max_cents:24000000,currency_type:'USD',interval:'year',title:'Base salary'}]};
 assert.equal(R.parseApi(r,api,j).pay.high,240000);
 for(const change of [x=>x.id=43,x=>x.title='Other',x=>x.location.name='Akron, OH',x=>x.pay_input_ranges[0].currency_type='CAD',x=>x.pay_input_ranges[0].interval='hour',x=>x.pay_input_ranges[0].title='Total compensation',x=>x.content='Snippet']){const k=structuredClone(j);change(k);assert.equal(R.parseApi(r,api,k),null);}
});
