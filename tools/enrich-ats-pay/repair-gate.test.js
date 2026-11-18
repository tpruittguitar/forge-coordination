'use strict';
// Card 8176bbb: salary repair/review skips rows the #433 gate would still block for a non-pay field.
const test=require('node:test'),assert=require('node:assert/strict'),G=require('./repair-gate');
const E={fit:p=>({value:p.SCOPE_FIT_RAW?Number(p.SCOPE_FIT_RAW):null})};
const READY={SCOPE_FIT_RAW:'80',REMOTE_HYBRID:'On-site',LATITUDE:'39.76',LONGITUDE:'-84.19',PRODUCT:'Industrial pumps',PRODUCT_REFERENCE:'acme-dayton-oh',OVERALL_RATING:'80',SCORING_MODEL_REF:'TIM_WEIGHTED_JOB_RATING v1 rev1'};
const row=p=>({PRIMARY_ID:'V2I-X',COMPANY:'Acme',TITLE:'Director of Quality',LOCATION:'Dayton, OH',p});
test('pay and degree gaps never block; products and fit do, with per-field stats',()=>{
 assert.deepEqual(G.blockers(row({...READY,DEGREE_REQ:'NOT_STATED'}),E),[]);
 const blocked=row({...READY,PRODUCT:'',SCOPE_FIT_RAW:''}),stats={by_missing:{}};
 assert.deepEqual(G.blockers(blocked,E),['experience fit','products (what they make)']);
 assert.equal(G.skip(stats,'skipped_blocked',blocked,E),true);assert.equal(G.skip(stats,'skipped_blocked',row(READY),E),false);
 assert.deepEqual(stats,{by_missing:{'experience fit':1,'products (what they make)':1},skipped_blocked:1});
});
