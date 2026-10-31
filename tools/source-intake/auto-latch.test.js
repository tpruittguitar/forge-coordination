'use strict';
const test=require('node:test'),assert=require('node:assert'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {latch,previous,stoppedAt}=require('./auto-latch');

const ID='HOLD: resumed case not verified (INSERT_IDENTITY_MISMATCH)';
const unknownRun={sourceRunId:'FORGE-AUTO-1',requestIds:['R1','R2','R3','R4'],results:{R1:{},R2:{WRITE_ACCEPTED:true},R3:{WRITE_ACCEPTED:true}},
 halts:[{at:'2026-10-24T05:11:15Z',message:'UNKNOWN: Writer POST outcome unconfirmed; reconcile receipt index before retry',
  outcomes:[{requestId:'R1',status:'SKIPPED'},{requestId:'R2',status:'RESUMED_ACCOUNTED'},{requestId:'R3',status:'RESUMED_ACCOUNTED'}]}]};
const identityRun={sourceRunId:'FORGE-AUTO-0',requestIds:['A','B'],
 results:{A:{},B:{WRITE_ACCEPTED:true,receipt:{REQUEST_ID:'B',NEW_PRIMARY_IDS:['V2I-1']}}},
 halts:[{at:'x',message:ID,outcomes:[{requestId:'A',status:'SKIPPED'},{requestId:'B',status:'HOLD',reason:ID}]}]};
function repo(files){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'auto-latch-'));
 for(const [rel,v] of Object.entries(files)){const p=path.join(root,rel);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,typeof v==='string'?v:JSON.stringify(v))}
 return root;
}

test('an UNKNOWN halt blocks and names the request the run stopped on',()=>{
 const r=latch([{file:'f.json',state:unknownRun}]);
 assert.strictEqual(r.blocking.length,1);
 assert.strictEqual(r.blocking[0].requestId,'R4');
 assert.match(r.blocking[0].message,/^UNKNOWN/);
});
test('the single exact identity HOLD is quarantined, not blocking',()=>{
 const r=latch([{file:'g.json',state:identityRun}]);
 assert.deepStrictEqual(r.blocking,[]);
 assert.strictEqual(r.quarantined[0].requestId,'B');
});
test('a HOLD of any other shape still blocks',()=>{
 const s=JSON.parse(JSON.stringify(identityRun));s.results.B.WRITE_ACCEPTED=false;
 const r=latch([{file:'g.json',state:s}]);
 assert.strictEqual(r.blocking.length,1);assert.strictEqual(r.blocking[0].requestId,'B');
});
test('reconciled and no-candidate runs never block; candidates-only files are ignored',()=>{
 const root=repo({'receipts/auto-intake/X.json':{reconciliation:{status:'OK'}},'receipts/auto-intake/Y.json':{noCandidates:true},'receipts/auto-intake/Z.candidates.json':[]});
 const p=previous(root);
 assert.deepStrictEqual(p.map(x=>x.file),['receipts/auto-intake/X.json','receipts/auto-intake/Y.json']);
 assert.deepStrictEqual(latch(p),{blocking:[],quarantined:[]});
});
test('stoppedAt falls back to the first unaccounted request id',()=>{
 assert.strictEqual(stoppedAt({requestIds:['A','B'],halts:[]}),'A');
});

// The intake run itself: latched -> exits normally, makes NO Writer or web call, writes nothing.
test('auto-run stops before any network call and does not fail when latched',async()=>{
 const root=repo({'control/SOURCE_INTAKE_RELEASE.json':fs.readFileSync(path.join(__dirname,'../../control/SOURCE_INTAKE_RELEASE.json'),'utf8'),
  'receipts/auto-intake/FORGE-AUTO-1.json':unknownRun});
 const cwd=process.cwd(),fetch0=globalThis.fetch,key0=process.env.FORGE_WRITER_KEY,log0=console.log,err0=console.error;
 let calls=0;const out=[];
 globalThis.fetch=async()=>{calls++;throw Error('network must not be used')};
 process.env.FORGE_WRITER_KEY='test-only';console.log=m=>out.push(String(m));console.error=m=>out.push(String(m));
 try{
  process.chdir(root);
  const cfg=JSON.parse(fs.readFileSync('control/SOURCE_INTAKE_RELEASE.json','utf8'));
  if(cfg.mode!=='AUTO'||cfg.enabled!==true){cfg.mode='AUTO';cfg.enabled=true;fs.writeFileSync('control/SOURCE_INTAKE_RELEASE.json',JSON.stringify(cfg))}
  const {main}=require('./auto-run');
  const r=await main(['--report','state/none.json']);
  assert.strictEqual(calls,0);
  assert.strictEqual(r.latched[0].requestId,'R4');
  assert.ok(out.some(m=>m.startsWith('::warning title=AUTO intake latched::')));
  assert.deepStrictEqual(fs.readdirSync('receipts/auto-intake'),['FORGE-AUTO-1.json']);
 }finally{process.chdir(cwd);globalThis.fetch=fetch0;console.log=log0;console.error=err0;if(key0===undefined)delete process.env.FORGE_WRITER_KEY;else process.env.FORGE_WRITER_KEY=key0}
});

test('operator containment preserves UNKNOWN and blocks changed-URL identities without losing untouched tail',()=>{
 const {requestId}=require('./production-executor'),{isolatedUnknown,identityKey}=require('./auto-latch'),{pick}=require('./auto-run');
 const record={COMPANY:'Acme',TITLE:'Director of Manufacturing',LOCATION:'Austin, TX',SOURCE_URL:'https://example.com/original'},rid=requestId(record),s={sourceRunId:'ORIGINAL',candidatesHash:'original-hash',requestIds:[rid,'UNTOUCHED'],results:{[rid]:{error:'timeout'}},halts:[{message:'UNKNOWN'}],quarantine:{schema:'forge.intake-quarantine.v1',status:'UNKNOWN_NO_REPLAY',authorizedBy:'Tim',at:'2026-10-31T00:00:00Z',record,requestId:rid,candidatesHash:'original-hash',proofs:['receipts/original-proof.json'],carryForwardRequestIds:['UNTOUCHED']}};
 assert.ok(isolatedUnknown(s));const r=latch([{file:'original.json',state:s}]);assert.equal(r.blocking.length,0);assert.equal(r.quarantined.length,1);assert.equal(s.completedAt,undefined);assert.equal(s.results[rid].error,'timeout');
 const report={new_roles:[{company:'Acme',title:record.TITLE,location:record.LOCATION,url:'https://example.com/changed',level:'DIRECTOR_PLUS'},{company:'Other Industrial',title:record.TITLE,location:record.LOCATION,url:'https://example.com/unrelated',level:'DIRECTOR_PLUS'}]};
 const candidates=pick(report,{max:25,sent:new Set(),blockedIdentities:new Set([identityKey(record)])});assert.equal(candidates.length,1);assert.equal(candidates[0].record.COMPANY,'Other Industrial');
 assert.equal(isolatedUnknown({...s,quarantine:{...s.quarantine,candidatesHash:'wrong'}}),null);
 assert.equal(isolatedUnknown({...s,quarantine:{...s.quarantine,carryForwardRequestIds:[]}}),null);
});
