'use strict';
const grantKeys=new Set(['receiptId','revision','ids','release','purpose','provider','workIdentity','expiresAt','readAt','reservedMicrousd','status','localBindingSha256','checkpointSha256','resultSha256','result']);
const reportKeys=new Set(['mode','jobs','modelAttempts','preparedJobs','preparedFields','reservedMicrousd','confirmedUsageMicrousd','unknownOutcomeJobs','writerRequests','stop']);
function keys(value,allowed){return value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(k=>allowed.has(k));}
function validate(work){
 for(const i of work.items||[])if(i.taskKey==='FORGE_OPENAI_DIRECT_PILOT'&&!keys(i,new Set(['primaryId','kind','lane','provider','taskKey','worker','status','assignmentVersion','sourceVersion','company','title','location','missingFields','pilotGrantId','assignedAt','assignedBy','remainingFields','returnProof'])))throw Error('PILOT_PUBLIC_PROJECTION_REQUIRED');
 const l=work.directPilot;if(!l)return;
 if(!keys(l,new Set(['schema','reservedMicrousd','grants']))||!l.grants||Array.isArray(l.grants))throw Error('PILOT_PUBLIC_PROJECTION_REQUIRED');
 for(const g of Object.values(l.grants)){
  if(!keys(g,grantKeys)||!/^[a-f0-9]{64}$/.test(g.localBindingSha256||'')||!/^[a-f0-9]{64}$/.test(g.revision||'')||
    !/^FORGE-OPENAI-PILOT-[A-Za-z0-9_-]{3,100}$/.test(g.receiptId||'')||g.provider!=='OpenAI'||g.workIdentity!=='FORGE_OPENAI_DIRECT_PILOT'||g.purpose!=='FIVE_JOB_LOCAL_EVIDENCE_ONLY'||g.release!=='AUTHORIZED'||
    !['RESERVED','LOCAL_COMPLETE','LOCAL_HELD'].includes(g.status)||!Array.isArray(g.ids)||g.ids.some(id=>!/^V2[A-Z]-[A-Za-z0-9_-]+$/.test(id))||
    !Number.isFinite(Date.parse(g.expiresAt))||!Number.isFinite(Date.parse(g.readAt))||g.reservedMicrousd!==10240)throw Error('PILOT_PUBLIC_PROJECTION_REQUIRED');
  if(g.result){
   if(!keys(g.result,reportKeys)||g.result.mode!=='live-evidence-only'||g.result.writerRequests!==0||g.result.stop!=null&&!/^[A-Z][A-Z0-9_]{2,80}$/.test(g.result.stop))throw Error('PILOT_PUBLIC_PROJECTION_REQUIRED');
   for(const k of [...reportKeys].filter(k=>!['mode','stop'].includes(k)))if(!Number.isSafeInteger(g.result[k])||g.result[k]<0)throw Error('PILOT_PUBLIC_PROJECTION_REQUIRED');
  }
 }

}
function project(g,localBindingSha256){return {receiptId:g.receiptId,revision:g.revision,ids:[...g.ids],release:g.release,purpose:g.purpose,provider:g.provider,workIdentity:g.workIdentity,expiresAt:g.expiresAt,readAt:g.readAt,reservedMicrousd:g.reservedMicrousd,status:g.status,localBindingSha256};}
module.exports={validate,project};
