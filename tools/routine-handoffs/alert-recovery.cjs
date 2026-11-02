'use strict';
const S=require('../programmed-coordinator/store.cjs'),L=require('../email-recovery/ledger.cjs');
// Recover exact cards from a complete original alert independently of its now
// changed saved search. Never turn advertised counts into invented job records.
function cards(message){
 if(!message.fullBody||!/^jobalerts-noreply@linkedin\.com$/.test(message.sender)||!/^Your job alert for /m.test(message.body))return[];
 const result=[],seen=new Set();
 for(const section of message.body.split(/-{10,}/)){
  const lines=section.split(/\r?\n/).map(s=>s.trim()).filter(Boolean),view=lines.findIndex(s=>/^View job: https:\/\//.test(s));if(view<0)continue;
  const link=lines[view].slice('View job: '.length);let u;try{u=new URL(link);}catch{continue;}
  const id=u.hostname==='www.linkedin.com'&&u.pathname.match(/^\/(?:comm\/)?jobs\/view\/(\d+)\/?$/)?.[1];if(!id||seen.has(id))throw Error('AMBIGUOUS_ALERT_CARD');
  const header=lines.findIndex(s=>/^\d+\+? new jobs match your preferences\.$/.test(s)),paragraphs=lines.slice(header>=0?header+1:0,view);if(paragraphs.length<3)throw Error('INCOMPLETE_ALERT_CARD');
  seen.add(id);result.push({jobId:id,paragraphs:paragraphs.slice(0,3)});
 }
 return result;
}
function recover(root,message){
 const file='state/EMAIL_RECOVERY_QUEUE.json',ledger=S.read(root,file,null),source=ledger?.sources[message.id];if(!source)return{recovered:0};
 if(source.originalAlertRecovery?.sourceSha256===message.sourceSha256)return{recovered:0,duplicate:true};
 const found=cards(message);if(!found.length)return{recovered:0};
 // Reuse card validation/dedup while restoring all live cursor/coverage fields.
 const original=structuredClone(source),before=new Set(Object.keys(ledger.jobs));
 for(const card of found){const old=ledger.jobs['linkedin:'+card.jobId],identity=card.paragraphs;if(old&&[old.title,old.company,old.location].some((v,n)=>String(v).toLowerCase().replace(/[^a-z0-9]/g,'')!==identity[n].toLowerCase().replace(/[^a-z0-9]/g,'')))throw Error('CONFLICTING_ORIGINAL_ALERT_IDENTITY');}
 L.capture(ledger,{gmailId:message.id,url:source.url,at:message.at,jobs:found,next:true});
 const keys=found.map(j=>'linkedin:'+j.jobId),recovered=keys.filter(k=>!before.has(k));
 ledger.sources[message.id]={...original,jobKeys:[...new Set([...original.jobKeys,...keys])],originalAlertRecovery:{sourceSha256:message.sourceSha256,at:new Date().toISOString(),originalDate:message.at,visibleKeys:keys,newKeys:recovered,unseenHistoricalCoverage:'UNPROVEN'}};
 for(const key of keys){const e=ledger.jobs[key].evidence.find(e=>e.gmailId===message.id&&e.at===message.at);if(e){e.source='FULL_ORIGINAL_ALERT';e.sourceSha256=message.sourceSha256;}}
 L.save(require('node:path').join(root,file),ledger);return{recovered:recovered.length,visible:keys.length,historicalCoverage:'UNPROVEN'};
}
module.exports={cards,recover};
