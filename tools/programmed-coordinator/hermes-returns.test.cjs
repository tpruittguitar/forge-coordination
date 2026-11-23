'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const H=require('./hermes-returns.cjs'),S=require('./store.cjs');
test('captures only a frozen Hermes evidentiary return once; conflicting, stale, spoofed and unsupported changes never pass',t=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'hermes-ingress-'));t.after(()=>fs.rmSync(temp,{recursive:true,force:true}));
 const inbox=path.join(temp,'outputs'),root=path.join(temp,'checkout'),privateDir=path.join(temp,'private');
 fs.mkdirSync(inbox);
 const id='V2I-0123456789AB',other='V2I-ABCDEF123456',partition={
  schema:'forge.enrichment-worker-partition.v1',sourcePath:'state/PIPELINE_WAITING_QUEUES.json',sourceCommit:'a'.repeat(40),
  workers:[{provider:'Hermes',primaryIds:[id]},{provider:'ChatGPT',primaryIds:[other]}]};
 S.save(root,H.PARTITION,partition);
 const quote='This role is onsite.';
 const b={schema:H.SCHEMA,provider:'Hermes',taskKey:H.TASK,runId:'FORGE-HERMES-20261123T030000Z-B001',instructionCommit:'b'.repeat(40),partitionSha256:S.hash(partition),writerSubmitted:false,items:[{
  kind:'ENRICHMENT',primaryId:id,recommendation:'ENRICHMENT_EVIDENCE_READY',sourceEvidence:{company:'Example',title:'Director',location:'City, TN',url:'https://example.com/jobs/1',observedAt:'2026-11-23T03:00:00Z',quote,
  proposedRawFields:{WORK_ARRANGEMENT:'ONSITE',REMOTE_HYBRID:'ONSITE'},fieldQuotes:{WORK_ARRANGEMENT:quote}}}]};
 const save=v=>fs.writeFileSync(path.join(inbox,b.runId+'.json'),JSON.stringify(v));
 const capture=(historical=partition)=>H.capture({inbox,root,privateDir,routing:(root,b)=>H.history(root,b,()=>JSON.stringify(historical))});
 save({...b,provider:'ChatGPT'});assert.deepEqual(capture(),{available:true,imported:0,invalid:1});
 save({...b,items:[{...b.items[0],primaryId:other}]});assert.equal(capture().invalid,1);
 save(b);assert.equal(capture({...partition,sourceCommit:'c'.repeat(40)}).invalid,1);
 assert.equal(capture().imported,1);assert.equal(capture().imported,0);
 save({...b,items:[{...b.items[0],sourceEvidence:{...b.items[0].sourceEvidence,quote:'This role is onsite. Timed.'}}]});
 assert.equal(capture().invalid,1);
 const rel=H.DIR+'/'+b.runId+'.json';
 assert.deepEqual(H.read(root,privateDir,rel),b);
 assert.equal(fs.existsSync(path.join(root,rel)),false);
 S.save(root,'state/enrich-ats-pay.json',{releasedNotApplied:{old:{ids:[id]}}});
 const native=path.join(temp,'native-ledger.json');
 assert.throws(()=>H.standingFence(root,native),/HERMES_ATS_WRITER_FENCE_UNREADABLE/);
 fs.writeFileSync(native,JSON.stringify({pendingWrites:{old:{ids:[other]}}}));
 assert.equal(H.standingFence(root,native).has(id),true);assert.equal(H.standingFence(root,native).has(other),true);
 S.save(root,'state/enrich-ats-pay.json',{notAccepted:{broken:{}}});
 assert.throws(()=>H.standingFence(root,native),/HERMES_ATS_WRITER_FENCE_UNREADABLE/);
 assert.equal(H.trustedUrl('https://other.example/job/1',[b.items[0].sourceEvidence.url]),undefined);
 assert.equal(H.trustedUrl(b.items[0].sourceEvidence.url,[b.items[0].sourceEvidence.url]),b.items[0].sourceEvidence.url);
 const projection={WORK_ARRANGEMENT:'ONSITE',REMOTE_HYBRID:'ONSITE',FIT_BASIS:'Internal scoring evidence'},known=v=>!!v;
 assert.deepEqual(H.blanks({...projection},{p:{WORK_ARRANGEMENT:'ONSITE'}},b.items[0],{REPLACE_GROUPS:{},known}),{REMOTE_HYBRID:'ONSITE'});
 assert.deepEqual(H.blanks({...projection},{p:{WORK_ARRANGEMENT:'HYBRID'}},b.items[0],{REPLACE_GROUPS:{},known}),{});
 assert.deepEqual(H.blanks({...projection},{p:{WORK_ARRANGEMENT:'ONSITE',REMOTE_HYBRID:'ONSITE'}},b.items[0],{REPLACE_GROUPS:{},known}),{});
});
