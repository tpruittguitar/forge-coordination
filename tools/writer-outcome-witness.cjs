'use strict';
// Read-only rollout witness. This never POSTs, changes canonical state or clears
// a request fence. Capture the deployed source BEFORE replacing the Writer.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),vm=require('node:vm'),S=require('./programmed-coordinator/store.cjs'),O=require('./writer-outcome.cjs'),R=require('./source-intake/writer-reader');
async function capture({privateDir,requestId,response,deps,now=Date.now()}){
 const status=await deps.status();if(!/^[a-f0-9]{7,40}$/.test(status.build?.commit||''))throw Error('DEPLOYED_WRITER_SOURCE_REQUIRED');
 const source=await deps.source(status.build.commit);if(!O.legacyLock(response,source))throw Error('ORIGINAL_PRE_MUTATION_REFUSAL_NOT_PROVEN');
 const witness={schema:'forge.writer-refusal-witness.v1',requestId,acceptanceSha256:S.hash(response),capturedAt:new Date(now).toISOString(),writerCommit:status.build.commit,status,source,sourceSha256:S.hash(source)};
 const file='writer-refusal-witnesses/'+S.hash(response)+'.json',prior=S.read(privateDir,file,null);if(prior){if(prior.requestId!==requestId||prior.acceptanceSha256!==witness.acceptanceSha256||prior.sourceSha256!==witness.sourceSha256)throw Error('IMMUTABLE_WRITER_WITNESS_CONFLICT');return{file,writerCommit:prior.writerCommit,capturedAt:prior.capturedAt};}
 S.immutable(privateDir,file,witness);return{file,writerCommit:witness.writerCommit,capturedAt:witness.capturedAt};
}
if(require.main===module)(async()=>{
 const config=JSON.parse(fs.readFileSync(process.argv[2],'utf8')),requestId=process.argv[3];if(!/^FORGE-CODE-CHATGPT-[A-Za-z0-9_-]+$/.test(requestId||''))throw Error('EXACT_ORIGINAL_REQUEST_REQUIRED');
 const ctx={};vm.runInNewContext(fs.readFileSync(config.connectionFile,'utf8'),ctx);const response=S.read(config.privateDirectory,requestId+'-acceptance.json',null);if(!response)throw Error('ORIGINAL_RESPONSE_REQUIRED');
 const result=await capture({privateDir:config.privateDirectory,requestId,response,deps:{status:async()=>(await R.read('writer_status',{key:ctx.PipelineConnection.key})).data,source:async revision=>cp.execFileSync('git',['show',revision+':apps-script/Code.gs'],{cwd:config.cockpitDirectory,encoding:'utf8',maxBuffer:4e6,stdio:['ignore','pipe','pipe']})}});
 console.log(JSON.stringify({...result,writerSubmissions:0,canonicalChanges:0,fencesCleared:0}));
})().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={capture};
