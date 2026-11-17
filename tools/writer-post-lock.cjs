'use strict';
/* Shared cross-runner lock for Writer POSTs. The intake executor and the enrich-ats-pay bot run on different GitHub runners,
 * so a local lock file cannot serialize them (tools/automation-run-lock.cjs only serves one machine). The lock is one file on a
 * dedicated branch, created atomically through the Contents API. A lock older than staleMs is taken over by compare-and-swap
 * on its blob sha, so a crashed runner cannot block the Writer forever. It brackets one POST, not a whole run.
 * Not enabled without a token and repository: tests and dry runs are unaffected. */
const BRANCH='forge-writer-post-lock',FILE='writer-post.lock.json';
const DEFAULTS={staleMs:12*60000,waitMs:10*60000,pollMs:5000};
function githubStore({token,repo,fetcher=globalThis.fetch,branch=BRANCH,file=FILE}){
 const base='https://api.github.com/repos/'+repo,headers={Accept:'application/vnd.github+json',Authorization:'Bearer '+token,'User-Agent':'forge-writer-post-lock','Content-Type':'application/json'};
 const call=async(method,url,body)=>{const r=await fetcher(base+url,{method,headers,body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(20000)});const text=await r.text();return {status:r.status,json:text?JSON.parse(text):null}};
 const enc=s=>Buffer.from(s).toString('base64');
 let ready=false;
 async function ensureBranch(){
  if(ready)return;
  const ref=await call('GET','/git/ref/heads/'+branch);
  if(ref.status===404){
   const tree=await call('POST','/git/trees',{tree:[{path:'README.md',mode:'100644',type:'blob',content:'Holds the Writer POST lock file. Not part of the pipeline.\n'}]});
   const commit=await call('POST','/git/commits',{message:'Create Writer POST lock branch',tree:tree.json?.sha,parents:[]});
   const made=await call('POST','/git/refs',{ref:'refs/heads/'+branch,sha:commit.json?.sha});
   if(made.status!==201&&made.status!==422)throw Error('lock branch create failed: HTTP '+made.status);
  }else if(ref.status!==200)throw Error('lock branch read failed: HTTP '+ref.status);
  ready=true;
 }
 return {
  async read(){await ensureBranch();const r=await call('GET','/contents/'+file+'?ref='+branch);if(r.status===404)return null;if(r.status!==200)throw Error('lock read failed: HTTP '+r.status);return {sha:r.json.sha,data:JSON.parse(Buffer.from(r.json.content,'base64').toString('utf8'))}},
  async create(data){await ensureBranch();const r=await call('PUT','/contents/'+file,{message:'Writer POST lock acquire',content:enc(JSON.stringify(data)),branch});if(r.status===201||r.status===200)return true;if(r.status===422||r.status===409)return false;throw Error('lock create failed: HTTP '+r.status)},
  async replace(sha,data){const r=await call('PUT','/contents/'+file,{message:'Writer POST lock take over',content:enc(JSON.stringify(data)),branch,sha});if(r.status===200||r.status===201)return true;if(r.status===409||r.status===422)return false;throw Error('lock replace failed: HTTP '+r.status)},
  async remove(sha){const r=await call('DELETE','/contents/'+file,{message:'Writer POST lock release',sha,branch});if(r.status===200)return true;if(r.status===404||r.status===409||r.status===422)return false;throw Error('lock release failed: HTTP '+r.status)}
 };
}
function createLock({store,owner,staleMs=DEFAULTS.staleMs,waitMs=DEFAULTS.waitMs,pollMs=DEFAULTS.pollMs,now=Date.now,sleep=ms=>new Promise(r=>setTimeout(r,ms))}){
 const ownerId=String(owner||'unknown').slice(0,120);
 async function tryOnce(token){
  const data={token,owner:ownerId,at:new Date(now()).toISOString()};
  const held=await store.read();
  if(!held)return (await store.create(data))?{sha:null}:null;
  const age=now()-Date.parse(held.data?.at);
  if(Number.isFinite(age)&&age<staleMs)return null;
  return (await store.replace(held.sha,data))?{sha:null,tookStale:{owner:held.data?.owner,at:held.data?.at}}:null;
 }
 async function acquire(){
  const token=ownerId+'-'+now()+'-'+Math.random().toString(36).slice(2,10),deadline=now()+waitMs;
  for(;;){
   let got=null;
   try{got=await tryOnce(token)}catch(e){return {ok:false,reason:'LOCK_STORE_ERROR',error:String(e.message).slice(0,160),release:async()=>false}}
   if(got){
    let released=false;
    return {ok:true,token,tookStale:got.tookStale||null,async release(){
     if(released)return true;released=true;
     try{const cur=await store.read();if(cur&&cur.data?.token===token)return await store.remove(cur.sha)}catch{}
     return false;
    }};
   }
   if(now()+pollMs>deadline)return {ok:false,reason:'LOCK_BUSY',release:async()=>false};
   await sleep(pollMs);
  }
 }
 return {acquire};
}
function fromEnv(env=process.env,options={}){
 const token=env.GITHUB_TOKEN||env.GH_TOKEN,repo=env.GITHUB_REPOSITORY;
 if(!token||!repo||env.FORGE_WRITER_POST_LOCK==='off')return null;
 return createLock({store:githubStore({token,repo}),owner:(env.GITHUB_WORKFLOW||'run')+'-'+(env.GITHUB_RUN_ID||process.pid),...options});
}
module.exports={createLock,githubStore,fromEnv,BRANCH,FILE,DEFAULTS};
