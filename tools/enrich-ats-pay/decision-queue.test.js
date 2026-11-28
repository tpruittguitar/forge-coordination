'use strict';
const FULL={SCOPE_FIT_RAW:'80',FLEX_CLASS:'NO_FLEX',DEGREE_TEXT:'Bachelor degree required',REMOTE_HYBRID:'On-site',SALARY_BASE_LOW:'$170,000',SALARY_BASE_HIGH:'$210,000',SALARY_BASIS:'FORGE-ESTIMATE',SALARY_SOURCE:'BLS OES 2025 Dayton MSA',LATITUDE:'39.76',LONGITUDE:'-84.19',PRODUCT:'Industrial pumps',PRODUCT_REFERENCE:'acme-dayton-oh'},E={fit:p=>({value:p.SCOPE_FIT_RAW?Number(p.SCOPE_FIT_RAW):null})},C=require('./decision-complete');
const {test}=require('node:test'),assert=require('node:assert/strict'),D=require('./decision-queue'),R=require('./active-review');
test('real Waiting on Me identities receive priority even when no row has TIM_DECISION_REQUIRED',()=>{
 const row=(id,p={})=>({PRIMARY_ID:id,COMPANY:'Acme',TITLE:'Director of Quality',LOCATION:'Dayton, OH',BUCKET:'SCOUT_INTAKE',p:{...FULL,SALARY_CONF:'LOW',OVERALL:80,SCORING_MODEL_REF:'TIM_WEIGHTED_JOB_RATING v1 rev1',...p}}),a=row('V2I-READY'),b=row('V2I-GAP',{SALARY_SOURCE:''}),closed=row('V2I-CLOSED',{LIVENESS:'CLOSED'}),declined={...row('V2I-DECLINED'),BUCKET:'DECLINED_BY_TIM'};
 const rows=[b,a,closed,declined],ids=D.ids(rows,{lanes:{FORGE_ENRICH_FEASIBILITY:[b],FORGE_ENRICH_STRATEGIC:[]}},E);
 assert.deepEqual([...ids],['V2I-READY']);assert.deepEqual(R.order([b,a],{},new Set(),Date.now(),ids).map(x=>x.PRIMARY_ID),['V2I-READY','V2I-GAP']);
 assert.deepEqual(R.order([b,a],{},new Set(['V2I-READY']),Date.now(),ids).map(x=>x.PRIMARY_ID),['V2I-GAP']);
});
test('TIM_DECISION_REQUIRED rows no longer bypass the completeness gate; a missing score or a lane listing does not hold a row (cs-683348cf)',()=>{
 const row=(id,p={})=>({PRIMARY_ID:id,COMPANY:'Acme',TITLE:'Director of Quality',LOCATION:'Dayton, OH',BUCKET:'TIM_DECISION_REQUIRED',p:{...FULL,OVERALL_RATING:'80',SCORING_MODEL_REF:'TIM_WEIGHTED_JOB_RATING v1 rev1',...p}});
 const rows=[row('T-COMPLETE'),row('T-NOPRODUCT',{PRODUCT:undefined,PRODUCT_REFERENCE:undefined}),row('T-NOSCORE',{OVERALL_RATING:''}),row('T-LANE'),row('T-CLOSED',{LIVENESS:'CLOSED'}),row('T-DNR',{DO_NOT_REWORK:'YES'})];
 const ids=D.ids(rows,{lanes:{FORGE_ENRICH_FEASIBILITY:[{PRIMARY_ID:'T-LANE'}],FORGE_ENRICH_STRATEGIC:[]}},E);
 assert.deepEqual([...ids],['T-COMPLETE','T-NOPRODUCT','T-NOSCORE','T-LANE']);
});
test('isDecisionComplete needs identity and labeled pay only; other gaps show as UNKNOWN (cs-683348cf)',()=>{
 const ok={COMPANY:'Acme',TITLE:'Director of Quality',LOCATION:'Dayton, OH',p:{...FULL,OVERALL_RATING:'80',SCORING_MODEL_REF:'TIM_WEIGHTED_JOB_RATING v1 rev1'}};
 assert.equal(C.isDecisionComplete(ok,E),true);
 const open={SCOPE_FIT_RAW:'',FLEX_CLASS:'UNKNOWN',DEGREE_TEXT:'',REMOTE_HYBRID:'UNKNOWN',OVERALL_RATING:'',SCORING_MODEL_REF:'v1'};
 for(const [k,v] of Object.entries(open)){const r={...ok,p:{...ok.p,[k]:v}};if(k==='DEGREE_TEXT')r.p.DEGREE_REQ='';assert.equal(C.isDecisionComplete(r,E),true,k);}
 for(const k of ['SALARY_BASIS','SALARY_SOURCE'])assert.deepEqual(C.missingFields({...ok,p:{...ok.p,[k]:''}},E),['pay basis and source'],k);
 assert.equal(C.isDecisionComplete({...ok,p:{...ok.p,SALARY_BASE_LOW:'',SALARY_BASE_HIGH:'',SALARY_BASIS:'',SALARY_SOURCE:''}},E),true,'no pay needs no pay label');
 for(const k of ['COMPANY','TITLE'])assert.equal(C.isDecisionComplete({...ok,[k]:''},E),false,k);
 assert.equal(C.isDecisionComplete({...ok,p:{...ok.p,LATITUDE:'',LONGITUDE:'',REMOTE_HYBRID:'Remote'}},E),true,'remote needs no coordinates');
 assert.equal(C.isDecisionComplete({...ok,p:{...ok.p,SALARY_BASIS:'EMPLOYER_POSTED'}},E),true);
});
test('products are display-only and either location text or finite coordinates is enough',()=>{
 const ok={COMPANY:'Acme',TITLE:'Director of Quality',LOCATION:'Dayton, OH',p:{...FULL,OVERALL_RATING:'80',SCORING_MODEL_REF:'TIM_WEIGHTED_JOB_RATING v1 rev1'}};
 const {PRODUCT,PRODUCT_REFERENCE,...noProducts}=ok.p;
 assert.equal(C.isDecisionComplete({...ok,p:noProducts},E),true);
 const {LATITUDE,LONGITUDE,...noCoords}=ok.p;
 assert.equal(C.isDecisionComplete({...ok,p:noCoords},E),true);
 assert.equal(C.isDecisionComplete({...ok,LOCATION:''},E),true);
 assert.deepEqual(C.missingFields({...ok,LOCATION:'',p:noCoords},E),['location / geography']);
});
test('CODE_FIT, keyword-proxy or missing fit no longer holds a row (cs-683348cf)',()=>{
 const ok={COMPANY:'Acme',TITLE:'Director of Quality',LOCATION:'Dayton, OH',p:{...FULL,OVERALL_RATING:'80',SCORING_MODEL_REF:'TIM_WEIGHTED_JOB_RATING v1 rev1'}};
 for(const p of [{SCOPE_FIT_RAW:'100',SCOPE_FIT_MODEL_REF:'CODE_FIT rev1'},{SCOPE_FIT_RAW:'100',FIT_BASIS:'CODE_FIT rev1: 6/9 resume competencies met'},{evidenceSource:'KEYWORD_PROXY'},{SCOPE_FIT_RAW:''}])assert.deepEqual(C.missingFields({...ok,p:{...ok.p,...p}},E),[]);
 const row=(id,p={})=>({PRIMARY_ID:id,COMPANY:'Acme',TITLE:'Director of Quality',LOCATION:'Dayton, OH',BUCKET:'SCOUT_INTAKE',p:{...FULL,OVERALL_RATING:'80',SCORING_MODEL_REF:'TIM_WEIGHTED_JOB_RATING v1 rev1',...p}});
 const ids=D.ids([row('V2I-CODE',{SCOPE_FIT_RAW:'100',SCOPE_FIT_MODEL_REF:'CODE_FIT rev1'}),row('V2I-AI',{SCOPE_FIT_RAW:'72',SCOPE_FIT_MODEL_REF:'grok-scope'})],{lanes:{FORGE_ENRICH_FEASIBILITY:[],FORGE_ENRICH_STRATEGIC:[]}},E);
 assert.deepEqual([...ids],['V2I-CODE','V2I-AI']);
});
