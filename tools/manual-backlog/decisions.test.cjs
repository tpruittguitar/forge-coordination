const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const D=require('./decisions.cjs');
const entry={key:'linkedin:123',company:'Example',title:'Accountant',location:'Boston',sourceUrl:'https://www.linkedin.com/jobs/view/123/',status:'WAITING'};
const request={schema:'forge.manual-backlog-request.v1',requestId:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',snapshotRevision:'a'.repeat(40),decision:'DELETE',items:[{key:entry.key}]};request.receiptId=D.hash(D.normalize(request));
function root(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'manual-backlog-'));fs.mkdirSync(path.join(dir,'state'));fs.writeFileSync(path.join(dir,'state/INTAKE_DRAIN.json'),JSON.stringify({items:{}}));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return dir;}
function prepare(t,e=entry,rows=[]){return D.prepare(root(t),[request],{ledger:{entries:{[e.key]:e}},rows,snapshotReader:()=>new Map([[entry.key,D.card(entry)]])});}
test('exact selected candidate is independently permitted, history retained, zero canonical writes',t=>{const p=prepare(t);const proof=D.approved(entry,p);assert.equal(proof.decision,'DELETE');assert.equal(p.receipts[0].canonicalWrites,0);assert.equal(p.receipts[0].items[0].status,'HELD');});
test('canonical same role, fences, held identity and changed source are not excluded',t=>{assert.equal(prepare(t,entry,[{COMPANY:'Example',TITLE:'Accountant'}]).decisions.size,0);for(const status of ['HELD','PRESENT','IDENTITY_HOLD','MISSING_PREVIOUSLY_PRESENT'])assert.equal(prepare(t,{...entry,status}).decisions.size,0);assert.equal(prepare(t,{...entry,title:'Changed'}).receipts[0].items[0].status,'STALE');const p=prepare(t);p.fences.set(entry.key,{});assert.equal(D.approved(entry,p),null);});
test('remote and multi-location user selections are explicit, not geographic inference',t=>{const p=prepare(t);assert.ok(D.approved(entry,p));assert.equal(D.approved({...entry,location:'Remote'},p),null);assert.equal(D.approved({...entry,location:'Boston or Atlanta'},p),null);});
test('receipt completes only from matching independent observer result',t=>{const dir=root(t),p=D.prepare(dir,[request],{ledger:{entries:{[entry.key]:entry}},rows:[],snapshotReader:()=>new Map([[entry.key,D.card(entry)]])});D.publish(dir,p,{summary:{reconciled:true},ledger:{at:'now',entries:{[entry.key]:{...entry,status:'EXCLUDED',manualDecision:p.decisions.get(entry.key)}}}});const receipt=JSON.parse(fs.readFileSync(path.join(dir,'receipts/manual-backlog',request.receiptId+'.json')));assert.equal(receipt.items[0].status,'APPLIED');assert.equal(receipt.canonicalWrites,0);});
test('receipt mismatches and canonical keys rejected',t=>{assert.throws(()=>D.normalize({...request,items:[{key:'V2A-123'}]}));assert.throws(()=>D.prepare(root(t),[{...request,receiptId:'f'.repeat(64)}],{ledger:{entries:{}},rows:[]}));});
test('real observer excludes selected waiting row, preserves canonical priority and later proof',t=>{const U=require('../pipeline-observability/upstream-flow');const p=prepare(t),prior={entries:{[entry.key]:entry},groups:{[entry.key]:{status:'WAITING',aliases:[entry.key]}}};const observed=U.build({records:[],rows:[],prior,manualContext:p});assert.equal(observed.ledger.entries[entry.key].status,'EXCLUDED');assert.equal(observed.summary.waiting,0);assert.equal(observed.summary.reconciliation.excluded,1);const again=U.build({records:[],rows:[],prior:observed.ledger,manualContext:{...p,decisions:new Map()}});assert.equal(again.ledger.entries[entry.key].status,'EXCLUDED');const protectedRun=U.build({records:[],rows:[{PRIMARY_ID:'V2A-1',COMPANY:entry.company,TITLE:entry.title,LOCATION:entry.location,p:{}}],prior:observed.ledger,manualContext:p});assert.equal(protectedRun.ledger.entries[entry.key].status,'PRESENT');});
test('rolling deployment tolerates missing endpoint and Pages HTML fallback only',async t=>{const dir=root(t);for(const response of [new Response('',{status:404}),new Response('<html/>',{headers:{'content-type':'text/html'}})])assert.deepEqual(await D.load(dir,{key:'test',fetchImpl:async()=>response}),[]);await assert.rejects(D.load(dir,{key:'test',fetchImpl:async()=>new Response('{}',{status:500})}));});
test('multiple batches reuse one immutable snapshot read',t=>{const dir=root(t);let reads=0;const second={...request,requestId:'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'};second.receiptId=D.hash(D.normalize(second));D.prepare(dir,[request,second],{ledger:{entries:{[entry.key]:entry}},rows:[],snapshotReader:()=>{reads++;return new Map([[entry.key,D.card(entry)]]);}});assert.equal(reads,1);});
test('Indeed source identities normalize and complete without a new fit review',t=>{
 const U=require('../pipeline-observability/upstream-flow'),key=U.key('https://www.indeed.com/viewjob?jk=860163fdd4b3ab44');
 assert.equal(key,'indeed:860163fdd4b3ab44');
 const e={...entry,key,sourceUrl:'https://www.indeed.com/viewjob?jk=860163fdd4b3ab44',preliminaryScreen:{decision:'HOLD'},relevanceScreen:{outcome:'HOLD'}};
 const r={...request,items:[{key}]};r.receiptId=D.hash(D.normalize(r));const dir=root(t);
 const p=D.prepare(dir,[r],{ledger:{entries:{[key]:e}},rows:[],snapshotReader:()=>new Map([[key,D.card(e)]])});
 const up=U.build({records:[],rows:[],prior:{entries:{[key]:e},groups:{[key]:{status:'WAITING',aliases:[key]}}},manualContext:p});
 D.publish(dir,p,up);const receipt=JSON.parse(fs.readFileSync(path.join(dir,'receipts/manual-backlog',r.receiptId+'.json')));
 assert.equal(receipt.items[0].status,'APPLIED');assert.equal(receipt.canonicalWrites,0);
});
test('mixed supported identities keep unresolved and canonical references held per item',t=>{
 const entries=[entry,{...entry,key:'indeed:860163fdd4b3ab44',status:'HELD',evidenceStatus:'EXISTING_PROTECTED'},
  {...entry,key:'unresolved:'+'a'.repeat(24),status:'IDENTITY_HOLD'}, {...entry,key:'pid:V2I-04D2C53487D6',status:'WAITING'}];
 const r={...request,items:entries.map(e=>({key:e.key}))};r.receiptId=D.hash(D.normalize(r));
 const p=D.prepare(root(t),[r],{ledger:{entries:Object.fromEntries(entries.map(e=>[e.key,e]))},rows:[],snapshotReader:()=>new Map(entries.map(e=>[e.key,D.card(e)]))});
 assert.equal(p.decisions.size,1);assert.ok(p.decisions.has(entry.key));
 for(const item of p.receipts[0].items.filter(i=>i.key!==entry.key)){assert.equal(item.status,'HELD');assert.equal(item.reason,'PROTECTED_IDENTITY');}
});
test('identity contract rejects malformed keys, canonical bare IDs and duplicates',()=>{
 for(const key of ['indeed:','indeed:860163fdd4b3ab4','indeed:860163fdd4b3ab4z','indeed:860163FDD4B3AB44','url:abc','unresolved:abc','pid:V2I-','pid:V2I-ABC/DEF','V2I-04D2C53487D6','linkedin:abc'])assert.throws(()=>D.normalize({...request,items:[{key}]}),/INVALID_DISCOVERY_KEYS/);
 assert.throws(()=>D.normalize({...request,items:[{key:entry.key},{key:entry.key}]}),/INVALID_DISCOVERY_KEYS/);
});
test('all currently published waiting-card key families are transportable',()=>{
 const dir=path.resolve(__dirname,'../../state/waiting-queues');
 const keys=[...new Set(fs.readdirSync(dir).filter(f=>/^intake-\d{4}\.json$/.test(f)).flatMap(f=>JSON.parse(fs.readFileSync(path.join(dir,f),'utf8')).items.map(i=>i.key)))];
 assert.ok(keys.length>0);
 for(let offset=0;offset<keys.length;offset+=100)assert.doesNotThrow(()=>D.normalize({...request,items:keys.slice(offset,offset+100).map(key=>({key}))}));
});
test('new dismissal scope removes exact unresolved and protected discovery cards without changing legacy requests',t=>{
 const U=require('../pipeline-observability/upstream-flow'),Q=require('../intake-drain/queue.cjs');
 for(const sample of [{key:'unresolved:'+'b'.repeat(24),status:'IDENTITY_HOLD'}, {key:'indeed:860163fdd4b3ab44',status:'HELD',evidenceStatus:'EXISTING_PROTECTED'}]){
  const e={...entry,...sample,sources:[]},key=e.key,r={...request,scope:'DISCOVERY_CARD_DISMISSAL',items:[{key}]};r.receiptId=D.hash(D.normalize(r));
  const dir=root(t),context={ledger:{entries:{[key]:e}},rows:[],snapshotReader:()=>new Map([[key,D.card(e)]])};
  const p=D.prepare(dir,[r],context),up=U.build({records:[],rows:[],prior:{entries:{[key]:e},groups:{[key]:{status:e.status,aliases:[key]}}},manualContext:p});
  D.publish(dir,p,up);assert.equal(up.ledger.entries[key].status,'EXCLUDED');assert.equal(up.summary.waiting,0);assert.equal(up.summary.reconciliation.excluded,1);
  const receipt=JSON.parse(fs.readFileSync(path.join(dir,'receipts/manual-backlog',r.receiptId+'.json')));assert.equal(receipt.items[0].status,'APPLIED');assert.equal(receipt.items[0].reason,'USER_DISMISSED_DISCOVERY_CARD_HISTORY_RETAINED');
  fs.writeFileSync(path.join(dir,'state/UPSTREAM_LEDGER.json'),JSON.stringify(up.ledger));assert.ok(D.dismissedKeys(dir).has(key));
  fs.writeFileSync(path.join(dir,'state/INTAKE_DRAIN.json'),JSON.stringify({schema:'forge.intake-drain.v1',items:{[key]:{key,aliases:[key],status:'ACTION_REQUIRED',action:'INTAKE'}}}));
  assert.equal(Q.sync(dir,{apply:true}).items[key].status,'ACCOUNTED_UPSTREAM');assert.equal(Q.seeds(dir).length,0);assert.equal(Q.approved(dir).roles.length,0);assert.equal(Q.sync(dir).actions.INTAKE,undefined);assert.equal(Q.next(dir,Q.TASKS.RESOLVE_IDENTITY).items.length,0);
  const again=U.build({records:[],rows:[],prior:up.ledger,manualContext:{...p,decisions:new Map()}});assert.equal(again.ledger.entries[key].status,'EXCLUDED');
  fs.writeFileSync(path.join(dir,'state/EMAIL_RECOVERY_QUEUE.json'),JSON.stringify({jobs:{[key]:{key,status:'POST_IN_FLIGHT_UNKNOWN',submissions:[{requestId:'late-writer'}]}}}));
  const fencedItem=Q.sync(dir).items[key];assert.equal(fencedItem.status,'ACTION_REQUIRED');assert.equal(fencedItem.action,'RECONCILE_WRITER');
  fs.writeFileSync(path.join(dir,'state/INTAKE_DRAIN.json'),JSON.stringify({schema:'forge.intake-drain.v1',items:{}}));assert.equal(Q.sync(dir).items[key].action,'RECONCILE_WRITER');
  fs.unlinkSync(path.join(dir,'state/EMAIL_RECOVERY_QUEUE.json'));
  const changed={...e,title:'Different role'};assert.equal(D.approved(changed,p),null);
  const legacy={...r};delete legacy.scope;legacy.receiptId=D.hash(D.normalize(legacy));assert.equal(D.prepare(dir,[legacy],context).decisions.size,0);
 }
});
test('dismissal scope never conceals active Writer uncertainty or canonical presence',t=>{
 const U=require('../pipeline-observability/upstream-flow'),key='indeed:860163fdd4b3ab44',r={...request,scope:'DISCOVERY_CARD_DISMISSAL',items:[{key}]};r.receiptId=D.hash(D.normalize(r));
 const e={...entry,key,status:'HELD',evidenceStatus:'EXISTING_PROTECTED'},dir=root(t),options={ledger:{entries:{[key]:e}},rows:[],snapshotReader:()=>new Map([[key,D.card(e)]])};
 for(const evidenceStatus of ['POST_IN_FLIGHT_UNKNOWN','SUBMITTED','HELD_WRITER_REVIEW','VERIFIED_INSERTED','HELD_INHERITED_NO_REPLAY'])assert.equal(D.prepare(dir,[r],{...options,ledger:{entries:{[key]:{...e,evidenceStatus}}}}).receipts[0].items[0].reason,'ACTIVE_WRITER_RECONCILIATION_REQUIRED');
 fs.writeFileSync(path.join(dir,'state/INTAKE_DRAIN.json'),JSON.stringify({items:{[key]:{key,aliases:[key],fence:{requestIds:['original']},action:'RECONCILE_WRITER'}}}));assert.equal(D.prepare(dir,[r],options).decisions.size,0);
 fs.writeFileSync(path.join(dir,'state/INTAKE_DRAIN.json'),JSON.stringify({items:{}}));const p=D.prepare(dir,[r],options);
 const up=U.build({records:[],rows:[{PRIMARY_ID:'V2I-1',COMPANY:e.company,TITLE:e.title,LOCATION:e.location,p:{}}],prior:{entries:{[key]:e}},manualContext:p});assert.equal(up.ledger.entries[key].status,'PRESENT');D.publish(dir,p,up);assert.equal(p.receipts[0].items[0].status,'HELD');
 const fenced={...p,fences:new Map([[key,{requestIds:['later']}]]),decisions:new Map()};const prior={...e,status:'EXCLUDED',manualDecision:p.decisions.get(key)};assert.equal(D.approved(prior,fenced),null);
});
test('scope normalization preserves old hashes and explicitly binds new dismissal semantics',()=>{
 assert.deepEqual(Object.keys(D.normalize(request)),['schema','requestId','snapshotRevision','decision','items']);
 assert.deepEqual(Object.keys(D.normalize({...request,scope:'DISCOVERY_CARD_DISMISSAL'})),['schema','requestId','snapshotRevision','decision','scope','items']);
 assert.notEqual(D.hash(D.normalize(request)),D.hash(D.normalize({...request,scope:'DISCOVERY_CARD_DISMISSAL'})));
 assert.throws(()=>D.normalize({...request,scope:'DELETE_CANONICAL'}),/INVALID_MANUAL_SCOPE/);
});
test('intake selection does not pursue rediscovered dismissed keys',()=>{
 const {pick}=require('../source-intake/auto-run'),U=require('../pipeline-observability/upstream-flow');
 const role={company:'Example',title:'Plant Manager',location:'Boston, MA',url:'https://example.com/jobs/123',level:'DIRECTOR_PLUS'};
 const options={max:10,sent:new Set(),dismissedKeys:new Set([U.key(role.url)])};assert.deepEqual(pick({new_roles:[role]},options),[]);
});
test('observer advertises scoped dismissal only with its upgraded waiting queue implementation',()=>{
 const Q=require('../pipeline-observability/waiting-queues');const result=Q.build({states:{},queues:{enrichment:0,readyForReview:0}},{summary:{reconciled:true,waiting:0},ledger:{groups:{},entries:{}}},new Date().toISOString());
 assert.deepEqual(result.index.manualDecisions,{version:1,maxBatch:100,scopes:['DISCOVERY_CARD_DISMISSAL']});
});
