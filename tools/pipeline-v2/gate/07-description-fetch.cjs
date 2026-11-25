'use strict';
// Step 07: description fetch. Green (NOT_NEEDED) when the handed-over text is already a full posting.
// Otherwise one read of the public posting: ATS public APIs first (Greenhouse, Lever, Ashby), then the page.
// No usable text -> held for retry with DESCRIPTION_UNAVAILABLE (park time is an open question for Tim).
const MIN=300;
const BLOCKED=/captcha|sign in to view|verify you are human|access denied|enable javascript/i;
const strip=h=>String(h||'').replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi,' ').replace(/<br\s*\/?>|<\/(p|li|div|h\d)>/gi,'\n').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#39;|&rsquo;/g,"'").replace(/&quot;/g,'"').replace(/[ \t]+/g,' ').replace(/\n\s*\n+/g,'\n').trim();
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
 if(usable(job.description))return {status:'PASS',reason:'NOT_NEEDED'};
 if(ctx.network===false)return {status:'HOLD',reason:'DESCRIPTION_UNAVAILABLE:NETWORK_OFF'};
 let got;
 try{got=await fetchText(job.url,{fetch:ctx.fetch});}catch(e){return {status:'HOLD',reason:'DESCRIPTION_UNAVAILABLE:FETCH_ERROR',detail:String(e&&e.cause&&e.cause.code||e.name||e).slice(0,60)};}
 if(usable(got.text)){job.description=got.text.slice(0,20000);job.descriptionSource='FETCHED:'+got.kind;return {status:'PASS',reason:'FETCHED:'+got.kind};}
 return {status:'HOLD',reason:'DESCRIPTION_UNAVAILABLE:'+got.kind+(got.http?':HTTP_'+got.http:'')};
};
module.exports.apiUrl=apiUrl;module.exports.strip=strip;module.exports.usable=usable;
