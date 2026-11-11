'use strict';
// Initiation provenance is independent of the posting host and Writer transport.
// Read only: this never changes historical master rows or replays an intake.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const Identity=require('../source-trial/job-identity'),Evidence=require('../source-trial/evidence-store');
const norm=s=>String(s||'').trim().toLowerCase().replace(/\s+/g,' ');
const shape=r=>[r.company||r.COMPANY,r.title||r.TITLE,r.location||r.LOCATION].map(norm);
const emailSource=s=>/^(?:EMAIL_RECOVERY|(?:state\/)?EMAIL_RECOVERY_QUEUE\.json(?:#.*)?|(?:receipts\/)?EMAIL_(?:CANDIDATE_LEDGER|EVAL|PENDING)[^/]*)$/.test(s||'');
function index(root){
 const read=file=>{try{const raw=fs.readFileSync(path.join(root,file),'utf8');return {data:JSON.parse(raw),proof:{path:file,sha256:crypto.createHash('sha256').update(raw).digest('hex')}};}catch{return {data:{},proof:null};}};
 const email=read('state/EMAIL_RECOVERY_QUEUE.json'),upstream=read('state/UPSTREAM_LEDGER.json'),byKey=new Map();
 for(const job of Object.values(email.data.jobs||{})){
  const key=Identity.urlKey(job.url||job.SOURCE_URL),ids=shape(job);
  if(!key||ids.some(x=>!x)||!Array.isArray(job.sourceEmails)||!job.sourceEmails.some(id=>typeof id==='string'&&/^[a-f0-9]{16}$/i.test(id)))continue;
  if(!byKey.has(key))byKey.set(key,[]);byKey.get(key).push(job);
 }
 return {find(role){
  const key=Identity.urlKey(role.initiatingUrl||role.INITIATING_URL||role.url||role.SOURCE_URL),ids=shape(role),entry=upstream.data.entries?.[key];
  if(!entry||entry.IDENTITY_EVIDENCE_CONFLICT||ids.some(x=>!x))return null;
  // A mixed-source aggregate does not establish which source initiated discovery.
  // Neither a later email nor a matching LinkedIn/Indeed URL proves email origin.
  if(!entry.sources?.length||!entry.sources.every(emailSource))return null;
  const matches=(byKey.get(key)||[]).filter(j=>shape(j).every((x,i)=>x===ids[i])&&Evidence.sameRequisition(j,role));
  if(matches.length!==1)return null;
  const job=matches[0];
  if(shape(entry).some((x,i)=>x!==ids[i]))return null;
  return {origin:'EMAIL',basis:'EXACT_EMAIL_ONLY_DISCOVERY_HISTORY',key,proofs:[email.proof,upstream.proof],sourceEmailIds:[...new Set(job.sourceEmails.filter(id=>typeof id==='string'&&/^[a-f0-9]{16}$/i.test(id)))].sort()};
 }};
}
module.exports={index,emailSource};
