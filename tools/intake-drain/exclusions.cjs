'use strict';
// Negative research is a proposal, never a master mutation. The existing observer
// consumes independently verified evidence only after its live canonical read.
const S=require('../programmed-coordinator/store.cjs'),Source=require('../programmed-coordinator/source.cjs');
const FILE='reference/EXCLUSION_BUSINESS_EVIDENCE.json',ROLE_FILE='reference/EXCLUSION_ROLE_EVIDENCE.json';
const ROLE_RULES=new Set(['NC-005','NC-006']);
function roleDefinition(raw,id){
 const lines=String(raw).split(/\r?\n/).filter(l=>new RegExp('^- '+id+' [A-Z_]+:').test(l));
 return lines.length===1?lines[0]:null;
}
function roleMatches(b,card){return b.kind==='ROLE_TEMPLATE'&&card?.company===b.company&&card?.title===b.title&&ROLE_RULES.has(b.ruleId)&&! /manufactur|production|plant|factory|assembly|industrial|\bnpi\b|process engineering/i.test(card.title);}
const sha=s=>require('node:crypto').createHash('sha256').update(s).digest('hex');
function binding(root,rules,evidence,card){
 if(rules?.status!=='ACTIVE'||!rules.raw)throw Error('CURRENT_CANONICAL_RULES_REQUIRED');
 const defs=evidence?.kind==='ROLE_TEMPLATE'?S.read(root,ROLE_FILE,{entries:[]}).entries:S.read(root,FILE,{entries:[]}).entries;
 const b=defs.find(b=>b.company===evidence?.company&&b.ruleId===evidence?.ruleId&&b.url===evidence?.url&&b.quote===evidence?.quote&&b.kind===evidence?.kind&&(!b.kind||(b.title===evidence?.title&&roleMatches(b,card))));
 if(!b)throw Error('REVIEWED_EMPLOYER_BUSINESS_BINDING_REQUIRED');
 if(b.kind==='ROLE_TEMPLATE'){
  const d=roleDefinition(rules.raw,b.ruleId);
  if(!d||sha(d)!==b.definitionSha256||!d.startsWith('- '+b.ruleId+' '+b.category+':'))throw Error('ACTIVE_MATCHING_ROLE_RULE_REQUIRED');
  Source.publicUrl(b.url);return b;
 }
 const r=rules.rules?.find(r=>r.active&&r.ACTION==='DO_NOT_ADD'&&r.RULE_ID===b.ruleId&&r.CATEGORY===b.category&&sha(r.MATCH||'')===b.matchSha256);
 if(!r)throw Error('ACTIVE_MATCHING_EXCLUSION_RULE_REQUIRED');
 Source.publicUrl(b.url);return b;
}
function validate(r,item){
 if(item.fence||item.action==='RECONCILE_WRITER'||item.currentRepresentation||item.sourceConflict)throw Error('FENCED_OR_CONFLICTING_IDENTITY_CANNOT_EXCLUDE');
 const e=r.exclusionEvidence;
 if(!e||e.company!==item.card.company||typeof e.ruleId!=='string'||typeof e.quote!=='string'||e.quote.length<30||e.quote.length>12000)throw Error('EXACT_EMPLOYER_EXCLUSION_EVIDENCE_REQUIRED');
 Source.publicUrl(e.url);
 if(S.hash(r.originalCard)!==S.hash(item.card))throw Error('EXACT_ORIGINAL_CARD_REQUIRED');
}
async function verify(root,r,item,{rules,fetchPage=Source.page,cache=new Map(),now=Date.now()}={}){
 validate(r,item);const b=binding(root,rules,r.exclusionEvidence,r.originalCard);
 if(!cache.has(b.url))cache.set(b.url,fetchPage(b.url));
 const p=await cache.get(b.url);
 if(new URL(p.url).hostname!==new URL(b.url).hostname)throw Error('EMPLOYER_SOURCE_REDIRECT_REQUIRES_REVIEW');
 const text=Source.text(p.raw);
 if(b.kind==='ROLE_TEMPLATE'&&(!text.includes(b.company)||!text.includes(b.title)))throw Error('EXACT_ROLE_SOURCE_IDENTITY_REQUIRED');
 if(!text.includes(b.quote))throw Error('EXCLUSION_QUOTE_NOT_IN_INDEPENDENT_SOURCE');
 return{status:'READY_FOR_CONTROLLED_EXCLUSION',reviewSha256:S.hash(r),observedAt:new Date(now).toISOString(),sourceSha256:sha(p.raw),sourceUrl:p.url,bindingSha256:S.hash(b),rulesSha256:sha(rules.raw),sourceVersion:item.sourceVersion};
}
function approved(root,entry,{rules,rows,work,now=Date.now()}={}){
 // Master/archive are read by the existing caller. Protect any possibly matching
 // canonical job, not just exact worksite matches; no status/decision is changed.
 if(!Array.isArray(rows)||rows.some(r=>Source.employer(r.COMPANY)===Source.employer(entry.company)&&Source.norm(r.TITLE)===Source.norm(entry.title)))return null;
 work=work||load(root);const item=work.byAlias?work.byAlias.get(entry.key):Object.values(work.items).find(i=>i.key===entry.key||i.aliases?.includes(entry.key));
 if(!item||[item.key,...item.aliases||[]].some(k=>work.fences?.has(k))||item.fence||item.action==='RECONCILE_WRITER'||item.sourceConflict||item.currentRepresentation)return null;
 const proof=entry.exclusionProof||null,v=proof?.validation||item.validation;
 const ref=proof?.reviewPath||item.review?.path;
 if(!v||v.status!=='READY_FOR_CONTROLLED_EXCLUSION'||!ref)return null;
 try{
  const r=S.read(root,ref),b=binding(root,rules,r.exclusionEvidence,r.originalCard);
  if(ref!=='receipts/INTAKE_DRAIN/'+S.hash(r)+'.json'||r.outcome!=='EXCLUSION_CANDIDATE'||v.reviewSha256!==S.hash(r)||v.bindingSha256!==S.hash(b))return null;
  if(!proof&&(r.sourceVersion!==item.sourceVersion||v.sourceVersion!==item.sourceVersion||Date.parse(v.observedAt)>now||now-Date.parse(v.observedAt)>=86400000))return null;
  const c=r.originalCard;
  if(!c||['company','title','location'].some(k=>Source.norm(c[k])!==Source.norm(entry[k]))||c.url&&require('../pipeline-observability/upstream-flow').key(c.url)!==entry.key)return null;
  return{reviewPath:ref,validation:v,ruleId:b.ruleId,reason:b.kind==='ROLE_TEMPLATE'?'Independently verified exact-role exclusion; canonical identities protected':'Independently verified primary-business exclusion; canonical identities protected',canonicalWrites:0};
 }catch{return null;}
}
function load(root){const work=S.read(root,'state/INTAKE_DRAIN.json',{items:{}});work.fences=require('./queue.cjs').writerFences(root);work.byAlias=new Map();for(const i of Object.values(work.items))for(const k of [i.key,...i.aliases||[]])work.byAlias.set(k,i);return work;}
module.exports={binding,validate,verify,approved,load,roleDefinition,roleMatches};
