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
 assert.deepEqual(out.stats,{scored:2,legacy_replaced:0,merged:1,added:1,short_posting:1,no_posting:1,deferred:1,fenced:1,inactive:0,already_fitted:1,already_fitted_legacy:0});
 assert.deepEqual(requests.map(q=>q.ruling.requestId),['RUN-S001','RUN-F001']);
 const f=requests[1].ruling.fields;
 assert.equal(requests[1].ruling.primaryId,'new');assert.equal(f.SCOPE_FIT_MODEL_REF,'CODE_FIT rev1');assert.match(f.EXPERIENCE_FIT_BASIS,/^CODE_FIT rev1: \d+\/\d+ resume competencies/);
 assert.ok(Number(f.SCOPE_FIT_RAW)>0&&Number(f.SCOPE_FIT_RAW)<=100);
 assert.equal(requests[0].ruling.fields.SALARY_BASE_LOW,'1');assert.equal(requests[0].ruling.fields.SCOPE_FIT_RAW,f.SCOPE_FIT_RAW);
 // CODE_FIT is still written into Writer slots; it does not satisfy the researched-fit gate.
 assert.ok(C.missingFields(row('new'),E).includes('experience fit'));
 assert.ok(C.missingFields(row('new',f),E).includes('experience fit'));
});
test('code fit zero run says why: other legacy fits (not EXPERIENCE_FIT), fenced and inactive rows are counted, not silently skipped (run 44210202982)',()=>{
 const F=require('./code-fit');
 // Same order and legacy flag as PipelineEvidence.fit: SCOPE_FIT_RAW first, other FIT_KEYS are legacy.
 const fit=p=>p.SCOPE_FIT_RAW?{value:Number(p.SCOPE_FIT_RAW),source:'SCOPE_FIT_RAW',legacy:false}:p.GROK_SCOPE_FIT_RAW?{value:Number(p.GROK_SCOPE_FIT_RAW),source:'GROK_SCOPE_FIT_RAW',legacy:true}:{value:null,source:'',legacy:false};
 const row=(id,p={},BUCKET='SCOUT_INTAKE')=>({PRIMARY_ID:id,TITLE:'Director of Operations',BUCKET,p});
 const rows=[row('a',{GROK_SCOPE_FIT_RAW:'40'}),row('b',{GROK_SCOPE_FIT_RAW:'35'}),row('c',{SCOPE_FIT_RAW:'82',EXPERIENCE_FIT:'82'}),row('d',{},'ARCHIVED'),row('e')];
 const out=F.plan({rows,requests:[],saved:()=>({text:'x'.repeat(500)}),fit,active:r=>r.BUCKET==='SCOUT_INTAKE',unavailable:new Set(['e']),runId:'RUN',slots:50});
 assert.deepEqual(out.stats,{scored:0,legacy_replaced:0,merged:0,added:0,short_posting:0,no_posting:0,deferred:0,fenced:1,inactive:1,already_fitted:1,already_fitted_legacy:2});
 const s=out.stats;assert.equal(s.scored+s.short_posting+s.no_posting+s.deferred+s.fenced+s.inactive+s.already_fitted+s.already_fitted_legacy,rows.length);
});
test('code fit replaces legacy EXPERIENCE_FIT inside the 2x25 Writer slots and never overwrites a CODE_FIT score (Tim, Nov 17 9:12 PM ET)',()=>{
 const F=require('./code-fit');
 // Same order, source and legacy flag as PipelineEvidence.fit.
 const KEYS=['SCOPE_FIT_RAW','GROK_SCOPE_FIT_RAW','EXPERIENCE_FIT'];
 const fit=p=>{for(const k of KEYS)if(p[k]!=null&&p[k]!=='')return{value:Number(p[k]),source:k,legacy:k!=='SCOPE_FIT_RAW'};return{value:null,source:'',legacy:false};};
 const row=(id,p={})=>({PRIMARY_ID:id,TITLE:'Director of Operations',COMPANY:'Acme',LOCATION:'Dayton, OH',p});
 const legacy=Array.from({length:60},(_,i)=>row('L'+i,{EXPERIENCE_FIT:i%2?'40':'35'}));
 const rows=[row('code',{SCOPE_FIT_RAW:'67',SCOPE_FIT_MODEL_REF:'CODE_FIT rev1',EXPERIENCE_FIT:'40'}),row('codeRefOnly',{SCOPE_FIT_MODEL_REF:'CODE_FIT rev1',EXPERIENCE_FIT:'40'}),row('grok',{GROK_SCOPE_FIT_RAW:'50',EXPERIENCE_FIT:'40'}),...legacy];
 const requests=[];
 const out=F.plan({rows,requests,saved:()=>({text:'Lead plant manufacturing operations and quality systems. '.repeat(10)}),fit,runId:'RUN',slots:2*25,max:150});
 // Legacy-only rows are scored until the 2x25 Writer slots are full; the rest wait for the next run.
 assert.deepEqual(out.stats,{scored:50,legacy_replaced:50,merged:0,added:50,short_posting:0,no_posting:0,deferred:10,fenced:0,inactive:0,already_fitted:2,already_fitted_legacy:1});
 assert.equal(requests.length,50);
 assert.ok(requests.every(q=>q.ruling.primaryId.startsWith('L')&&q.ruling.fields.SCOPE_FIT_MODEL_REF===F.MODEL_REF));
 // Writer readback guard: keep fields while the row still has only the legacy fit; drop them if a CODE_FIT score or SCOPE_FIT_RAW landed meanwhile.
 const fields=()=>({...requests[0].ruling.fields}),planned=legacy[0];
 const keep=fields();assert.equal(F.guard(keep,planned,row('L0',{EXPERIENCE_FIT:'35'}),fit),false);assert.equal(keep.SCOPE_FIT_RAW,requests[0].ruling.fields.SCOPE_FIT_RAW);
 for(const p of [{EXPERIENCE_FIT:'35',SCOPE_FIT_RAW:'90'},{EXPERIENCE_FIT:'35',SCOPE_FIT_MODEL_REF:'CODE_FIT rev1'},{EXPERIENCE_FIT:'35',GROK_SCOPE_FIT_RAW:'50'}]){
  const f=fields();assert.equal(F.guard(f,planned,row('L0',p),fit),true);assert.equal(f.SCOPE_FIT_RAW,undefined);
 }
});

