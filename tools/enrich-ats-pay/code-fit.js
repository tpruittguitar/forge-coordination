'use strict';
// Code-scored experience fit (Tim, Nov 17 2026 6:08 PM ET): no AI. Each row's saved
// posting text is matched against Tim's grounded resume profile and the score goes to
// the Writer as SCOPE_FIT_RAW, the first FIT_KEYS field the decision gate reads
// (decision-complete.js -> PipelineEvidence.fit). Rows without a saved posting of
// MIN_CHARS+ characters are left alone and stay in enrichment.
const Match=require('../source-trial/resume-match');
const MODEL_REF='CODE_FIT rev1',MIN_CHARS=400,FULL_AT=6;
function score({title,text},profile){
 const m=Match.match({title,description:text},profile),ids=m.matches.map(x=>x.competencyId),total=profile.competencies.length;
 const value=Math.round(100*Math.min(ids.length,FULL_AT)/FULL_AT);
 const basis=`${MODEL_REF}: ${ids.length}/${total} resume competencies observed in a ${text.length}-char saved posting (${FULL_AT}+ = 100)`+(ids.length?': '+ids.join(', '):'');
 return{value,fields:{SCOPE_FIT_RAW:String(value),SCOPE_FIT_MODEL_REF:MODEL_REF,EXPERIENCE_FIT_BASIS:basis.slice(0,300)}};
}
// Plans fit rulings in place. A row already in this run's requests gets the fit fields
// merged into its ruling (no extra Writer slot); otherwise a new ruling is added only
// while requests stay under `slots` (the existing maxBatches x 25 Writer limit).
// Fenced rows (pending/refused writes, helper reservations) are in `unavailable`.
// Tim (Nov 17 2026 9:12 PM ET): code fit replaces the legacy title-level EXPERIENCE_FIT.
// A row is open to code fit when it has no fit, or its only fit is EXPERIENCE_FIT
// (no SCOPE_FIT_RAW). A row that already carries a CODE_FIT score is never overwritten.
const codeFitted=p=>/^CODE_FIT\b/.test(String(p.SCOPE_FIT_MODEL_REF||''));
function replaceable(p,fit){const h=fit(p);return!codeFitted(p)&&(h.value==null||h.legacy===true&&h.source==='EXPERIENCE_FIT');}
function plan({rows,requests,saved,fit,active=()=>true,unavailable=new Set(),runId,slots,max=150,profile=Match.load()}){
 // Every row that is not scored lands in exactly one counter, so a zero run says why.
 // already_fitted_legacy: the row carries a legacy FIT_KEYS value other than EXPERIENCE_FIT.
 // legacy_replaced (a subset of scored): rows whose legacy EXPERIENCE_FIT was replaced by code fit.
 const stats={scored:0,legacy_replaced:0,merged:0,added:0,short_posting:0,no_posting:0,deferred:0,fenced:0,inactive:0,already_fitted:0,already_fitted_legacy:0},sample=[];
 for(const r of rows){
  if(stats.scored>=max)break;
  if(unavailable.has(r.PRIMARY_ID)){stats.fenced++;continue;}
  if(!active(r)){stats.inactive++;continue;}
  const p=r.p||{},had=fit(p);
  if(!replaceable(p,fit)){stats[had.legacy&&!codeFitted(p)?'already_fitted_legacy':'already_fitted']++;continue;}
  const text=saved(r)?.text;
  if(typeof text!=='string'||!text.trim()){stats.no_posting++;continue;}
  if(text.trim().length<MIN_CHARS){stats.short_posting++;continue;}
  const existing=requests.find(q=>q.ruling.primaryId===r.PRIMARY_ID);
  if(!existing&&requests.length>=slots){stats.deferred++;continue;}
  const s=score({title:r.TITLE,text:text.trim()},profile);
  if(existing){Object.assign(existing.ruling.fields,s.fields);stats.merged++;}
  else{requests.push({action:'ruling',ruling:{requestId:`${runId}-F${String(stats.added+1).padStart(3,'0')}`,primaryId:r.PRIMARY_ID,kind:'ENRICH',actor:'ATSBOT',fields:s.fields}});stats.added++;}
  stats.scored++;if(had.value!=null)stats.legacy_replaced++;if(sample.length<5)sample.push({id:r.PRIMARY_ID,fit:s.value});
 }
 return{stats,sample};
}
// Writer readback guard: drop the fit fields when the row gained a non-replaceable fit
// (SCOPE_FIT_RAW, a CODE_FIT score or a non-EXPERIENCE_FIT legacy fit) meanwhile or its
// identity changed, so a score never lands on a different job than the posting scored.
const FIELDS=['SCOPE_FIT_RAW','SCOPE_FIT_MODEL_REF','EXPERIENCE_FIT_BASIS'];
function guard(fields,planned,current,fit){
 if(fields.SCOPE_FIT_MODEL_REF!==MODEL_REF)return false;
 if(planned&&current&&replaceable(current.p||{},fit)&&['COMPANY','TITLE','LOCATION'].every(k=>planned[k]===current[k]))return false;
 FIELDS.forEach(k=>delete fields[k]);return true;
}
module.exports={plan,score,guard,replaceable,FIELDS,MODEL_REF,MIN_CHARS};
