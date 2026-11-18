'use strict';
const test=require('node:test'),assert=require('node:assert');
const C=require('./decision-complete');
test('code fit scores 400+ char saved postings into SCOPE_FIT_RAW inside the Writer slots; short, fitted and fenced rows are left alone',()=>{
 const F=require('./code-fit'),E={fit:p=>({value:p.SCOPE_FIT_RAW?Number(p.SCOPE_FIT_RAW):null})};
 const long='Lead plant manufacturing operations, quality systems, lean manufacturing and supplier quality for a new product launch. '.repeat(5);
 const row=(id,p={})=>({PRIMARY_ID:id,TITLE:'Director of Operations',COMPANY:'Acme',LOCATION:'Dayton, OH',p});
 const rows=[row('merge'),row('new'),row('short'),row('none'),row('fitted',{SCOPE_FIT_RAW:'70'}),row('fenced'),row('over')];
 const text={merge:long,new:long,short:'Short posting. '.repeat(10),fitted:long,fenced:long,over:long};
 const requests=[{action:'ruling',ruling:{requestId:'RUN-S001',primaryId:'merge',kind:'ENRICH',actor:'ATSBOT',fields:{SALARY_BASE_LOW:'1'}}}];
 const out=F.plan({rows,requests,saved:r=>text[r.PRIMARY_ID]?{text:text[r.PRIMARY_ID]}:null,fit:E.fit,unavailable:new Set(['fenced']),runId:'RUN',slots:2});
 assert.deepEqual(out.stats,{scored:2,merged:1,added:1,short_posting:1,no_posting:1,deferred:1});
 assert.deepEqual(requests.map(q=>q.ruling.requestId),['RUN-S001','RUN-F001']);
 const f=requests[1].ruling.fields;
 assert.equal(requests[1].ruling.primaryId,'new');assert.equal(f.SCOPE_FIT_MODEL_REF,'CODE_FIT rev1');assert.match(f.EXPERIENCE_FIT_BASIS,/^CODE_FIT rev1: \d+\/\d+ resume competencies/);
 assert.ok(Number(f.SCOPE_FIT_RAW)>0&&Number(f.SCOPE_FIT_RAW)<=100);
 assert.equal(requests[0].ruling.fields.SALARY_BASE_LOW,'1');assert.equal(requests[0].ruling.fields.SCOPE_FIT_RAW,f.SCOPE_FIT_RAW);
 // The written field is one the decision gate reads: experience fit is no longer missing.
 assert.ok(C.missingFields(row('new'),E).includes('experience fit'));
 assert.ok(!C.missingFields(row('new',f),E).includes('experience fit'));
});
