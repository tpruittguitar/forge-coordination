'use strict';
const {test}=require('node:test'),a=require('node:assert/strict');
const S=require('../programmed-coordinator/store.cjs'),H=require('../helper-routing/shared.cjs'),API=require('../helper-routing/api-grant.cjs');
const Host=require('./host-readers.cjs'),Adapter=require('./timmay-adapter.cjs');
const {fixture}=require('../helper-routing/api-grant-fixture.cjs');
function setup(t){
 const f=fixture(t);S.save(f.root,H.FILE,API.plan(f).work);S.save(f.root,'state/PROGRAMMED_COORDINATOR.json',f.state);
 const at=f.snapshot.source.readAt,text=f.snapshot.rows.map(r=>r.line).join('\n')+'\nEND V2_CURRENT_POPULATION_MASTER';
 const data={master:{ok:true,text,fetchedAt:at,rowCount:2},writer_status:{ok:true,...f.snapshot.status,build:{commit:'b'.repeat(40)},now:at},rules:{ok:true,rules:{source:'TIM_PIPELINE_RULES_CANONICAL',status:'ACTIVE',raw:'SYNTHETIC RULES',rules:[]}}};
 const calls=[],index={version:1,requests:{},pending:[]},revision='a'.repeat(40);
 const git=args=>{
  calls.push('git:'+args.join(' '));
  switch(args[0]){case 'remote':return Host.REMOTE;case 'rev-parse':return revision;case 'ls-remote':return revision+'\trefs/heads/main';case 'status':return '';case 'show':return JSON.stringify(H.load(f.root));default:a.fail('unexpected git command');}
 };
 const options={root:f.root,now:()=>f.now,git,
  // Synthetic implementation of the exact PipelineWorklists parse/build/render interface.
  W:{parseRows:()=>structuredClone(f.snapshot.rows),build:()=>({lanes:{FORGE_ENRICH_FEASIBILITY:f.snapshot.rows}}),render:()=> 'NEED=DEGREE'},
  writerRead:async action=>{calls.push(action);return {data:structuredClone(data[action]),startedAt:at,completedAt:at};},
  readReceiptIndex:async()=>{calls.push('index');return {sha:'c'.repeat(40),index:structuredClone(index)};}};
 return {...f,options,data,calls,index};
}
test('bound readers use complete canonical source and published revision, never invent eligibility',async t=>{
 const f=setup(t),view=await Host.create(f.options).readView();
 a.equal(view.instructionCommit,'a'.repeat(40));a.equal(view.snapshot.rows.length,2);a.deepEqual(view.snapshot.needsById[f.ids[0]],['DEGREE']);
 a.deepEqual(view.snapshot.neverConsiderById,{});a.equal(view.readerProof.eligibility,'AUTHORITATIVE_CLEAR_UNAVAILABLE');
 a.throws(()=>Adapter.current(f.root,f.ids[0],view,f.now),/CURRENT_NEVER_CONSIDER_PROOF_REQUIRED/);
 a.deepEqual(f.calls.filter(c=>!c.startsWith('git:')),['writer_status','index','rules','master','master','rules','writer_status','index']);
});
test('wrong origin, unpublished revision, dirty checkout or disabled route block before authorized reads',async t=>{
 for(const change of [o=>{const g=o.git;o.git=args=>args[0]==='remote'?'https://example.com/repo':g(args);},o=>{const g=o.git;o.git=args=>args[0]==='ls-remote'?'b'.repeat(40):g(args);},o=>{const g=o.git;o.git=args=>args[0]==='status'?' M control/SHARED_HELPER_WORK.json':g(args);}]){
  const f=setup(t);change(f.options);await a.rejects(Host.create(f.options).readView());a.equal(f.calls.includes('master'),false);
 }
 const f=setup(t),w=H.load(f.root);w.apiGrantBinding.enabled=false;S.save(f.root,H.FILE,w);await a.rejects(Host.create(f.options).readView(),/DISABLED/);a.equal(f.calls.includes('writer_status'),false);
});
test('missing action authorization, stale/future clocks, freeze and incomplete master fail closed',async t=>{
 for(const change of [f=>f.data.rules.ok=false,f=>f.data.rules.rules.status='UNAVAILABLE',f=>f.data.writer_status.freeze='freeze',f=>f.data.master.fetchedAt='2020-01-01',f=>f.data.master.fetchedAt='2099-01-01',f=>f.data.master.text='1 | incomplete',f=>f.data.master.rowCount=3]){
  const f=setup(t);change(f);await a.rejects(Host.create(f.options).readView());
 }
 const f=setup(t);f.options.writerRead=async()=>{throw Error('PRIVATE TRANSPORT BODY');};await a.rejects(Host.create(f.options).readView(),e=>e.message==='AUTHORIZED_WRITER_READ_FAILED');
});
test('master, rules, status, receipt and coordinator drift cannot form a composite snapshot',async t=>{
 for(const target of ['master','rules','writer_status','index','state']){
  const f=setup(t);let n=0;const read=f.options.writerRead,idx=f.options.readReceiptIndex;
  if(target==='index')f.options.readReceiptIndex=async()=>{const r=await idx();if(++n===2)r.sha='d'.repeat(40);return r;};
  else f.options.writerRead=async action=>{const r=await read(action);if(target==='state'&&action==='master'){const s=structuredClone(f.state);s.items.NEW={status:'SUBMITTED'};S.save(f.root,'state/PROGRAMMED_COORDINATOR.json',s);}
   if(action===target&&++n===2){if(action==='master')r.data.text+=' changed';if(action==='rules')r.data.rules.raw+=' changed';if(action==='writer_status')r.data.build.commit='e'.repeat(40);}return r;};
  await a.rejects(Host.create(f.options).readView(),/CHANGED/);
 }
});
test('incomplete receipts fail globally, unresolved exact IDs stay fenced, status clock may advance',async t=>{
 const f=setup(t);f.index.pending=[{}];await a.rejects(Host.create(f.options).readView(),/UNRESOLVED_RECEIPT_IDENTITY/);
 f.index.pending=[];f.index.requests.X={s:'NEEDS_RESOLUTION',items:[{pid:f.ids[0]}]};
 const read=f.options.writerRead;let n=0;f.options.writerRead=async action=>{const r=await read(action);if(action==='writer_status')r.data.now=new Date(f.now+(n++)).toISOString();return r;};
 const v=await Host.create(f.options).readView();a.equal(v.snapshot.writerReceiptIndex.pending[0].items[0].pid,f.ids[0]);
});
test('bound adapter cannot progress missing authoritative eligibility to evidence/model or launch',async t=>{
 const f=setup(t);let evidence=0,models=0;
 const h=Adapter.bindReaders({...f.options,readPublicEvidence:async()=>{evidence++;},reuse:async()=>null,simulate:async()=>{models++;}});
 const r=await h.runDry(require('node:path').join(f.root,'private'));a.equal(r.preparedJobs,0);a.equal(evidence,0);a.equal(models,0);a.throws(()=>h.launch(),/LIVE_RELEASE_DISABLED/);
});

test('canonical protected decisions survive full reader projection',async t=>{
 const f=setup(t);for(const row of f.snapshot.rows){row.BUCKET='APPLIED';row.line=row.line.replace('SCOUT_INTAKE','APPLIED');}
 f.data.master.text=f.snapshot.rows.map(r=>r.line).join('\n')+'\nEND V2_CURRENT_POPULATION_MASTER';
 const v=await Host.create(f.options).readView();a.ok(v.snapshot.rows.every(require('../programmed-coordinator/transactions.cjs').protectedRow));
});
test('future transport timestamps and receipt capability failures are sanitized',async t=>{
 const f=setup(t),read=f.options.writerRead;f.options.writerRead=async action=>({...await read(action),completedAt:'2099-01-01'});
 await a.rejects(Host.create(f.options).readView(),/STALE_AUTHORIZED_READ/);
 f.options.writerRead=read;f.options.readReceiptIndex=async()=>{throw Error('PRIVATE AUTH BODY');};
 await a.rejects(Host.create(f.options).readView(),e=>e.message==='AUTHORIZED_RECEIPT_READ_FAILED');
});
