'use strict';
const test=require('node:test'),a=require('node:assert/strict');
const {open}=require('./grant-first-pass.cjs');

test('only new Product evidence can reopen historical submissions; original requests stay fenced',()=>{
 const h='a'.repeat(64),newProof='b'.repeat(64),
  hold=()=>({status:'INCOMPLETE',reason:'PRODUCT_EVIDENCE_REQUIRED',productEvidence:h,partialPolicyTried:true});
 const ledger={submitted:Object.fromEntries(['ready','same','unknown','notAccepted','released','postAttempt','other'].map(x=>[x,'2026-11-22'])),
  pendingWrites:{old:{ids:['unknown']}},notAccepted:{old:{ids:['notAccepted']}},releasedNotApplied:{old:{ids:['released']}},
  grantFirstPass:{schema:'forge.ats-grant-first-pass.v1',partition:'fixed',rows:{
   ready:hold(),same:hold(),unknown:hold(),notAccepted:hold(),released:hold(),
   postAttempt:{...hold(),writerAttempt:{batch:'original',requestId:'original-item'}},other:{status:'INCOMPLETE',reason:'OTHER_GAP'}
  }}};
 const options={ledger,scope:{partition:'fixed',size:7},isEligible:()=>true,checkpoint(){}};
 const pass=run=>open({...options,run});
 const p=pass('a'),isValidated=()=>true;
 for(const blocked of ['unknown','notAccepted','released','postAttempt']){
  a.equal(p.canClaim(blocked,()=>newProof,isValidated),false,blocked);
  a.equal(p.awaitingProduct(blocked),false,blocked);
 }
 a.equal(p.canClaim('other',()=>newProof,isValidated),false);
 a.equal(p.canClaim('same',()=>h,isValidated),false);a.equal(p.canClaim('same',()=>null,isValidated),false);
 a.equal(p.awaitingProduct('same'),true);
 a.equal(p.canClaim('ready',()=>newProof),false,'canonical note alone is not a validated registry match');
 a.equal(p.claim('ready',()=>newProof,isValidated),true);
 const plan={fields:{PRODUCT:'Site equipment'},productEvidence:newProof};
 p.finish('ready','FIELDS_PLANNED',{plan});
 const resumed=pass('b');a.equal(resumed.planned('ready'),plan);
 resumed.markWriterAttempt('new-batch',[{ruling:{primaryId:'ready',requestId:'new-item'}}]);
 a.equal(pass('c').planned('ready'),null);
});
