'use strict';

// Resolve routes before calling this tracker. Different saved URLs can name the
// same API/guest endpoint; fallback must not silently restart its retry budget.
function endpoint(raw) { const u=new URL(raw);u.hash='';return u.href; }
function provider(raw) {
  const host=new URL(raw).hostname;
  return ['linkedin','indeed','ziprecruiter'].find(p=>host===p+'.com'||host.endsWith('.'+p+'.com'))||null;
}
function transient(error) {
  if(error.code==='RUN_BUDGET')return false;
  if(error.status!=null)return [408,500,502,503,504].includes(error.status);
  return ['ETIMEDOUT','ECONNRESET','EAI_AGAIN','UND_ERR_CONNECT_TIMEOUT','UND_ERR_HEADERS_TIMEOUT','UND_ERR_BODY_TIMEOUT','UND_ERR_SOCKET'].includes(error.code||error.cause?.code)||error.name==='TimeoutError'||error instanceof TypeError&&error.message==='fetch failed';
}
// Per-run transport circuit for public origins outside the named aggregators.
// A 403 is not useful posting evidence. Do not spend every fallback slot on the
// same blocked site; another origin remains eligible. No persistent blacklist.
function originCircuit(limit=3){
 const failures=new Map(),key=url=>new URL(url).origin;
 return {allowed:url=>(failures.get(key(url))||0)<limit,
  failure(url,error){if(error.status===403)failures.set(key(url),(failures.get(key(url))||0)+1);},
  success:url=>failures.delete(key(url)),
  blocked:()=>Object.fromEntries([...failures].filter(([,n])=>n>=limit))};
}
function create({read,wait,canRead=()=>true,onAttempt=()=>{},onFailure=()=>{}}) {
  const attempted=new Set();
  return {
    has:raw=>attempted.has(endpoint(raw)),
    async read(raw,{gapMs=0,timeoutMs=30000,category='primary',...opts}={}) {
      const url=endpoint(raw);
      if(attempted.has(url))throw Object.assign(Error('Source endpoint already attempted'),{code:'SOURCE_ALREADY_ATTEMPTED'});
      attempted.add(url);
      // One explicit transient retry, never another attempt via fallback. Parse
      // failures, access blocks, 404s and provider walls are not retryable here.
      let delay=gapMs;
      for(let attempt=0;attempt<2;attempt++) {
        if(!canRead(url,delay+1,category))throw Object.assign(Error('Source read unavailable'),{code:'SOURCE_READ_UNAVAILABLE'});
        await wait(delay);
        if(!canRead(url,1,category))throw Object.assign(Error('Source read unavailable'),{code:'SOURCE_READ_UNAVAILABLE'});
        onAttempt(url,attempt,category);
        try {return await read(url,{...opts,signal:AbortSignal.timeout(timeoutMs)});}
        catch(error) {
          onFailure(url,error);
          if(attempt||!transient(error))throw error;
          delay=Math.max(gapMs,1000,Number(error.retryAfterMs)||0);
          if(!canRead(url,delay+1,category))throw error;
        }
      }
    }
  };
}
module.exports={endpoint,provider,transient,originCircuit,create};
