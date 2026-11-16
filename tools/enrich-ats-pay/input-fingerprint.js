'use strict';
const crypto=require('node:crypto');
// Same JSON bytes as the previous Store.hash input, without constructing one
// expanded cache-sized string. Inputs are JSON data read from the existing stores.
function hash(value){
 const digest=crypto.createHash('sha256');
 function write(v){
  if(v===null||typeof v!=='object'){digest.update(JSON.stringify(v));return;}
  const array=Array.isArray(v);digest.update(array?'[':'{');let first=true;
  for(const key of array?v.keys():Object.keys(v)){
   const item=v[key];
   if(!array&&(item===undefined||typeof item==='function'||typeof item==='symbol'))continue;
   if(!first)digest.update(',');first=false;
   if(!array)digest.update(JSON.stringify(key)+':');
   if(array&&(item===undefined||typeof item==='function'||typeof item==='symbol'))digest.update('null');else write(item);
  }
  digest.update(array?']':'}');
 }
 write(value);return digest.digest('hex');
}
module.exports={hash};
