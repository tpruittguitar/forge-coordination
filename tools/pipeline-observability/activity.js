'use strict';
const fs=require('node:fs'),path=require('node:path');
const {loadIndex}=require('../writer-verify/recovery');
async function build({root=process.cwd(),now=Date.now(),load=loadIndex,aggregate}={}){
 const snapshot=await load();
 const age=now-Date.parse(snapshot.index.updatedAt);
 if(!Number.isFinite(age)||age < -120000)throw Error('Receipt index timestamp invalid');
 const recovery=JSON.parse(fs.readFileSync(path.join(root,'verify/recovery/latest.json'),'utf8'));
 const data=aggregate(snapshot.index,now,recovery);
 return {...data,schema:'forge.writer-activity.v1',source:{repo:'tpruittguitar/forge-writer-state',path:'PIPELINE_RECEIPT_INDEX.json',sha:snapshot.sha},publishedAt:new Date(now).toISOString()};
}
if(require.main===module){const fc=process.env.ACTIVITY_FC_DIR;if(!fc)throw Error('ACTIVITY_FC_DIR required');build({aggregate:require(path.resolve(fc,'pipeline-writer-activity.js')).aggregate}).then(data=>{const text=JSON.stringify(data);if(Buffer.byteLength(text)>256*1024)throw Error('Summary size budget exceeded');fs.writeFileSync('state/WRITER_ACTIVITY.json',text+'\n');console.log('Published compact receipt summary',text.length,'bytes');}).catch(e=>{console.error(e.message);process.exitCode=1});}
module.exports={build};
