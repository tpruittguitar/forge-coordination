'use strict';
const Prepared=require('./prepared.cjs'),Cache=require('./posting-cache'),Recovery=require('./recovery');
const Fields=require('../helper-routing/helper-fields.cjs'),Pay=require('./pay-values'),L=require('./lib');
const {isDecisionComplete}=require('./decision-complete');
const blank=value=>value==null||String(value).trim()==='';
const identityKnown=value=>!blank(value)&&!/^(?:UNKNOWN|TBD|N\/?A|NONE|NOT_STATED|-)$/i.test(String(value).trim());
const norm=value=>String(value??'').normalize('NFKC').replace(/\s+/g,' ').trim().toLowerCase();
const payKeys=['SALARY_BASE_LOW','SALARY_BASE_HIGH','SALARY_BASIS','SALARY_SOURCE','SALARY_ASOF'];
const degreeKeys=['DEGREE_REQ','DEGREE_TEXT','DEGREE_EVIDENCE_URL','DEGREE_ASOF'];
const workKeys=['WORK_ARRANGEMENT','REMOTE_HYBRID'];
const productKeys=['PRODUCT','PRODUCT_SOURCE','PRODUCT_SCOPE','PRODUCT_SITE','PRODUCT_ASOF','PRODUCT_REFERENCE'];
const fieldKeys=new Set([...payKeys,'SALARY_MIDPOINT','SALARY_SCORE_POINT','SALARY_CONF',...degreeKeys,...workKeys,...productKeys]);
function waiting(rows,built,E){
  const needed=new Set(['FORGE_ENRICH_FEASIBILITY','FORGE_ENRICH_STRATEGIC'].flatMap(k=>(built.lanes[k]||[]).map(r=>r.PRIMARY_ID)));
  return rows.filter(r=>!Prepared.protectedRow(r)&&(needed.has(r.PRIMARY_ID)||!isDecisionComplete(r,E)));
}
function matchesKnown(p,v,k){
  return blank(p[k])||(k.startsWith('SALARY_BASE_')?Number(p[k])===Number(v):norm(p[k])===norm(v));
}
function samePosting(p,k,url){return blank(p[k])||!!Cache.route(url)&&Cache.route(p[k])===Cache.route(url);}
function missing(p,keys){return keys.some(k=>blank(p[k]));}
function select(p,fields){return Object.fromEntries(Object.entries(fields).filter(([k,v])=>fieldKeys.has(k)&&blank(p[k])&&!blank(v)));}
function work(source){
  const body=source.text, found=new Map();
  for(const q of body.split(/\r?\n|(?<=[.!?])\s+/).map(t=>t.trim()).filter(t=>t&&t.length<=1500)){
    for(const mode of ['ONSITE','HYBRID','REMOTE'])if(!/^#/i.test(q)&&Fields.statesMode(q,mode)&&(!found.has(mode)||/\b(?:this|the) (?:role|position|job)\b/i.test(q)))found.set(mode,q);
  }
  if(found.size!==1)return {};
  const [mode,q]=found.entries().next().value;
  return {...Fields.verified({fieldQuotes:{WORK_ARRANGEMENT:q},proposedRawFields:{WORK_ARRANGEMENT:mode,REMOTE_HYBRID:mode}},{description:body}),quote:q};
}
function exactStoredPosting(store,row,now=Date.now()){
  // The existing index verifies immutable content/hash, normalized identity,
  // exact route and requisition. Keep only that single complete posting.
  for(const url of Recovery.urls(row)){
    const card={...row,SOURCE_URL:url};
    const match=store.find(card,{now,maxAgeMs:Infinity});
    const d=match?.doc,observed=Date.parse(match?.ref?.observedAt),expires=d?.validThrough;
    const constraint=store.constraints?.(card,{now})?.[0];
    if(!d||match.fullPosting!==true||d.fullPosting!==true||Cache.route(d.url)!==Cache.route(url)
      ||!Number.isFinite(observed)||observed>now||expires!=null&&!(Date.parse(expires)>now)
      ||constraint&&(!(Date.parse(constraint.validThrough)>now)||!require('../source-trial/evidence-store').sameRequisition(constraint,d)))continue;
    return Recovery.saveEvidence({},row,d.url,{text:d.text,fullPosting:true,identityVerified:true,
      sourceIdentity:{company:row.COMPANY,title:row.TITLE,location:row.LOCATION},basis:'EMPLOYER_POSTED',
      postedPay:d.postedPay,payFacts:d.payFacts,postingFacts:{validThrough:constraint?.validThrough||expires}},observed);
  }
  return null;
}
function project({row,capture,product,Products,now=Date.now()}){
  if(Prepared.protectedRow(row))return {};
  const p=row.p, fields={};
  // Products use only the existing exact validated site/job registry. A field
  // can be added only when any existing product and reference already agree.
  if(product&&Products){
    const v=Products.fields(product);
    if(matchesKnown(p,v.PRODUCT,'PRODUCT')&&matchesKnown(p,v.PRODUCT_REFERENCE,'PRODUCT_REFERENCE')
      &&matchesKnown(p,v.PRODUCT_SITE,'PRODUCT_SITE')&&matchesKnown(p,v.PRODUCT_SCOPE,'PRODUCT_SCOPE')&&matchesKnown(p,v.PRODUCT_SOURCE,'PRODUCT_SOURCE'))Object.assign(fields,v);
  }
  if(!capture||!Recovery.urls(row).some(u=>Cache.route(u)===Cache.route(capture.url)))return select(p,fields);
  const e=Prepared.posting(row,capture,now);
  if(!e||e.identityVerified!==true||e.fullPosting!==true)return select(p,fields);
  const day=e.at.slice(0,10),d=e.degree;
  if(d&&['REQUIRED','PREFERRED'].includes(d.req)&&matchesKnown(p,d.req,'DEGREE_REQ')&&matchesKnown(p,d.text,'DEGREE_TEXT')&&samePosting(p,'DEGREE_EVIDENCE_URL',e.degreeUrl||e.url)){
    Object.assign(fields,{DEGREE_REQ:d.req,DEGREE_TEXT:d.text,DEGREE_EVIDENCE_URL:e.degreeUrl||e.url,DEGREE_ASOF:(e.degreeAt||e.at).slice(0,10)});
  }
  if(e.pay&&e.basis==='EMPLOYER_POSTED'&&!capture.payAmbiguous&&!e.payAmbiguous&&!e.payNeedsRefresh
    &&matchesKnown(p,e.pay.low,'SALARY_BASE_LOW')&&matchesKnown(p,e.pay.high,'SALARY_BASE_HIGH')
    &&matchesKnown(p,'EMPLOYER_POSTED','SALARY_BASIS')&&samePosting(p,'SALARY_SOURCE',e.url)
    &&!Pay.conflicts(e.text,e.pay,L.payFromText)&&!Pay.estimatedPay(e.text,e.pay,L.payFromText)){
    const v=Pay.values(e.pay.low,e.pay.high);
    if(v)Object.assign(fields,{SALARY_BASE_LOW:v.low,SALARY_BASE_HIGH:v.high,SALARY_MIDPOINT:v.mid,SALARY_SCORE_POINT:v.scorePoint,
      SALARY_BASIS:'EMPLOYER_POSTED',SALARY_SOURCE:e.url,SALARY_ASOF:day,SALARY_CONF:'HIGH'});
  }
  if(missing(p,workKeys)){
    const v=work(e);
    if(v.WORK_ARRANGEMENT&&workKeys.every(k=>matchesKnown(p,v[k],k)))Object.assign(fields,Object.fromEntries(workKeys.map(k=>[k,v[k]])));
  }
  return select(p,fields);
}
// Find a viable MODEL candidate before spend. Whole-source checks still govern
// every result; only the original quote itself is sent to the model.
function modelCandidate(row,source,now,groups){
  const fields=project({row,capture:source,now});
  if(groups.includes('WORK_ARRANGEMENT')&&(fields.WORK_ARRANGEMENT||fields.REMOTE_HYBRID)){
    const w=work(source);
    if(w.quote)return {group:'WORK_ARRANGEMENT',text:w.quote,fields};
  }
  const d=source.degree;
  if(groups.includes('DEGREE')&&(fields.DEGREE_REQ||fields.DEGREE_TEXT)){
    if(d?.text&&source.text.includes(d.text)&&Buffer.byteLength(d.text)<=1200)return {group:'DEGREE',text:d.text,fields};
  }
  return null;
}
function modelResult(result,candidate,source){
  const names=Fields.GROUPS[candidate.group];
  if(!result?.fields||Object.keys(result.fields).some(k=>!names.includes(k)))return {};
  const quote=result.quotes?.[candidate.group];
  if(typeof quote!=='string'||!quote.trim()||!candidate.text.includes(quote))return {};
  const valid=Fields.verified({fieldQuotes:result.quotes,proposedRawFields:result.fields},{description:source.text});
  if(candidate.group==='WORK_ARRANGEMENT'){
    const expected=work(source);
    if(!names.some(k=>valid[k]===expected[k])||names.some(k=>valid[k]!==undefined&&valid[k]!==expected[k]))return {};
  }else if(valid.DEGREE_REQ!==source.degree?.req||valid.DEGREE_TEXT!==source.degree?.text)return {};
  const keys=candidate.group==='DEGREE'?degreeKeys:workKeys;
  return Object.fromEntries(Object.entries(candidate.fields).filter(([k])=>keys.includes(k)));
}
module.exports={exactStoredPosting,modelCandidate,modelResult,waiting,identityKnown,project,select,missing,payKeys,degreeKeys,workKeys,productKeys};
