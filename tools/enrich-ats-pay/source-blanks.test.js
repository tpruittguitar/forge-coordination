'use strict';
const {test}=require('node:test'),a=require('node:assert/strict');
const S=require('./source-blanks.cjs'),R=require('./recovery');
const now=Date.parse('2026-11-22T18:00:00Z'),url='https://example.org/jobs/1';
const row={PRIMARY_ID:'V2I-BLANKS',COMPANY:'Acme',TITLE:'Director',LOCATION:'Dayton, OH',BUCKET:'SCOUT_INTAKE',p:{SOURCE_URL:url}};
const body='Lead manufacturing quality operations. '.repeat(10)+"\nThis position is hybrid.\nBachelor's degree required.\nAnnual base salary: $180,000 to $230,000.";
function capture(r=row,text=body,extra={}){
 return R.saveEvidence({},r,url,{identityVerified:true,sourceIdentity:{company:r.COMPANY,title:r.TITLE,location:r.LOCATION},
  basis:'EMPLOYER_POSTED',pay:{low:180000,high:230000},text,...extra},now-60000);
}
const Products={fields:()=>({PRODUCT:'Industrial valves',PRODUCT_SOURCE:'https://example.org/plant',PRODUCT_ROLE:'NEVER',PRODUCT_SCOPE:'COMPANY_LOCATION',PRODUCT_REFERENCE:'site-1',PRODUCT_SITE:'Dayton',PRODUCT_ASOF:'2026-11-22'})};
test('whole canonical waiting includes non-feasibility rows still missing a decision field but excludes protected rows',()=>{
 const other={...row,PRIMARY_ID:'V2I-WORKONLY',TITLE:''},protectedRow={...row,PRIMARY_ID:'V2I-PROTECTED',p:{DO_NOT_REWORK:'yes'}};
 a.deepEqual(S.waiting([row,other,protectedRow],{lanes:{FORGE_ENRICH_FEASIBILITY:[row],FORGE_ENRICH_STRATEGIC:[]}},{fit:()=>({value:null})}).map(r=>r.PRIMARY_ID),['V2I-BLANKS','V2I-WORKONLY']);
});
test('exact posting and product reference fill only missing source-backed values, including provenance',()=>{
 const r={...row,p:{...row.p,SALARY_BASE_LOW:180000,SALARY_BASIS:'EMPLOYER_POSTED',DEGREE_REQ:'REQUIRED',WORK_ARRANGEMENT:'HYBRID',PRODUCT:'Industrial valves',PRODUCT_REFERENCE:'site-1',OVERALL_RATING:99,FLEX_CLASS:'HIGH_FLEX'}};
 const out=S.project({row:r,capture:capture(r),product:{},Products,now});
 a.equal(out.SALARY_BASE_HIGH,230000);a.equal(out.SALARY_SOURCE,url);a.equal(out.DEGREE_EVIDENCE_URL,url);a.equal(out.REMOTE_HYBRID,'HYBRID');a.equal(out.PRODUCT_SOURCE,'https://example.org/plant');
 for(const k of Object.keys(r.p))a.equal(Object.hasOwn(out,k),false,k);
});
test('different pay, product, identity or conflicting remote mode gets no matching fill',()=>{
 const r={...row,p:{...row.p,SALARY_BASE_LOW:200000,DEGREE_REQ:'PREFERRED',PRODUCT:'Batteries',WORK_ARRANGEMENT:'REMOTE'}};
 a.deepEqual(S.project({row:r,capture:capture(r),product:{},Products,now}),{});
 const conflicting=capture(row,body+'\nThis position is on-site.\nCalifornia annual base salary: $280,000 to $330,000.',{pay:null,payAmbiguous:true});
 const fields=S.project({row,capture:conflicting,now});
 a.equal(fields.WORK_ARRANGEMENT,undefined);a.equal(fields.SALARY_BASE_LOW,undefined);
 a.deepEqual(S.project({row:{...row,TITLE:'Wrong'},capture:capture(),now}),{});
 a.equal(S.identityKnown('unknown'),false);
});

test('exact posting work fields go to Writer without a model opinion; missing employer pay stays blank',async()=>{
 const payless='Lead manufacturing quality operations. '.repeat(10)+'\nThis role will be hybrid requiring a minimum of 3 days in office.';
 const r={...row,p:{...row.p,WORK_ARRANGEMENT:'HYBRID'}};
 const fields=await S.directOrFallback({row:r,capture:capture(r,payless,{pay:null}),now},()=>{throw Error('proven fields must not use the model');});
 a.deepEqual(fields,{REMOTE_HYBRID:'HYBRID'});
 let calls=0;
 const noFact='Lead manufacturing quality operations. '.repeat(10);
 a.deepEqual(await S.directOrFallback({row:r,capture:capture(r,noFact,{pay:null}),now},async()=>{calls++;return {}}),{});
 a.equal(calls,1);
});
