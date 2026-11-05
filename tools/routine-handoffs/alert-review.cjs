'use strict';
// Gofer/AI can repair an unsupported alert format, but every proposed card must
// be bound to its exact saved full-body source. Full quotes remain private.
const fs=require('node:fs'),path=require('node:path'),S=require('../programmed-coordinator/store.cjs'),L=require('../email-recovery/ledger.cjs'),U=require('../pipeline-observability/upstream-flow');
function importReview(root,message,privateDir){
 if(!privateDir||!message.fullBody)return null;
 const file=path.join(privateDir,'alert-reviews',message.sourceSha256+'.json');if(!fs.existsSync(file))return null;
 if(require('./mail.cjs').classify(message).classification!=='JOB_ALERT')throw Error('AUTOMATED_JOB_ALERT_SOURCE_REQUIRED');
 const r=JSON.parse(fs.readFileSync(file,'utf8'));
 if(r.schema!=='forge.alert-card-review.v1'||r.messageId!==message.id||r.sourceSha256!==message.sourceSha256||r.reviewedBy!=='CHATGPT'||!['FORGE_APPLICATION_WRITER_GOFER','FORGE_APPLICATION_OUTCOME_TRACKER'].includes(r.taskKey)||!Array.isArray(r.cards)||!r.cards.length)throw Error('SOURCE_BOUND_ALERT_REVIEW_REQUIRED');
 const ledger=S.read(root,'state/EMAIL_RECOVERY_QUEUE.json',L.empty()),keys=[],seen=new Set(),prepared=[];
 for(const c of r.cards){
  if(!['title','company','location','url','quote'].every(k=>typeof c[k]==='string'&&c[k].trim())||!message.body.includes(c.quote)||!['title','company','location','url'].every(k=>c.quote.includes(c[k])))throw Error('EXACT_ORIGINAL_ALERT_QUOTE_REQUIRED');
  const url=new URL(c.url);if(url.protocol!=='https:'||url.username||url.password||url.port||!/\./.test(url.hostname))throw Error('PUBLIC_ALERT_JOB_URL_REQUIRED');
  for(const k of [...url.searchParams.keys()])if(/^(utm_|trk|tracking|ref|source|token|sig|lipi|eid)/i.test(k))url.searchParams.delete(k);
  const key=U.key(url.href);if(!key||seen.has(key))throw Error('UNIQUE_ALERT_CARD_REQUIRED');seen.add(key);
  const prior=ledger.jobs[key];if(prior&&['title','company','location'].some(k=>prior[k]!==c[k]))throw Error('CONFLICTING_ORIGINAL_ALERT_IDENTITY');
  prepared.push({key,url:url.href,card:c});
 }
 for(const {key,url,card:c} of prepared){
  const j=ledger.jobs[key]||(ledger.jobs[key]={key,jobId:key.split(':').slice(1).join(':'),title:c.title,company:c.company,location:c.location,url,observedAt:message.at,status:'UNSCREENED',sourceEmails:[],evidence:[]});
  if(!j.sourceEmails.includes(message.id))j.sourceEmails.push(message.id);
  const evidence={gmailId:message.id,at:message.at,page:url,paragraphs:[c.title,c.company,c.location],source:'FULL_ORIGINAL_ALERT_AI_REVIEW',sourceSha256:message.sourceSha256,reviewSha256:S.hash(r)};evidence.cardHash=S.hash({jobId:j.jobId,paragraphs:evidence.paragraphs});
  if(!j.evidence.some(e=>e.cardHash===evidence.cardHash&&e.gmailId===message.id))j.evidence.push(evidence);keys.push(key);
 }
 const source=ledger.sources[message.id]||(ledger.sources[message.id]={gmailId:message.id,url:prepared[0].url,status:'CAPTURED_ALERT_PENDING',access:'OK',pages:[],jobKeys:[],historicalCoverage:'UNPROVEN',nextPageRequired:false,exhausted:false,advertisedUnseen:0,sourceKind:'FULL_ALERT_BODY'});
 source.jobKeys=[...new Set([...source.jobKeys,...keys])];source.originalAlertRecovery={sourceSha256:message.sourceSha256,at:new Date().toISOString(),originalDate:message.at,visibleKeys:keys,reviewSha256:S.hash(r),unseenHistoricalCoverage:'UNPROVEN'};
 fs.mkdirSync(path.join(root,'state'),{recursive:true});L.save(path.join(root,'state/EMAIL_RECOVERY_QUEUE.json'),ledger);return{recovered:prepared.length,visible:keys.length,aiReviewed:true,historicalCoverage:'UNPROVEN'};
}
module.exports={importReview};
