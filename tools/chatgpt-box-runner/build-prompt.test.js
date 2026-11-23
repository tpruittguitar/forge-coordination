'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {buildPrompt,loadLane,grantFirst}=require('./build-prompt.js');

function fixture(){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'chatgpt-box-prompt-'));
  const lanes={schema:'forge.chatgpt-box-lanes.v1',commonEntry:'control/FORGE_SHARED_AUTOMATION_ENTRY.txt',lanes:{
    FORGE_EMAIL_DISCOVERY:{enabled:true,procedure:'lanes/CHATGPT_INTAKE_INSPECTION.txt',model:'sonnet',timeoutMinutes:25,runner:'claude'},
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
