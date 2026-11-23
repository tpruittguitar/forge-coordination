'use strict';
// Lanes have no owner (Tim 2026-11-22). Whichever authorized provider's
// scheduler fires a lane runs it; the shared lane run lock keeps two providers
// from running the same lane at once. PROVIDER is recorded, never a gate.
const fs=require('node:fs'),path=require('node:path');
const FILE='control/AI_AUTOMATION_TASKS.json';
function read(root){return JSON.parse(fs.readFileSync(path.join(root,FILE),'utf8'));}
// Neutral launcher keys and old AI-named keys both resolve to the one record key.
function resolve(registry,key){
 if(typeof key!=='string'||!key)return null;
 const record=registry?.laneKeys?.[key]||key,task=registry?.tasks?.[record];
 return task?{key:record,task}:null;
}
// A registry from before the owner removal (no authorizedProviders) is read the
// old way, so historical instruction revisions validate exactly as they did.
const legacy=registry=>!Array.isArray(registry?.authorizedProviders);
function authorized(registry,provider){
 return typeof provider==='string'&&!legacy(registry)&&registry.authorizedProviders.includes(provider);
}
// Receipts written by a provider that has since left keep standing only for retired lanes.
function receiptProvider(registry,key,provider){
 const r=resolve(registry,key);
 if(!r||typeof provider!=='string'||!provider)return false;
 if(legacy(registry))return r.task.owner===provider;
 return authorized(registry,provider)||(r.task.retired===true&&(registry.formerProviders||[]).includes(provider));
}
module.exports={FILE,read,resolve,authorized,receiptProvider};
