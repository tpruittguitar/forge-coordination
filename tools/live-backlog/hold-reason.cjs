'use strict';
// Read-only presentation of existing classification and source-bound research.
// Never run reconciliation, infer successful writes, or substitute screening for a hold.
const {sha}=require('./model.cjs');
const text=value=>typeof value==='string'&&value.trim()?value.trim():null;
const norm=value=>String(value||'').trim().replace(/\s+/g,' ').toLowerCase();
const tasks=new Set(['FORGE_INTAKE_SCOPE_REVIEW','FORGE_INTAKE_SOURCE_RECOVERY','FORGE_INTAKE_HELD_RECONCILIATION']);
const outcomes=new Set(['SOURCE_READY','EXCLUSION_CANDIDATE','WAITING_SOURCE_CHANGE','RECONCILIATION_REQUIRED']);
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const date=value=>typeof value==='string'&&Number.isFinite(Date.parse(value));
const held=new Set(['HELD','IDENTITY_HOLD','MISSING_PREVIOUSLY_PRESENT']);
function baseline(item,source){
 const group=source?.ledger?.groups?.[item.key];
 const entries=(group?.aliases||[]).map(key=>source.ledger.entries[key]).filter(Boolean);
 const codes=[...new Set(entries.map(e=>text(e.evidenceStatus)).filter(Boolean))];
 let reason=item.reason||'Pending intake or source review';
 if(item.status==='HELD')reason='Saved '+(codes.length?codes.join(', '):'hold')+' evidence still needs identity or original Writer-result reconciliation.';
 if(item.status==='IDENTITY_HOLD')reason=item.key.startsWith('unresolved:')?'Exact source identity has not been resolved.':'Source identity is ambiguous; it may match multiple canonical jobs.';
 if(item.status==='MISSING_PREVIOUSLY_PRESENT')reason='A previously linked job is no longer found in the current canonical snapshot.';
 return {holdReason:reason,holdReasonBasis:held.has(item.status)?'Saved ledger classification; detailed review unavailable':'Saved intake screen',holdOwner:null,holdTaskKey:null,holdWorkStatus:null,holdNextAction:null,holdRetryCondition:null,holdRetryAfter:null,holdObservedAt:source?.ledger?.at||null,holdEvidence:group?'state/UPSTREAM_LEDGER.json#'+item.key:null,holdReviewAvailability:held.has(item.status)?'Detailed review not recorded or not current':null};
}
function savedIndex(read,source){
 const result=new Map();for(const item of source.items)result.set(item.key,baseline(item,source));
 let drain;try{drain=JSON.parse(read('state/INTAKE_DRAIN.json'));}catch{return result;}
 // A mixed-age inventory must not present old research as the current explanation.
 if(!drain||typeof drain!=='object'||Array.isArray(drain)||drain.schema!=='forge.intake-drain.v1'||drain.upstreamAt!==source.ledger?.at||!drain.items||Array.isArray(drain.items))return result;
 for(const item of source.items){
  const d=drain.items[item.key],group=source.ledger.groups[item.key],out=result.get(item.key);
  if(!d||d.key!==item.key||d.upstreamStatus!==item.status||d.status==='ACCOUNTED_UPSTREAM'||d.status==='INVENTORY_RECONCILIATION_REQUIRED'||d.currentRepresentation||!Array.isArray(d.aliases)||!same([...d.aliases].sort(),[...(group?.aliases||[])].sort())||!/^[a-f0-9]{64}$/.test(d.sourceVersion||'')||!d.card||['company','title','location'].some(field=>text(item[field])&&norm(item[field])!==norm(d.card[field])))continue;
  // Filled-in missing fields are allowed; conflicting recorded identity is not.
  const sourceKey=require('../pipeline-observability/upstream-flow').key;
  if(text(item.sourceUrl)&&(!sourceKey(d.card.url)||!d.aliases.includes(sourceKey(d.card.url))))continue;
  Object.assign(out,{holdOwner:text(d.owner),holdTaskKey:text(d.taskKey),holdWorkStatus:text(d.status),holdNextAction:text(d.nextAction),holdEvidence:'state/INTAKE_DRAIN.json#'+item.key});
  const ref=d.review;
  if(!ref){out.holdReviewAvailability='Detailed review not recorded';continue;}
  try{
   if(!/^receipts\/INTAKE_DRAIN\/[a-f0-9]{64}\.json$/.test(ref.path||''))throw Error();
   const r=JSON.parse(read(ref.path)),hash=sha(r);
   if(ref.path!=='receipts/INTAKE_DRAIN/'+hash+'.json'||ref.sha256!==hash||r.schema!=='forge.intake-drain-review.v1'||r.key!==item.key||r.sourceVersion!==d.sourceVersion||r.taskKey!==d.taskKey||!tasks.has(r.taskKey)||!outcomes.has(r.outcome)||r.provider!=='ChatGPT'||r.writerSubmitted!==false||r.outcome!==ref.outcome||r.observedAt!==ref.observedAt||!date(r.observedAt)||!date(drain.at)||Date.parse(r.observedAt)>Date.parse(drain.at)||!text(r.reason)||!text(r.nextAction)||!Array.isArray(r.attempts)||!r.attempts.length)throw Error();
   Object.assign(out,{holdReason:r.reason,holdReasonBasis:'Saved source-bound research review; not proof of canonical completion',holdObservedAt:r.observedAt,holdEvidence:ref.path,holdNextAction:r.nextAction,holdRetryCondition:text(r.retryCondition),holdRetryAfter:date(r.retryAfter)?r.retryAfter:null,holdReviewAvailability:'Source-bound review available'});
   if(d.validation?.reviewSha256===hash&&d.status==='SOURCE_VALIDATION_REQUIRED'&&d.validation.status===d.status&&text(d.validation.reason)){
    out.holdReason='Independent source validation failed: '+d.validation.reason+'\n\nSaved research: '+r.reason;
    out.holdReasonBasis='Saved validation failure and source-bound research review';
    out.holdRetryAfter=date(d.validation.retryAfter)?d.validation.retryAfter:out.holdRetryAfter;
   }
  }catch{out.holdReviewAvailability='Saved review unavailable or does not match this source version';}
 }
 return result;
}
function display(item,index){return index?.get(item.key)||baseline(item);}
module.exports={baseline,savedIndex,display};
