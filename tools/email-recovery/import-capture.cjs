'use strict';
const crypto=require('node:crypto'),L=require('./ledger.cjs');
function query(value){const u=new URL(L.safeUrl(value));u.pathname=u.pathname.replace('/comm/','/');for(const k of ['start','currentJobId'])u.searchParams.delete(k);u.searchParams.sort();return u.href;}
// Import a complete saved browser batch atomically. The caller saves only the
// returned ledger. Never turn a loading page, changed filter or page cycle into
// successful coverage. A real empty page after Next ends current pagination;
// it does not retroactively prove historical email coverage.
function ingest(ledger,pages,{proof}){
 if(!proof||!Array.isArray(pages)||!pages.length)throw Error('Capture proof required');
 const next=structuredClone(ledger),observations=[];
 for(const page of pages){
  const s=next.sources[page.gmailId];if(!s||query(s.url)!==query(page.url))throw Error('Changed source filters');
  if(!['Edge','Chrome','TinyFish'].includes(page.browser)||!Number.isFinite(Date.parse(page.at)))throw Error('Missing observation provenance');
  if(!Array.isArray(page.jobs)||(!page.jobs.length&&!page.emptyConfirmed))throw Error('Unrendered results');
  const prior=s.pages.at(-1),sameIds=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  if(prior&&Number(new URL(page.url).searchParams.get('start')||0)>Number(new URL(prior.url).searchParams.get('start')||0)&&page.jobs.length&&sameIds(prior.jobKeys,page.jobs.map(j=>'linkedin:'+j.jobId)))throw Error('Repeated page at a later cursor');
  if(page.jobs.length)L.capture(next,page);
  else{
   if(page.next||!page.endConfirmed||!page.emptyConfirmed||!prior?.next||Number(new URL(page.url).searchParams.get('start')||0)<=Number(new URL(prior.url).searchParams.get('start')||0))throw Error('Empty page is not a proven continuation end');
   L.advance(next,{gmailId:page.gmailId,fromUrl:prior.url,toUrl:page.url,at:page.at,paginationControl:'RESULTS_NEXT'});
   s.nextPageRequired=false;s.exhausted=true;s.cursorState='EXHAUSTED';s.lastObservedAt=page.at;s.paginationEnd={at:page.at,url:L.safeUrl(page.url),proof,reason:'Rendered empty results reached through actual Next after captured nonempty pages'};
  }
  observations.push({gmailId:page.gmailId,at:page.at,url:L.safeUrl(page.url),cards:page.jobs.length,next:page.next,endConfirmed:page.endConfirmed,browser:page.browser,sha256:crypto.createHash('sha256').update(JSON.stringify(page)).digest('hex')});
 }
 return {ledger:next,observations};
}
module.exports={ingest,query};
