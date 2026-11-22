'use strict';
const test=require('node:test'),a=require('node:assert/strict');
const {open}=require('./grant-first-pass.cjs');

test('bulk grant continues its frozen first pass after a no-source row and an interruption, without touching pending Writer',()=>{
  const frozen=Array.from({length:1582},(_,i)=>'V2I-'+(0x800000000000+i).toString(16).toUpperCase());
  const isEligible=id=>frozen.includes(id),scope={partition:'immutable-split',size:frozen.length};
  const [pending,model,noSource,hung,...rest]=frozen;
  const prefix='FORGE-ENRICH_ATS-ATSBOT-20261122T225306035Z',pendingWrites={
    [prefix+'-B01']:{ids:[pending,'V2I-OUTSIDE00000'],requestIds:[prefix+'-GB001',prefix+'-GB002'],status:'POSTING_OR_UNCONFIRMED'},
    OTHER:{ids:[rest[0]],requestIds:['ANOTHER-LANE-B01']}
  };
  let ledger={pendingWrites:structuredClone(pendingWrites),grantExtractionAttempts:{m:{primaryId:model,phase:'BULK'},s:{primaryId:rest[1],phase:'SMOKE'}}},saved;
  function start(run,scopeOverride=scope){return open({ledger,scope:scopeOverride,isEligible,run,checkpoint:()=>{saved=JSON.stringify(ledger);}});}
  const first=start('first');
  a.equal(first.summary().legacySeeded,2,'only documented legacy identities are seeded');
  a.equal(first.claim(pending),false);a.equal(first.claim(model),false);
  a.equal(first.claim('V2I-OUTSIDE00000'),false);
  a.equal(first.claim(noSource),true);first.finish(noSource,'NO_SUPPORTED_FIELDS');
  a.equal(first.claim(hung),true); // crash after the checkpoint, before a result
  ledger=JSON.parse(saved);
  const next=start('next'),claims=[];
  const reordered=[hung,noSource,pending,model,'V2I-OUTSIDE00000',...rest];
  for(const id of reordered){if(claims.length===50)break;if(next.claim(id)){claims.push(id);next.finish(id,'FIELDS_PLANNED');}}
  a.deepEqual(claims,rest.slice(0,50));
  a.deepEqual(next.summary(),{frozen:1582,previouslyReached:4,legacySeeded:0,reached:54,notReached:1528,reopened:0,awaitingProductEvidence:0,priorInterrupted:1});
  const planned=rest[51],uncertain=rest[52],missingPlan=rest[53],plan={fields:{WORK_ARRANGEMENT:'ONSITE'}};
  for(const id of [planned,uncertain,missingPlan])a.equal(next.claim(id),true);
  next.finish(planned,'FIELDS_PLANNED',{plan});next.finish(uncertain,'FIELDS_PLANNED',{plan});
  next.finish(missingPlan,'FIELDS_PLANNED');
  a.equal(next.planned(planned),null,'do not replay a plan in its originating run');
  const originalBatch=prefix+'-B02',originalChild=prefix+'-GB003';
  ledger.pendingWrites[originalBatch]={ids:[uncertain],requestIds:[originalChild]};
  next.markWriterAttempt(originalBatch,[{ruling:{primaryId:uncertain,requestId:originalChild}}]);
  // Persist both before POST, then simulate receipt reconciliation removing pending.
  delete ledger.pendingWrites[originalBatch];
  saved=JSON.stringify(ledger);
  const productOnly=rest[50], old='a'.repeat(64), changed='b'.repeat(64);
  a.equal(next.claim(productOnly),true);
  next.finish(productOnly,'INCOMPLETE',{reason:'PRODUCT_EVIDENCE_REQUIRED',missing:['products (what they make)'],productEvidence:old});
  a.equal(next.claim(productOnly,()=>changed),false,'even new evidence cannot reopen in the same invocation');
  ledger=JSON.parse(saved);
  const followup=start('followup');
  a.deepEqual(followup.planned(planned),plan,'proven plans stranded before Writer are retained without readmitting');
  a.equal(followup.claim(planned),false);
  a.equal(followup.planned(uncertain),null,'original transmission marker prevents replay even after pending cleanup');
  a.equal(followup.planned(missingPlan),null,'absence of a transmission marker alone does not establish a resumable plan');
  a.equal(followup.claim(productOnly,()=>old),false,'same committed fingerprint is not new evidence');
  a.equal(followup.claim(productOnly,()=>null),false,'no committed Product is not evidence');
  a.equal(followup.claim(productOnly,()=>changed),true,'only a changed durable Product fingerprint reopens');
  a.equal(followup.summary().reopened,1);a.equal(followup.summary().reached,58,'reopening does not double-count a distinct ID');
  a.equal(followup.claim(hung,()=>changed),false,'hung rows cannot be reopened by an unrelated Product change');
  a.deepEqual(ledger.pendingWrites,pendingWrites);
  a.throws(()=>start('wrong',{partition:'other-pass',size:1582}),/SCOPE_MISMATCH/);
});
