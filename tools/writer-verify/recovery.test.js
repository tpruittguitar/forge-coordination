'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const R=require('./recovery');const now=new Date('2026-10-29T12:00:00Z'),sha='a'.repeat(40),at='2026-10-20T12:00:00Z';
const entry=(items,s='NOT_PERSISTED')=>({s,at,w:'W-OLD',items});
const item=(pid='V2I-1',a='a:10',b='b:10')=>({pid,op:'REPLACE',a,b});
const idx=requests=>({version:1,updatedAt:'2026-10-29T11:00:00Z',requests,pending:[]});
const row=(hash='a:10')=>({primaryId:'V2I-1',hash,sha256:'f'.repeat(64),readAt:now.toISOString(),location:'MASTER'});
const temp=()=>fs.mkdtempSync(path.join(os.tmpdir(),'recovery-'));
test('Writer hash matches real saved hash and is sensitive to exact row bytes',()=>{
 const text='1 | V2I-1 | Acme | Director | SCOUT_INTAKE | OPEN | P | R | Austin, TX | NOTE';
 assert.equal(R.textHash(text),'d8fde2dff7d79:77');assert.notEqual(R.textHash(text),R.textHash(text+' '));
});
test('an old NOT_PERSISTED can be proven by its exact saved after-image, without changing the canonical index',async()=>{
 const root=temp(),index=idx({'REQ-OLD':entry([item()])}),before=JSON.stringify(index);const r=await R.recover({root,index,sha,now,readRows:async()=>[row()]});
 assert.equal(r.cases[0].status,'PROVEN_PERSISTED');assert.equal(r.writerSubmissions,0);assert.equal(r.canonicalReceiptMutations,0);assert.equal(JSON.stringify(index),before);assert.ok(fs.existsSync(path.join(root,r.cases[0].evidenceFile)));assert.equal(r.summary.resolved,1);
});
test('a later COMPLETE hash chain can prove a changed row, but unrelated writes and conflicting aliases cannot',async()=>{
 const source=entry([item()]),index=idx({'REQ-OLD':source,'REQ-LATER':{s:'COMPLETE',at:'2026-10-21T12:00:00Z',w:'W-LATER',items:[item('V2I-1','c:10','a:10')]}}),c={requestId:'REQ-OLD',entry:source,bindings:[]};
 let r=await R.inspect(c,index,R.graph(index),async()=>[row('c:10')],{});assert.equal(r.status,'PROVEN_PERSISTED');assert.equal(r.rows[0].chain[0].requestId,'REQ-LATER');
 index.requests['REQ-LATER'].items[0].b='b:10';r=await R.inspect(c,index,R.graph(index),async()=>[row('c:10')],{});assert.equal(r.status,'ESCALATED');
 index.requests['REQ-LATER'].items[0].b='a:10';index.requests.CONFLICT={s:'NOT_PERSISTED',w:'W-LATER'};assert.equal((await R.inspect(c,index,R.graph(index),async()=>[row('c:10')],{})).status,'ESCALATED');
});
test('before-images, absent/duplicate rows, mixed batches and missing bindings never count as recovered',async()=>{
 const c={requestId:'REQ-OLD',entry:entry([item()]),bindings:[]},index=idx({'REQ-OLD':c.entry});
 for(const observed of [row('b:10'),{missing:true},{error:'DUPLICATE_ARCHIVE_ROW'}])assert.equal((await R.inspect(c,index,R.graph(index),async()=>[observed],{})).status,'ESCALATED');
 c.entry.items.push(item('V2I-2'));assert.equal((await R.inspect(c,index,R.graph(index),async()=>[row(),row('other:10')],{})).status,'ESCALATED');
 c.entry={s:'FALSE_COMPLETE',at};assert.equal((await R.inspect(c,index,R.graph(index),()=>{throw Error('No guessed IDs')},{})).reason,'SAVED_AFTER_IMAGE_BINDING_MISSING');
});
test('authenticated reads are GET only, bound to exact IDs and current or archived row hashes',async()=>{
 const line='1 | V2I-1 | Acme | Director | SCOUT_INTAKE | OPEN | P | R | Austin, TX | NOTE',actions=[];
 const reader=R.rowReader({key:'secret',transport:async(url,o)=>{const u=new URL(url);actions.push(u.searchParams.get('action'));assert.equal(o.method,'GET');return {ok:true,json:async()=>({ok:true,readAt:now.toISOString(),master:{endMarkerPresent:true},rows:[{primaryId:'V2I-1',found:true,matches:1,line,lineSha256:R.digest(line)}]})};}});
 const rows=await reader('REQ-OLD',['V2I-1']);assert.equal(rows[0].hash,R.textHash(line));await reader('REQ-OTHER',['V2I-1']);assert.deepEqual(actions,['row_readback']);
});
test('uncertain saved verification cases remain visible and bounded runs do not starve later cases',async()=>{
 const root=temp(),index=idx(Object.fromEntries(Array.from({length:5},(_,i)=>['REQ-'+i,{s:'FALSE_COMPLETE',at}])));const seen=new Set();
 for(let n=0;n<3;n++){const r=await R.recover({root,index,sha,now:new Date(+now+n*3600000),maxCases:2,readRows:()=>{throw Error('No guessed IDs')}});r.cases.forEach(c=>seen.add(c.requestId));assert.equal(r.deferred,3);}
 assert.equal(seen.size,5);
 fs.mkdirSync(path.join(root,'verify/requests'),{recursive:true});fs.writeFileSync(path.join(root,'verify/requests/CHATGPT-20261020-1200.json'),JSON.stringify({schema:'forge.writer-verify-request.v1',requested_by:'CHATGPT',requests:[{requestId:'REQ-UNBOUND',primaryIds:['V2I-1']}]}));
 assert.ok(R.candidates(root,index).some(c=>c.requestId==='REQ-UNBOUND'));assert.equal((await R.inspect({requestId:'REQ-UNBOUND',entry:null,bindings:[]},index,new Map(),null,{})).status,'ESCALATED');
});

