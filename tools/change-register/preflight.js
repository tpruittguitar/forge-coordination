#!/usr/bin/env node
'use strict';
// Deterministic local preflight for Forge change records. Run BEFORE git push / PR creation.
// Usage: node tools/change-register/preflight.js control/changes/provider-yyyymmdd-hhmm-slug.txt
const fs = require('node:fs');
const path = require('node:path');
const {parseRecord, parseLedger, isRecordFile, recordId, LEDGER, RECORDS_DIR} = require('./consolidate.js');
function checkFile(file, root=process.cwd()) {
  const errors=[];
  const rel=path.relative(root,path.resolve(root,file)).split(path.sep).join('/');
  const name=path.posix.basename(rel);
  if(path.posix.dirname(rel)!==RECORDS_DIR || !isRecordFile(name) || !/^[a-z0-9][a-z0-9._-]{2,99}\.txt$/.test(name))
    errors.push('invalid change record path/filename: '+rel);
  let body;
  try {body=fs.readFileSync(path.join(root,rel),'utf8');} catch(e) {errors.push('record unreadable: '+e.message);}
  if(body!==undefined) errors.push(...parseRecord(body,recordId(name)).errors);
  let ledger='';
  try {ledger=fs.readFileSync(path.join(root,LEDGER),'utf8');} catch(e) {errors.push('consumed ledger unreadable: '+e.message);}
  if(ledger) {
    const used=parseLedger(ledger).consumed;
    if(used[recordId(name)]) errors.push('record name already consumed: '+recordId(name));
  }
  return {ok:errors.length===0,errors};
}
if(require.main===module){
  const files=process.argv.slice(2);
  if(!files.length){console.error('usage: node tools/change-register/preflight.js control/changes/<id>.txt');process.exit(2);}
  let failed=false;
  for(const file of files){
    const result=checkFile(file);
    if(result.ok)console.log('PASS '+file);
    else {failed=true; for(const e of result.errors)console.error('FAIL '+file+': '+e);}
  }
  process.exitCode=failed?1:0;
}
module.exports={checkFile};
