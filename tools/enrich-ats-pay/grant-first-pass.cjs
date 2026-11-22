'use strict';

const SCHEMA='forge.ats-grant-first-pass.v1';
const CHILD=/^FORGE-ENRICH_ATS-ATSBOT-\d{8}T\d{9}Z-GB\d{3}$/;
const STATUS=new Set(['IN_PROGRESS','NO_SUPPORTED_FIELDS','INCOMPLETE','FIELDS_PLANNED','GRANT_STOPPED','LEGACY_WRITER_TRACKED','LEGACY_GRANT_ATTEMPT']);

function open({ledger,scope,isEligible,run,checkpoint}){
  const state=ledger.grantFirstPass??={schema:SCHEMA,partition:scope.partition,rows:{}};
  if(state.schema!==SCHEMA||state.partition!==scope.partition||!state.rows||Array.isArray(state.rows)
    ||typeof state.rows!=='object'||Object.entries(state.rows).some(([id,row])=>!isEligible(id)||!STATUS.has(row?.status)))throw Error('ATS_GRANT_FIRST_PASS_SCOPE_MISMATCH');
  const rows=state.rows,seen=id=>Object.hasOwn(rows,id);
  let seeded=0;
  function seed(id,status,at,ref){
    if(typeof id!=='string'||!isEligible(id)||seen(id))return;
    rows[id]={status,...(at?{at}:{}),...(ref?{ref}:{})};seeded++;
  }
  // Old runs did not log the selected cohort. Only their exact request/attempt identities can be carried forward,
  // and Writer protection remains owned by pendingWrites, not by this coverage record.
  for(const group of ['pendingWrites','notAccepted','releasedNotApplied']){
    for(const [batch,entry] of Object.entries(ledger[group]||{})){
      for(const [i,child] of (entry.requestIds||[]).entries()){
        if(CHILD.test(child)&&batch.slice(0,-4)===child.slice(0,-6)&&/-B\d{2}$/.test(batch))seed(entry.ids?.[i],'LEGACY_WRITER_TRACKED',entry.at,child);
      }
      for(const q of entry.requests||[]){
        const r=q?.ruling;
        if(r?.actor==='ATSBOT'&&r.kind==='ENRICH'&&CHILD.test(r.requestId))seed(r.primaryId,'LEGACY_WRITER_TRACKED',entry.at,r.requestId);
      }
    }
  }
  for(const r of Object.values(ledger.grantExtractionAttempts||{})){
    if(r?.phase==='BULK'&&r.purpose!=='PRODUCT_PROPOSAL')seed(r.primaryId,'LEGACY_GRANT_ATTEMPT',r.at);
  }
  if(seeded)checkpoint();
  const prior=Object.keys(rows).length;
  let reopened=0;
  const canClaim=(id,getProductEvidence)=>{
    if(!isEligible(id))return false;
    if(!seen(id))return true;
    const previous=rows[id];
    if(previous.status!=='INCOMPLETE'||previous.reason!=='PRODUCT_EVIDENCE_REQUIRED'||previous.run===run)return false;
    const next=getProductEvidence?.();
    return typeof next==='string'&&/^[a-f0-9]{64}$/.test(next)&&next!==previous.productEvidence;
  };
  function hasTracking(id){
    return ['pendingWrites','notAccepted','releasedNotApplied'].some(group=>Object.values(ledger[group]||{}).some(e=>
      e.ids?.includes(id)||e.requests?.some(q=>q.ruling?.primaryId===id)));
  }
  return {
    planned(id){
      const row=rows[id];
      if(row?.status==='FIELDS_PLANNED'&&row.run!==run&&!row.writerAttempt&&row.plan&&!hasTracking(id))return row.plan;
      return null;
    },
    markWriterAttempt(batch,requests){
      for(const q of requests){
        const {primaryId,requestId}=q.ruling,row=rows[primaryId];
        if(row?.status==='FIELDS_PLANNED')row.writerAttempt??={batch,requestId};
      }
      // Caller commits the attempt and original pending checkpoint together, before POST.
    },
    seen,canClaim,awaitingProduct:id=>rows[id]?.status==='INCOMPLETE'&&rows[id]?.reason==='PRODUCT_EVIDENCE_REQUIRED',
    claim(id,getProductEvidence){
      if(!canClaim(id,getProductEvidence))return false;
      const previous=rows[id],at=new Date().toISOString();
      if(previous)reopened++;
      rows[id]={status:'IN_PROGRESS',run,at,firstAt:previous?.firstAt||previous?.at||at};
      checkpoint(); // A killed or stalled process cannot claim this ID again in the same first pass.
      return true;
    },
    finish(id,status,detail={}){
      if(!['NO_SUPPORTED_FIELDS','INCOMPLETE','FIELDS_PLANNED','GRANT_STOPPED'].includes(status)||rows[id]?.run!==run||rows[id].status!=='IN_PROGRESS')throw Error('ATS_GRANT_FIRST_PASS_NOT_CLAIMED');
      rows[id].status=status;
      if(status==='FIELDS_PLANNED'&&detail.plan)rows[id].plan=detail.plan;
      if(status==='INCOMPLETE')Object.assign(rows[id],{reason:detail.reason,missing:detail.missing,productEvidence:detail.productEvidence||null});
      checkpoint();
    },
    summary(){
      const reached=Object.keys(rows).length;
      return {frozen:scope.size,previouslyReached:prior,legacySeeded:seeded,reached,notReached:scope.size-reached,reopened,
        awaitingProductEvidence:Object.values(rows).filter(row=>row.status==='INCOMPLETE'&&row.reason==='PRODUCT_EVIDENCE_REQUIRED').length,
        priorInterrupted:Object.values(rows).filter(row=>row.run!==run&&row.status==='IN_PROGRESS').length};
    }
  };
}

module.exports={open};
