'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const C=require('./consolidate.js'),root=path.resolve(__dirname,'../..');
const hash=t=>crypto.createHash('sha256').update(t).digest('hex');
test('historical repair preserves every original byte and supported field, and remains valid after consumption',()=>{
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'receipts/CHANGE_RECORD_REPAIRS/20261106-register-records.json'),'utf8'));
  a.equal(manifest.schema,'forge.change-record-repair.v1');a.match(manifest.sourceCommit,/^[a-f0-9]{40}$/);a.equal(manifest.records.length,126);
  const ledger=fs.readFileSync(path.join(root,C.LEDGER),'utf8'),register=fs.readFileSync(path.join(root,C.REGISTER),'utf8'),consumed=C.parseLedger(ledger).consumed;
  const records=manifest.records.map((r,order)=>{
    a.equal(r.source,C.RECORDS_DIR+'/'+r.id+'.txt');a.equal(r.archive,'receipts/CHANGE_RECORD_DETAILS/'+r.id+'.txt');
    const original=fs.readFileSync(path.join(root,r.archive));a.equal(hash(original),r.originalSha256);
    const parsed=C.parseRecord(original.toString('utf8'),r.id);a.deepEqual(parsed.errors,r.errors);
    const fields={...parsed.fields,WHAT:'Publication record '+r.id+'. Full original description and checkpoint evidence: '+r.archive+' (SHA-256 '+r.originalSha256+'). Registration does not verify canonical effects.'};
    const text=Object.entries(fields).map(([k,v])=>k+'='+v).join('\n')+'\n';a.equal(hash(text),r.correctedSha256);a.deepEqual(C.parseRecord(text,r.id).errors,[]);
    const file=path.join(root,r.source);if(fs.existsSync(file))a.equal(fs.readFileSync(file,'utf8'),text);else a.ok(consumed[r.id],'a removed repair must have a consumed-ID entry');
    return{id:r.id,text,order,pr:'direct',date:'2026-11-06'};
  });
  const first=C.consolidate({register,ledger,records});a.equal(first.rejected.length,0);a.equal(first.added.length+first.refused.length,126);a.ok(first.register.startsWith(register));a.ok(first.ledger.startsWith(ledger));
  const second=C.consolidate({register:first.register,ledger:first.ledger,records});a.equal(second.added.length,0);a.equal(second.register,first.register);a.equal(second.ledger,first.ledger);
});
