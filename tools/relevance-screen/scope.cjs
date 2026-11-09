'use strict';
// Optional narrowing only. Missing/invalid requested scope must never become a
// broad run; the existing source, ownership and original-request checks still run.
const path=require('node:path'),S=require('../programmed-coordinator/store.cjs');
const filename='intake-return-scope.json';
function save({privateDir,runId,keys}){
 if(!path.isAbsolute(privateDir)||!runId||!Array.isArray(keys)||keys.some(k=>typeof k!=='string'||!k))throw Error('INVALID_INTAKE_RETURN_SCOPE');
 S.save(privateDir,filename,{schema:'forge.intake-return-scope.v1',runId,keys:[...new Set(keys)]});
 return path.join(privateDir,filename);
}
function load({file=process.env.FORGE_INTAKE_SCOPE,privateDir=process.env.FORGE_PRIVATE_WORK_DIR,runId=process.env.FORGE_RUN_ID}={}){
 if(!file)return null;
 if(!privateDir||!path.isAbsolute(privateDir)||!runId||path.resolve(file)!==path.join(path.resolve(privateDir),filename))throw Error('INVALID_INTAKE_RETURN_SCOPE');
 const scope=S.read(privateDir,filename,null);
 if(scope?.schema!=='forge.intake-return-scope.v1'||scope.runId!==runId||!Array.isArray(scope.keys)||scope.keys.some(k=>typeof k!=='string'||!k))throw Error('INVALID_INTAKE_RETURN_SCOPE');
 return new Set(scope.keys);
}
module.exports={save,load};
