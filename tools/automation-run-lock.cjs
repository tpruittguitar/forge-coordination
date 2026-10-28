// Local AI schedule exclusion. Fail closed: an abandoned lock needs reconciliation, never an automatic expiry.
'use strict';
const fs=require('node:fs'),path=require('node:path');
function lock(file,action,token){
 if(!path.isAbsolute(file)||!token||!/^[A-Za-z0-9_-]{8,160}$/.test(token))throw Error('Absolute lock path and run token required');
 if(action==='acquire'){
  fs.mkdirSync(path.dirname(file),{recursive:true});
  try{const fd=fs.openSync(file,'wx');try{fs.writeFileSync(fd,JSON.stringify({token,at:new Date().toISOString()}));}finally{fs.closeSync(fd);}return {acquired:true};}
  catch(e){if(e.code!=='EEXIST')throw e;return {acquired:false,reason:'Another or abandoned run owns the lock; do not remove or expire it'};}
 }
 const held=JSON.parse(fs.readFileSync(file,'utf8'));
 if(held.token!==token)throw Error('Lock belongs to a different run');
 if(action==='release'){fs.unlinkSync(file);return {released:true};}
 if(action==='check')return {owned:true,at:held.at};
 throw Error('Unknown lock action');
}
if(require.main===module){try{const [action,file,token]=process.argv.slice(2),r=lock(file,action,token);console.log(JSON.stringify(r));if(r.acquired===false)process.exitCode=2;}catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={lock};
