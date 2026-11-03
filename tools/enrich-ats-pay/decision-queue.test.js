'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),D=require('./decision-queue'),R=require('./active-review');
test('real Waiting on Me identities receive priority even when no row has TIM_DECISION_REQUIRED',()=>{
 const row=(id,p={})=>({PRIMARY_ID:id,COMPANY:'Acme',TITLE:'Director of Quality',LOCATION:'Dayton, OH',BUCKET:'SCOUT_INTAKE',p:{SALARY_BASIS:'FORGE-ESTIMATE',SALARY_CONF:'LOW',OVERALL:80,SCORING_MODEL_REF:'TIM_WEIGHTED_JOB_RATING v1 rev1',...p}}),a=row('V2I-READY'),b=row('V2I-GAP'),closed=row('V2I-CLOSED',{LIVENESS:'CLOSED'}),declined={...row('V2I-DECLINED'),BUCKET:'DECLINED_BY_TIM'};
 const rows=[b,a,closed,declined],ids=D.ids(rows,{lanes:{FORGE_ENRICH_FEASIBILITY:[b],FORGE_ENRICH_STRATEGIC:[]}},{fit:()=>({value:85})});
 assert.deepEqual([...ids],['V2I-READY']);assert.deepEqual(R.order([b,a],{},new Set(),Date.now(),ids).map(x=>x.PRIMARY_ID),['V2I-READY','V2I-GAP']);
 assert.deepEqual(R.order([b,a],{},new Set(['V2I-READY']),Date.now(),ids).map(x=>x.PRIMARY_ID),['V2I-GAP']);
});
