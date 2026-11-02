'use strict';
const S=require('../programmed-coordinator/store.cjs');
function queue(root){
 const coordinator=S.read(root,'state/PROGRAMMED_COORDINATOR_REPORT.json',{}),mail=S.read(root,'state/MAIL_PROCESSING_REPORT.json',{});
 const items=[...(coordinator.aiExceptions||[]),...(coordinator.routineHandoffs?.assignments?.exceptions||[]),...(mail.exceptions||[])].filter(x=>x.owner==='AI');
 const unique=new Map();for(const item of items){const key=S.hash({key:item.key,messageId:item.messageId,requestId:item.requestId,reason:item.reason,sourceSha256:item.sourceSha256,itemVersion:item.itemVersion});unique.set(key,{...item,exceptionId:key});}
 return{schema:'forge.ai-exception-queue.v1',coordinatorRunId:coordinator.runId,mailRunId:mail.runId,items:[...unique.values()],noProcessingCap:true};
}
if(require.main===module)console.log(JSON.stringify(queue(process.argv[2]||process.cwd())));
module.exports={queue};
