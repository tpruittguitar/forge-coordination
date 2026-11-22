'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),V=require('./pilot-terminal.cjs'),S=require('./store.cjs'),W=require('../grant-backlog/worker.cjs');
function sample(){
 const ids=Array.from({length:5},(_,i)=>'V2I-SYNTHETIC-'+i),g={receiptId:'SYNTHETIC',revision:'a',ids,workIdentity:'FORGE_OPENAI_DIRECT_PILOT',project:{id:'proj_SYNTHETIC'},checkpointDir:'/private/synthetic'};
 const text='Bachelor degree required.',e={company:'Factory',title:'Manager',location:'Ohio',url:'https://example.com/job',observedAt:'2026-11-22T04:00:00Z',sha256:S.hash(text),capture:{kind:'TEXT_EXTRACT',text},fieldQuotes:{DEGREE:text},proposedRawFields:{DEGREE_REQ:'REQUIRED',DEGREE_TEXT:text}};
 const job={status:'PREPARED',reused:true,evidence:e,degree:{requirement:'REQUIRED',equivalence:'UNKNOWN',confidence:'HIGH',quote:text}};
 const s={schema:'forge.native-five-local.v1',binding:W.hash({receiptId:g.receiptId,revision:g.revision,ids,workIdentity:g.workIdentity,project:g.project,dir:g.checkpointDir}),ids,jobs:Object.fromEntries(ids.map(id=>[id,structuredClone(job)])),reservedMicrousd:0,confirmedUsageMicrousd:0};
 const report={mode:'live-evidence-only',jobs:5,modelAttempts:0,preparedJobs:5,preparedFields:10,reservedMicrousd:0,confirmedUsageMicrousd:0,unknownOutcomeJobs:0,writerRequests:0,stop:null};return {g,s,report};
}
test('five independently checked prepared records are eligible for separate review, never automatic continuation',()=>{const f=sample();a.equal(V.validate(f.s,f.g,f.report),true);});
for(const status of ['HELD','CHECKING','RESERVED','IN_FLIGHT','OUTCOME_UNKNOWN','RESPONSE_RECEIVED','NO_SUPPORTED_FACTS'])test('five '+status+' records never qualify as success',()=>{
 const f=sample();for(const j of Object.values(f.s.jobs)){j.status=status;delete j.evidence;delete j.degree;delete j.reused;}
 f.report.preparedJobs=0;f.report.preparedFields=0;f.report.unknownOutcomeJobs=status==='OUTCOME_UNKNOWN'?5:0;
 a.equal(V.validate(f.s,f.g,f.report),false);
});
for(const change of [f=>delete f.s.jobs[f.g.ids[0]],f=>f.s.jobs[f.g.ids[0]].status='invented',f=>delete f.s.jobs[f.g.ids[0]].evidence,f=>f.s.jobs[f.g.ids[0]].evidence.fieldQuotes.DEGREE='made up',f=>f.s.jobs[f.g.ids[0]].degree.requirement='PREFERRED',f=>f.s.binding='wrong',f=>f.report.modelAttempts=5,f=>f.s.stop='/private/location'])test('malformed or falsely summarized checkpoint remains fenced',()=>{const f=sample();change(f);a.throws(()=>V.validate(f.s,f.g,f.report));});
