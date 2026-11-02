'use strict';
const S=require('../programmed-coordinator/store.cjs');
function queue(root){
 const coordinator=S.read(root,'state/PROGRAMMED_COORDINATOR_REPORT.json',{}),mail=S.read(root,'state/MAIL_PROCESSING_REPORT.json',{});
 const work=S.read(root,require('./exception-work.cjs').FILE,null);
 if(work){const cases=Object.values(work.cases);return{schema:'forge.ai-exception-queue.v1',coordinatorRunId:work.runId,mailRunId:mail.runId,items:cases.filter(i=>i.status==='ACTION_REQUIRED'),waiting:cases.filter(i=>['WAITING_SOURCE_CHANGE','AWAITING_TIM'].includes(i.status)),reviewErrors:work.reviewErrors,counts:work.counts,noProcessingCap:true};}
 const items=[...(coordinator.aiExceptions||[]),...(coordinator.routineHandoffs?.assignments?.exceptions||[]),...(mail.exceptions||[])].filter(x=>x.owner==='AI');
 const unique=new Map();for(const item of items){const key=S.hash({key:item.key,messageId:item.messageId,requestId:item.requestId,reason:item.reason,sourceSha256:item.sourceSha256,itemVersion:item.itemVersion});unique.set(key,{...item,exceptionId:key});}
 return{schema:'forge.ai-exception-queue.v1',coordinatorRunId:coordinator.runId,mailRunId:mail.runId,items:[...unique.values()],noProcessingCap:true};
}
if(require.main===module){try{console.log(JSON.stringify(process.argv[2]==='review'?require('./exception-work.cjs').publishReview(process.argv[3]||process.cwd(),JSON.parse(require('node:fs').readFileSync(process.argv[4],'utf8'))):queue(process.argv[2]||process.cwd())));}catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={queue};
