#!/usr/bin/env node
'use strict';
// Create a small register entry; detailed run evidence belongs in receipts.
const fs=require('node:fs'),path=require('node:path');
const {parseRecord,parseLedger,recordId,isRecordFile,ID_RE,LEDGER,RECORDS_DIR}=require('./consolidate.js');
function writeRecord(file,fields,{root=process.cwd()}={}) {
  const target=path.resolve(root,file),rel=path.relative(root,target).split(path.sep).join('/'),name=path.posix.basename(rel);
  if(path.posix.dirname(rel)!==RECORDS_DIR||!isRecordFile(name)||!ID_RE.test(recordId(name)))throw Error('Invalid change record path');
  const entries=Object.entries(fields);
  if(entries.some(([k,v])=>/[\r\n=]/.test(k)||typeof v!=='string'||/[\r\n]/.test(v)))throw Error('Each change record field must be one line');
  const text=entries.map(([k,v])=>k+'='+v).join('\n')+'\n',parsed=parseRecord(text,recordId(name));
  if(parsed.errors.length)throw Error(parsed.errors.join('; '));
  const ledger=fs.readFileSync(path.join(root,LEDGER),'utf8');
  if(parseLedger(ledger).consumed[recordId(name)])throw Error('Change record name already consumed');
  fs.writeFileSync(target,text,{flag:'wx'}); // Never replace an existing record or run checkpoint.
  return rel;
}
if(require.main===module){
  const [file,flag,what,...extra]=process.argv.slice(2);
  try {
    if(!file||flag!=='--what'||!what||extra.length)throw Error('Usage: node tools/change-register/write.js control/changes/<unique-id>.txt --what "Brief publication summary"');
    console.log('Created '+writeRecord(file,{WHAT:what}));
  } catch(e){console.error(e.message);process.exitCode=1;}
}
module.exports={writeRecord};
