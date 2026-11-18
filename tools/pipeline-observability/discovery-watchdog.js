'use strict';
// Recover missed scheduler starts, never restart a running workflow or submit jobs.
// A failing board (e.g. Dover) whose retryAt has passed is due for its retry even inside the normal 5 h cadence.
function boardRetryDue(health,now=Date.now()){return Object.values(health?.boards||{}).some(h=>h&&!h.paused&&h.status!=='OK'&&Date.parse(h.retryAt||0)<=now);}
function discoveryDue(report,runs,now=Date.now(),health=null){
 const at=Date.parse(report?.summary?.at);if(!Number.isFinite(at))return false;
 if(now-at<=5*3600000&&!boardRetryDue(health,now))return false;
 return !runs.some(r=>r.head_branch==='main'&&r.event!=='pull_request'&&(r.status!=='completed'||now-Date.parse(r.created_at)<90*60000));
}
function recover(exec,readReport,now=Date.now()){const dispatched=[];
 for(const [workflow,file] of [['source-trial.yml','state/source-trial-report.json'],['board-discovery.yml','state/board-discovery-report.json']]){
  const runs=JSON.parse(exec('gh',['api','repos/tpruittguitar/forge-coordination/actions/workflows/'+workflow+'/runs?branch=main&per_page=30'],{encoding:'utf8'})).workflow_runs,report=readReport(file);
  let health=null;if(workflow==='board-discovery.yml')try{health=readReport('state/board-health.json')}catch{}
  if(discoveryDue(report,runs,now,health)){exec('gh',['workflow','run',workflow,'--ref','main']);dispatched.push(workflow);}
 }return dispatched;
}
async function main(){const {execFileSync:exec}=require('node:child_process'),fs=require('node:fs');
 const dispatched=recover(exec,file=>JSON.parse(fs.readFileSync(file)));console.log(dispatched.length?'Dispatched overdue discovery: '+dispatched.join(', '):'Source and board discovery within cadence, recently attempted, or already running');
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1});
module.exports={discoveryDue,boardRetryDue,recover};
