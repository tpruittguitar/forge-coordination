'use strict';
const S=require('../programmed-coordinator/store.cjs');
// Private AI reviews can resolve correspondence only. They cannot select a job,
// create a Writer ruling, or override any application/outcome classification.
function disposition(privateDir,message,classification){
 if(!/^[a-f0-9]{1,64}$/i.test(message.id||''))throw Error('MAIL_MESSAGE_ID_REQUIRED');
 const record=S.read(privateDir,'mail-reviews/'+message.id+'.json',null);if(!record)return null;
 const sourceMatches=/^[a-f0-9]{64}$/.test(record.sourceSha256||'')&&[message.sourceSha256,message.legacySourceSha256,...message.legacySourceSha256s||[]].includes(record.sourceSha256);
 if(record.schema!=='forge.mail-correspondence-review.v1'||record.messageId!==message.id||!message.fullBody||!sourceMatches||record.reviewedBy!=='CHATGPT'||!Number.isFinite(Date.parse(record.reviewedAt))||Date.parse(record.reviewedAt)<Date.parse(message.at)||Date.parse(record.reviewedAt)>Date.now()+60000||classification.owner!=='AI'||classification.status!=='EXCEPTION'||require('../programmed-coordinator/outcome.cjs').classify(message).owner==='CODE'||record.disposition!=='REVIEWED_CORRESPONDENCE'||record.reason!=='UNNAMED_EMPLOYER_APPROACH'||record.nextAction!=='CLARIFY_EMPLOYER_AND_ROLE'||record.noCanonicalOutcome!==true||record.primaryId||record.eventType||typeof record.evidenceQuote!=='string'||record.evidenceQuote.length<20||!message.body.includes(record.evidenceQuote))throw Error('SOURCE_BOUND_CORRESPONDENCE_REVIEW_REQUIRED');
 return{status:'REVIEWED_CORRESPONDENCE',reviewSha256:S.hash(record),reason:record.reason,nextAction:record.nextAction,reviewedAt:record.reviewedAt};
}
module.exports={disposition};
