'use strict';
// Recover missed scheduler starts, never restart a running workflow or submit jobs.
function discoveryDue(report,runs,now=Date.now()){
 const at=Date.parse(report?.summary?.at);if(!Number.isFinite(at))return false;
 if(now-at<=5*3600000)return false;
 return !runs.some(r=>r.head_branch==='main'&&r.event!=='pull_request'&&(r.status!=='completed'||now-Date.parse(r.created_at)<90*60000));
}
function recover(exec,readReport,now=Date.now()){const dispatched=[];
 for(const [workflow,file] of [['source-trial.yml','state/source-trial-report.json'],['board-discovery.yml','state/board-discovery-report.json']]){
  const runs=JSON.parse(exec('gh',['api','repos/tpruittguitar/forge-coordination/actions/workflows/'+workflow+'/runs?branch=main&per_page=30'],{encoding:'utf8'})).workflow_runs,report=readReport(file);
  if(discoveryDue(report,runs,now)){exec('gh',['workflow','run',workflow,'--ref','main']);dispatched.push(workflow);}
 }return dispatched;
}
async function main(){const {execFileSync:exec}=require('node:child_process'),fs=require('node:fs');
 const dispatched=recover(exec,file=>JSON.parse(fs.readFileSync(file)));console.log(dispatched.length?'Dispatched overdue discovery: '+dispatched.join(', '):'Source and board discovery within cadence, recently attempted, or already running');
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1});
module.exports={discoveryDue,recover};
