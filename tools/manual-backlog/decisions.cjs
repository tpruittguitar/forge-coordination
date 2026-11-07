'use strict';
// Existing observer owns upstream accounting; Writer retains all canonical mutations.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const API='https://foreman-cockpit.pages.dev/api/backlog-decisions';
const hash=x=>crypto.createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex');
const norm=x=>String(x||'').toLowerCase().replace(/[^a-z0-9]/g,'');
const file=id=>'receipts/manual-backlog/'+id+'.json';
function normalize(r){
 if(r.schema!=='forge.manual-backlog-request.v1'||!/^[0-9a-f-]{36}$/.test(r.requestId||'')||!/^[a-f0-9]{40}$/.test(r.snapshotRevision||'')||!['DECLINE','DELETE'].includes(r.decision)||!Array.isArray(r.items)||!r.items.length||r.items.length>100)throw Error('INVALID_MANUAL_REQUEST');
 const keys=r.items.map(i=>i.key);if(keys.some(k=>typeof k!=='string'||!/^(linkedin:\d+|indeed:[a-f0-9]{16}|(?:url|unresolved):[a-f0-9]{24}|pid:V2[A-Z]-[A-Z0-9]+(?:-[A-Z0-9]+)*)$/.test(k))||new Set(keys).size!==keys.length)throw Error('INVALID_DISCOVERY_KEYS');
 if(r.scope!==undefined&&r.scope!=='DISCOVERY_CARD_DISMISSAL')throw Error('INVALID_MANUAL_SCOPE');
 return {schema:r.schema,requestId:r.requestId,snapshotRevision:r.snapshotRevision,decision:r.decision,...(r.scope?{scope:r.scope}:{}),items:keys.sort().map(key=>({key}))};
}
function card(e){return {key:e.key,company:e.company||'',title:e.title||'',location:e.location||'',sourceUrl:require('../pipeline-observability/waiting-queues').sourceUrl(e)};}
function safe(e,{rows,fences=new Set(),item,scope}={}){
 if(!Array.isArray(rows))return 'CANONICAL_READ_REQUIRED';
 if(scope==='DISCOVERY_CARD_DISMISSAL'){
  // Dismiss the saved discovery card, never an outstanding Writer operation.
  if(fences.has(e.key)||(item?.aliases||[]).some(k=>fences.has(k))||item?.fence||item?.action==='RECONCILE_WRITER'||/UNKNOWN|SUBMITTED|IN_FLIGHT|HELD_WRITER|VERIFIED_INSERTED|NO_REPLAY/.test(e.evidenceStatus||''))return 'ACTIVE_WRITER_RECONCILIATION_REQUIRED';
  if(e.key.startsWith('pid:')||e.primaryId||e.claimedPid||['PRESENT','MISSING_PREVIOUSLY_PRESENT'].includes(e.status)||item?.currentRepresentation)return 'CANONICAL_IDENTITY_PROTECTED';
  if(item?.sourceConflict||/CONFLICT/.test(e.evidenceStatus||''))return 'IDENTITY_CONFLICT_REQUIRES_RECONCILIATION';
  return null;
 }
 if(/^(pid|unresolved):/.test(e.key)||e.primaryId||e.claimedPid||['PRESENT','MISSING_PREVIOUSLY_PRESENT','IDENTITY_HOLD','HELD'].includes(e.status)||/HOLD|HELD|UNKNOWN|SUBMITTED|IN_FLIGHT|EXISTING|VERIFIED_INSERTED/.test(e.evidenceStatus||''))return 'PROTECTED_IDENTITY';
 if(fences.has(e.key)||item?.fence||item?.sourceConflict||item?.currentRepresentation||item?.action==='RECONCILE_WRITER')return 'WRITER_OR_IDENTITY_FENCE';
 if(rows.some(r=>norm(r.COMPANY)===norm(e.company)&&norm(r.TITLE)===norm(e.title)))return 'CANONICAL_IDENTITY_PROTECTED';
 return null;
}
function approved(e,context){
 const proof=context.decisions?.get(e.key)||e.manualDecision;
 if(!proof||proof.schema!=='forge.manual-backlog-proof.v1'||!['DECLINE','DELETE'].includes(proof.decision)||proof.cardSha256!==hash(card(e))||!/^[a-f0-9]{64}$/.test(proof.receiptId||'')||safe(e,{...context,scope:proof.scope}))return null;
 return proof;
}
function snapshot(root,revision){
 // A submitted revision must belong to this repository's current history.
 cp.execFileSync('git',['merge-base','--is-ancestor',revision,'HEAD'],{cwd:root,stdio:'pipe'});
 const read=p=>cp.execFileSync('git',['show',revision+':'+p],{cwd:root,maxBuffer:8e6,encoding:'utf8'});
 const index=JSON.parse(read('state/PIPELINE_WAITING_QUEUES.json')),cards=new Map();
 if(!index.reconciled||index.schema!=='forge.waiting-queues.v1')throw Error('INVALID_SNAPSHOT');
 for(const p of index.intake.pages){if(!/^state\/waiting-queues\/intake-\d{4}\.json$/.test(p.path))throw Error('INVALID_PAGE');const raw=read(p.path);if(hash(raw)!==p.sha256)throw Error('PAGE_HASH_MISMATCH');for(const c of JSON.parse(raw).items)cards.set(c.key,c);}
 return cards;
}
async function load(root,{key,fetchImpl=fetch}={}){
 const requests=[];let cursor;
 for(let page=0;page<100;page++){
  const u=new URL(API);u.searchParams.set('action','queue');if(cursor)u.searchParams.set('cursor',cursor);
  const res=await fetchImpl(u,{headers:{'x-writer-key':key},signal:AbortSignal.timeout(15000),redirect:'error'});
  // Rolling deployment: old cockpit has no inbox yet. Nothing can be submitted before capability marker.
  if(res.status===404)return [];
  if(!res.ok)throw Error('MANUAL_BACKLOG_INBOX_UNAVAILABLE');
  if(/text\/html/i.test(res.headers.get('content-type')||''))return []; // Pages pre-endpoint SPA fallback
  const data=await res.json();if(!data.ok||!Array.isArray(data.requests))throw Error('INVALID_BACKLOG_INBOX');
  for(const r of data.requests)if(/^[a-f0-9]{64}$/.test(r.receiptId||'')&&!fs.existsSync(path.join(root,file(r.receiptId))))requests.push(r);
  cursor=data.cursor;if(!cursor)return requests;
 }
 throw Error('MANUAL_BACKLOG_INBOX_PAGE_LIMIT');
}
function prepare(root,requests,{ledger,rows,snapshotReader=snapshot}={}){
 const decisions=new Map(),receipts=[],snapshots=new Map(),fences=require('../intake-drain/queue.cjs').writerFences(root);
 const drain=JSON.parse(fs.readFileSync(path.join(root,'state/INTAKE_DRAIN.json'),'utf8'));
 for(const input of requests){
  const r=normalize(input);if(hash(r)!==input.receiptId)throw Error('MANUAL_REQUEST_HASH_MISMATCH');
  const receipt={schema:'forge.manual-backlog-receipt.v1',receiptId:input.receiptId,requestId:r.requestId,status:'COMPLETE',decision:r.decision,snapshotRevision:r.snapshotRevision,observedAt:new Date().toISOString(),canonicalWrites:0,...(r.scope?{scope:r.scope}:{}),items:[]};
  if(!snapshots.has(r.snapshotRevision)){try{snapshots.set(r.snapshotRevision,snapshotReader(root,r.snapshotRevision));}catch{snapshots.set(r.snapshotRevision,new Map());}}
  const original=snapshots.get(r.snapshotRevision);
  for(const {key} of r.items){
   const entry=ledger?.entries[key],c=original.get(key),out={key,decision:r.decision,status:'HELD',reason:''};receipt.items.push(out);
   if(!entry||!c){out.status='STALE';out.reason='SNAPSHOT_IDENTITY_UNAVAILABLE';continue;}
   if(hash(card(entry))!==hash({key:c.key,company:c.company||'',title:c.title||'',location:c.location||'',sourceUrl:c.sourceUrl||null})){out.status='STALE';out.reason='DISPLAYED_IDENTITY_CHANGED';continue;}
   const item=Object.values(drain.items||{}).find(i=>i.key===key||i.aliases?.includes(key));
   const reason=safe(entry,{rows,fences,item,scope:r.scope});if(reason){out.reason=reason;continue;}
   if(entry.status==='EXCLUDED'){out.status='ALREADY_ACCOUNTED';out.reason='ALREADY_EXCLUDED';continue;}
   if(!(r.scope==='DISCOVERY_CARD_DISMISSAL'?['WAITING','HELD','IDENTITY_HOLD']:['WAITING']).includes(entry.status)||decisions.has(key)){out.reason='CURRENT_PENDING_IDENTITY_REQUIRED';continue;}
   decisions.set(key,{schema:'forge.manual-backlog-proof.v1',receiptId:input.receiptId,decision:r.decision,cardSha256:hash(card(entry)),snapshotRevision:r.snapshotRevision,observedAt:receipt.observedAt,...(r.scope?{scope:r.scope}:{})});
   out.reason='AWAITING_OBSERVER';
  }
  receipts.push(receipt);
 }
 const itemsByAlias=new Map();for(const item of Object.values(drain.items||{}))for(const alias of [item.key,...item.aliases||[]])itemsByAlias.set(alias,item);
 return {decisions,receipts,fences,rows,itemsByAlias};
}
function publish(root,prepared,up){
 if(!up.summary.reconciled)throw Error('RECONCILED_OBSERVER_REQUIRED');
 for(const receipt of prepared.receipts){
  for(const item of receipt.items){const e=up.ledger.entries[item.key];if(item.reason==='AWAITING_OBSERVER'){if(e?.status==='EXCLUDED'&&e.manualDecision?.receiptId===receipt.receiptId){item.status='APPLIED';item.reason=receipt.scope==='DISCOVERY_CARD_DISMISSAL'?'USER_DISMISSED_DISCOVERY_CARD_HISTORY_RETAINED':'USER_SELECTION_EXCLUDED_FROM_BACKLOG_HISTORY_RETAINED';}else item.reason='OBSERVER_DID_NOT_CONFIRM_EXCLUSION';}}
  receipt.observerAt=up.ledger.at;receipt.ledgerSha256=hash(up.ledger);
  const p=path.join(root,file(receipt.receiptId));fs.mkdirSync(path.dirname(p),{recursive:true});if(!fs.existsSync(p))fs.writeFileSync(p,JSON.stringify(receipt,null,2)+'\n');
 }
}
function dismissedKeys(root){
 const ledger=JSON.parse(fs.readFileSync(path.join(root,'state/UPSTREAM_LEDGER.json'),'utf8'));
 if(ledger.schema!=='forge.upstream-ledger.v1'||!ledger.entries)throw Error('DISMISSAL_LEDGER_REQUIRED');
 return new Set(Object.values(ledger.entries).filter(e=>e.status==='EXCLUDED'&&e.manualDecision?.scope==='DISCOVERY_CARD_DISMISSAL'&&e.manualDecision.cardSha256===hash(card(e))).map(e=>e.key));
}
module.exports={dismissedKeys,hash,normalize,card,safe,approved,snapshot,load,prepare,publish};
