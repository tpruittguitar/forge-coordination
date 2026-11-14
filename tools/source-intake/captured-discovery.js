'use strict';
// A saved job card is source evidence, not proof of employer business or posting liveness.
const crypto=require('node:crypto'),Source=require('../programmed-coordinator/source.cjs');
const {normalizeCompany}=require('./record-normalize'),{key}=require('../pipeline-observability/upstream-flow');
const hash=value=>crypto.createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
// Provider names identify provenance; aggregators and recruiting sites are not lower-grade text.
const supported=source=>typeof source==='string'&&!!source.trim()&&!/[\x00-\x1f\x7f]/.test(source)&&!/^(?:SAVED_DISCOVERY|INTAKE_DRAIN|UNKNOWN)$/i.test(source.trim());
const identity=card=>[Source.employer(normalizeCompany(card.company||card.COMPANY).company),Source.norm(card.title||card.TITLE),Source.location(card.location||card.LOCATION)||Source.norm(card.location||card.LOCATION)];
function publicUrl(url){try{return typeof url==='string'&&Source.publicUrl(url) ? true:false;}catch{return false;}}
function validProof(proof){
 if(!proof||typeof proof.path!=='string'||!/^[a-f0-9]{64}$/.test(proof.sha256||''))return false;
 if(/^state\/discovery-evidence\/[a-f0-9]{64}\.json$/.test(proof.path))return proof.path.endsWith(proof.sha256+'.json');
 return /^(?:state\/(?:source-trial-report|board-discovery-report|UPSTREAM_LEDGER)\.json|receipts\/auto-intake\/catch-up\/state\.json)(?:@[a-f0-9]{40})?$/.test(proof.path);
}
const validRequisitions=ids=>ids==null||Array.isArray(ids)&&ids.every(x=>typeof x==='string'&&x.trim()&&x===x.trim().toLowerCase())&&new Set(ids).size===ids.length;
function validEnvelope(e,{now=Date.now()}={}){
 if(!e||e.schema!=='forge.captured-discovery.v1'||!validProof(e.proof)||e.postingStatus!=='UNVERIFIED')return false;
 const c=e.card;
 if(!c||['company','title','location','url','source','description','contentBasis'].some(k=>typeof c[k]!=='string')||typeof c.fullPosting!=='boolean')return false;
 if(c.postedPay!=null&&!require('../source-trial/posted-pay').bound(c.postedPay,c))return false;
 if(c.validThrough!=null&&(typeof c.validThrough!=='string'||!Number.isFinite(Date.parse(c.validThrough))))return false;
 if(!validRequisitions(c.requisitionIds))return false;
 if(c.validThroughEvidence!=null){
  const v=c.validThroughEvidence;
  if(!v||!validRequisitions(v.requisitionIds)||v.validThrough!==c.validThrough||!validProof(v.proof)||!supported(v.source)||!publicUrl(v.url)||key(v.url)!==key(c.url)||identity(v).some((x,n)=>!x||x!==identity(c)[n])||!require('../source-trial/evidence-store').sameRequisition(v,c))return false;
  if(v.observedAt!==null&&(typeof v.observedAt!=='string'||!Number.isFinite(Date.parse(v.observedAt))||Date.parse(v.observedAt)>now))return false;
 }
 if(!supported(c.source)||!publicUrl(c.url)||identity(c).some(x=>!x)||e.cardSha256!==hash(c))return false;
 if(e.observedAt!==null&&(typeof e.observedAt!=='string'||!Number.isFinite(Date.parse(e.observedAt))||Date.parse(e.observedAt)>now))return false;
 if(e.businessStatus!==(c.description?'SOURCE_TEXT':'UNKNOWN'))return false;
 if(c.fullPosting&&(!c.description||c.contentBasis!=='CAPTURED_ROLE_CONTENT'))return false;
 return true;
}
function capture(input,{proof,observedAt=null,now=Date.now()}={}){
 if(!input||typeof input!=='object')return null;
 const description=typeof input.description==='string'?input.description:'',contentBasis=input.contentBasis||input.discoveryReview?.contentBasis||(description?'CAPTURED_ROLE_CONTENT':'TITLE_ONLY');
 const fullPosting=!!description&&contentBasis==='CAPTURED_ROLE_CONTENT'&&input.fullPosting!==false&&input.discoveryReview?.fullPosting!==false;
 const card={company:input.company||input.COMPANY||'',title:input.title||input.TITLE||'',location:input.location||input.LOCATION||'',url:input.url||input.SOURCE_URL||'',source:input.source||'',description,contentBasis,fullPosting,...(input.validThrough!=null?{validThrough:input.validThrough}:{})};
 if(input.requisitionIds!=null)card.requisitionIds=structuredClone(input.requisitionIds);
 if(input.validThroughEvidence!=null)card.validThroughEvidence=structuredClone(input.validThroughEvidence);
 if(input.postedPay){const P=require('../source-trial/posted-pay');if(P.bound(input.postedPay,card))card.postedPay=Object.fromEntries(['schema','company','title','location','sourceUrl','text','low','high','currency','period','basis','status','observedAt','source'].filter(k=>Object.hasOwn(input.postedPay,k)).map(k=>[k,input.postedPay[k]]));}
 const e={schema:'forge.captured-discovery.v1',card,cardSha256:hash(card),observedAt,proof:proof?{path:proof.path,sha256:proof.sha256}:null,businessStatus:description?'SOURCE_TEXT':'UNKNOWN',postingStatus:'UNVERIFIED'};
 return validEnvelope(e,{now})?e:null;
}
function validate(candidate,options){
 if(!candidate||candidate.evidenceSource!=='CAPTURED_DISCOVERY'||candidate.evidenceVerified!==false||candidate.businessEvidenceApproved!==false||candidate.reviewedNeverConsider!==false||!validEnvelope(candidate.discoveryEvidence,options))return false;
 const c=candidate.discoveryEvidence.card,r=candidate.record;
 if(c.validThrough!=null&&Date.parse(c.validThrough)<=(options?.now??Date.now()))return false;
 if(!r||!require('../source-trial/evidence-store').sameRequisition(r,c)||identity(r).some((x,n)=>!x||x!==identity(c)[n])||!publicUrl(r.SOURCE_URL)||!publicUrl(candidate.evidenceUrl)||key(c.url)!==key(r.SOURCE_URL)||key(c.url)!==key(candidate.evidenceUrl))return false;
 return candidate.primaryBusiness===''||candidate.primaryBusiness===c.description;
}
module.exports={capture,validate,validEnvelope,hash,supported};
