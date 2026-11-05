'use strict';
const S=require('../programmed-coordinator/store.cjs'),path=require('node:path'),fs=require('node:fs');
function consume({root,privateDir,snapshot,checkLock}){
 const report={recorded:0,unchanged:0,exceptions:[]};
 for(const file of S.files(path.join(privateDir,'interview-reviews'))){try{
  const r=JSON.parse(fs.readFileSync(file,'utf8'));if(typeof r.sourceFile!=='string'||path.isAbsolute(r.sourceFile)||r.sourceFile.split(/[\\/]/).includes('..'))throw Error('PRIVATE_SOURCE_PATH_REQUIRED');const source=S.read(privateDir,r.sourceFile),e=r.event;
  if(r.schema!=='forge.interview-source-review.v1'||r.reviewedBy!=='CHATGPT'||!Number.isFinite(Date.parse(r.reviewedAt))||r.reviewedAt>new Date().toISOString()||S.hash(source)!==r.sourceSha256||!e?.evidenceVerified||!['EMAIL','GOOGLE_CALENDAR'].includes(e.sourceType)||!['INTERVIEW_PREPARATION','INTERVIEW_STATUS','INTERVIEW_SCHEDULED'].includes(e.type)||!['INVITED','SCHEDULED','COMPLETED','RECEIVED','AWAITING_SCHEDULING'].includes(e.progress)||!Number.isFinite(Date.parse(e.eventDate)))throw Error('SOURCE_BOUND_INTERVIEW_REVIEW_REQUIRED');
  if(path.isAbsolute(r.sourceFile)||r.sourceFile.split(/[\\/]/).includes('..'))throw Error('PRIVATE_SOURCE_PATH_REQUIRED');
  const hits=snapshot.rows.concat(snapshot.archiveRows||[]).filter(x=>x.PRIMARY_ID===e.primaryId);
  if(hits.length!==1||hits[0].COMPANY!==r.company||hits[0].TITLE!==r.title)throw Error('EXACT_INTERVIEW_IDENTITY_REQUIRED');
  if(!r.evidenceQuote||r.evidenceQuote.length<20||!JSON.stringify(source).includes(r.evidenceQuote))throw Error('INTERVIEW_QUOTE_REQUIRED');
  if(e.sourceType==='GOOGLE_CALENDAR'&&!/^[a-f0-9]{64}$/.test(e.sourceEventHash||''))throw Error('HASHED_CALENDAR_REFERENCE_REQUIRED');
  const allowed=['primaryId','type','stage','progress','eventDate','sourceType','sourceEventHash','gmailMessageId','threadId','evidenceVerified','matchingMethod','inferenceBasis','observedAt'];
  const event=Object.fromEntries(allowed.filter(k=>e[k]!==undefined).map(k=>[k,e[k]]));event.reviewSha256=S.hash(r);event.masterWriteStatus='EVENT_ONLY';event.canonicalStatePreserved=true;
  checkLock();let changed=false;
  for(const [f,schema]of [['state/APPLICATION_OUTCOMES.json','forge.application-outcomes.v1'],['state/APPLICATION_TRACKER_EVENTS.json','forge.application-tracker-events.v1']]){
   const ledger=S.read(root,f,{schema,events:[]});const index=ledger.events.findIndex(x=>x.primaryId===event.primaryId&&x.type===event.type&&(event.sourceEventHash?x.sourceEventHash===event.sourceEventHash:x.gmailMessageId===event.gmailMessageId));
   if(index>=0&&ledger.events[index].reviewSha256===event.reviewSha256)continue;
   if(index>=0)ledger.events[index]={...ledger.events[index],...event};else ledger.events.push(event);
   ledger.at=new Date().toISOString();S.save(root,f,ledger);changed=true;
  }report[changed?'recorded':'unchanged']++;
 }catch(e){report.exceptions.push({reviewHash:S.hash(file),reason:e.message,owner:'FORGE_APPLICATION_OUTCOME_TRACKER'});}}
 return report;
}
module.exports={consume};
