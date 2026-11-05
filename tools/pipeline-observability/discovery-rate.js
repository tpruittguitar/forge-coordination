'use strict';
// Compatibility call path: use the same all-source capture ledger as the main flow.
// A rolling source report is not a history of first discovery and cannot supply a fallback rate.
const fs=require('node:fs'),path=require('node:path');
function fromFlow(flow,now=Date.now()){
 const age=now-Date.parse(flow?.at),r=flow?.ratesByWindow?.[36]?.discovery||flow?.rates?.discovery;
 if(flow?.schema!=='forge.upstream-flow.v1'||flow.reconciled!==true||!Number.isInteger(flow.total)||flow.total!==flow.accounted||Object.values(flow.counts||{}).reduce((a,b)=>a+b,0)!==flow.total||!Number.isFinite(age)||age<0||age>30*60000||r?.unit!=='candidate identities'||r.windowHours!==36||!Number.isInteger(r.count)||r.count<0||!Number.isFinite(r.perHour)||Math.abs(r.perHour-r.count/36)>1e-9)throw Error('Discovery rate unavailable: current reconciled all-source capture history required');
 return {...r,hours:36,available:true,partial:true,sourceAt:flow.at,source:'state/UPSTREAM_FLOW.json'};
}
function build(root,now){return fromFlow(JSON.parse(fs.readFileSync(path.join(root,'state/UPSTREAM_FLOW.json'),'utf8')),now);}
module.exports={build,fromFlow};
