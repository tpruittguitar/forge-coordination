'use strict';
const Source=require('../programmed-coordinator/source.cjs');
const Recovery=require('./recovery'),L=require('./lib');

// An explicit foreign-country Workday posting route cannot support a US row.
// Do not guess geography from arbitrary company slugs or job-title text.
function routeConflict(row,url){
  if(!L.stateFrom(row.LOCATION)&&!/\b(?:USA|United States)\s*$/i.test(row.LOCATION||''))return false;
  try{
    const u=new URL(url),loc=decodeURIComponent(u.pathname.match(/\/job\/([^/]+)\//i)?.[1]||'');
    return /\.myworkdayjobs\.com$/i.test(u.hostname)&&/(?:^|[-_ ])(?:india|canada|mexico|china|germany|france|poland|brazil|japan|singapore|united-kingdom)$/i.test(loc);
  }catch{return false;}
}
function rejectedProposal(row,entry){
  if(!entry)return false;
  const product=String(entry.products?.[0]||''),quote=String(entry.provenance?.quote||'').trim().replace(/[.!]$/,'');
  return routeConflict(row,entry.sources?.[0])||
    /\b(?:plant|facility|site)$/i.test(product)&&quote.toLowerCase()==='our '+product.toLowerCase();
}
function make({privateDir,providerAllowed,canStart,gapMs=1500,verify=Source.verify,page=Source.page,transport=globalThis.fetch,wait=ms=>new Promise(r=>setTimeout(r,ms)),now=Date.now}){
  const visited=new Set(), budgetMs=90000;let attempts=0,physical=0,startedAt;
  const stats={attempts:0,requests:0,found:0,blockedIdentity:0};
  return {stats,async find(row,{off=[],skip=[]}={}){
    if(!canStart()||attempts>=16)return null;
    const routes=Recovery.urls(row).filter(url=>{
      if(routeConflict(row,url)||!Recovery.readableRoute(url,off)||skip.includes(url))return false;
      try{
        const u=new URL(Source.publicUrl(url));
        return u.pathname!=='/'&&!u.searchParams.has('token')&&!/docs\.google|drive\.google|mail\./i.test(u.hostname);
      }catch{return false;}
    }).slice(0,4);
    if(!routes.length)return null;
    const reqId=[row.p.REQ_ID,row.p.REQUISITION_ID].find(x=>/^[A-Za-z0-9][A-Za-z0-9_-]{2,80}$/.test(x||'')&&!/^(?:UNKNOWN|NONE|NA|TBD)$/i.test(x));
    let rowAttempts=0;
    const fetchPage=async target=>{
      if(!canStart()||attempts>=16||rowAttempts>=4||visited.has(target)||!providerAllowed(target))throw Error('GRANT_SOURCE_ROUTE_UNAVAILABLE');
      startedAt??=now();
      const remaining=budgetMs-(now()-startedAt);
      if(remaining<=gapMs)return Promise.reject(Error('GRANT_SOURCE_BUDGET'));
      visited.add(target);rowAttempts++;stats.attempts=++attempts;
      if(attempts>1)await wait(gapMs);
      const signal=AbortSignal.timeout(Math.min(8000,remaining-gapMs));
      const bounded=(url,opts)=>{
        if(physical>=16||signal.aborted||!providerAllowed(url))throw Error('GRANT_SOURCE_ROUTE_UNAVAILABLE');
        stats.requests=++physical;
        return transport(url,{...opts,signal:AbortSignal.any([signal,opts.signal])});
      };
      let abort;
      try{return await Promise.race([page(target,{transport:bounded}),new Promise((_,reject)=>{
        abort=()=>reject(Error('GRANT_SOURCE_TIMEOUT'));signal.addEventListener('abort',abort,{once:true});
      })]);}finally{signal.removeEventListener('abort',abort);}
    };
    try{
      const result=await verify({item:{sourceEvidence:{url:routes[0]}},sourceUrls:routes.slice(1),
        expected:{company:row.COMPANY,title:row.TITLE,location:row.LOCATION,...(reqId?{reqId}:{})},
        privateDir,requireRoleText:true,discovery:{find:()=>null},fetchPage});
      if(!result?.identityVerified||!routes.includes(result.sourceUrl)||routeConflict(row,result.sourceUrl)||
        typeof result.description!=='string'||result.description.length<300)return null;
      stats.found++;
      return {url:result.sourceUrl,at:result.observedAt,text:result.description,fullPosting:true,
        identityVerified:true,sourceIdentity:result.sourceIdentity,postingFacts:result.postingFacts,
        basis:'EMPLOYER_POSTED',pay:result.pay,payFacts:result.payFacts,payAmbiguous:result.payAmbiguous};
    }catch(e){if(/IDENTITY|REQUISITION.*CONFLICT/.test(e.message||''))stats.blockedIdentity++;return null;}
  }};
}
module.exports={make,routeConflict,rejectedProposal};
