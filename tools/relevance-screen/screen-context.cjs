'use strict';
// Reuse this run's private, already-read screening context. No external reads.
const fs=require('node:fs'),path=require('node:path');
function load({file=process.env.FORGE_DISCOVERY_SCREEN_CONTEXT,privateDir=process.env.FORGE_PRIVATE_WORK_DIR,runId=process.env.FORGE_RUN_ID,now=Date.now()}={}){
 if(!file||!privateDir||!runId||!path.isAbsolute(privateDir)||path.resolve(file)!==path.join(path.resolve(privateDir),'discovery-screen-context.json'))return null;
 try{const saved=JSON.parse(fs.readFileSync(file,'utf8')),at=Date.parse(saved.context?.checkedAt);return saved.runId===runId&&Number.isFinite(at)&&at<=now&&now-at<=15*60000?saved.context:null;}catch{return null;}
}
module.exports={load};
