'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const T=require('./transactions.cjs'),S=require('./store.cjs'),C=require('./collect.cjs');
function dir(t){const p=fs.mkdtempSync(path.join(os.tmpdir(),'forge-fence-index-'));t.after(()=>fs.rmSync(p,{recursive:true,force:true}));return p;}
test('index preserves each legacy ledger/checkpoint ID form and unrelated IDs stay open',t=>{
 const root=dir(t),state={transactions:{x:{requestId:'OLD',status:'AWAITING_VERIFICATION',ids:['TX']},v:{status:'VERIFIED',ids:['DONE']}}};
 S.save(root,'state/enrich-ats-pay.json',{pendingWrites:{x:{ids:['PAY']}}});
 S.save(root,'state/CLAUDE_HELPER_CONSUMPTION.json',{items:[{primaryId:'PRIMARY',key:'KEY',status:'SUBMITTED'},{primaryId:'CLEAR',status:'VERIFIED'}]});
 S.save(root,'receipts/X_CHECKPOINT.json',{ids:['ID'],primaryIds:['PRIMARY_IDS'],requests:[{primaryId:'REQ'}],evidence:[{primaryId:'EVIDENCE'}]});
 S.save(root,'receipts/Y_CHECKPOINT.json',{ids:['VERIFIED_CP']});S.save(root,'receipts/Y_VERIFIED.json',{});
 const ix=T.fenceIndex(root,state);
 for(const id of ['TX','PAY','PRIMARY','KEY','ID','PRIMARY_IDS','REQ','EVIDENCE'])a.equal(ix.has(id),true,id);
 for(const id of ['DONE','CLEAR','VERIFIED_CP','UNRELATED'])a.equal(ix.has(id),false,id);
});
test('index reads checkpoints once, not once per queried candidate',t=>{
 const root=dir(t),state={transactions:{}};
 for(let i=0;i<250;i++)S.save(root,'receipts/'+i+'_CHECKPOINT.json',{ids:['ID'+i]});
 const read=fs.readFileSync;let reads=0;
 fs.readFileSync=function(f,...args){if(String(f).startsWith(root)&&String(f).endsWith('_CHECKPOINT.json'))reads++;return read.call(this,f,...args);};
 try{const ix=T.fenceIndex(root,state);for(let i=0;i<1000;i++)a.equal(ix.has('UNRELATED'+i),false);a.equal(reads,250);}finally{fs.readFileSync=read;}
});
test('malformed later input never opens a fence or hides read errors',t=>{
 const root=dir(t),state={transactions:{x:{requestId:'OLD',status:'AWAITING_VERIFICATION',ids:['TX']}}};
 fs.mkdirSync(path.join(root,'state'),{recursive:true});fs.writeFileSync(path.join(root,'state/enrich-ats-pay.json'),'{bad');
 const ix=T.fenceIndex(root,state);a.equal(ix.has('TX'),true);a.throws(()=>ix.has('OTHER'));a.throws(()=>T.fenced(root,state,'OTHER'));
});
test('new snapshots observe added checkpoints, verification and changed memory transactions',t=>{
 const root=dir(t),state={transactions:{}};const before=T.fenceIndex(root,state);a.equal(before.has('NEW'),false);
 S.save(root,'receipts/N_CHECKPOINT.json',{ids:['NEW']});a.equal(T.fenceIndex(root,state).has('NEW'),true);
 S.save(root,'receipts/N_VERIFIED.json',{});a.equal(T.fenceIndex(root,state).has('NEW'),false);
 state.transactions.x={requestId:'X',status:'POST_IN_FLIGHT_UNKNOWN',ids:['NEW']};a.equal(T.fenceIndex(root,state).has('NEW'),true);
});
test('submission builds fresh fences after canonical read, never trusts inspection snapshot',async t=>{
 const root=dir(t),privateDir=dir(t),state=C.empty(),id='V2I-ONE',key='TEST:'+id;
 state.items[key]={status:'READY_ENRICHMENT'};
 const row={PRIMARY_ID:id,COMPANY:'Factory',TITLE:'Plant Manager',LOCATION:'Austin, TX',BUCKET:'SCOUT_INTAKE',p:{}};
 a.equal(T.fenceIndex(root,state).has(id),false);let posts=0;
 const deps={checkLock(){},async snapshot(){S.save(root,'receipts/CONCURRENT_CHECKPOINT.json',{ids:[id]});return{rows:[row],status:{freeze:null,level:'OK',errors:[],unverified:{}}};},async post(){posts++;}};
 await a.rejects(T.submit({root,privateDir,state,jobs:[{itemKey:key,primaryId:id,identity:T.identity(row),fields:{DEGREE_REQ:'PREFERRED'}}],runId:'FORGE-TEST',deps}),/FENCE/);a.equal(posts,0);
});

test('malformed string ID lists fail closed rather than indexing characters',t=>{
 const root=dir(t);a.throws(()=>T.fenceIndex(root,{transactions:{x:{status:'AWAITING_VERIFICATION',ids:'V2I-ONE'}}}).has('V2I-ONE'),/INVALID_TRANSACTION_FENCE_IDS/);
 for(const ids of ['V2I-ONE',0,false,{}]){S.save(root,'state/enrich-ats-pay.json',{pendingWrites:{x:{ids}}});a.throws(()=>T.fenceIndex(root,{transactions:{}}).has('V2I-ONE'),/INVALID_PENDING_FENCE_IDS/);}
});
