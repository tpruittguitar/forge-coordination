'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {knownRequestIds}=require('./known-requests'),{pick}=require('./auto-run'),{requestId}=require('./production-executor');
const role={company:'Factory A',title:'Director of Manufacturing',location:'Austin, TX',url:'https://example.com/jobs/A',level:'DIRECTOR_PLUS',family:'MANUFACTURING'},id=requestId({COMPANY:role.company,TITLE:role.title,LOCATION:role.location,SOURCE_URL:role.url});
function recovered(){return [{state:{requestIds:[id,'UNTOUCHED'],results:{CAPTURED:{}},reconciliation:{status:'RECONCILED_INTERRUPTED_RUN_WITH_CARRY_FORWARD',proofs:['receipts/proof.json'],preExistingCompleteRequests:[{requestId:id,primaryId:'V2I-EXISTING',receiptState:'COMPLETE',exactRowVerified:true,proof:'receipts/proof.json'}]}}}];}
test('operator-proven earlier write is not selected again, while untouched tail stays eligible',()=>{
 const prior=recovered(),sent=knownRequestIds(prior);
 assert(sent.has('CAPTURED'));assert(sent.has(id));assert(!sent.has('UNTOUCHED'));
 assert.deepEqual(pick({new_roles:[role]},{max:25,sent}),[]);
 assert(!Object.hasOwn(prior[0].state.results,id),'no invented acceptance response');
});
test('COMPLETE alone or an unbound proof cannot suppress a candidate',()=>{
 for(const change of [p=>p.exactRowVerified=false,p=>p.receiptState='PENDING',p=>p.proof='other',p=>p.requestId='UNBOUND']){
  const prior=recovered();change(prior[0].state.reconciliation.preExistingCompleteRequests[0]);assert.throws(()=>knownRequestIds(prior),/invalid recovered/);
 }
});
test('unreconciled request lists do not count as attempts',()=>{
 const prior=recovered();delete prior[0].state.reconciliation;
 assert(!knownRequestIds(prior).has(id));assert.equal(pick({new_roles:[role]},{max:25,sent:knownRequestIds(prior)}).length,1);
});
