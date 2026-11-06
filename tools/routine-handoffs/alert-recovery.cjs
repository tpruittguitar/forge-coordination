'use strict';
const S=require('../programmed-coordinator/store.cjs'),L=require('../email-recovery/ledger.cjs');
const Formats=require('./alert-formats.cjs'),U=require('../pipeline-observability/upstream-flow');
const publicText=s=>String(s||'').replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[public contact omitted]').replace(/(?:\+?1[ .-]?)?\(?\d{3}\)?[ .-]\d{3}[ .-]\d{4}\b/g,'[public contact omitted]').replace(/https?:\/\/\S+/g,'[source link omitted]');
function recoverFormat(root,message,format,{screenContext}={}){
 const file='state/EMAIL_RECOVERY_QUEUE.json',ledger=S.read(root,file,L.empty());
 const previous=ledger.sources[message.id];
 if(previous?.originalAlertRecovery?.sourceSha256===message.sourceSha256&&previous.originalAlertRecovery.template===format.template)return{recovered:0,duplicate:true};
 const keys=[],newKeys=[],pending=[...format.pending],unresolved=[];
 for(const card of format.cards){
  const key=card.url?U.key(card.url):'alert-card:'+S.hash({sourceSha256:message.sourceSha256,slot:card.slot,title:card.title,company:card.company,location:card.location});
  const old=ledger.jobs[key];
  if(old&&['title','company','location'].some(k=>old[k]!==card[k])){
   pending.push({slot:card.slot,reason:'CONFLICTING_ORIGINAL_ALERT_IDENTITY',sourceCardSha256:card.sourceCardSha256});continue;
  }
  const description=publicText(card.description),job=old||(ledger.jobs[key]={key,jobId:card.jobId,provider:card.provider,title:card.title,company:card.company,location:card.location,url:card.url,observedAt:message.at,status:'UNSCREENED',sourceEmails:[],evidence:[]});
  if(!old)newKeys.push(key);
  if(!job.sourceEmails.includes(message.id))job.sourceEmails.push(message.id);
  const e={gmailId:message.id,at:message.at,page:card.url,paragraphs:[card.title,card.company,card.location,...(description?[description]:[])],source:format.reviewSha256?'FULL_ORIGINAL_ALERT_AI_REVIEW':'FULL_ORIGINAL_ALERT',sourceSha256:message.sourceSha256,template:format.template,sourceCardSha256:card.sourceCardSha256,...(format.reviewSha256?{reviewSha256:format.reviewSha256}:{})};
  e.cardHash=S.hash({jobId:card.jobId,paragraphs:e.paragraphs});
  if(!job.evidence.some(x=>x.cardHash===e.cardHash&&x.gmailId===message.id))job.evidence.push(e);
  // Keep card evidence distinct from a complete employer job description.
  job.description=job.description||description;
  job.selectionReason=job.selectionReason||'Exact saved '+card.provider+' alert card; state/EMAIL_RECOVERY_QUEUE.json#'+key;
  job.discoveryReview=job.discoveryReview||{sourceSha256:message.sourceSha256,sourceProof:'state/EMAIL_RECOVERY_QUEUE.json#'+key,contentBasis:'EXACT_ORIGINAL_ALERT_CARD',fullPosting:false,provider:card.provider,pendingFacts:card.url?[]:['SOURCE_URL']};
  job.preliminaryScreen=require('../source-trial/preliminary-screen').screen({...job,description},screenContext);
  if(card.sourceRecoveryReason){
   job.sourceRecovery={reason:card.sourceRecoveryReason,owner:'FORGE_INTAKE_SOURCE_RECOVERY',sourceSha256:message.sourceSha256,sourceProof:'state/EMAIL_RECOVERY_QUEUE.json#'+key};unresolved.push(key);
  }
  keys.push(key);
 }
 if(!keys.length&&!pending.length)return{recovered:0};
 const source=previous||(ledger.sources[message.id]={gmailId:message.id,url:format.cards.find(c=>c.url)?.url||null,status:'CAPTURED_ALERT_PENDING',access:'OK',pages:[],jobKeys:[],historicalCoverage:'UNPROVEN',nextPageRequired:false,exhausted:false,advertisedUnseen:0,sourceKind:'FULL_ALERT_BODY'});
 source.jobKeys=[...new Set([...source.jobKeys,...keys])];
 source.originalAlertRecovery={sourceSha256:message.sourceSha256,at:new Date().toISOString(),originalDate:message.at,visibleKeys:keys,newKeys,template:format.template,unresolvedKeys:unresolved,pendingCards:pending,...(format.reviewSha256?{reviewSha256:format.reviewSha256}:{}),unseenHistoricalCoverage:'UNPROVEN'};
 ledger.at=Date.parse(ledger.at||0)>Date.parse(message.at)?ledger.at:message.at;
 require('node:fs').mkdirSync(require('node:path').join(root,'state'),{recursive:true});L.save(require('node:path').join(root,file),ledger);
 return{recovered:newKeys.length,visible:keys.length,sourceRecoveryRequired:unresolved.length,unresolvedCards:pending.length,historicalCoverage:'UNPROVEN'};
}
// Recover exact cards from a complete original alert independently of its now
// changed saved search. Never turn advertised counts into invented job records.
function cards(message){
 if(!message.fullBody||!/^(?:jobalerts-noreply|jobs-noreply)@linkedin\.com$/.test(message.sender)||!/Your job alert|Jobs similar|Your saved job|Job alert:|Jobs for Tim|Recommendations based/.test(message.body))return[];
 const result=[],seen=new Set();
 for(const section of message.body.split(/-{10,}/)){
  const lines=section.split(/\r?\n/).map(s=>s.trim()).filter(Boolean),view=lines.findIndex(s=>/^View job: https:\/\//.test(s));if(view<0)continue;
  const link=lines[view].slice('View job: '.length);let u;try{u=new URL(link);}catch{continue;}
  const id=u.hostname==='www.linkedin.com'&&u.pathname.match(/^\/(?:comm\/)?jobs\/view\/(\d+)\/?$/)?.[1];if(!id||seen.has(id))throw Error('AMBIGUOUS_ALERT_CARD');
  const paragraphs=lines.slice(0,view).filter(s=>!/^Your job alert|^Jobs similar|^Your saved job|^Job alert:|^Jobs for Tim|^Recommendations based|^\d+\+? new jobs? match|^https:\/\/|^Fast growing$|^This company is actively hiring$|^Apply with resume|^\d+ (company alumni|connections?)/.test(s));if(paragraphs.length<3)throw Error('INCOMPLETE_ALERT_CARD');
  seen.add(id);result.push({jobId:id,paragraphs:paragraphs.slice(-3)});
 }
 return result;
}
function recover(root,message,{privateDir,screenContext}={}){
 const reviewed=require('./alert-review.cjs').importReview(root,message,privateDir,{screenContext});if(reviewed)return reviewed;
 const format=Formats.extract(message);if(format)return recoverFormat(root,message,format,{screenContext});
 const file='state/EMAIL_RECOVERY_QUEUE.json',ledger=S.read(root,file,L.empty());let source=ledger.sources[message.id];
 if(source?.originalAlertRecovery?.sourceSha256===message.sourceSha256)return{recovered:0,duplicate:true};
 const found=cards(message);if(!found.length)return{recovered:0};
 if(!source){
  L.seed(ledger,[{gmailId:message.id,url:'https://www.linkedin.com/jobs/view/'+found[0].jobId+'/',advertisedUnseen:0}]);source=ledger.sources[message.id];
  Object.assign(source,{status:'CAPTURED_ALERT_PENDING',access:'OK',nextPageRequired:false,exhausted:false,sourceKind:'FULL_ALERT_BODY'});
 }
 // Reuse card validation/dedup while restoring all live cursor/coverage fields.
 const original=structuredClone(source),before=new Set(Object.keys(ledger.jobs));
 for(const card of found){const old=ledger.jobs['linkedin:'+card.jobId],identity=card.paragraphs;if(old&&[old.title,old.company,old.location].some((v,n)=>String(v).toLowerCase().replace(/[^a-z0-9]/g,'')!==identity[n].toLowerCase().replace(/[^a-z0-9]/g,'')))throw Error('CONFLICTING_ORIGINAL_ALERT_IDENTITY');}
 L.capture(ledger,{gmailId:message.id,url:source.url,at:message.at,jobs:found,next:true},{screenContext});
 const keys=found.map(j=>'linkedin:'+j.jobId),recovered=keys.filter(k=>!before.has(k));
 ledger.sources[message.id]={...original,jobKeys:[...new Set([...original.jobKeys,...keys])],originalAlertRecovery:{sourceSha256:message.sourceSha256,at:new Date().toISOString(),originalDate:message.at,visibleKeys:keys,newKeys:recovered,unseenHistoricalCoverage:'UNPROVEN'}};
 for(const key of keys){const e=ledger.jobs[key].evidence.find(e=>e.gmailId===message.id&&e.at===message.at);if(e){e.source='FULL_ORIGINAL_ALERT';e.sourceSha256=message.sourceSha256;}}
 L.save(require('node:path').join(root,file),ledger);return{recovered:recovered.length,visible:keys.length,historicalCoverage:'UNPROVEN'};
}
function handoff(root,message){
 const file='state/MAIL_SOURCE_HANDOFFS.json',h=S.read(root,file,{messages:{}}),entry=h.messages[message.id];
 if(entry?.classification!=='JOB_ALERT')return;
 const q=S.read(root,'state/EMAIL_RECOVERY_QUEUE.json',L.empty()),s=q.sources[message.id];
 if(s?.originalAlertRecovery?.sourceSha256!==message.sourceSha256)throw Error('ALERT_FORMAT_RESEARCH_REQUIRED');
 const keys=s.originalAlertRecovery.visibleKeys;
 if(keys.some(k=>!q.jobs[k]))throw Error('ALERT_CANDIDATE_ACK_REQUIRED');
 entry.candidateKeys=keys;entry.sourceProof='state/EMAIL_RECOVERY_QUEUE.json#'+message.id;
 if(s.originalAlertRecovery.pendingCards?.length){entry.status='PENDING_SOURCE_ACCOUNTING';entry.unseenCoverageComplete=false;S.save(root,file,h);throw Error('ALERT_CARD_SOURCE_RESEARCH_REQUIRED');}
 if(!keys.length)throw Error('ALERT_CANDIDATE_ACK_REQUIRED');
 // Visible-card capture is an acknowledgment, never proof that unseen results or jobs are complete.
 entry.status=keys.every(k=>/^(VERIFIED_INSERTED|VERIFIED_EXISTING|OUT_OF_SCOPE|EXCLUDED_BY_WRITER)$/.test(q.jobs[k].status))?'VISIBLE_CARDS_DISPOSITIONED':'CANDIDATES_AWAITING_EVALUATION';
 entry.unseenCoverageComplete=false;S.save(root,file,h);
}
module.exports={cards,recover,handoff,recoverFormat,publicText};