test('run.js leaves writer requests alone unless CODE_FIT is explicitly enabled',()=>{
 const fs=require('node:fs'),vm=require('node:vm');
 const source=fs.readFileSync(require.resolve('./run.js'),'utf8');
 // Exercise the planning block without loading the rest of the Writer or its checkout dependencies.
 const start=source.indexOf('  // Code-scored fit'),end=source.indexOf('  // Card 6e439fa',start);
 assert.ok(start>=0&&end>start);
 const block=new vm.Script(source.slice(start,end));
 const config=require('./config.json');
 assert.strictEqual(config.codeFitEnabled,false);
 for(const enabled of [config.codeFitEnabled,undefined,'true',true]){
  const requests=[{ruling:{fields:{SALARY_BASE_LOW:'1'}}}],stats={};
  let calls=0;
  block.runInNewContext({
   CONFIG:{...config,codeFitEnabled:enabled},stats,requests,broadGrant:false,PRODUCTS_ONLY:false,PREPARE_ONLY:false,
   progress(){},rows:[],Evidence:{},activeProductRow(){},unavailableIds:new Set(),RUN_ID:'RUN',
   require(id){
    assert.strictEqual(id,'./code-fit');
    return {plan({requests}){
     calls++;
     Object.assign(requests[0].ruling.fields,{SCOPE_FIT_RAW:'72',SCOPE_FIT_MODEL_REF:'CODE_FIT rev1'});
     return {stats:{scored:1}};
    }};
   },
  });
  assert.strictEqual(calls,enabled===true?1:0);
  if(enabled!==true){
   assert.deepStrictEqual(requests,[{ruling:{fields:{SALARY_BASE_LOW:'1'}}}]);
   assert.strictEqual(stats.code_fit.disabled,'Tim Nov 23 2026: keywords never used for fit (cs-b90e0bf4)');
  }
 }
});
