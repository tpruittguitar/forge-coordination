'use strict';
/* Workday box pass report (cards 14c6e4a, e51fff1): Workday roles read from the box land in
 * state/workday-box-pass-report.json; intake reads them beside the board-discovery report.
 * A missing or malformed file is a no-op recorded in stats, never fatal. */
const fs=require('node:fs'),path=require('node:path');
const FILE='state/workday-box-pass-report.json';
function load(root='.',file=FILE){
 const f=path.join(root,file);
 if(!fs.existsSync(f))return {roles:[],keys:new Set(),stat:{status:'MISSING',roles:0}};
 try{
  const j=JSON.parse(fs.readFileSync(f,'utf8'));
  if(!j||!Array.isArray(j.new_roles))throw Error('no new_roles list');
  const roles=j.new_roles.filter(r=>r&&r.company&&r.title&&r.url);
  return {roles,keys:new Set(roles.map(r=>require('./catch-up').id(r))),stat:{status:'READ',roles:roles.length,run:j.summary?.run||null,at:j.summary?.at||null}};
 }catch(e){return {roles:[],keys:new Set(),stat:{status:'MALFORMED',roles:0,error:String(e.message||e).slice(0,120)}};}
}
/* One role per intake request id, first list wins. */
function merge(...lists){const out=new Map(),id=require('./catch-up').id;for(const r of lists.flat())if(r&&!out.has(id(r)))out.set(id(r),r);return [...out.values()];}
module.exports={FILE,load,merge};
