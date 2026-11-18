const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');const {hydrate,matches}=require('./activity-history');
test('history uses only exact current receipt binding, retains details and never upgrades failed state',async()=>{const root=fs.mkdtempSync(path.join(os.tmpdir(),'rate-history-'));fs.mkdirSync(path.join(root,'state'));const at=new Date().toISOString(),e={s:'COMPLETE',w:'W',at,snapshotHash:'H',items:[{pid:'P',op:'INSERT'}]};const entries={A:{entry:e,sha:'a'.repeat(40)},B:{entry:e,sha:'a'.repeat(40)}};fs.writeFileSync(path.join(root,'state/WRITER_ACTIVITY_DETAILS.json'),JSON.stringify({schema:'forge.activity-details.v1',entries}));const index={requests:{A:{...e,items:undefined},B:{...e,s:'NOT_PERSISTED',items:undefined}},sourceSha:'b'.repeat(40)};const r=await hydrate(index,{root,maxReads:0});assert.deepEqual(r.index.requests.A.items,e.items);assert.equal(r.index.requests.B.s,'NOT_PERSISTED');assert.equal(r.index.requests.B.items,undefined);assert.equal(index.requests.A.items,undefined);assert.equal(matches(e,{...e,w:'different'}),false);assert.equal(r.remaining,0);});

test('over-budget cache still returns hydrated inserts and writes at or under 2 MiB',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'rate-history-budget-'));
 fs.mkdirSync(path.join(root,'state'));
 const now=Date.now(),at=new Date(now-60000).toISOString(),pad='x'.repeat(80*1024);
 const insert={s:'COMPLETE',w:'W-INS',at,snapshotHash:'H',items:[{pid:'JOB-1',op:'INSERT'}]};
 const entries={KEEP:{entry:insert,sha:'a'.repeat(40)}};
 for(let i=0;i<30;i++){
  const t=new Date(now-(30-i)*3600*1000).toISOString();
  entries['OLD-'+i]={entry:{s:'COMPLETE',w:'W-OLD-'+i,at:t,snapshotHash:'H'+i,items:[{pid:'P'+i,op:'REPLACE',note:pad}]},sha:'a'.repeat(40)};
 }
 const cachePath=path.join(root,'state/WRITER_ACTIVITY_DETAILS.json');
 const raw=JSON.stringify({schema:'forge.activity-details.v1',entries});
 assert.ok(raw.length>2*1024*1024);
 fs.writeFileSync(cachePath,raw);
 const requests={KEEP:{s:'COMPLETE',w:'W-INS',at,snapshotHash:'H'}};
 for(let i=0;i<30;i++){
  const e=entries['OLD-'+i].entry;
  requests['OLD-'+i]={s:e.s,w:e.w,at:e.at,snapshotHash:e.snapshotHash};
 }
 const index={requests,sourceSha:'b'.repeat(40)};
 const r=await hydrate(index,{root,now,maxReads:0});
 assert.deepEqual(r.index.requests.KEEP.items,insert.items);
 assert.equal(r.remaining,0);
 assert.equal(index.requests.KEEP.items,undefined);
 assert.match(String(r.error||''),/budget exceeded/i);
 const written=fs.readFileSync(cachePath,'utf8');
 assert.ok(written.replace(/\n$/,'').length<=2*1024*1024);
 const kept=JSON.parse(written);
 assert.ok(kept.entries.KEEP);
 assert.deepEqual(kept.entries.KEEP.entry.items,insert.items);
});
