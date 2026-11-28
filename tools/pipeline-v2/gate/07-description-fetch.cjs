'use strict';
// Step 07: description fetch. Green (NOT_NEEDED) when description text was handed over.
// Otherwise one read of the public posting: ATS public APIs first (Greenhouse, Lever, Ashby), then the page.
// No usable text -> held for retry with DESCRIPTION_UNAVAILABLE (park time is an open question for Tim).
const MIN=300;
const TextIdentity=require('../../enrich-ats-pay/text-identity');
const Recovery=require('../../enrich-ats-pay/recovery'),L=require('../../enrich-ats-pay/lib'),P=require('../../enrich-ats-pay/public-posting');
async function readExact(job,url,fetch=globalThis.fetch){
 const api=L.atsApi(url),r=await fetch(api?.api||url,{signal:AbortSignal.timeout(20000)});
 if(!r.ok)return {kind:api?.kind||'page',http:r.status,text:''};
 const row={COMPANY:job.company,TITLE:job.title,LOCATION:job.location};
 const posting=api?Recovery.exactApi(row,api,await r.json()):P.parse(await r.text(),row);
 return {kind:api?.kind||'page',text:posting?.text||''};
}
const BLOCKED=/captcha|sign in to view|verify you are human|access denied|enable javascript/i;
const strip=h=>String(h||'').replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi,' ').replace(/<br\s*\/?>|<\/(p|li|div|h\d)>/gi,'\n').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#39;|&rsquo;/g,"'").replace(/&quot;/g,'"').replace(/[ \t]+/g,' ').replace(/\n\s*\n+/g,'\n').trim();
function available(raw){
 const text=typeof raw==='string'?strip(raw):'';
 return !!text&&!/^(?:-|N\/A|NONE|UNKNOWN|NOT_AVAILABLE)$/i.test(text)&&!BLOCKED.test(text.slice(0,2000));
}
const usable=t=>t&&t.length>=MIN&&!BLOCKED.test(t.slice(0,2000));
function apiUrl(url){
 let m;
 if((m=url.match(/(?:boards|job-boards)\.greenhouse\.io\/([^/?#]+)\/jobs\/(\d+)/i)))return {kind:'greenhouse',url:`https://boards-api.greenhouse.io/v1/boards/${m[1]}/jobs/${m[2]}`};
 if((m=url.match(/jobs\.lever\.co\/([^/?#]+)\/([0-9a-f-]{36})/i)))return {kind:'lever',url:`https://api.lever.co/v0/postings/${m[1]}/${m[2]}`};
 if((m=url.match(/jobs\.ashbyhq\.com\/([^/?#]+)\/([0-9a-f-]{36})/i)))return {kind:'ashby',url:`https://api.ashbyhq.com/posting-api/job-board/${m[1]}`,jobId:m[2]};
 if((m=url.match(/linkedin\.com\/jobs\/view\/(?:[^/?#]*-)?(\d{6,})/i)))return {kind:'linkedin',url:`https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${m[1]}`};
 return {kind:'page',url};
}
async function fetchText(url,{fetch=globalThis.fetch}={}){
 const a=apiUrl(url);
 const r=await fetch(a.url,{signal:AbortSignal.timeout(20000),headers:{'User-Agent':'Mozilla/5.0 (forge pipeline-v2 read-only)'}});
 if(!r.ok)return {kind:a.kind,http:r.status,text:''};
 if(a.kind==='greenhouse'){const d=await r.json();return {kind:a.kind,http:r.status,text:strip(d.content&&d.content.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&amp;/g,'&'))};}
 if(a.kind==='lever'){const d=await r.json();return {kind:a.kind,http:r.status,text:strip([d.descriptionPlain||d.description,...(d.lists||[]).map(l=>l.text+'\n'+l.content),d.additionalPlain||''].join('\n'))};}
 if(a.kind==='ashby'){const d=await r.json();const j=(d.jobs||[]).find(x=>x.id===a.jobId);return {kind:a.kind,http:r.status,text:j?strip(j.descriptionHtml||j.descriptionPlain):''};}
 return {kind:a.kind,http:r.status,text:strip(await r.text())};
}
module.exports=async function descriptionFetch(job,ctx={}){
 if(job.fullPosting!==false&&available(job.description))return {status:'PASS',reason:'NOT_NEEDED'};
 const saved=TextIdentity.aggregator(job.url)&&ctx.discoveryEvidence?.employerText(job);
 if(saved&&usable(saved.doc.text)){
  job.description=saved.doc.text.slice(0,20000);job.descriptionSource=saved.doc.url;job.fullPosting=true;
  return {status:'PASS',reason:'SAVED_EMPLOYER_POSTING'};
 }
 if(ctx.network===false)return {status:'HOLD',reason:'DESCRIPTION_UNAVAILABLE:NETWORK_OFF'};
 const urls=[job.url,...TextIdentity.recoveryUrls(job.next).filter(url=>url!==job.url)];
 let outcome={status:'HOLD',reason:'DESCRIPTION_UNAVAILABLE:NO_READER'};
 for(const url of urls){
  if(!ctx.readPosting&&TextIdentity.aggregator(url)&&apiUrl(url).kind!=='linkedin')continue;
  let got;
  try{got=ctx.readPosting?await ctx.readPosting(url,{fetch:ctx.fetch}):url===job.url?await fetchText(url,ctx):await readExact(job,url,ctx.fetch);}
  catch(e){outcome={status:'HOLD',reason:'DESCRIPTION_UNAVAILABLE:FETCH_ERROR',detail:String(e?.cause?.code||e?.name||e).slice(0,60)};continue;}
  if(got.fullPosting!==false&&usable(got.text)){job.description=got.text.slice(0,20000);job.descriptionSource=url===job.url?'FETCHED:'+got.kind:url;job.fullPosting=true;return {status:'PASS',reason:'FETCHED:'+got.kind};}
  outcome={status:'HOLD',reason:'DESCRIPTION_UNAVAILABLE:'+got.kind+(got.http?':HTTP_'+got.http:'')};
 }
 return outcome;
};
module.exports.readExact=readExact;module.exports.apiUrl=apiUrl;module.exports.strip=strip;module.exports.usable=usable;module.exports.available=available;
