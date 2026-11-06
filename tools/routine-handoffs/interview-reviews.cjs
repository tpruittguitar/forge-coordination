'use strict';
const S=require('../programmed-coordinator/store.cjs'),path=require('node:path'),fs=require('node:fs');
const ledgers=[['state/APPLICATION_OUTCOMES.json','forge.application-outcomes.v1'],['state/APPLICATION_TRACKER_EVENTS.json','forge.application-tracker-events.v1']];
function mailSource(source,id){
 if(typeof id!=='string'||!id.trim()||!/^[-A-Za-z0-9_]{1,160}$/.test(id))throw Error('BOUND_GMAIL_MESSAGE_ID_REQUIRED');
 const candidates=source.id?[source]:[...(source.messages||[]),...(source.responses||[])],hits=candidates.filter(m=>m.id===id);
 if(hits.length!==1)throw Error('EXACT_REVIEW_EMAIL_SOURCE_REQUIRED');
 const message=hits[0].payload?require('./mail.cjs').normalize(hits[0]):hits[0];
 if(message.fullBody===false)throw Error('COMPLETE_REVIEW_EMAIL_SOURCE_REQUIRED');
 return message;
}
const eventKey=e=>S.hash([e.primaryId,e.type,e.sourceType,e.sourceType==='GOOGLE_CALENDAR'?e.sourceEventHash:e.gmailMessageId]);
const privateRef=(privateDir,file)=>S.hash(path.relative(privateDir,file).split(path.sep).join('/'));
function inspect({privateDir,sourceReviewRef,sourceVersion}){
 if(!/^[a-f0-9]{64}$/.test(sourceReviewRef||'')||!/^[a-f0-9]{64}$/.test(sourceVersion||''))throw Error('EXACT_PRIVATE_REVIEW_BINDING_REQUIRED');
 const hits=S.files(path.join(privateDir,'interview-reviews')).filter(f=>privateRef(privateDir,f)===sourceReviewRef);
 if(hits.length!==1)throw Error('EXACT_PRIVATE_REVIEW_BINDING_REQUIRED');
 const raw=fs.readFileSync(hits[0],'utf8');if(S.hash(raw)!==sourceVersion)throw Error('PRIVATE_REVIEW_VERSION_CHANGED');
 let review=null;try{review=JSON.parse(raw);}catch{}
 return{sourceReviewRef,sourceVersion,privateReviewFile:path.relative(privateDir,hits[0]),review,raw:review?undefined:raw,privateSourceOnly:true};
}
function consume({root,privateDir,snapshot,checkLock}){
 const report={recorded:0,unchanged:0,superseded:0,exceptions:[],resolvedReviews:[]},groups=new Map(),revisions=new Map(),refs=new Map();
 const files=S.files(path.join(privateDir,'interview-reviews'));
 for(const file of files){const ref={file,id:privateRef(privateDir,file)};try{ref.raw=fs.readFileSync(file,'utf8');ref.version=S.hash(ref.raw);try{ref.review=JSON.parse(ref.raw);}catch{}}catch(e){ref.version=S.hash({ref:ref.id,error:e.code});}refs.set(ref.id,ref);}
 const fail=(file,e)=>{const ref=refs.get(privateRef(privateDir,file)),r=ref.review,reason=e instanceof SyntaxError?'INTERVIEW_REVIEW_JSON_INVALID':/^[A-Z][A-Z0-9_]{3,100}$/.test(e.message)?e.message:'INTERVIEW_REVIEW_SOURCE_OR_STORAGE_FAILURE';report.exceptions.push({owner:'AI',reason,sourceReviewRef:ref.id,sourceVersion:ref.version,reviewHash:ref.version,...(/^[a-f0-9]{64}$/.test(r?.sourceSha256||'')?{sourceSha256:r.sourceSha256}:{}),...(r?.event?{eventKey:eventKey(r.event)}:{}),...(/^[a-f0-9]{64}$/.test(e.priorReviewSha256||'')?{priorReviewSha256:e.priorReviewSha256}:{}),nextAction:'Use interview-reviews.cjs inspect with the existing private coordinator config and exact sourceReviewRef/sourceVersion. Read the original full source, then publish a new immutable source-bound interview review with correctsReview={sourceReviewRef,sourceVersion}; for unknown prior chronology also bind supersedesReviewSha256. The coordinator validates and consumes the correction automatically. Never edit original evidence or infer a canonical write.'});};
 for(const file of files){try{
  const r=JSON.parse(fs.readFileSync(file,'utf8'));if(typeof r.sourceFile!=='string'||path.isAbsolute(r.sourceFile)||r.sourceFile.split(/[\\/]/).includes('..'))throw Error('PRIVATE_SOURCE_PATH_REQUIRED');
  const source=S.read(privateDir,r.sourceFile),e=r.event,correspondence=['RECRUITER_CONTACT','USER_REPLIED'].includes(e?.type);
  if(r.schema!=='forge.interview-source-review.v1'||r.reviewedBy!=='CHATGPT'||!Number.isFinite(Date.parse(r.reviewedAt))||Date.parse(r.reviewedAt)>Date.now()||S.hash(source)!==r.sourceSha256||!e?.evidenceVerified||!['EMAIL','GOOGLE_CALENDAR'].includes(e.sourceType)||!['INTERVIEW_PREPARATION','INTERVIEW_STATUS','INTERVIEW_SCHEDULED','RECRUITER_CONTACT','USER_REPLIED'].includes(e.type)||!correspondence&&!['INVITED','SCHEDULED','COMPLETED','RECEIVED','AWAITING_SCHEDULING','CANCELED'].includes(e.progress)||!Number.isFinite(Date.parse(e.eventDate)))throw Error('SOURCE_BOUND_INTERVIEW_REVIEW_REQUIRED');
  const hits=snapshot.rows.concat(snapshot.archiveRows||[]).filter(x=>x.PRIMARY_ID===e.primaryId);
  if(hits.length!==1||hits[0].COMPANY!==r.company||hits[0].TITLE!==r.title)throw Error('EXACT_INTERVIEW_IDENTITY_REQUIRED');
  if(e.sourceType==='GOOGLE_CALENDAR'&&!/^[a-f0-9]{64}$/.test(e.sourceEventHash||''))throw Error('HASHED_CALENDAR_REFERENCE_REQUIRED');
  const message=e.sourceType==='EMAIL'?mailSource(source,e.gmailMessageId):null;
  if(message&&e.threadId&&(message.threadId||message.thread_id)!==e.threadId)throw Error('EXACT_REVIEW_EMAIL_THREAD_REQUIRED');
  // The quote must belong to the identified email, not another message in the
  // same thread capture. Calendar reviews remain bound to the captured event.
  if(!r.evidenceQuote||r.evidenceQuote.length<20||!JSON.stringify(message||source).includes(r.evidenceQuote))throw Error('INTERVIEW_QUOTE_REQUIRED');
  if(r.correctsReview){
   const c=r.correctsReview;
   if(typeof c!=='object'||Array.isArray(c)||Object.keys(c).some(k=>!['sourceReviewRef','sourceVersion'].includes(k))||!/^[a-f0-9]{64}$/.test(c.sourceReviewRef||'')||!/^[a-f0-9]{64}$/.test(c.sourceVersion||''))throw Error('INTERVIEW_CORRECTION_BINDING_REQUIRED');
   const original=refs.get(c.sourceReviewRef);
   if(!original||c.sourceVersion!==original.version||original.file===file)throw Error('INTERVIEW_CORRECTION_BINDING_REQUIRED');
   // A correction may repair a bad claimed source hash, but cannot quietly
   // switch to an unrelated capture. Bind the actual retained source bytes.
   if(original.review){const originalFile=original.review.sourceFile;
    if(typeof originalFile!=='string'||path.isAbsolute(originalFile)||originalFile.split(/[\\/]/).includes('..'))throw Error('INTERVIEW_CORRECTION_SOURCE_REQUIRED');
    if(S.hash(S.read(privateDir,originalFile))!==r.sourceSha256)throw Error('INTERVIEW_CORRECTION_SOURCE_REQUIRED');
   }
  }
  if(r.supersedesReviewSha256&&(!r.correctsReview||!/^[a-f0-9]{64}$/.test(r.supersedesReviewSha256)))throw Error('INTERVIEW_CORRECTION_BINDING_REQUIRED');
  const sha=S.hash(r),key=eventKey(e),entry={file,r,e,sha,message};
  revisions.set(sha,Date.parse(r.reviewedAt));if(!groups.has(key))groups.set(key,[]);groups.get(key).push(entry);
 }catch(e){fail(file,e);}}
 for(const [key,entries]of groups){const latest=[...new Map(entries.map(x=>[x.sha,x])).values()].sort((a,b)=>Date.parse(b.r.reviewedAt)-Date.parse(a.r.reviewedAt)),chosen=latest[0];try{
  // Directory order never decides precedence. Conflicting equal-time reviews
  // need explicit resolution rather than an arbitrary hash/filename tie break.
  if(latest[1]&&Date.parse(latest[1].r.reviewedAt)===Date.parse(chosen.r.reviewedAt))throw Error('INTERVIEW_REVIEW_REVISION_CONFLICT');
  const {r,e,sha,message}=chosen;
  const allowed=['primaryId','type','stage','progress','eventDate','sourceType','sourceEventHash','gmailMessageId','threadId','evidenceVerified','matchingMethod','inferenceBasis','observedAt'];
  const event=Object.fromEntries(allowed.filter(k=>e[k]!==undefined).map(k=>[k,e[k]]));
  Object.assign(event,{reviewSha256:sha,sourceReviewAt:r.reviewedAt,masterWriteStatus:'EVENT_ONLY',canonicalStatePreserved:true});
  const targets=ledgers.map(([file,schema])=>{const ledger=S.read(root,file,{schema,events:[]}),matches=ledger.events.map((x,index)=>({x,index})).filter(({x})=>eventKey(x)===key);if(matches.length>1)throw Error('DUPLICATE_INTERVIEW_EVENT_IDENTITY');return{file,ledger,index:matches[0]?.index??-1,prior:matches[0]?.x};});
  const time=Date.parse(r.reviewedAt);let newer=false;
  for(const {prior}of targets){if(!prior?.reviewSha256||prior.reviewSha256===sha)continue;
   const previous=Number.isFinite(Date.parse(prior.sourceReviewAt))?Date.parse(prior.sourceReviewAt):revisions.get(prior.reviewSha256);
   if(!Number.isFinite(previous)){if(r.correctsReview&&r.supersedesReviewSha256===prior.reviewSha256)continue;const error=Error('INTERVIEW_REVIEW_PRECEDENCE_REQUIRED');error.priorReviewSha256=prior.reviewSha256;throw error;}
   if(previous>time)newer=true;else if(previous===time)throw Error('INTERVIEW_REVIEW_REVISION_CONFLICT');
  }
  if(newer){report.superseded+=entries.length;continue;}
  report.superseded+=Math.max(0,entries.length-1);
  const superseded=[...new Set([...latest.slice(1).map(x=>x.sha),...targets.flatMap(({prior})=>[...(prior?.supersededReviews||[]),...(prior?.reviewSha256&&prior.reviewSha256!==sha?[prior.reviewSha256]:[])])])].sort();
  if(superseded.length)event.supersededReviews=superseded;
  checkLock();let changed=false;
  for(const {file,ledger,index,prior}of targets){
   if(prior?.reviewSha256===sha)continue;
   const next={...prior,...event};
   if(prior?.masterWriteStatus==='VERIFIED'){next.masterWriteStatus=prior.masterWriteStatus;next.writerProof=prior.writerProof;}
   if(index>=0)ledger.events[index]=next;else ledger.events.push(next);
   ledger.at=new Date().toISOString();S.save(root,file,ledger);changed=true;
  }
  report[changed?'recorded':'unchanged']++;
  if(r.correctsReview)report.resolvedReviews.push({sourceReviewRef:r.correctsReview.sourceReviewRef,sourceVersion:r.correctsReview.sourceVersion,correctedBy:sha,eventKey:key,status:'SOURCE_BOUND_REVIEW_CONSUMED',canonicalWrites:0});
  if(message){
   const mail=S.read(root,'state/MAIL_PROCESSING.json',{messages:{},transactions:{},exceptions:{}}),entry=mail.messages[e.gmailMessageId];
   if(message.fullBody&&entry&&!entry.transactionId&&entry.sourceSha256===message.sourceSha256&&!(entry.status==='RECORDED_EVENT'&&entry.reviewSha256===sha)){
    checkLock();entry.status='RECORDED_EVENT';entry.reviewSha256=sha;entry.event=event;
    delete mail.exceptions[e.gmailMessageId];S.save(root,'state/MAIL_PROCESSING.json',mail);
   }
  }
 }catch(e){fail(chosen.file,e);}}
 const resolved=new Set(report.resolvedReviews.map(r=>r.sourceReviewRef+':'+r.sourceVersion));
 report.exceptions=report.exceptions.filter(e=>!resolved.has(e.sourceReviewRef+':'+e.sourceVersion));
 return report;
}
if(require.main===module){try{if(process.argv[2]!=='inspect')throw Error('USE_PRIVATE_REVIEW_INSPECT');const config=JSON.parse(fs.readFileSync(process.argv[3],'utf8'));console.log(JSON.stringify(inspect({privateDir:config.privateDirectory,sourceReviewRef:process.argv[4],sourceVersion:process.argv[5]})));}catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={consume,inspect};
