'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const hex=(s,n)=>typeof s==='string'&&new RegExp('^[a-f0-9]{'+n+'}$').test(s),date=s=>Number.isFinite(Date.parse(s));
function load(root,file){if(!/^receipts\/[A-Za-z0-9_-]+\.json$/.test(file))throw Error('Invalid coordinator proof path');return JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));}
function utility(root,t){
 if(t.schema!=='forge.helper-coordinator-terminal.v1'||t.provider!=='ChatGPT'||t.taskKey!=='FORGE_EMAIL_DISCOVERY'||!hex(t.instructionCommit,40)||!date(t.at)||!Number.isSafeInteger(t.submitted)||t.submitted<0||t.submitted!==t.verified||t.pendingMasterWrites!==0||t.fullyEnrichedJobsClaimed!==0)return false;
 const collection=load(root,t.collectionProof);if(collection.runId!==t.runId||!date(collection.at)||Date.parse(collection.at)>Date.parse(t.at))return false;
 const sources=[...(collection.intake?[collection.intake]:[]),...(collection.enrichment||[])];
 for(const source of sources){if(!/^receipts\/(?:GROK_HELPERS|CLAUDE_HELPERS)\/FORGE_[A-Z0-9_]+\/[A-Za-z0-9_-]+\.json$/.test(source.path))return false;const raw=fs.readFileSync(path.join(root,source.path),'utf8').replace(/\r\n/g,'\n'),hash=s=>crypto.createHash('sha256').update(s).digest('hex');if(![hash(raw),hash(raw.replace(/\n/g,'\r\n'))].includes(source.sha256)||JSON.parse(raw).items.length!==source.items)return false;if(source.validationError&&!source.noPromotion)return false;}
 if(!t.verified)return t.submitted===0;
 const p=load(root,t.writerProof),acceptance=load(root,t.writerProof.replace('_VERIFIED.json','_ACCEPTANCE.json'));
 return p.run===t.runId&&p.requestId===acceptance.requestId&&typeof p.writeId==='string'&&p.writeId.length>0&&p.writeId===acceptance.writeId&&p.acceptedResponseSha256===acceptance.responseSha256&&hex(p.acceptedResponseSha256,64)&&hex(p.indexSha,40)&&date(p.independentCompleteObservedAt)&&date(p.readbackStartedAt)&&Date.parse(p.readbackStartedAt)>=Date.parse(p.independentCompleteObservedAt)&&Date.parse(p.at)<=Date.parse(t.at)&&p.verifiedUpdates===t.verified&&Array.isArray(p.proofs)&&p.proofs.length===t.verified&&new Set(p.proofs.map(x=>x.primaryId)).size===t.verified&&p.proofs.every(x=>t.verifiedIds?.includes(x.primaryId)&&x.independentReceipt==='COMPLETE'&&hex(x.rowSha256,64)&&Object.keys(x.fields||{}).length>0&&Object.values(x.fields).every(v=>v===true));
}
function programmed(root,t){
 const c=t.canonicalSource;if(t.schema!=='forge.programmed-coordinator-report.v1'||t.mode!=='apply'||!hex(t.instructionCommit,40)||!date(t.at)||c?.kind!=='CANONICAL_WRITER_MASTER'||!hex(c.sha256,64)||!date(c.readAt)||Date.parse(c.readAt)>Date.parse(t.at)||Date.parse(t.at)-Date.parse(c.readAt)>900000||!Number.isSafeInteger(c.rows)||c.rows<1||!Array.isArray(t.transactions))return false;
 // Outstanding writes are valid execution evidence, never verified mutation.
 for(const tx of t.transactions.filter(x=>x.status==='VERIFIED')){const p=load(root,'receipts/'+tx.requestId+'_VERIFIED.json');if(p.schema!=='forge.programmed-coordinator-verification.v1'||p.requestId!==tx.requestId||!hex(p.acceptanceSha256,64)||(!p.noWrite&&!hex(p.independentIndexSha,40))||!date(p.completeObservedAt)||Date.parse(p.completeObservedAt)>Date.parse(t.at)||!Array.isArray(p.proofs)||p.proofs.length!==tx.items||!p.proofs.every(x=>hex(x.rowSha256,64)&&Array.isArray(x.fields)&&x.fields.length>0))return false;}
 return true;
}
function coordinatorProof(root,t){try{return utility(root,t)||programmed(root,t);}catch{return false;}}
module.exports={coordinatorProof};
