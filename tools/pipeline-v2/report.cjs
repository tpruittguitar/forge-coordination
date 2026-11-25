'use strict';
// Readable dry-run report: per-step counts and reasons, every drop with its reason, the Writer preview.
const fs=require('node:fs'),path=require('node:path');
const S=require('./store.cjs');
function write({store,dir,meta={}}){
 fs.mkdirSync(dir,{recursive:true});
 const jobs=store.jobs(),statuses=S.STEPS.map(s=>store.status(s.id)).filter(Boolean);
 const byState={};for(const j of jobs)byState[j.state]=(byState[j.state]||0)+1;
 const drops=jobs.filter(j=>j.state==='DROPPED').map(j=>({id:j.id,lane:j.lane,company:j.company,title:j.title,location:j.location,step:j.dropped.step,reason:j.dropped.reason,crafted:!!j.crafted}));
 const held=jobs.filter(j=>['HELD','PARKED'].includes(j.state)).map(j=>{const t=j.trail[j.trail.length-1]||{};return {id:j.id,company:j.company,title:j.title,step:t.step,reason:t.reason,crafted:!!j.crafted};});
 // Writer dry run: the row fields each enriched job would carry. Nothing is sent.
 const preview=jobs.filter(j=>j.state==='ENRICHING').map(j=>({id:j.id,company:j.company,title:j.title,location:j.location,url:j.url,lane:j.lane,fields:Object.fromEntries(Object.entries(j.fields).map(([k,v])=>[k,v.value])),sources:Object.fromEntries(Object.entries(j.fields).map(([k,v])=>[k,v.source]))}));
 const report={schema:'forge.pipeline-v2.dryrun-report.v1',card:'cs-bb7d087b',at:new Date().toISOString(),dryRun:true,writerCalls:0,meta,jobs:jobs.length,byState,steps:statuses.map(s=>({step:s.step,name:s.name,stage:s.stage,result:s.lastRun.result,counts:s.counts,reasons:s.reasons,queue:s.queue,schedule:s.schedule})),drops,held,writerPreview:preview.length};
 fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify(report,null,1)+'\n');
 fs.writeFileSync(path.join(dir,'writer-preview.json'),JSON.stringify(preview,null,1)+'\n');
 const md=['# Pipeline v2 dry run ('+report.at+')','','Card cs-bb7d087b. Dry run: 0 Writer calls, no master writes, every schedule disabled.','',
  'Jobs: '+jobs.length+' · '+Object.entries(byState).map(([k,v])=>k+' '+v).join(' · '),'','AI: '+meta.ai+' · scoring/FLEX/coordinates modules: '+meta.viewer,'',
  '## The 19 steps','','| # | Step | Stage | Result | In | Pass | Skip | Drop | Hold | Wait | Blocked | Fail | Queue (wait/retry/park) | Reasons |','|---|---|---|---|---|---|---|---|---|---|---|---|---|---|',
  ...report.steps.map(s=>'| '+[s.step,s.name,s.stage,s.result,s.counts.in,s.counts.pass,s.counts.skip,s.counts.drop,s.counts.hold,s.counts.wait,s.counts.blocked,s.counts.fail,s.queue.waiting+'/'+s.queue.retrying+'/'+s.queue.parked,Object.entries(s.reasons).map(([k,v])=>k+' '+v).join('; ')].join(' | ')+' |'),
  '','## Drops ('+drops.length+')','','| Step | Reason | Company | Title | Location | Lane | Crafted |','|---|---|---|---|---|---|---|',
  ...drops.sort((a,b)=>a.step.localeCompare(b.step)||a.reason.localeCompare(b.reason)).map(d=>'| '+[d.step,d.reason,d.company,d.title,d.location,d.lane,d.crafted?'yes':''].join(' | ')+' |'),
  '','## Held for retry ('+held.length+')','','| Step | Reason | Company | Title | Crafted |','|---|---|---|---|---|',...held.map(h=>'| '+[h.step,h.reason,h.company,h.title,h.crafted?'yes':''].join(' | ')+' |'),
  '','## Writer preview','',preview.length+' enriched jobs would be sent as rows (writer-preview.json). Nothing was sent.',''];
 fs.writeFileSync(path.join(dir,'report.md'),md.join('\n'));
 return report;
}
module.exports={write};
