'use strict';
const test=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');

test('claimable source-supported grant partials go before unseen jobs, preserving eligibility and stable order',()=>{
 const src=fs.readFileSync(path.join(__dirname,'run.js'),'utf8');
 const ordering=src.slice(src.indexOf('    const canVisit=r=>!firstPass'),src.indexOf('    const addGrantRequest='));
 const prioritize=new Function('ordered','firstPass','productEvidence','Recovery','postingCache','Prepared','discoveryEvidence','require','SourceBlanks','bulkSource','completeGrantBatch','runtime','grantExtraction','blocked','validIdentity','rawNeeded','productNeeded','getProduct','Products','coverage','ledger',ordering+'return {grantOrder,getRetained};');
 const rows=['unseenA','blocked','seenReady','conflict','unseenB','newReady','unclaimable','wrongHalf','invalid'].map(PRIMARY_ID=>({PRIMARY_ID,p:{}}));
 const id=r=>r.PRIMARY_ID, cacheReads=new Map(), retained=new Set(['blocked','seenReady','conflict','newReady','unclaimable','wrongHalf','invalid']);
 const coverage={};
 const {grantOrder,getRetained}=prioritize(rows,{canClaim:k=>k!=='unclaimable',seen:k=>k==='seenReady'||k==='unclaimable'},()=>null,
  {combine:(x,y)=>x||y,cached:(_l,r)=>{cacheReads.set(id(r),(cacheReads.get(id(r))||0)+1);return retained.has(id(r))?{url:id(r)}:null}},
  {find:()=>null},{posting:(_r,x)=>x},null,()=>({forRow:()=>null}),{exactStoredPosting:()=>null,missing:()=>true,
   project:({capture,product})=>capture||product?{WORK_ARRANGEMENT:'ONSITE'}:{}},
  {routeConflict:(_r,url)=>url==='conflict'},true,{canStart:()=>true},
  {isEligibleId:k=>k!=='wrongHalf',rejectedProductSource:()=>undefined},r=>id(r)==='blocked',r=>id(r)!=='invalid',()=>true,()=>true,()=>null,{known:()=>false},coverage,{});
 a.deepEqual(grantOrder.map(id),['newReady','seenReady','unseenA','blocked','conflict','unseenB','wrongHalf','invalid','unclaimable']);
 a.equal(coverage.retainedReadyPriority,2);
 a.equal(getRetained(rows[2]).capture.url,'seenReady');
 a.equal(cacheReads.get('seenReady'),1);
 for(const k of ['blocked','unclaimable','wrongHalf','invalid'])a.equal(cacheReads.has(k),false,k);
 a.equal(getRetained(rows[3]).capture,null);
});
