'use strict';
// True UTC to the second. An America/New_York clock with a Z suffix collides
// across the same civil hour and is not a unique request id.
function utcStamp(now=new Date()){
 const d=now instanceof Date?now:new Date(now);
 if(Number.isNaN(d.getTime()))throw Error('UTC_REQUEST_TIME_REQUIRED');
 const p=n=>String(n).padStart(2,'0');
 const stamp=''+d.getUTCFullYear()+p(d.getUTCMonth()+1)+p(d.getUTCDate())+'T'+p(d.getUTCHours())+p(d.getUTCMinutes())+p(d.getUTCSeconds())+'Z';
 if(!/^\d{8}T\d{6}Z$/.test(stamp))throw Error('UTC_REQUEST_TIME_REQUIRED');
 return stamp;
}
function grokRequestIds(now=new Date(),batch=1){
 if(!Number.isInteger(batch)||batch<1||batch>999)throw Error('GROK_BATCH_REQUIRED');
 const stamp=utcStamp(now),requestId=`FORGE-GROK-SHARED-${stamp}-B${String(batch).padStart(3,'0')}`;
 return {stamp,requestId,childRequestId:requestId+'-R001'};
}
if(require.main===module){
 try{console.log(JSON.stringify(grokRequestIds()));}
 catch(e){console.error(e.message);process.exitCode=1;}
}
module.exports={utcStamp,grokRequestIds};
