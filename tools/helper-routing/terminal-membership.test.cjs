'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const M=require('./terminal-membership.cjs'),E=require('./enrichment.cjs'),A=require('./shared-assignments.cjs'),H=require('./shared.cjs'),P=require('./worker-partition.cjs'),S=require('../programmed-coordinator/store.cjs');
const at=()=>new Date().toISOString();
function chatWork(items){
 return {schema:'forge.enrichment-helper-work.v1',enabled:true,routingActive:true,assignmentId:'GROK-TEST',provider:'ChatGPT',taskKey:'FORGE_CHATGPT_ENRICHMENT_RESEARCH',items:items.map(i=>({primaryId:i.primaryId,owner:'ChatGPT',taskKey:'FORGE_CHATGPT_ENRICHMENT_RESEARCH',status:i.status||'ASSIGNED',missingFields:['SALARY','DEGREE']}))};
}
function snap(rows){
 const list=rows.map(r=>({PRIMARY_ID:r.id,BUCKET:r.bucket,COMPANY:'Co',TITLE:'Role',LOCATION:'Austin, TX',p:r.p||{}}));
 return {rows:list,archiveRows:[],source:{kind:'CANONICAL_WRITER_MASTER',readAt:at()},needsById:Object.fromEntries(list.map(r=>[r.PRIMARY_ID,['SALARY']]))};
}
test('reconcileResearch removes declined, applied, closed and duplicate items and keeps open and manual-research work',()=>{
 const w=chatWork([
  {primaryId:'V2I-OPEN'},
  {primaryId:'V2I-DECLINED'},
  {primaryId:'V2I-APPLIED'},
  {primaryId:'V2I-CLOSED'},
  {primaryId:'V2I-DUP'},
  {primaryId:'V2I-MANUAL'}
 ]);
 const r=E.reconcileResearch(w,snap([
  {id:'V2I-OPEN',bucket:'SCOUT_INTAKE'},
  {id:'V2I-DECLINED',bucket:'DECLINED_BY_TIM'},
  {id:'V2I-APPLIED',bucket:'APPLIED'},
  {id:'V2I-CLOSED',bucket:'CLOSED_DEAD'},
  {id:'V2I-DUP',bucket:'DUPLICATE'},
  {id:'V2I-MANUAL',bucket:'MANUAL_RESEARCH'}
 ]));
 a.deepEqual(r.items.map(i=>i.primaryId),['V2I-OPEN','V2I-MANUAL']);
 a.equal(r.items.every(i=>i.status==='ASSIGNED'),true);
});
test('rejected and invalid-discovery items are also dropped; already-skipped terminal items leave the list',()=>{
 const w=chatWork([
  {primaryId:'V2I-REJ',status:'PROTECTED_SKIP'},
  {primaryId:'V2I-INV',status:'ALREADY_COMPLETE'},
  {primaryId:'V2I-OPEN'}
 ]);
 const r=E.reconcileResearch(w,snap([
  {id:'V2I-REJ',bucket:'REJECTED_BY_EMPLOYER'},
  {id:'V2I-INV',bucket:'INVALID_DISCOVERY'},
  {id:'V2I-OPEN',bucket:'READY_TO_PURSUE'}
 ]));
 a.deepEqual(r.items.map(i=>i.primaryId),['V2I-OPEN']);
});
test('partition lock accepts shrinkage of allowed IDs and rejects additions or lock edits',()=>{
 const root=path.resolve(__dirname,'../..');
 const raw=JSON.parse(fs.readFileSync(path.join(root,P.FILE),'utf8'));
 P.validate(raw);
 const drop=raw.workers[0].primaryIds[0];
 const shrunk=P.prune(raw,[drop]);
 a.equal(shrunk.workers[0].primaryIds.includes(drop),false);
 a.equal(shrunk.lock.hermes.length,P.LOCKED_HERMES_SIZE);
 a.equal(shrunk.lock.hermes.includes(drop),true);
 a.equal(P.validate(shrunk).hermes.has(drop),false);
 const added=structuredClone(shrunk);
 added.workers[0].primaryIds=[...added.workers[0].primaryIds,'V2I-FFFFFFFFFFFF'].sort();
 a.throws(()=>P.validate(added),/PARTITION_INVALID/);
 const touchedLock=structuredClone(raw);
 touchedLock.lock.hermes=touchedLock.lock.hermes.slice(1);
 a.throws(()=>P.validate(touchedLock),/PARTITION_INVALID/);
});
test('a later coordinator replenish run leaves terminal items out and does not re-add them',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'terminal-membership-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const now=Date.now();
 const work={schema:'forge.shared-helper-work.v1',assignmentId:'SHARED-TEST',enabled:true,routingActive:true,providers:{FORGE_CLAUDE_SHARED_HELPER:{provider:'Claude',available:true},FORGE_GROK_SHARED_HELPER:{provider:'Grok',available:false},FORGE_HERMES_SHARED_HELPER:{provider:'Hermes',available:false}},items:[
  {kind:'ENRICHMENT',primaryId:'V2I-OPEN00OPEN',provider:'Claude',taskKey:'FORGE_CLAUDE_SHARED_HELPER',assignmentVersion:1,sourceVersion:'a'.repeat(64),status:'ASSIGNED'},
  {kind:'ENRICHMENT',primaryId:'V2I-DECL00DECL',provider:'Claude',taskKey:'FORGE_CLAUDE_SHARED_HELPER',assignmentVersion:1,sourceVersion:'a'.repeat(64),status:'ASSIGNED'},
  {kind:'ENRICHMENT',primaryId:'V2I-APPL00APPL',provider:'Claude',taskKey:'FORGE_CLAUDE_SHARED_HELPER',assignmentVersion:1,sourceVersion:'a'.repeat(64),status:'PROTECTED_SKIP'},
  {kind:'ENRICHMENT',primaryId:'V2I-CLOS00CLOS',provider:'Claude',taskKey:'FORGE_CLAUDE_SHARED_HELPER',assignmentVersion:1,sourceVersion:'a'.repeat(64),status:'ASSIGNED'},
  {kind:'ENRICHMENT',primaryId:'V2I-DUPL00DUPL',provider:'Claude',taskKey:'FORGE_CLAUDE_SHARED_HELPER',assignmentVersion:1,sourceVersion:'a'.repeat(64),status:'ASSIGNED'}
 ]};
 S.save(root,H.FILE,work);
 const rows=[
  {PRIMARY_ID:'V2I-OPEN00OPEN',COMPANY:'Open Co',TITLE:'Plant Manager',LOCATION:'Austin, TX',BUCKET:'SCOUT_INTAKE',p:{}},
  {PRIMARY_ID:'V2I-DECL00DECL',COMPANY:'Declined Co',TITLE:'Plant Manager',LOCATION:'Austin, TX',BUCKET:'DECLINED_BY_TIM',p:{}},
  {PRIMARY_ID:'V2I-APPL00APPL',COMPANY:'Applied Co',TITLE:'Plant Manager',LOCATION:'Austin, TX',BUCKET:'APPLIED',p:{}},
  {PRIMARY_ID:'V2I-CLOS00CLOS',COMPANY:'Closed Co',TITLE:'Plant Manager',LOCATION:'Austin, TX',BUCKET:'CLOSED_DEAD',p:{}},
  {PRIMARY_ID:'V2I-DUPL00DUPL',COMPANY:'Dup Co',TITLE:'Plant Manager',LOCATION:'Austin, TX',BUCKET:'DUPLICATE',p:{}},
  {PRIMARY_ID:'V2I-FRESH00FRESH',COMPANY:'Fresh Terminal',TITLE:'Plant Manager',LOCATION:'Austin, TX',BUCKET:'DECLINED_BY_TIM',p:{}}
 ];
 const snapshot={rows,archiveRows:[],source:{readAt:new Date(now).toISOString()}};
 A.replenish({root,state:{items:{},batches:{},transactions:{},exceptions:{}},snapshot,runId:'T1',now,apply:true,checkLock(){}});
 const first=S.read(root,H.FILE);
 a.deepEqual(first.items.map(i=>i.primaryId).sort(),['V2I-OPEN00OPEN']);
 A.replenish({root,state:{items:{},batches:{},transactions:{},exceptions:{}},snapshot,runId:'T2',now:now+1000,apply:true,checkLock(){}});
 const second=S.read(root,H.FILE);
 a.deepEqual(second.items.map(i=>i.primaryId).sort(),['V2I-OPEN00OPEN']);
 a.equal(second.items.some(i=>['V2I-DECL00DECL','V2I-APPL00APPL','V2I-CLOS00CLOS','V2I-DUPL00DUPL','V2I-FRESH00FRESH'].includes(i.primaryId)),false);
});
