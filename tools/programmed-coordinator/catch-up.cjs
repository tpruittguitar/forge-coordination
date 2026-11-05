'use strict';
const S=require('./store.cjs');
const FILE='state/COORDINATOR_CATCH_UP.json';
function summarize(root,runId,now=Date.now()){
 const plan=S.read(root,'state/RELEVANCE_INTAKE_PLAN.json',{items:[]}),mail=S.read(root,'state/MAIL_SOURCE_HANDOFFS.json',{messages:{}}),work=S.read(root,'state/AI_EXCEPTION_WORK.json',{cases:{}});
 const counts={};for(const i of plan.items)counts[i.status]=(counts[i.status]||0)+1;
 const handoffs=Object.values(mail.messages).filter(x=>x.classification==='JOB_ALERT'),ai=Object.values(work.cases).filter(x=>x.status==='ACTION_REQUIRED').length;
 const reviewCards=['RANKED_DISCOVERY','SOURCE_REVALIDATION_REQUIRED','HELD_WRITER_IDENTITY','HELD_CARD_REVIEW'].reduce((n,k)=>n+(counts[k]||0),0);
 const ready=counts.READY||0,pending=counts.POST_IN_FLIGHT_UNKNOWN||0;
 const alertsAwaitingCapture=handoffs.filter(x=>x.status==='PENDING_SOURCE_ACCOUNTING').length;
 // Distinct IDs from canonical verification effects only; acceptances aren't completions.
 const previous=S.read(root,FILE,null);
 const consumption=S.read(root,'state/CODE_INTAKE_CONSUMPTION.json',{items:[]});
 const verified=new Set([...(previous?.verifiedPrimaryIds||[]),...plan.items.concat(consumption.items).filter(x=>['VERIFIED_INSERTED','VERIFIED_EXISTING'].includes(x.status)).map(x=>x.primaryId).filter(Boolean)]);
 return{schema:'forge.coordinator-catch-up.v1',at:new Date(now).toISOString(),runId,scope:'Persisted visible alert cards and coordinator intake plan; unseen historical coverage is unproven',status:ready?'ACTIVE':pending||ai||alertsAwaitingCapture||reviewCards?'WAITING_RECONCILIATION':'NO_ACTIONABLE_WORK',
  verifiedPrimaryIds:[...verified].sort(),
  intake:{ready,reviewCards,pendingOriginalRequests:new Set(plan.items.filter(x=>x.status==='POST_IN_FLIGHT_UNKNOWN').map(x=>x.requestId).filter(Boolean)).size,pendingCards:pending,statusCounts:counts,verifiedDistinctJobs:verified.size,newVerifiedSincePrevious:previous?Math.max(0,verified.size-(previous.intake?.verifiedDistinctJobs||0)):0},
  alerts:{awaitingCapture:alertsAwaitingCapture,awaitingEvaluation:handoffs.filter(x=>x.status==='CANDIDATES_AWAITING_EVALUATION').length,visibleCardsDispositioned:handoffs.filter(x=>x.status==='VISIBLE_CARDS_DISPOSITIONED').length},ai:{actionRequired:ai},
  nextAction:ready?'Next five-minute coordinator pass drains independent READY jobs':'Keep original requests fenced; Gofer/AI reconciles exceptions. Resume changed evidence and due retries.',noProcessingCap:true};
}
module.exports={FILE,summarize};
