'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {checkFile}=require('./preflight.js');
function fixture(fn){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'forge-record-preflight-'));
 fs.mkdirSync(path.join(root,'control/changes'),{recursive:true});
 fs.writeFileSync(path.join(root,'control/CHANGE_RECORDS_CONSUMED.txt'),'# ledger\n');
 try{fn(root)}finally{fs.rmSync(root,{recursive:true,force:true})}
}
test('valid WHAT record passes',()=>fixture(root=>{
 const p='control/changes/chatgpt-20261024-0100-receipt.txt';
 fs.writeFileSync(path.join(root,p),'WHAT=Recorded email run\n');
 assert.deepEqual(checkFile(p,root),{ok:true,errors:[]});
}));
test('bare prose and empty WHAT fail',()=>fixture(root=>{
 const p='control/changes/chatgpt-20261024-0100-receipt.txt';
 fs.writeFileSync(path.join(root,p),'Recorded email run\n');
 const e=checkFile(p,root).errors.join(' | ');
 assert.match(e,/expected KEY=VALUE/);assert.match(e,/WHAT is required/);
}));
test('unsupported fields fail',()=>fixture(root=>{
 const p='control/changes/ChatGPT-20261024-0100-receipt.txt';
 fs.writeFileSync(path.join(root,p),'PROVIDER=ChatGPT\nWHAT=desc\n');
 const e=checkFile(p,root).errors.join(' | ');
 assert.match(e,/unknown key PROVIDER/);
}));
test('previously consumed identifier fails',()=>fixture(root=>{
 const p='control/changes/chatgpt-20261024-0100-receipt.txt';
 fs.writeFileSync(path.join(root,p),'WHAT=desc\n');
 fs.writeFileSync(path.join(root,'control/CHANGE_RECORDS_CONSUMED.txt'),'CONSUMED REV-1  chatgpt-20261024-0100-receipt  #1  2026-10-24\n');
 assert.match(checkFile(p,root).errors.join(' | '),/already consumed/);
}));
test('missing record fails',()=>fixture(root=>{
 assert.match(checkFile('control/changes/chatgpt-20261024-0100-missing.txt',root).errors.join(' | '),/unreadable/);
}));
