'use strict';
// Recoverable discovery-card removal. Never reads or mutates canonical Writer data.
const crypto=require('node:crypto');
const pending=new Set(['WAITING','HELD','IDENTITY_HOLD','MISSING_PREVIOUSLY_PRESENT']);
const sha=x=>crypto.createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex');
const receiptPath=id=>'receipts/live-backlog/'+id+'.json';
const json=x=>JSON.stringify(x)+'\n';
const stable=x=>JSON.stringify(x,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
function activeDeletion(e){return e?.worksheetDeletion?.schema==='forge.worksheet-deletion.v1'&&e.worksheetDeletion.key===e.key&&/^[a-f0-9]{64}$/.test(e.worksheetDeletion.receiptId||'');}
function regroup(entries){const groups={};for(const e of Object.values(entries)){const key=e.primaryId&&e.status==='PRESENT'?'pid:'+e.primaryId:e.key;let g=groups[key];if(!g)g=groups[key]={status:e.status,firstSeen:e.firstSeen,aliases:[]};g.aliases.push(e.key);if(e.firstSeen&&(!g.firstSeen||e.firstSeen<g.firstSeen))g.firstSeen=e.firstSeen;}return groups;}
function load(read){
 const ledger=JSON.parse(read('state/UPSTREAM_LEDGER.json')),index=JSON.parse(read('state/PIPELINE_WAITING_QUEUES.json')),flow=JSON.parse(read('state/ENRICHMENT_FLOW.json')),upstream=JSON.parse(read('state/UPSTREAM_FLOW.json'));
 if(ledger.at!==upstream.at||stable(flow.upstream)!==stable(upstream)||stable(regroup(ledger.entries))!==stable(ledger.groups))throw Error('SOURCE_LEDGER_SUMMARY_MISMATCH');
 if(ledger.schema!=='forge.upstream-ledger.v1'||index.schema!=='forge.waiting-queues.v1'||!index.reconciled||!upstream.reconciled||flow.at!==index.at||flow.upstream?.waiting!==index.counts.intake)throw Error('SOURCE_SNAPSHOT_NOT_RECONCILED');
 const items=[],seen=new Set();for(const p of index.intake.pages){if(!/^state\/waiting-queues\/intake-\d{4}\.json$/.test(p.path))throw Error('INVALID_PAGE_PATH');const raw=read(p.path),page=JSON.parse(raw);if(sha(raw)!==p.sha256||page.items.length!==p.count)throw Error('SOURCE_PAGE_HASH_MISMATCH');for(const item of page.items){if(seen.has(item.key)||!pending.has(ledger.groups[item.key]?.status))throw Error('SOURCE_IDENTITY_MISMATCH');seen.add(item.key);items.push(item);}}
 if(items.length!==index.counts.intake||items.length!==upstream.waiting||Object.values(ledger.groups).filter(g=>pending.has(g.status)).length!==items.length)throw Error('SOURCE_COUNT_MISMATCH');
 const current={states:Object.fromEntries([...index.ids.enrichment.map(id=>[id,{enrichment:false}]),...index.ids.decision.map(id=>[id,{enrichment:true}])]),queues:{enrichment:index.counts.enrichment,readyForReview:index.counts.decision}};
 const expected=require('../pipeline-observability/waiting-queues').build(current,{ledger,summary:upstream},index.at);
 if(stable(expected.index.intake.pages)!==stable(index.intake.pages))throw Error('DISPLAYED_CARDS_DO_NOT_MATCH_LEDGER');
 return {ledger,index,flow,upstream,items};
}
function validateRequest(input){if(!/^[a-f0-9]{40}$/.test(input.revision||'')||!/^[a-f0-9-]{36}$/i.test(input.requestId||''))throw Error('INVALID_REQUEST');}
function mutate(source,input,kind,original=null,now=new Date().toISOString()){
 validateRequest(input);const s=structuredClone(source),id=sha({requestId:input.requestId,revision:input.revision,kind,keys:input.keys||null,receiptId:input.receiptId||null});
 const receipt={schema:'forge.live-backlog-receipt.v1',receiptId:id,requestId:input.requestId,operation:kind,baseRevision:input.revision,selectionRevision:input.selectionRevision||input.revision,at:now,canonicalWrites:0,items:[]};
 if(kind==='delete'){
  if(!Array.isArray(input.keys)||!input.keys.length||input.keys.length>10000||new Set(input.keys).size!==input.keys.length)throw Error('SELECT_UNIQUE_DISCOVERY_ROWS');
  const cards=new Map(s.items.map(i=>[i.key,i]));
  for(const key of input.keys){const g=s.ledger.groups[key];if(!cards.has(key)||!g||!pending.has(g.status))throw Error('SELECTED_ROW_NO_LONGER_ACTIVE');
   for(const alias of g.aliases){const e=s.ledger.entries[alias];if(!e||activeDeletion(e))throw Error('SELECTED_IDENTITY_CHANGED');receipt.items.push({key:alias,groupKey:key,previousStatus:e.status});e.worksheetDeletion={schema:'forge.worksheet-deletion.v1',key:alias,receiptId:id,at:now,currentStatus:e.status};e.status='EXCLUDED';}
  }
  receipt.removed=input.keys.length;
 }else if(kind==='restore'){
  if(!original||original.operation!=='delete'||original.receiptId!==input.receiptId)throw Error('DELETION_RECEIPT_REQUIRED');
  for(const prior of original.items){const e=s.ledger.entries[prior.key];if(!activeDeletion(e)||e.worksheetDeletion.receiptId!==original.receiptId)throw Error('ROW_CHANGED_OR_ALREADY_RESTORED');const status=e.worksheetDeletion.currentStatus||prior.previousStatus;if(!['WAITING','HELD','IDENTITY_HOLD','MISSING_PREVIOUSLY_PRESENT','PRESENT','EXCLUDED'].includes(status))throw Error('INVALID_RESTORE_STATUS');e.status=status;delete e.worksheetDeletion;receipt.items.push({key:e.key,restoredStatus:status});}
  receipt.restores=original.receiptId;
 }else throw Error('INVALID_OPERATION');
 s.ledger.groups=regroup(s.ledger.entries);s.ledger.worksheetUpdatedAt=now;
 const counts={WAITING:0,PRESENT:0,EXCLUDED:0,HELD:0,IDENTITY_HOLD:0,MISSING_PREVIOUSLY_PRESENT:0};for(const g of Object.values(s.ledger.groups)){if(!(g.status in counts))throw Error('UNKNOWN_LEDGER_STATUS');counts[g.status]++;}
 const closing=Object.values(s.ledger.groups).filter(g=>pending.has(g.status)).length,opening=s.upstream.waiting;
 const summary={...s.upstream,counts,waiting:closing,total:Object.keys(s.ledger.groups).length,accounted:Object.keys(s.ledger.groups).length,sourceIdentities:Object.keys(s.ledger.entries).length,aliasesMerged:Object.keys(s.ledger.entries).length-Object.keys(s.ledger.groups).length,worksheetUpdatedAt:now,reconciled:true,reconciliation:{from:s.upstream.at,to:s.upstream.at,opening,arrivals:Math.max(0,closing-opening),admitted:0,excluded:Math.max(0,opening-closing),otherExits:0,closing,basis:'User worksheet edit; original observation timestamps preserved'}};
 if(summary.screening)summary.screening={...summary.screening,pendingCandidates:closing};
 if(summary.canonicalPopulation)summary.canonicalPopulation={...summary.canonicalPopulation,linked:counts.PRESENT,withoutCapturedSource:summary.canonicalPopulation.total-counts.PRESENT};
 s.flow.upstream=summary;s.flow.worksheetUpdatedAt=now;
 // Reuse the exact app page builder and preserve original observation freshness.
 const current={states:Object.fromEntries([...s.index.ids.enrichment.map(id=>[id,{enrichment:false}]),...s.index.ids.decision.map(id=>[id,{enrichment:true}])]),queues:{enrichment:s.index.counts.enrichment,readyForReview:s.index.counts.decision}};
 const built=require('../pipeline-observability/waiting-queues').build(current,{ledger:s.ledger,summary},s.index.at);
 built.index.worksheetUpdatedAt=now;
 const files=new Map([['state/UPSTREAM_LEDGER.json',json(s.ledger)],['state/UPSTREAM_FLOW.json',json(summary)],['state/ENRICHMENT_FLOW.json',json(s.flow)],['state/PIPELINE_WAITING_QUEUES.json',json(built.index)]]);
 for(const p of s.index.intake.pages)files.set(p.path,null);for(const p of built.pages)files.set(p.path,p.body);
 if(kind==='restore')receipt.restored=Math.max(0,closing-opening);
 receipt.activeBefore=opening;receipt.activeAfter=closing;receipt.status='COMMITTED';files.set(receiptPath(id),json(receipt));
 return {files,receipt};
}
module.exports={pending,sha,receiptPath,activeDeletion,regroup,load,mutate};
