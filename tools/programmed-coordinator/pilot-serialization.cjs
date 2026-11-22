'use strict';
// Cross-host Writer serialization for the direct pilot (protocol in ../writer-post-recheck.cjs).
// TIMMAY and the Ubuntu ATS runner share the GitHub-branch Writer POST lock. Reserve holds it from the
// first canonical read until the reservation is published on main; ATS rereads main under the same
// lock before every POST. establish() proves, before any reader/secret is loaded, that:
//  1. this clean current-main checkout carries the ATS recheck (protocol and marker present);
//  2. no enrich-ats-pay run is queued or in progress on a commit without that recheck;
//  3. for reserve, the shared lock is held by this invocation and still held at publication.
// No flag, config value or callback replaces this proof: check() accepts only a session made here.
const fs=require('node:fs'),path=require('node:path');
const Recheck=require('../writer-post-recheck.cjs'),PostLock=require('../writer-post-lock.cjs');
const ATS='tools/enrich-ats-pay/run.js',WORKFLOW='enrich-ats-pay.yml';
const SESSIONS=new WeakSet(),fail=c=>{throw Error(c);};
const unproven=()=>fail('CROSS_HOST_WRITER_SERIALIZATION_UNPROVEN');
const carries=text=>typeof text==='string'&&text.includes(Recheck.MARKER)&&text.includes("require('../writer-post-recheck.cjs').fromEnv()");
// GitHub capability built by the host from its own token. Never read from the checkout or a CLI argument.
function github({token,repo='tpruittguitar/forge-coordination',fetcher=globalThis.fetch}){
 const readFile=Recheck.githubReader({token,repo,fetcher});
 const headers={Accept:'application/vnd.github+json',Authorization:'Bearer '+token,'User-Agent':'forge-direct-pilot'};
 return {
  store:PostLock.githubStore({token,repo,fetcher}),
  readFile,
  async activeAtsShas(){
   const shas=new Set();
   for(const status of ['queued','in_progress','waiting','requested','pending']){
    const r=await fetcher('https://api.github.com/repos/'+repo+'/actions/workflows/'+WORKFLOW+'/runs?per_page=100&status='+status,{headers,signal:AbortSignal.timeout(20000)});
    if(r.status!==200)fail('ATS_RUN_LIST_UNREADABLE');
    const body=await r.json();if(!Array.isArray(body?.workflow_runs))fail('ATS_RUN_LIST_UNREADABLE');
    if(body.total_count>body.workflow_runs.length)fail('ATS_RUN_LIST_INCOMPLETE');
    for(const run of body.workflow_runs){if(!/^[a-f0-9]{40}$/.test(run.head_sha||''))fail('ATS_RUN_LIST_UNREADABLE');shas.add(run.head_sha);}
   }
   return [...shas];
  }
 };
}
async function establish({root,capability,hold,owner,lockOptions={}}){
 if(!capability||typeof capability.activeAtsShas!=='function'||typeof capability.readFile!=='function'||!capability.store)unproven();
 if(!carries(fs.readFileSync(path.join(root,ATS),'utf8')))unproven();
 for(const sha of await capability.activeAtsShas())if(!carries(await capability.readFile(ATS,sha)))fail('ATS_RUN_WITHOUT_PILOT_RECHECK_ACTIVE');
 const session={protocol:Recheck.PROTOCOL,held:false,store:capability.store,token:null,release:async()=>true};
 if(hold){
  const got=await PostLock.createLock({store:capability.store,owner,...lockOptions}).acquire();
  if(!got.ok)fail(got.reason==='LOCK_BUSY'?'WRITER_POST_LOCK_BUSY':'WRITER_POST_LOCK_UNAVAILABLE');
  Object.assign(session,{held:true,token:got.token,release:got.release});
  // A run may have started between the run listing and the acquire; recheck while holding the lock.
  try{for(const sha of await capability.activeAtsShas())if(!carries(await capability.readFile(ATS,sha)))fail('ATS_RUN_WITHOUT_PILOT_RECHECK_ACTIVE');}
  catch(e){await got.release();throw e;}
 }
 SESSIONS.add(session);return Object.freeze(session);
}
function check(session,{lock=false}={}){if(!session||!SESSIONS.has(session)||session.protocol!==Recheck.PROTOCOL||(lock&&!session.held))unproven();}
// Lock must still be ours (not taken over as stale) immediately before the reservation is published.
async function confirmHeld(session){
 check(session,{lock:true});
 let cur;try{cur=await session.store.read();}catch{unproven();}
 if(cur?.data?.token!==session.token)fail('WRITER_POST_LOCK_LOST');
}
async function end(session){if(session&&SESSIONS.has(session)&&session.held)await session.release();}
module.exports={establish,check,confirmHeld,end,github,carries,PROTOCOL:Recheck.PROTOCOL};
