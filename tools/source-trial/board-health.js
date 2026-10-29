'use strict';
const P=require('../enrich-ats-pay/lib');
const ADDRESSES=require('./board-addresses.json');
const TRANSIENT=new Set([408,429,500,502,503,504]);
function repair(b){return b&&ADDRESSES[b.key]?{...b,...ADDRESSES[b.key],repairedFrom:b.key}:b;}
function failure(status){return status===401||status===403?'ACCESS_RESTRICTED':status===404||status===410||status===422?'ADDRESS_OR_REQUEST_ERROR':TRANSIENT.has(status)||!status?'TEMPORARY_FAILURE':'INVALID_RESPONSE';}
async function jsonRequest(req,{fetcher=fetch,wait=ms=>new Promise(r=>setTimeout(r,ms)),attempts=3}={}){
 let count=0;
 while(++count<=attempts){
  let r;
  try{r=await fetcher(req.url,{method:req.method||'GET',headers:{accept:'application/json',...(req.body?{'content-type':'application/json'}:{})},...(req.body?{body:req.body}:{}),signal:AbortSignal.timeout(20000)});}
  catch(e){if(count<attempts){await wait(500*2**(count-1));continue;}const err=Error('Connection timeout or network failure');err.attempts=count;throw err;}
  if(!r.ok){const header=r.headers?.get?.('retry-after'),seconds=Number(header),retryMs=header?Math.max(0,Number.isFinite(seconds)?seconds*1000:Date.parse(header)-Date.now()):0;
   if(TRANSIENT.has(r.status)&&count<attempts&&!(retryMs>20000)){await wait(Math.max(500*2**(count-1),Number.isFinite(retryMs)?retryMs:0));continue;}
   const err=Error('HTTP '+r.status);err.status=r.status;err.attempts=count;err.retryAfterMs=Number.isFinite(retryMs)?retryMs:0;throw err;
  }
  try{return {data:await r.json(),attempts:count};}catch{const err=Error('Invalid job-board response');err.status=r.status;err.attempts=count;throw err;}
 }
}
function validAnswer(b,j){return b.kind==='lever'?Array.isArray(j):b.kind==='workday'?Array.isArray(j?.jobPostings):Array.isArray(j?.jobs);}
// The tenant is public page configuration, not necessarily the hostname prefix. Never execute page JavaScript.
async function workdayConfig(b,fetcher=fetch){
 const r=await fetcher(`https://${b.host}/${b.site}`,{signal:AbortSignal.timeout(15000),headers:{accept:'text/html'}});
 if(!r.ok)return null;
 const html=await r.text();if(html.length>2*1024*1024)return null;
 const tenant=html.match(/\btenant\s*:\s*["']([A-Za-z0-9_-]+)["']/)?.[1],site=html.match(/\bsiteId\s*:\s*["']([A-Za-z0-9_-]+)["']/)?.[1];
 return tenant&&site&&site.toLowerCase()===b.site.toLowerCase()?{...b,tenant,site}:null;
}
async function readBoard(board,searches,{fetcher=fetch,wait=ms=>new Promise(r=>setTimeout(r,ms)),gapMs=0}={}){
 let b=board;const jobs=[],seen=new Set();let succeeded=0,failed=0,attempts=0,lastError=null,tenantRecovered=false;
 for(const search of b.kind==='workday'&&searches.length?searches:['']){
  await wait(gapMs);let answer;
  try{
   try{answer=await jsonRequest(P.boardListRequest(b,search),{fetcher,wait});}
   catch(e){if(b.kind!=='workday'||e.status!==422)throw e;
    let config=null;try{config=await workdayConfig(b,fetcher);}catch{}
    if(!config||config.tenant===b.tenant&&config.site===b.site)throw e;
    attempts+=e.attempts||1;b=config;tenantRecovered=true;answer=await jsonRequest(P.boardListRequest(b,search),{fetcher,wait});
   }
   attempts+=answer.attempts;if(!validAnswer(b,answer.data)){const e=Error('Unsupported job-board schema');e.status=200;throw e;}
   succeeded++;for(const job of P.parseBoard(b,answer.data)){const key=job.page||job.title;if(!seen.has(key)){seen.add(key);jobs.push(job);}}
  }catch(e){failed++;attempts+=e.attempts||0;lastError=e;break;} // do not repeat the same broken endpoint for all search words
 }
 return {board:b,jobs,succeeded,failed,attempts,tenantRecovered,error:lastError?String(lastError.message).slice(0,120):'',httpStatus:lastError?.status||null,retryAfterMs:lastError?.retryAfterMs||0,status:lastError?(succeeded?'PARTIAL':failure(lastError.status)):'OK'};
}
function loadState(text){if(!text)return {schema:'forge.board-health.v1',at:null,boards:{}};const s=JSON.parse(text);if(s.schema!=='forge.board-health.v1'||!s.boards||Array.isArray(s.boards))throw Error('Invalid board-health history; preserve it for recovery');return s;}
function record(state,b,result,at){
 const prev=state.boards[b.key]||{},ok=result.status==='OK',now=Date.parse(at),delay=Math.max(result.retryAfterMs||0,result.status==='ACCESS_RESTRICTED'?4*3600000:result.status==='ADDRESS_OR_REQUEST_ERROR'?6*3600000:15*60000);
 state.boards[b.key]={key:b.key,descriptor:{kind:b.kind,key:b.key,board:b.board,host:b.host,tenant:b.tenant,site:b.site,tier:b.tier||'',companies:[...b.companies]},companies:[...b.companies],lastAttemptAt:at,lastSuccessAt:ok?at:prev.lastSuccessAt||null,lastSuccessOpenings:ok?result.jobs.length:prev.lastSuccessOpenings??null,status:result.status,error:result.error,httpStatus:result.httpStatus,consecutiveFailures:ok?0:(prev.consecutiveFailures||0)+1,retryAt:ok?null:new Date(now+delay).toISOString(),attempts:result.attempts,pagesSucceeded:result.succeeded,pagesFailed:result.failed,repairedFrom:b.repairedFrom||null,evidenceUrl:b.evidenceUrl||null};
 state.at=at;return state.boards[b.key];
}
function recoveryBoards(state,paused,now=Date.now()){
 return Object.values(state.boards).filter(h=>h.status!=='OK'&&h.descriptor&&Date.parse(h.retryAt||0)<=now&&!h.companies.every(c=>paused.has(P.normCo(c)))).sort((a,b)=>Date.parse(a.lastAttemptAt)-Date.parse(b.lastAttemptAt)).map(h=>({...repair(h.descriptor),companies:new Set(h.companies),tier:h.descriptor.tier||''}));
}
function summary(state,paused){const rows=Object.values(state.boards).filter(h=>!h.companies.every(c=>paused.has(P.normCo(c))));return {tracked:rows.length,pending:rows.filter(h=>h.status!=='OK').length,unavailable:rows.filter(h=>h.status==='ACCESS_RESTRICTED'||h.status==='TEMPORARY_FAILURE').length};}
module.exports={repair,failure,jsonRequest,validAnswer,workdayConfig,readBoard,loadState,record,recoveryBoards,summary};
