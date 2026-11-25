'use strict';
// Step 12: coordinates, moved out of the Writer. Uses the viewer's shared city table and state centroids
// (pipeline-scoring.js point()). Remote roles need no point. A miss records NOT_FOUND and the job moves on.
const {filled}=require('../store.cjs');
module.exports=function coordinates(job,ctx){
 if(filled(job,'LATITUDE')&&filled(job,'LONGITUDE'))return {status:'SKIP',reason:'ALREADY_RECORDED'};
 const mode=job.fields&&job.fields.REMOTE_HYBRID&&job.fields.REMOTE_HYBRID.value;
 if(mode==='REMOTE')return {status:'SKIP',reason:'NOT_NEEDED_REMOTE'};
 if(!ctx.viewer)throw Error('VIEWER_MODULES_REQUIRED');
 const pt=ctx.viewer.Scoring.point({LOCATION:job.location,payload:{}});
 if(!pt)return {status:'PASS',reason:'NOT_FOUND',fields:{GEOCODE_STATUS:{value:'NOT_FOUND',source:'PIPELINE_V2_CITY_TABLE'}}};
 const source=pt.approx?'PIPELINE_V2_STATE_CENTROID':'PIPELINE_V2_CITY_TABLE';
 return {status:'PASS',reason:pt.approx?'STATE_CENTROID':'CITY_TABLE',fields:{LATITUDE:{value:String(pt.lat),source},LONGITUDE:{value:String(pt.lon),source},GEOCODE_STATUS:{value:pt.approx?'APPROX_STATE':'OK',source}}};
};
