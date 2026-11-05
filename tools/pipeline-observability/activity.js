'use strict';
const fs=require('node:fs'),path=require('node:path');
const {loadIndex}=require('../writer-verify/recovery');
async function build({root=process.cwd(),now=Date.now(),load=loadIndex,aggregate,hydrate=require("./activity-history").hydrate}={}){
 const snapshot=await load();
 const age=now-Date.parse(snapshot.index.updatedAt);
 if(!Number.isFinite(age)||age < -120000)throw Error('Receipt index timestamp invalid');
 const recovery=JSON.parse(fs.readFileSync(path.join(root,'verify/recovery/latest.json'),'utf8'));
 const data=aggregate(snapshot.index,now,recovery);
 if(data.rates36){try{const history=await hydrate({...snapshot.index,sourceSha:snapshot.sha},{root,now});const totals=aggregate(history.index,now,null);for(const key of ["rates36","today","recent","buckets","sources","coverage"])data[key]=totals[key];data.rates36.history={remaining:history.remaining,sources:history.sources,error:history.error};}catch(e){data.rates36.history={error:e.message};}try{data.rates36.discovery=require("./discovery-rate").build(root,now);}catch(e){data.rates36.discovery=null;data.rates36.discoveryError=e.message;}const partial=!!(data.rates36.history?.remaining||data.rates36.history?.error||data.rates36.metadataGaps);for(const k of ['intake','verification','enrichment'])if(data.rates36[k]){data.rates36[k].partial=partial;data.rates36[k].basis='Distinct jobs in independently COMPLETE Writer receipts within 36 elapsed hours; receipt history is not canonical stage-completion history.';}}
 return {...data,schema:'forge.writer-activity.v1',source:{repo:'tpruittguitar/forge-writer-state',path:'PIPELINE_RECEIPT_INDEX.json',sha:snapshot.sha},publishedAt:new Date(now).toISOString()};
}
if(require.main===module){const fc=process.env.ACTIVITY_FC_DIR;if(!fc)throw Error('ACTIVITY_FC_DIR required');build({aggregate:require(path.resolve(fc,'pipeline-writer-activity.js')).aggregate}).then(data=>{const text=JSON.stringify(data);if(Buffer.byteLength(text)>256*1024)throw Error('Summary size budget exceeded');fs.writeFileSync('state/WRITER_ACTIVITY.json',text+'\n');console.log('Published compact receipt summary',text.length,'bytes');}).catch(e=>{console.error(e.message);process.exitCode=1});}
module.exports={build};
