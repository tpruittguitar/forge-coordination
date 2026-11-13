'use strict';
const {isDeepStrictEqual:eq}=require('node:util');
const fail=()=>{throw Error('Semantic enrichment accounting conflict; preserve checkout and lock');};
const hash=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
function validate(w){
 const validated=require('../helper-routing/enrichment.cjs').validateWork(w);
 // Do not normalize away an invalid/mismatched raw owner during reconciliation.
 if(!eq(w,validated))fail();
 return new Map(w.items.map(i=>[i.primaryId,i]));
}
function metadata(w){const x={...w};delete x.items;return x;}
function snapshotDuplicate(left,right){
 // Only duplicate NEW assignments may differ in their whole-master observation.
 // Row identity, status, evidence binding and every unknown field remain atomic.
 const strip=i=>{const x=structuredClone(i);delete x.canonicalObservedAt;if(x.researchProvenance)delete x.researchProvenance.canonicalSourceSha256;return x;};
 if(!eq(strip(left),strip(right))||!hash(left.rowSha256)||!hash(left.researchProvenance?.sourceFingerprint)||left.researchProvenance?.schema!=='forge.enrichment-research-provenance.v1')fail();
 for(const i of [left,right])if(!hash(i.researchProvenance?.canonicalSourceSha256)||!Number.isFinite(Date.parse(i.canonicalObservedAt)))fail();
 const l=Date.parse(left.canonicalObservedAt),r=Date.parse(right.canonicalObservedAt);
 if(l===r)fail();
 return l>r?left:right;
}
function mergeEnrichmentWork(base,left,right){
 const [B,L,R]=[base,left,right].map(validate);
 if(!eq(metadata(base),metadata(left))||!eq(metadata(base),metadata(right)))fail();
 const result=structuredClone(base);result.items=[];
 for(const id of new Set([...B.keys(),...L.keys(),...R.keys()])){
  const b=B.get(id),l=L.get(id),r=R.get(id);let selected;
  if(b){
   if(!l||!r)fail(); // deletion of assignment/history requires explicit reconciliation
   if(eq(l,r))selected=l;else if(eq(l,b))selected=r;else if(eq(r,b))selected=l;else fail();
  }else if(!l)selected=r;else if(!r||eq(l,r))selected=l;else selected=snapshotDuplicate(l,r);
  result.items.push(structuredClone(selected));
 }
 validate(result);return result;
}
module.exports={mergeEnrichmentWork};
