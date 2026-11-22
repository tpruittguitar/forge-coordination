#!/usr/bin/env node
'use strict';
const path=require('node:path');
const {run}=require('./worker.cjs');
const {fixture}=require('./fixture.cjs');
const {reuseDegree}=require('./reuse.cjs');
async function main(args) {
  if(args.length!==2||args[0]!=='--dry-run') throw Error('Only --dry-run <private-checkpoint-directory> is enabled; live processing is blocked');
  const f=fixture(31);
  // First job demonstrates sufficient existing evidence: no simulated API call.
  f.adapter.reuse=async current=>current.row.PRIMARY_ID==='V2I-SYNTHETIC-0'?reuseDegree(current):null;
  console.log(JSON.stringify(await run({dir:path.resolve(args[1]),adapter:f.adapter,now:f.now}),null,2));
}
if(require.main===module) main(process.argv.slice(2)).catch(()=>{console.error('GRANT_WORKER_STOPPED: dry-run only; inspect the documented command and checkpoint.');process.exitCode=1;});
module.exports={main};
