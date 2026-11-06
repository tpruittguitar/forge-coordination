'use strict';
// Gofer/AI can repair an unsupported alert format, but every proposed card must
// be bound to its exact saved full-body source. Full quotes remain private.
const fs=require('node:fs'),path=require('node:path'),S=require('../programmed-coordinator/store.cjs'),Formats=require('./alert-formats.cjs');
function importReview(root,message,privateDir,{screenContext}={}){
 if(!privateDir||!message.fullBody)return null;
 const file=path.join(privateDir,'alert-reviews',message.sourceSha256+'.json');if(!fs.existsSync(file))return null;
 if(require('./mail.cjs').classify(message).classification!=='JOB_ALERT')throw Error('AUTOMATED_JOB_ALERT_SOURCE_REQUIRED');
 const r=JSON.parse(fs.readFileSync(file,'utf8'));
 if(r.schema!=='forge.alert-card-review.v1'||r.messageId!==message.id||r.sourceSha256!==message.sourceSha256||r.reviewedBy!=='CHATGPT'||!['FORGE_APPLICATION_WRITER_GOFER','FORGE_APPLICATION_OUTCOME_TRACKER'].includes(r.taskKey)||!Array.isArray(r.cards)||!r.cards.length)throw Error('SOURCE_BOUND_ALERT_REVIEW_REQUIRED');
 const capture=require('./alert-recovery.cjs'),cards=[],pending=[],seen=new Map(),conflicts=new Set(),reviewSha256=S.hash(r);
 for(const [slot,c]of r.cards.entries()){
  // Envelope mistakes block the review; a malformed individual card never
  // discards an independently source-bound sibling or exposes a private quote.
  if(!c||!['title','company','location','url','quote'].every(k=>typeof c[k]==='string'&&c[k].trim())||!message.body.includes(c.quote)||!['title','company','location','url'].every(k=>c.quote.includes(c[k]))||['title','company','location'].some(k=>capture.publicText(c[k])!==c[k])){
   pending.push({slot,reason:'EXACT_ORIGINAL_ALERT_QUOTE_REQUIRED',sourceCardSha256:S.hash(c)});continue;
  }
  const target=Formats.reviewedJob(c.url),identity={title:c.title,company:c.company,location:c.location},key=target?.url||'opaque:'+S.hash({slot,identity});
  if(seen.has(key)){
   if(S.hash(seen.get(key))!==S.hash(identity)){conflicts.add(key);const at=cards.findIndex(x=>x.url===target?.url);if(at>=0)cards.splice(at,1);pending.push({slot,reason:'CONFLICTING_ALERT_CARD_IDENTITY',sourceCardSha256:S.hash(c)});}
   continue;
  }
  if(conflicts.has(key))continue;seen.set(key,identity);
  cards.push({...identity,url:target?.url||null,jobId:target?.jobId||null,provider:target?.provider||'SAVED_ALERT_REVIEW',slot,description:'',sourceCardSha256:S.hash(c),...(target?{}:{sourceRecoveryReason:'EXACT_POSTING_URL_REQUIRED'})});
 }
 const result=capture.recoverFormat(root,message,{provider:'SAVED_ALERT_REVIEW',template:'SOURCE_BOUND_AI_REVIEW_'+reviewSha256,reviewSha256,cards,pending},{screenContext});
 return{...result,aiReviewed:true};
}
module.exports={importReview};
