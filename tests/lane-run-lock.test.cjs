'use strict';
// Lanes have no owner: any authorized provider runs a lane, and the shared run
// lock (a non-force push to run-locks) lets exactly one run hold it at a time.
const test=require('node:test'),a=require('node:assert/strict');
const cp=require('node:child_process'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const R=require('../tools/lane-run-lock.cjs'),L=require('../tools/automation-lanes.cjs');
const REPO=path.resolve(__dirname,'..');

function sandbox(){
 const base=fs.mkdtempSync(path.join(os.tmpdir(),'lane-lock-')),remote=path.join(base,'remote.git'),root=path.join(base,'work');
 const git=(cwd,...args)=>cp.execFileSync('git',args,{cwd,stdio:'pipe'});
 git(base,'init','-q','--bare',remote);git(base,'init','-q',root);git(root,'remote','add','origin',remote);
 fs.mkdirSync(path.join(root,'control'));fs.copyFileSync(path.join(REPO,L.FILE),path.join(root,L.FILE));
 return{base,root};
}

test('registry names no owner and every old AI-named key resolves to the same record as its neutral key',()=>{
 const r=L.read(REPO);
 for(const [k,t] of Object.entries(r.tasks)){a.equal(t.owner,undefined,k);a.equal(t.currentOwner,undefined,k);}
 for(const [neutral,record] of Object.entries(r.laneKeys)){a.ok(r.tasks[record],neutral);a.equal(L.resolve(r,neutral).key,L.resolve(r,record).key);}
 a.ok(['ChatGPT','Claude','Hermes','President','Grok','Grokbot President'].every(p=>L.authorized(r,p)));a.equal(L.authorized(r,'Bogus'),false);
});

test('one run holds a lane across alias and old key; stale locks are taken over; only the holder releases',()=>{
 const {base,root}=sandbox(),t0=Date.parse('2026-11-23T03:00:00Z');
 try{
  const run=(action,key,id,provider,now=t0)=>R.run(action,key,id,provider,{root,now});
  a.equal(run('acquire','FORGE_INTAKE_A','RUN-ONE-01','Hermes').result,'ACQUIRED');
  const busy=run('acquire','FORGE_CLAUDE_INTAKE_A','RUN-TWO-02','ChatGPT',t0+60000);
  a.equal(busy.result,'BUSY');a.equal(busy.heldBy.provider,'Hermes');
  a.equal(run('acquire','FORGE_INTAKE_B','RUN-TWO-02','ChatGPT',t0+60000).result,'ACQUIRED');
  a.equal(run('acquire','FORGE_INTAKE_A','RUN-BAD-03','Bogus').reason,'PROVIDER_NOT_AUTHORIZED');
  const taken=run('acquire','FORGE_CLAUDE_INTAKE_A','RUN-THREE-03','Claude',t0+91*60000);
  a.equal(taken.result,'ACQUIRED');a.equal(taken.tookOverStale.runId,'RUN-ONE-01');
  a.equal(run('release','FORGE_INTAKE_A','RUN-ONE-01','Hermes').result,'NOT_HELD');
  a.equal(run('release','FORGE_INTAKE_A','RUN-THREE-03','Claude').result,'RELEASED');
  a.equal(run('acquire','FORGE_INTAKE_A','RUN-FOUR-04','ChatGPT',t0+92*60000).result,'ACQUIRED');
 }finally{fs.rmSync(base,{recursive:true,force:true});}
});

test('a write against a moved branch head loses instead of overwriting',()=>{
 let head='h1';const writes=[];
 const store={head:()=>head,read:()=>null,write:(b,parent)=>{writes.push(parent);if(parent!==head)return false;head='h2';return true;}};
 let n=0;const racer={...store,head:()=>{const h=head;head='h-other-'+(++n);return h;}};
 a.equal(R.run('acquire','FORGE_INTAKE_A','RUN-RACE-01','Claude',{root:REPO,store:racer}).result,'BUSY');
 a.equal(R.run('acquire','FORGE_INTAKE_A','RUN-OK-01','Claude',{root:REPO,store}).result,'ACQUIRED');
});
