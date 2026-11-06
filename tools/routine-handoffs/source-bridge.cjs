'use strict';
const fs=require('node:fs'),path=require('node:path'),Mail=require('./mail-connector.cjs'),Direct=require('./direct-handoffs.cjs');
function script(config){
 if(!path.isAbsolute(config.privateDirectory||'')||!path.isAbsolute(config.repositoryDirectory||''))throw Error('ABSOLUTE_BRIDGE_PATHS_REQUIRED');
 const mail=Mail.prepare(config),direct=Direct.prepare(config.privateDirectory);
 // No browser or model calls: only the existing Gmail/Drive connectors. Source
 // bodies go directly to private files, never back into a model's context.
 return '(async()=>{const r=await Promise.allSettled([('+Mail.host.toString()+')(tools,'+JSON.stringify(mail)+',('+require('./mail-content.cjs').toString()+')),('+Direct.host.toString()+')(tools,'+JSON.stringify(direct)+'),('+require('./calendar-connector.cjs').host.toString()+')(tools,'+JSON.stringify({directory:path.join(config.privateDirectory,'calendar-inbox')})+')]);return r.map((x,i)=>({source:["GMAIL","DIRECT_HANDOFFS","CALENDAR"][i],...(x.status==="fulfilled"?{result:x.value}:{status:"PENDING_SOURCE_ROUTE"})}));})()';
}
if(require.main===module){try{if(process.argv[2]!=='script')throw Error('Use script with the existing private coordinator configuration');console.log(script(JSON.parse(fs.readFileSync(process.argv[3],'utf8'))));}catch{console.error('SOURCE_BRIDGE_CONFIGURATION_REQUIRED');process.exitCode=1;}}
module.exports={script};
