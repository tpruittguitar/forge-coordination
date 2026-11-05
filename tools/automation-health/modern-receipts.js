'use strict';
const fs=require('fs'),path=require('path'),S=require('../programmed-coordinator/store.cjs');
function execution(root,file,t,coordinator){
 if(!t||t.provider!=='ChatGPT'||!/^FORGE-(GOFER|OUTCOME|POSTVAL)-CHATGPT-[A-Za-z0-9_-]+$/.test(t.runId||'')||file!=='AI_REASON_RUN_RECEIPT_'+t.runId+'_TERMINAL.txt'||!/^([a-f0-9]{40})$/.test(t.instructionSha||'')||!Number.isFinite(Date.parse(t.at)))return null;
 if(t.taskKey==='FORGE_APPLICATION_WRITER_GOFER'&&t.submitted===0&&t.verified===0&&t.noReplay===true&&t.persistentReviews?.length){
  for(const r of t.persistentReviews){if(!/^receipts\/AI_EXCEPTION_REVIEWS\/[a-f0-9]{64}-[a-f0-9]{64}\.json$/.test(r.path)||r.canonicalWrites!==0)return null;const v=JSON.parse(fs.readFileSync(path.join(root,r.path)));if(v.schema!=='forge.ai-exception-review.v1'||v.reviewedBy!=='CHATGPT'||v.taskKey!==t.taskKey||!r.path.endsWith('-'+S.hash(v)+'.json')||Date.parse(v.reviewedAt)>Date.parse(t.at))return null;}
  return{id:'forge-application-writer-gofer',status:'RESEARCH_EXECUTED_WITH_PENDING_WORK',files:[file,...t.persistentReviews.map(r=>r.path)]};
 }
 if(t.taskKey==='FORGE_APPLICATION_OUTCOME_TRACKER'&&t.masterSubmitted===0&&t.masterVerified===0&&t.noReplay===true&&t.gmail&&Number.isSafeInteger(t.gmail.enumerated)&&t.gmail.enumerated>0&&t.gmail.newFullCaptures+t.gmail.reused+t.gmail.pendingCapture===t.gmail.enumerated&&t.gmail.pendingCapture===0&&coordinator?.routineHandoffs?.mail?.read>=t.gmail.enumerated&&Date.parse(coordinator.at)>=Date.parse(t.at))return{id:'forge-application-outcome-tracker',status:'SOURCE_CAPTURE_CORROBORATED_CODE_CONSUMPTION_PENDING',files:[file,'receipts/'+coordinator.runId+'_TERMINAL.json']};
 return null;
}
module.exports={execution};
