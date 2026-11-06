'use strict';
const fs=require('node:fs'),path=require('node:path'),S=require('../programmed-coordinator/store.cjs'),Reports=require('./reports.cjs'),Pagination=require('./pagination.cjs'),Assignments=require('./assignments.cjs'),L=require('../email-recovery/ledger.cjs');
const FILE='state/HELPER_TRANSPORT.json';
function settings(privateDir){const file=process.env.FORGE_HANDOFF_CONFIG||path.join(privateDir,'handoffs.json');return fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{inboxes:[{directory:path.join(privateDir,'helper-inbox'),pattern:'.*\\.(?:json|jsonl|md|txt|zip)$'},{directory:path.join(require('node:os').homedir(),'Downloads')}]};}
const reason=e=>/^[A-Z][A-Z0-9_]{3,100}$/.test(e.message||'')?e.message:'BROWSER_TOOL_FAILURE';
async function run({root,privateDir,commit,runId,apply,config=settings(privateDir),browserConnect=require('./browser.cjs').connect}){
 const state=S.read(root,FILE,Reports.empty()),ledger=S.read(root,'state/EMAIL_RECOVERY_QUEUE.json'),before=S.hash(ledger),result={imported:0,reportFeeds:[],pagination:null};
 const save=async()=>{if(apply){S.save(root,FILE,state);L.save(path.join(root,'state/EMAIL_RECOVERY_QUEUE.json'),ledger);}};
 if(apply){
  S.save(root,'state/HELPER_ROUTING_CURRENT.json',require('./routing.cjs').snapshot(root,commit));
  try{const D=require('./delivery.cjs'),token=require('node:child_process').execFileSync('gh',['auth','token'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();result.delivery=await D.collect({root,privateDir,commit,api:D.github(token)});for(const r of result.delivery.results){if(r.status==='PENDING')state.exceptions['delivery:'+r.pullRequest]={owner:'CODE',reason:r.reason,pullRequest:r.pullRequest,artifacts:r.pendingArtifacts||[],...(r.errorSha256?{errorSha256:r.errorSha256}:{})};else delete state.exceptions['delivery:'+r.pullRequest];}delete state.exceptions.delivery;}
  catch(e){state.exceptions.delivery={owner:'CODE',reason:'HELPER_DELIVERY_ROUTE_UNAVAILABLE',errorSha256:S.hash(e.message)};}
 }
 if(apply){
  result.directHandoffs=require('./direct-handoffs.cjs').consume(privateDir);
  for(const key of Object.keys(state.exceptions).filter(k=>k.startsWith('direct:')))delete state.exceptions[key];
  for(const item of result.directHandoffs.pending)state.exceptions['direct:'+item.sourceHash]={owner:'CODE',...item};
  result.imported+=Reports.scanInboxes({root,privateDir,state,commit,inboxes:config.inboxes||[],python:config.python}).imported;
 }
 if(apply&&config.browser?.connectorDirectory){result.connector=require('./connector-bridge.cjs').consume({directory:config.browser.connectorDirectory});for(const key of Object.keys(state.exceptions).filter(k=>k.startsWith('connector:')))delete state.exceptions[key];for(const failure of result.connector.failures)state.exceptions['connector:'+failure.jobId]={owner:'CODE',...failure};}
 let browser;
 try{
  if(!config.browser?.endpoint&&!config.browser?.connectorDirectory&&!config.browser?.localManaged)throw Error('SUPPORTED_BROWSER_ROUTE_UNAVAILABLE');
  browser=await browserConnect(config.browser);
  const homes=S.read(root,'control/AUTOMATION_OPERATING_MODEL.json');
  for(const feedConfig of config.reportFeeds||[]){
   const home=homes.external.find(h=>h.taskKey===feedConfig.taskKey&&h.id===feedConfig.automationId&&h.provider===feedConfig.provider);
   if(!home){state.exceptions['feed:'+feedConfig.taskKey]={owner:'CODE',reason:'FEED_NOT_CURRENT_REGISTERED_AUTOMATION'};continue;}
   if(config.nativeReportPolling!==true){
    // Drain already captured bodies once; never enqueue another native AI run
    // page. Unresolved historical coverage stays pending in the transport ledger.
    const packets=require('./connector-queue.cjs').packets(config.browser.connectorDirectory||privateDir,'NATIVE_REPORTS').filter(p=>p.request.taskKey===home.taskKey&&p.request.automationId===home.id&&p.request.provider===home.provider);
    if(apply)for(const packet of packets)for(const r of packet.data.reports||[])result.imported+=Reports.ingest({root,privateDir,state,commit,text:r.text,source:{provider:home.provider,taskKey:home.taskKey,id:r.id,complete:r.fullReportComplete}}).imported;
    result.reportFeeds.push({taskKey:home.taskKey,mode:'DIRECT_ARTIFACTS',nativePolling:false,historicalCoverageComplete:false});continue;
   }
   let feed;
   try{feed=await browser.feed(feedConfig);if(apply)result.reportFeeds.push(await Reports.collectFeed({feed,root,privateDir,state,commit,save}));delete state.exceptions['feed:'+feedConfig.taskKey];}
   catch(e){state.exceptions['feed:'+feedConfig.taskKey]={owner:'CODE',reason:reason(e),errorSha256:S.hash(e.message)};}
   finally{if(feed)await feed.close().catch(()=>{});}
  }
  if(apply)result.pagination=await Pagination.drain({ledger,state,adapter:browser.pagination,privateDir,save});
  delete state.exceptions.browser;
 }catch(e){state.exceptions.browser={owner:'CODE',reason:reason(e),errorSha256:S.hash(e.message),retryCondition:'Restore the existing supported browser connection; do not change sign-in or copy session credentials'};}
 finally{if(browser)await browser.close().catch(()=>{});}
 await save();
 const report={schema:'forge.routine-handoffs-report.v1',runId,at:new Date().toISOString(),...result,exceptions:Object.values(state.exceptions),sourceLedgerChanged:S.hash(ledger)!==before,noProcessingCap:true,writerSubmissions:0,browserConnected:!!browser};
 if(apply){S.save(root,'state/ROUTINE_HANDOFFS_REPORT.json',report);S.immutable(root,'receipts/'+runId+'_TRANSPORT.json',report);}
 else S.save(privateDir,'routine-handoffs-preview.json',report);
 return{report,state};
}
module.exports={run,settings};
