'use strict';
// Synthetic only. Never a production allocation or evidence source.
const crypto=require('node:crypto');
const {NAME,TASK}=require('./worker.cjs');
function fixture(count=5) {
  const at='2026-11-22T04:00:00Z',now=()=>Date.parse(at);
  const text='Bachelor degree required. This role is onsite.';
  const result={fields:{DEGREE_TEXT:'Bachelor degree required.',DEGREE_REQ:'REQUIRED'},
    quotes:{DEGREE:'Bachelor degree required.'},degree:{requirement:'REQUIRED',equivalence:'UNKNOWN',confidence:'HIGH',quote:'Bachelor degree required.'}};
  const work={schema:'forge.enrichment-helper-work.v1',enabled:true,assignmentId:'SYNTHETIC-GRANT',provider:'ChatGPT',taskKey:TASK,
    items:Array.from({length:count},(_,i)=>({primaryId:'V2I-SYNTHETIC-'+i,owner:'ChatGPT',taskKey:TASK,status:'ASSIGNED',missingFields:['DEGREE']}))};
  const view={readAt:at,instructionCommit:'a'.repeat(40),registryOwner:'ChatGPT',owner:{provider:'ChatGPT',taskKey:TASK,assignmentId:work.assignmentId},
    work,allocationComplete:true,allocationProof:'synthetic fixture only',allocations:work.items.map(i=>({primaryId:i.primaryId,worker:NAME}))};
  const current=id=>({authority:structuredClone(view),readAt:at,neverConsider:'CLEAR',originalRequestsReconciled:true,writerFenced:false,missingGroups:['DEGREE'],
    row:{PRIMARY_ID:id,COMPANY:'Synthetic Factory',TITLE:'Plant Manager',LOCATION:'Austin, TX',BUCKET:'SCOUT_INTAKE',p:{DEGREE_TEXT:'',DEGREE_REQ:''}},
    evidence:{kind:'PUBLIC_JOB_POSTING_EXCERPT',publicReviewed:true,identityVerified:true,company:'Synthetic Factory',title:'Plant Manager',location:'Austin, TX',
      url:'https://example.com/jobs/synthetic',observedAt:at,text,sha256:crypto.createHash('sha256').update(text).digest('hex'),fullPosting:false}});
  return {view,current,result,now,adapter:{authority:async()=>structuredClone(view),current:async id=>current(id),reuse:async()=>null,simulate:async()=>structuredClone(result)}};
}
module.exports={fixture};
