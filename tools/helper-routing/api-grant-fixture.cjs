'use strict';
const a=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const API=require('./api-grant.cjs'),H=require('./shared.cjs'),S=require('../programmed-coordinator/store.cjs'),C=require('../programmed-coordinator/collect.cjs'),T=require('../programmed-coordinator/transactions.cjs');
const partner='FORGE_CLAUDE_SHARED_HELPER',at='2026-11-22T04:00:00Z';
function fixture(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'api-route-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const work={schema:'forge.shared-helper-work.v1',assignmentId:'SYNTHETIC-API',enabled:true,routingActive:true,
  providers:{[partner]:{provider:'Claude',available:true},FORGE_GROK_SHARED_HELPER:{provider:'Grok',available:false},[API.TASK]:{provider:'ChatGPT',available:true}},
  items:[{primaryId:'V2I-HERMES',kind:'ENRICHMENT',taskKey:partner,provider:'Claude',status:'ASSIGNED',assignmentVersion:1,sourceVersion:'a'.repeat(64)}]};
 const authRef='receipts/SHARED_HELPER_IDENTITY/SYNTHETIC_AUTH.json',ackRef='receipts/SHARED_HELPER_IDENTITY/SYNTHETIC_ACK.json';
 const auth={schema:'forge.api-grant-authorization.v1',taskKey:API.TASK,worker:'forge-grant-luna',host:'TIMMAY',project:'Default',assignmentId:work.assignmentId,hermesTaskKey:partner,grantOnly:true};
 const ack={schema:'forge.shared-execution-identity-ack.v1',identity:'Hermes',taskKey:partner,provider:'Claude',assignmentId:work.assignmentId,status:'ACKNOWLEDGED',runId:'SYNTHETIC-ACK',assignments:[{primaryId:'V2I-HERMES',assignmentVersion:1,sourceVersion:'a'.repeat(64)}]};
 S.save(root,authRef,auth);S.save(root,ackRef,ack);
 work.apiGrantBinding={schema:'forge.api-grant-binding.v1',enabled:true,worker:'forge-grant-luna',host:'TIMMAY',project:'Default',authorizationRef:authRef,
  authorizationSha256:S.hash(fs.readFileSync(path.join(root,authRef))),hermes:{taskKey:partner,provider:'Claude',acknowledgmentRef:ackRef,acknowledgmentSha256:S.hash(fs.readFileSync(path.join(root,ackRef)))}};
 const registry={schema:'forge.ai-automation-tasks.v1',common:'policy/current/AI_AUTOMATION_COMMON.txt',tasks:{
  [API.TASK]:{owner:'ChatGPT',enabled:true,executionIdentity:'forge-grant-luna',route:'utility',procedure:API.PROCEDURE,workAssignments:H.FILE,executionMode:'WRITE_THROUGH_SUPPORTED_WRITER'},
  [partner]:{owner:'Claude',enabled:true,executionIdentity:'Hermes',workAssignments:H.FILE}}};
 S.save(root,H.FILE,work);S.save(root,'control/AI_AUTOMATION_TASKS.json',registry);
 S.save(root,'control/ENRICHMENT_HELPER_WORK.json',{schema:'forge.enrichment-helper-work.v1',enabled:true,assignmentId:'LEGACY',provider:'ChatGPT',taskKey:'FORGE_CHATGPT_ENRICHMENT_RESEARCH',items:[]});
 S.save(root,'control/CLAUDE_HELPER_WORK.json',{schema:'forge.claude-helper-work.v1',enabled:false,intake:[],enrichment:[]});
 for(const file of [registry.common,API.PROCEDURE]){fs.mkdirSync(path.dirname(path.join(root,file)),{recursive:true});fs.writeFileSync(path.join(root,file),'Synthetic contract\n');}
 const ids=['V2I-API1','V2I-API2'],snapshot={source:{kind:'CANONICAL_WRITER_MASTER',readAt:at},rows:[],archiveRows:[],needsById:{},neverConsiderById:{},writerReceiptIndex:{requests:{},pending:[]},status:{freeze:null,level:'OK',errors:[],unverified:{count:0}}};
 for(const id of ids){const row={PRIMARY_ID:id,COMPANY:'Factory',TITLE:'Manager',LOCATION:'Ohio',BUCKET:'SCOUT_INTAKE',p:{SOURCE_URL:'https://example.com/job'}};
  row.line='1 | '+id+' | Factory | Manager | SCOUT_INTAKE | - | - | - | Ohio | SOURCE_URL=https://example.com/job';snapshot.rows.push(row);snapshot.needsById[id]=['DEGREE'];
  snapshot.neverConsiderById[id]={status:'CLEAR',rowSha256:S.hash(row.line),readAt:at,policySha256:'f'.repeat(64)};
 }
 return{root,work,registry,ids,hermesIds:['V2I-HERMES'],snapshot,state:C.empty(),now:Date.parse(at)};
}
function prepared(f){const p=API.plan(f);S.save(f.root,H.FILE,p.work); // synthetic publication only
 const quote='Bachelor degree preferred.',text=quote+' '+'Manufacturing leadership and operational quality. '.repeat(8);
 const items=p.work.items.filter(i=>i.taskKey===API.TASK).map(i=>({...i,writerSubmitted:false,recommendation:'ENRICHMENT_EVIDENCE_READY',sourceEvidence:{company:i.company,title:i.title,location:i.location,url:'https://example.com/job',observedAt:at,quote,capture:{kind:'TEXT_EXTRACT',text},proposedRawFields:{DEGREE_TEXT:quote,DEGREE_REQ:'PREFERRED'},fieldQuotes:{DEGREE:quote}}}));
 return API.envelope({root:f.root,items,runId:'FORGE-CHATGPT-API-SYNTHETIC',instructionCommit:'a'.repeat(40)});
}

module.exports={fixture,prepared};
