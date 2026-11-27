'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {buildPrompt,loadLane,grantFirst}=require('./build-prompt.js');

function fixture(){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'chatgpt-box-prompt-'));
  const lanes={schema:'forge.chatgpt-box-lanes.v1',commonEntry:'control/FORGE_SHARED_AUTOMATION_ENTRY.txt',lanes:{
    FORGE_EMAIL_DISCOVERY:{enabled:true,procedure:'lanes/CHATGPT_INTAKE_INSPECTION.txt',model:'gpt-5.4-mini',timeoutMinutes:25,runner:'grant'},
    FORGE_APPLICATION_WRITER_GOFER:{enabled:true,procedure:'runtime:current',focus:'fill missing discovery and intake data'},
    FORGE_APPLICATION_OUTCOME_TRACKER:{enabled:false,hold:'TIMMAY ACTIVE',procedure:'lanes/CHATGPT_APPLICATION_OUTCOME_TRACKER.txt',model:'sonnet',timeoutMinutes:25}
  }};
  fs.mkdirSync(path.join(root,'tools/chatgpt-box-runner'),{recursive:true});
  fs.mkdirSync(path.join(root,'control'),{recursive:true});
  fs.mkdirSync(path.join(root,'lanes'),{recursive:true});
  fs.mkdirSync(path.join(root,'policy/current'),{recursive:true});
  fs.writeFileSync(path.join(root,'tools/chatgpt-box-runner/lanes.json'),JSON.stringify(lanes));
  fs.writeFileSync(path.join(root,'control/FORGE_SHARED_AUTOMATION_ENTRY.txt'),'SHARED ENTRY TEXT');
  fs.writeFileSync(path.join(root,'lanes/CHATGPT_INTAKE_INSPECTION.txt'),'EMAIL PROCEDURE');
  fs.writeFileSync(path.join(root,'lanes/CHATGPT_APPLICATION_OUTCOME_TRACKER.txt'),'OUTCOME PROCEDURE');
  fs.writeFileSync(path.join(root,'policy/current/AI_AUTOMATION_COMMON.txt'),'intro\nBEGIN GRANT-FIRST AND WRITER COORDINATION\nuse the grant\nEND GRANT-FIRST AND WRITER COORDINATION\nafter');
  fs.mkdirSync(path.join(root,'runtime/releases/R1'),{recursive:true});
  fs.writeFileSync(path.join(root,'runtime/current.json'),JSON.stringify({release_id:'R1',lanes:{FORGE_APPLICATION_WRITER_GOFER:{file:'FORGE_APPLICATION_WRITER_GOFER.txt'}}}));
  fs.writeFileSync(path.join(root,'runtime/releases/R1/FORGE_APPLICATION_WRITER_GOFER.txt'),'GOFER RELEASE PROCEDURE');
  fs.writeFileSync(path.join(root,'control/AI_AUTOMATION_TASKS.json'),JSON.stringify({schema:'forge.ai-automation-tasks.v1',tasks:{FORGE_EMAIL_DISCOVERY:{owner:'ChatGPT',procedure:'lanes/CHATGPT_INTAKE_INSPECTION.txt'}}}));
  return root;
}

test('grantFirst keeps only the marked excerpt',()=>{
  a.equal(grantFirst('x\nBEGIN GRANT-FIRST AND WRITER COORDINATION\nbody\nEND GRANT-FIRST AND WRITER COORDINATION\ny'),
    'BEGIN GRANT-FIRST AND WRITER COORDINATION\nbody\nEND GRANT-FIRST AND WRITER COORDINATION');
});

test('enabled lane prompt uses published entry and procedure',()=>{
  const root=fixture();
  const r=buildPrompt(root,'FORGE_EMAIL_DISCOVERY',{RUN_ID:'R1',WORKDIR:'/w',INSTRUCTION_COMMIT:'abc'});
  a.match(r.prompt,/PROVIDER=ChatGPT/);
  a.match(r.prompt,/SHARED ENTRY TEXT/);
  a.match(r.prompt,/EMAIL PROCEDURE/);
  a.match(r.prompt,/use the grant/);
  a.doesNotMatch(r.prompt,/\nafter/);
  a.equal(r.lane.l.enabled,true);
});

test('held lane is rejected so the scheduler cannot start it',()=>{
  const root=fixture();
  a.equal(loadLane(root,'FORGE_APPLICATION_OUTCOME_TRACKER').l.enabled,false);
  a.throws(()=>buildPrompt(root,'FORGE_APPLICATION_OUTCOME_TRACKER',{}),/held lane/);
});

// cs-92f6a3b0 / Tim 2026-11-26: hard $1.00 floor and Nov 30 expiry replace the old $20 deferral.
test('prompt carries the $1.00 floor, expiry and high reasoning, never the $20 deferral',()=>{
  const r=buildPrompt(fixture(),'FORGE_EMAIL_DISCOVERY',{});
  a.match(r.prompt,/Hard floor \$1\.00/);
  a.match(r.prompt,/2026-11-30T23:59 ET/);
  a.match(r.prompt,/reasoning_effort high/);
  a.doesNotMatch(r.prompt,/\$20/);
});

test('runtime:current lanes read the pinned release and carry the lane focus',()=>{
  const r=buildPrompt(fixture(),'FORGE_APPLICATION_WRITER_GOFER',{});
  a.match(r.prompt,/GOFER RELEASE PROCEDURE/);
  a.match(r.prompt,/FOCUS: fill missing discovery and intake data/);
});

test('checked-in lanes run on the grant runner with existing procedures and live registry routes',()=>{
  const root=path.resolve(__dirname,'../..');
  const m=JSON.parse(fs.readFileSync(path.join(__dirname,'lanes.json'),'utf8'));
  const reg=JSON.parse(fs.readFileSync(path.join(root,'control/AI_AUTOMATION_TASKS.json'),'utf8'));
  a.equal(m.grant.floorUsd,1); a.equal(m.grant.expiresET,'2026-11-30T23:59'); a.equal(m.grant.reasoningEffort,'high'); a.equal(m.grant.paidFallback,false);
  a.ok(m.lanes.FORGE_APPLICATION_WRITER_GOFER.enabled);
  a.equal(reg.tasks.FORGE_APPLICATION_WRITER_GOFER.route,'runtime');
  for(const [k,l] of Object.entries(m.lanes)){
    a.equal(l.runner,'grant',k); a.equal(l.model,'gpt-5.4-mini',k); a.equal(l.reasoningEffort,'high',k);
    a.equal(l.timezone,'America/New_York',k); a.ok(l.timeoutMinutes<=25,k);
    const t=reg.tasks[k]; a.ok(t&&!t.retired,k+' is a live registry task');
    a.equal(l.enabled,!t.executionHold,k+' is enabled exactly when the registry has no hold');
    a.ok(fs.existsSync(path.join(root,require('./build-prompt.js').procedurePath(root,k,l.procedure))),k+' procedure exists');
  }
});
