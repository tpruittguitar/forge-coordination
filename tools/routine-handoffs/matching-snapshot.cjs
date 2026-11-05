'use strict';
// Matching-only, invocation-local reuse. Exact verification reads are never cached.
function wrap(deps,clock=Date.now){let cached=null,readAt=0;const stats={reads:0,reused:0,invalidations:0};return{stats,deps:{...deps,async snapshot(){if(cached&&clock()-readAt>=0&&clock()-readAt<15000){stats.reused++;return cached;}stats.reads++;cached=await deps.snapshot();readAt=clock();return cached;},async post(payload){cached=null;stats.invalidations++;try{return await deps.post(payload);}finally{cached=null;}}}};}
module.exports={wrap};
