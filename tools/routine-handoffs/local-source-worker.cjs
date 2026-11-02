'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process'),S=require('../programmed-coordinator/store.cjs'),Q=require('./connector-queue.cjs');
const reason=e=>(e.message||'').match(/(?:^|Error: )([A-Z][A-Z0-9_]{3,100})(?:\n|$)/)?.[1]||'LOCAL_SOURCE_CAPTURE_FAILED';
function alive(pid){try{process.kill(pid,0);return true;}catch(e){return e.code!=='ESRCH';}}
function lockPath(config){if(!path.isAbsolute(config.privateDirectory||'')||!path.isAbsolute(config.connectorDirectory||''))throw Error('ABSOLUTE_PRIVATE_WORKER_PATHS_REQUIRED');return path.join(config.privateDirectory,'local-source-worker.lock.json');}
function acquire(config){const file=lockPath(config);const lock={pid:process.pid,token:crypto.randomUUID(),at:new Date().toISOString()};try{fs.writeFileSync(file,JSON.stringify(lock),{flag:'wx',mode:0o600});return lock;}catch(e){if(e.code==='EEXIST')return null;throw e;}}
function start(config,{spawn=cp.spawn}={}){const file=lockPath(config),old=S.read(config.privateDirectory,path.basename(file),null);if(old){const result={status:Number.isInteger(old.pid)&&alive(old.pid)?'ALREADY_RUNNING':'WORKER_LOCK_REQUIRES_RECONCILIATION'};S.save(config.privateDirectory,'local-source-worker-start.json',result);return result;}const configFile=path.join(config.privateDirectory,'local-source-worker.json');S.save(config.privateDirectory,path.basename(configFile),config);const child=spawn(process.execPath,[__filename,'run',configFile],{detached:true,windowsHide:true,stdio:'ignore'});child.on('error',e=>S.save(config.privateDirectory,'local-source-worker-start.json',{status:'PENDING',reason:reason(e)}));child.unref();return{status:'STARTED'};}
async function run(config,{browserConnect=require('./browser.cjs').connect}={}){
 const lock=acquire(config);if(!lock)return{status:'ALREADY_RUNNING'};
 const report={schema:'forge.local-source-worker.v1',startedAt:new Date().toISOString(),accepted:0,failures:[],noProcessingCap:true},directory=config.connectorDirectory;let browser;
 try{browser=await browserConnect({...config,connectorDirectory:undefined,localManaged:true});
  for(;;){const jobs=require('./connector-bridge.cjs').pending(directory).filter(j=>j.request.type==='RESULTS_PAGE'&&!j.run&&!fs.existsSync(path.join(directory,'failures',j.id+'.json')));if(!jobs.length)break;
   for(const job of jobs){let session;try{
    session=await browser.pagination.open({sourceId:job.request.sourceId,url:job.request.url});const before=await session.observe();S.immutable(directory,'local-observations/'+S.hash(before)+'.json',before);
    let after;if(before.next?.available){after=await session.next({expectedUrl:before.url,controlProof:before.next.proof});S.immutable(directory,'local-observations/'+S.hash(after)+'.json',after);}
    Q.accept(directory,job,{schema:'forge.browser-pagination-capture.v1',sourceId:job.request.sourceId,complete:true,before,...(after?{after,clickedControl:'RESULTS_NEXT'}:{})},crypto.randomUUID());report.accepted++;
   }catch(e){const failure={jobId:job.id,at:new Date().toISOString(),reason:reason(e)};S.save(directory,'failures/'+job.id+'.json',failure);report.failures.push(failure);}
   finally{await session?.close().catch(()=>{});S.save(config.privateDirectory,'local-source-worker-report.json',report);}
   }
  }
 }catch(e){report.failures.push({reason:reason(e)});}
 finally{await browser?.close().catch(()=>{});report.finishedAt=new Date().toISOString();S.save(config.privateDirectory,'local-source-worker-report.json',report);const current=S.read(config.privateDirectory,'local-source-worker.lock.json',null);if(current?.token===lock.token)fs.unlinkSync(lockPath(config));}
 return report;
}
if(require.main===module){if(process.argv[2]!=='run')throw Error('Use run with the private worker configuration');run(JSON.parse(fs.readFileSync(process.argv[3],'utf8'))).catch(()=>{process.exitCode=1;});}
module.exports={run,start,acquire};
