'use strict';
/* Pre-admission gate for the source-trial adapter. No network, no Writer credentials, no writes. */
const fs=require('node:fs');
const L=require('../source-trial/lib');
const MAX_BATCH=200;
function plan(preview,master,{snapshotAsOf,runId='FORGE-SOURCE-ADMISSION-REVIEW'}={}){
 if(!Array.isArray(preview?.rows)||!Array.isArray(master))throw Error('BLOCKED: preview rows and canonical master snapshot required');
 if(!snapshotAsOf||!Number.isFinite(Date.parse(snapshotAsOf)))throw Error('BLOCKED: timestamped live canonical master snapshot required');
 const age=Date.now()-Date.parse(snapshotAsOf);
 if(age > 15*60*1000 || age < -2*60*1000)throw Error('BLOCKED: canonical master snapshot outside 15-minute freshness window');
 if(!/^[A-Z0-9_-]+$/.test(runId))throw Error('BLOCKED: invalid run identifier');
 const index=L.masterIndex(master);
 const rows=preview.rows.map(x=>{
  const rec=x.record||{},candidate=x.verdict==='CANDIDATE_REQUIRES_WRITER_CHECK';
  const status=candidate?L.novelty(index,rec.COMPANY,rec.TITLE,rec.SOURCE_URL,rec.LOCATION,rec.REQ_ID):'NOT_CANDIDATE';
  let gate=!candidate?x.verdict:status==='EXISTING_PROTECTED'?'PROTECTED_HOLD':status==='EXISTING'?'EXISTING_REVIEW':'REVIEW_REQUIRED';
  // All apparent NEW records require canonical employer-business evidence and live Writer decisions.
  if(gate==='REVIEW_REQUIRED'&&!rec.EMPLOYER_PRIMARY_BUSINESS)gate='EMPLOYER_BUSINESS_REVIEW';
  return {index:x.index,company:rec.COMPANY,title:rec.TITLE,location:rec.LOCATION,url:rec.SOURCE_URL,masterStatus:status,gate,sourceVerdict:x.verdict,tier:x.tier||'UNKNOWN',flags:Array.isArray(x.flags)?x.flags:[],memphisStrongNegative:Array.isArray(x.flags)&&x.flags.includes('MEMPHIS_STRONG_NEGATIVE')};
 });
 const counts={input:rows.length};for(const x of rows)counts[x.gate]=(counts[x.gate]||0)+1;
 return {mode:'NON_SUBMITTABLE_REVIEW_ONLY',writer_submissions:0,runId,snapshotAsOf,counts,rows,writer_payloads:[],maxBatch:MAX_BATCH};
}

// A production admission audit must use the caller-inaccessible acquisition path below.
// The authenticated reader is dependency-injected because the live Writer URL and
// request schema must come from the governing contract, never be guessed here.
async function auditAuthenticated(preview,{fetchMaster,fetchArchive,clock=()=>Date.now(),maxAgeMs=900000}={}){
 if(typeof fetchMaster!=='function'||typeof fetchArchive!=='function')throw Error('BLOCKED: authenticated master and archive readers required');
 const begin=clock();
 const masterResponse=await fetchMaster();
 const archiveResponse=await fetchArchive();
 const end=clock();
 if(!masterResponse||masterResponse.authenticated!==true||masterResponse.source!=='WRITER'||!Array.isArray(masterResponse.rows))throw Error('BLOCKED: authoritative Writer master acquisition failed');
 if(!archiveResponse||archiveResponse.authenticated!==true||archiveResponse.source!=='WRITER'||!Array.isArray(archiveResponse.rows))throw Error('BLOCKED: authoritative Writer archive acquisition failed');
 if(end<begin||end-begin>maxAgeMs)throw Error('BLOCKED: authenticated acquisition expired');
 const master=[...masterResponse.rows,...archiveResponse.rows];
 const stamp=new Date(end).toISOString();
 const result=plan(preview,master,{snapshotAsOf:stamp});
 // Checking snapshot timestamps alone is not proof of real authentication;
 // callers must review the concrete fetchMaster/fetchArchive adapter separately.
 return {...result,acquisition:{source:'WRITER',masterCount:masterResponse.rows.length,archiveCount:archiveResponse.rows.length,startedAt:new Date(begin).toISOString(),completedAt:stamp,readMethod:'INJECTED_AUTHENTICATED_READER'},productionAdmission:'BLOCKED_UNTIL_READER_CONTRACT_QA'};
}
module.exports={plan,auditAuthenticated};
if(require.main===module){
 const [p,m,out,asOf]=process.argv.slice(2);
 if(!p||!m||!out||!asOf)throw Error('Usage: node tools/source-intake/admission.js preview.json live-master-snapshot.json output.json snapshot-ISO-time');
 const x=plan(JSON.parse(fs.readFileSync(p,'utf8')),JSON.parse(fs.readFileSync(m,'utf8')),{snapshotAsOf:asOf});
 fs.writeFileSync(out,JSON.stringify(x,null,2)+'\n');
 console.log(JSON.stringify(x.counts));
}
