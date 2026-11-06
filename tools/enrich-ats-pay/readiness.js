'use strict';
// An independently verified previous batch can release the delay early. Unknown
// readiness keeps the bounded delay; no writes, replays or relaxed fences here.
async function wait({probe,sleep,now=()=>Date.now(),maxMs=130000,pollMs=30000}){
 const start=now();let checks=0;
 for(;;){checks++;try{if(await probe())return{ready:true,waitedMs:now()-start,checks};}catch{}
  const left=maxMs-(now()-start);if(left<=0)return{ready:false,waitedMs:now()-start,checks};await sleep(Math.min(pollMs,left));
 }
}
module.exports={wait};
