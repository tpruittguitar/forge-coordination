const test=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const R=require('../source-intake/queue-state.cjs'),Q=require('../intake-drain/queue.cjs');
function fixture(t){const root=fs.mkdtempSync(path.join(os.tmpdir(),'queue-conflict-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));fs.mkdirSync(path.join(root,'state'));return root;}
const conflict=(a,b,base='')=>'<<<<<<< local\n'+JSON.stringify(a,null,2)+'\n'+(base?'||||||| base\n'+JSON.stringify(base)+'\n':'')+'=======\n'+JSON.stringify(b,null,2)+'\n>>>>>>> remote\n';
test('conflicted drain preserves both request fences and holds disputed work while unrelated intake continues',t=>{
 const root=fixture(t),item=key=>({key,aliases:[key],card:{url:'https://example.com/'+key},status:'ACTION_REQUIRED',action:'INTAKE',screen:{outcome:'ADMIT'}}),left={schema:'forge.intake-drain.v1',items:{safe:item('safe'),disputed:{...item('disputed'),fence:{requestIds:['LEFT']}}}},right={schema:'forge.intake-drain.v1',items:{safe:item('safe'),disputed:{...item('disputed'),fence:{requestIds:['RIGHT']}},remote:item('remote')}};
 const raw=conflict(left,right,{items:{}});fs.writeFileSync(path.join(root,Q.FILE),raw);
 const work=R.read(root,Q.FILE);a.deepEqual(work.items.disputed.fence.requestIds,['LEFT','RIGHT']);a.equal(work.items.remote.status,'INVENTORY_RECONCILIATION_REQUIRED');
 a.deepEqual(Q.seeds(root).map(r=>r.url),['https://example.com/safe']);a.equal(Q.approved(root).roles.length,0);a.equal(Q.admissionHolds(root).has('disputed'),true);
 const audits=fs.readdirSync(path.join(root,'receipts/auto-intake/state-conflicts'));a.equal(audits.length,1);a.equal(JSON.parse(fs.readFileSync(path.join(root,'receipts/auto-intake/state-conflicts',audits[0]))).raw,raw);
 a.equal(fs.readFileSync(path.join(root,Q.FILE),'utf8'),raw);
 const now=Date.now();fs.writeFileSync(path.join(root,'state/UPSTREAM_LEDGER.json'),JSON.stringify({schema:'forge.upstream-ledger.v1',at:new Date(now).toISOString(),entries:{},groups:{disputed:{status:'WAITING'}}}));
 const synced=Q.sync(root,{now,config:require('../relevance-screen/screen.cjs').load()});
 a.equal(synced.items.disputed.sourceConflict,'QUEUE_MERGE_CONFLICT');a.deepEqual(synced.items.disputed.fence.requestIds,['LEFT','RIGHT']);

});
test('guard conflicts are recorded, clean JSON is unchanged, other corruption stays an error',t=>{
 const root=fixture(t),file='state/RELEVANCE_SCREEN_GUARD.json',dest=path.join(root,file);
 fs.writeFileSync(dest,conflict({disabledRules:['one']},{disabledRules:['two']}));a.match(R.read(root,file).mergeConflict,/^[a-f0-9]{64}$/);
 fs.writeFileSync(dest,'{"disabledRules":["one"]}');a.deepEqual(R.read(root,file),{disabledRules:['one']});
 fs.writeFileSync(dest,'{broken');a.throws(()=>R.read(root,file));
 fs.writeFileSync(dest,'<<<<<<< local\n{}\n');a.throws(()=>R.read(root,file));
 a.deepEqual(R.read(root,'state/missing.json',{items:{}}),{items:{}});
});

test('a conflicted guard disables exclusions without blocking valid intake',t=>{
 const root=fixture(t),Screen=require('../relevance-screen/screen.cjs'),config=JSON.parse(fs.readFileSync(path.join(__dirname,'../../control/RELEVANCE_SCREEN.json')));
 fs.mkdirSync(path.join(root,'control'));fs.writeFileSync(path.join(root,'control/RELEVANCE_SCREEN.json'),JSON.stringify({...config,backtest:'state/backtest.json'}));
 fs.writeFileSync(path.join(root,'state/backtest.json'),JSON.stringify({rules:config.rules.map(r=>({ruleId:r.id,pattern:r.pattern,falseClosures:0,positiveCohort:1}))}));
 fs.writeFileSync(path.join(root,'state/RELEVANCE_SCREEN_GUARD.json'),conflict({disabledRules:[]},{disabledRules:['one']}));
 const loaded=Screen.load(root);a.deepEqual(loaded.disabledRules,config.rules.map(r=>r.id));
 a.equal(Screen.evaluate({company:'Example',title:'Claims Operations Director',location:'Austin, TX',url:'https://example.com/jobs/1'},loaded).outcome,'ADMIT');
});
