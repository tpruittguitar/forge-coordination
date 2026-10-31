'use strict';
// Recover missed scheduler starts, never restart a running workflow or submit jobs.
function discoveryDue(report,runs,now=Date.now()){
 const at=Date.parse(report?.summary?.at);if(!Number.isFinite(at))return false;
 if(now-at<=5*3600000)return false;
 return !runs.some(r=>r.head_branch==='main'&&r.event!=='pull_request'&&(r.status!=='completed'||now-Date.parse(r.created_at)<90*60000));
}
async function main(){const {execFileSync:exec}=require('node:child_process'),fs=require('node:fs');
 const runs=JSON.parse(exec('gh',['api','repos/tpruittguitar/forge-coordination/actions/workflows/source-trial.yml/runs?branch=main&per_page=30'],{encoding:'utf8'})).workflow_runs;
 const report=JSON.parse(fs.readFileSync('state/source-trial-report.json'));
 if(discoveryDue(report,runs)){exec('gh',['workflow','run','source-trial.yml','--ref','main']);console.log('Dispatched one overdue read-only discovery pass');}else console.log('Discovery within cadence, recently attempted, or already running');
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1});
module.exports={discoveryDue};