test('GitHub source requires a matching blob revision and valid index, never a guessed raw branch snapshot',async()=>{
 const crypto=require('node:crypto'),raw=Buffer.from(JSON.stringify(idx({}))),blob=crypto.createHash('sha1').update(Buffer.from('blob '+raw.length+'\0')).update(raw).digest('hex');let calls=0;
 const transport=async(url,o)=>{assert.equal(o.method,undefined);calls++;return new Response(JSON.stringify(url.includes('/contents/')?{sha:blob}:{content:raw.toString('base64')}));};
 const source=await R.loadIndex({transport});assert.equal(source.sha,blob);assert.equal(calls,2);
 await assert.rejects(()=>R.loadIndex({transport:async()=>new Response(JSON.stringify({sha:'a'.repeat(40),content:raw.toString('base64')}))}),/integrity/);
});
test('terminal archive rows can be independently checked; duplicate archive identities cannot',async()=>{
 const line='1 | V2I-1 | Acme | Director | CLOSED_DEAD | CLOSED | P | R | Austin, TX | NOTE';
 const transport=async(url,o)=>{assert.equal(o.method,'GET');return {ok:true,json:async()=>new URL(url).searchParams.get('action')==='archive'?{ok:true,archiveId:'ARCHIVE',text:'V2_TERMINAL_ARCHIVE\n'+line}:{ok:true,readAt:now.toISOString(),master:{endMarkerPresent:true},rows:[{primaryId:'V2I-1',found:false,matches:0}]}};};
 const rows=await R.rowReader({key:'secret',transport})('REQ-OLD',['V2I-1']);assert.equal(rows[0].location,'TERMINAL_ARCHIVE');assert.equal(rows[0].hash,R.textHash(line));
});
test('a retained pending transaction supplies after-image bindings without fabricating receipt metadata',async()=>{
 const e={s:'NEEDS_RESOLUTION',at,w:'W-OLD'},index=idx({'REQ-OLD':e});index.pending=[{writeId:'W-OLD',writtenAt:at,requestIds:['REQ-OLD'],items:[item()]}];
 const c=await R.inspect({requestId:'REQ-OLD',entry:e,bindings:[]},index,R.graph(index),async()=>[row()],{});assert.equal(c.status,'PROVEN_PERSISTED');assert.equal(c.sourceEntry.items,undefined);assert.deepEqual(c.pendingBinding.items,[item()]);
});
