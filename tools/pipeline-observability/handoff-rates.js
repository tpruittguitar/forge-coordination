'use strict';
// Durable, source-reviewed candidates handed to intake, separate from raw captures
// and from canonical admissions. No accepted/attempted write is a completion here.
const fs=require('fs'),path=require('path');
function summarize(events,now=Date.now(),coverage={}){
 const first=new Map();for(const e of events){const at=Date.parse(e.at);if(!e.id||!Number.isFinite(at)||at>now)continue;if(!first.has(e.id)||at<Date.parse(first.get(e.id)))first.set(e.id,e.at);}
 return {basis:'Distinct source-reviewed request identities durably handed to intake, using the earliest saved pre-submission snapshot. Not captures, admissions, or completed writes.',coverage,ratesByWindow:Object.fromEntries([6,12,24,36].map(h=>{const count=[...first.values()].filter(t=>now-Date.parse(t)<h*3600000).length;return[h,{count,windowHours:h,perHour:events.length?count/h:null,available:events.length>0,partial:true,unit:'reviewed candidates/hour'}];}))};
}
function build(root,now=Date.now()){
 const dir=path.join(root,'receipts/auto-intake'),events=[];let missingTimestamps=0;if(fs.existsSync(dir))for(const f of fs.readdirSync(dir).filter(x=>x.endsWith('.candidates.json'))){const stateFile=path.join(dir,f.replace('.candidates.json','.json'));if(!fs.existsSync(stateFile))continue;const state=JSON.parse(fs.readFileSync(stateFile)),at=state.snapshots?.before?.takenAt;if(!Number.isFinite(Date.parse(at))){missingTimestamps++;continue;}for(const c of JSON.parse(fs.readFileSync(path.join(dir,f))))if(c.evidenceVerified===true&&c.businessEvidenceApproved===true&&c.rulesHash){const id=require('../source-intake/production-executor').requestId(c.record);events.push({id,at});}}
 return summarize(events,now,{missingTimestamps,source:'receipts/auto-intake/*.candidates.json plus saved before snapshots'});
}
module.exports={build,summarize};
