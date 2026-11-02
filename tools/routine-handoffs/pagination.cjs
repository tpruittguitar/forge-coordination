'use strict';
const S=require('../programmed-coordinator/store.cjs'),L=require('../email-recovery/ledger.cjs'),{query}=require('../email-recovery/import-capture.cjs');
const position=url=>Number(new URL(url).searchParams.get('start')||0);
function observation(value,source){
 if(value?.schema!=='forge.result-page-observation.v1'||!['Chrome','TinyFish'].includes(value.browser)||value.complete!==true||!Number.isFinite(Date.parse(value.at))||query(value.url)!==query(source.url))throw Error('INCOMPLETE_OR_CHANGED_SOURCE_PAGE');
 if(!Array.isArray(value.jobs)||!value.next||typeof value.next.available!=='boolean')throw Error('INCOMPLETE_RESULTS_CONTROLS');
 const ids=new Set();for(const j of value.jobs){if(!/^\d+$/.test(j.jobId)||ids.has(j.jobId)||!Array.isArray(j.paragraphs)||j.paragraphs.length<3||j.paragraphs.slice(0,3).some(v=>typeof v!=='string'||!v.trim()))throw Error('AMBIGUOUS_RESULT_CARD');ids.add(j.jobId);}
 if(value.jobs.length===0&&value.emptyConfirmed!==true)throw Error('LOADING_OR_UNRENDERED_PAGE');
 if(value.next.available&&value.next.kind!=='RESULTS_NEXT')throw Error('UNSUPPORTED_PAGINATION_CONTROL');
 if(!value.next.available&&value.endConfirmed!==true)throw Error('RESULTS_END_NOT_PROVEN');
 return value;
}
function pageProof(value){return S.hash({url:L.safeUrl(value.url),jobs:value.jobs,next:value.next.available,empty:value.emptyConfirmed===true});}
function reconcileEmptyContinuation(source,progress,privateDir){
 const a=progress?.advance,sha=source.emptyEvidence?.sha256;if(source.status!=='HISTORICAL_RESULTS_UNAVAILABLE'||a?.status!=='OBSERVED'||!/^[a-f0-9]{64}$/.test(sha||''))return false;
 const after=S.read(privateDir,'result-pages/'+sha+'.json',null),prior=progress.observedPages.find(p=>p.position===position(a.fromUrl));if(!after||!prior||!/^[a-f0-9]{64}$/.test(prior.captureSha256||''))return false;
 const before=S.read(privateDir,'result-pages/'+prior.captureSha256+'.json',null);if(!before)return false;
 try{observation(before,source);observation(after,source);}catch{return false;}
 if(S.hash(after)!==sha||S.hash(before)!==prior.captureSha256||pageProof(after)!==a.pageProof||L.safeUrl(before.url)!==a.fromUrl||L.safeUrl(after.url)!==a.toUrl||!before.jobs.length||!before.next.available||!before.next.proof||after.jobs.length||!after.emptyConfirmed||after.next.available||position(after.url)<=position(before.url)||Date.parse(after.at)<Date.parse(before.at))return false;
 Object.assign(source,{status:'PROCESSING',exhausted:true,cursorState:'EXHAUSTED',nextPageRequired:false,lastPageUrl:a.toUrl,resumeUrl:a.toUrl,nextPagePosition:position(a.toUrl),emptyEvidence:{...source.emptyEvidence,observedContinuation:true}});return true;
}
// The adapter owns a dedicated browser page. The engine never guesses offsets,
// clicks unrelated Next controls, infers coverage from a report, or submits jobs.
async function drain({ledger,state,adapter,privateDir,save=async()=>{},now=()=>Date.now()}){
 state.sources=state.sources||{};state.exceptions=state.exceptions||{};
 for(const source of Object.values(ledger.sources))if(reconcileEmptyContinuation(source,state.sources[source.gmailId],privateDir))await save();
 for(const source of Object.values(ledger.sources))if(source.status==='NEEDS_BROWSER'&&!source.pages.length&&source.nextPageRequired===undefined){source.nextPageRequired=true;source.resumeUrl=source.url;source.nextPagePosition=position(source.url);}
 const queue=L.pendingSources(ledger).filter(s=>!state.sources[s.gmailId]?.retryAfter||Date.parse(state.sources[s.gmailId].retryAfter)<=now()).map(s=>s.gmailId);
 let pages=0,advances=0;
 while(queue.length){
  const id=queue.shift(),source=ledger.sources[id],progress=state.sources[id]||(state.sources[id]={observedPages:[],status:'PENDING'});
  if(!source.nextPageRequired)continue;
  let session;
  try{
   const resume=source.resumeUrl||source.lastPageUrl||source.url;
   // A prior uncertain click is a read-only recovery: reopen the saved captured
   // source page, reobserve, then activate its actual Next once. No page is skipped.
   session=await adapter.open({sourceId:id,url:progress.advance?.status==='IN_FLIGHT'?progress.advance.fromUrl:resume});
   let current=observation(await session.observe(),source);
   if(position(current.url)!==position(progress.advance?.status==='IN_FLIGHT'?progress.advance.fromUrl:resume))throw Error('UNEXPECTED_RESUME_POSITION');
   const capture=(value,continued=false)=>{
    const proof=pageProof(value),captureSha256=S.hash(value);
    S.immutable(privateDir,'result-pages/'+captureSha256+'.json',value);
    if(value.jobs.length)L.capture(ledger,{gmailId:id,url:value.url,at:value.at,jobs:value.jobs,next:value.next.available,endConfirmed:value.endConfirmed===true});
    else{source.nextPageRequired=false;source.cursorState=continued?'EXHAUSTED':'LIVE_EMPTY';source.status=continued?'PROCESSING':'HISTORICAL_RESULTS_UNAVAILABLE';source.exhausted=continued;source.emptyEvidence={sha256:captureSha256,at:value.at,observedContinuation:continued};source.lastObservedAt=value.at;source.lastPageUrl=L.safeUrl(value.url);source.resumeUrl=source.lastPageUrl;source.nextPagePosition=position(value.url);}
    if(!progress.observedPages.some(p=>p.sha256===proof)){progress.observedPages.push({sha256:proof,captureSha256,position:position(value.url),cards:value.jobs.length,at:value.at});pages++;}
    progress.status=value.next.available?'CAPTURED':'LIVE_EXHAUSTED';progress.lastProof=captureSha256;delete progress.retryAfter;delete state.exceptions[id];
    return proof;
   };
   const proof=pageProof(current);
   const priorAtPosition=progress.observedPages.find(p=>p.position===position(current.url));
   if(priorAtPosition&&priorAtPosition.sha256!==proof)progress.changedLivePage=true;
   // Identical IDs at a higher cursor mean a stale/repeated page, not progress.
   const ids=current.jobs.map(j=>'linkedin:'+j.jobId),last=source.pages.at(-1);
   if(last&&position(current.url)>position(last.url)&&ids.length&&JSON.stringify(last.jobKeys)===JSON.stringify(ids))throw Error('REPEATED_RESULTS_AT_NEW_CURSOR');
   capture(current);
   await save(); // Persist full captured cards before leaving the page.
   if(!current.next.available){delete progress.advance;continue;}
   progress.advance={status:'IN_FLIGHT',fromUrl:L.safeUrl(current.url),pageProof:proof,controlProof:current.next.proof||null};
   await save();
   const after=observation(await session.next({expectedUrl:current.url,controlProof:current.next.proof}),source);
   if(position(after.url)<=position(current.url)||query(after.url)!==query(current.url))throw Error('NEXT_DID_NOT_ADVANCE_SAME_RESULTS');
   const afterProof=pageProof(after);
   if(after.jobs.length&&JSON.stringify(ids)===JSON.stringify(after.jobs.map(j=>'linkedin:'+j.jobId)))throw Error('REPEATED_RESULTS_AT_NEW_CURSOR');
   L.advance(ledger,{gmailId:id,fromUrl:current.url,toUrl:after.url,at:after.at,paginationControl:'RESULTS_NEXT'});
   capture(after,true); // Cards are durable before rotation closes this browser page.
   progress.advance={status:'OBSERVED',fromUrl:L.safeUrl(current.url),toUrl:L.safeUrl(after.url),pageProof:afterProof};
   await save();advances++;queue.push(id); // Fair rotation; no page/run-count quota.
  }catch(e){
   progress.status='PENDING_EXCEPTION';progress.retryAfter=new Date(now()+(/^(RESULT_PAGE|RESULTS_NEXT)_CAPTURE_PENDING$/.test(e.message)?0:15*60000)).toISOString();
   state.exceptions[id]={owner:/AMBIGUOUS/.test(e.message)?'AI':'CODE',reason:/^[A-Z][A-Z0-9_]{3,100}$/.test(e.message||'')?e.message:'BROWSER_SOURCE_FAILURE',errorSha256:S.hash(e.message),sourceIdHash:S.hash(id),retryAfter:progress.retryAfter};
   await save();
  }finally{if(session)await session.close().catch(()=>{});}
 }
 return{pagesCaptured:pages,advances,sourcesWithPendingResults:L.pendingSources(ledger).length,coverageComplete:false,noProcessingCap:true};
}
module.exports={drain,observation,pageProof,position,reconcileEmptyContinuation};
