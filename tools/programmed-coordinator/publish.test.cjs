'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),p=require('node:path'),cp=require('node:child_process');
const {publish,timestampMerge}=require('./publish.cjs'),guard='state/RELEVANCE_SCREEN_GUARD.json';
const g=(root,...args)=>cp.execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
const value=(at='2026-11-02T03:00:00Z',extra={})=>({schema:'forge.relevance-guard.v1',at,policyCommit:'same-policy',disabledRules:[],...extra});
function save(root,f,j){fs.mkdirSync(p.dirname(p.join(root,f)),{recursive:true});fs.writeFileSync(p.join(root,f),JSON.stringify(j,null,2)+'\n');}
function commit(root,msg){g(root,'add','.');g(root,'commit','-m',msg);}
function fixture(t){const dir=fs.mkdtempSync(p.join(os.tmpdir(),'forge-publish-'));t.after(()=>{a.ok(p.resolve(dir).startsWith(p.resolve(os.tmpdir())+p.sep));fs.rmSync(dir,{recursive:true,force:true});});g(dir,'init','--bare','remote.git');g(dir,'clone','remote.git','local');const local=p.join(dir,'local'),remote=p.join(dir,'remote.git');g(local,'config','user.name','Test');g(local,'config','user.email','test@example.invalid');g(local,'checkout','-b','main');save(local,guard,value());commit(local,'baseline');g(local,'push','-u','origin','main');g(dir,'clone','--branch','main','remote.git','bot');const bot=p.join(dir,'bot');g(bot,'config','user.name','Bot');g(bot,'config','user.email','bot@example.invalid');return{local,bot,remote};}
function race(f,extra={}){save(f.local,guard,value('2026-11-02T03:25:54Z'));save(f.local,'receipts/FORGE-CODE-CHATGPT-TEST_TERMINAL.json',{runId:'test',transactions:[]});commit(f.local,'retained accounting');save(f.bot,guard,value('2026-11-02T03:26:58Z',extra));save(f.bot,'independent.json',{preserved:true});commit(f.bot,'independent bot observation');g(f.bot,'push','origin','main');}
test('timestamp merge requires identical semantics, valid dates and unknown fields',()=>{a.equal(timestampMerge(value(),value('2026-11-02T04:00:00Z')).at,'2026-11-02T04:00:00Z');for(const b of [value('bad'),value(undefined,{policyCommit:'different'}),value(undefined,{disabledRules:['r']}),value(undefined,{newField:true}),value(undefined,{schema:'other'})])a.equal(timestampMerge(value(),b),null);});
test('real concurrent timestamp conflict publishes both commits and newest observation',t=>{const f=fixture(t);race(f);const r=publish(f.local);a.equal(r.published,true);a.equal(JSON.parse(g(f.local,'show','origin/main:'+guard)).at,'2026-11-02T03:26:58Z');a.equal(JSON.parse(g(f.local,'show','origin/main:independent.json')).preserved,true);a.equal(JSON.parse(g(f.local,'show','origin/main:receipts/FORGE-CODE-CHATGPT-TEST_TERMINAL.json')).runId,'test');a.equal(g(f.local,'status','--porcelain'),'');});
test('clean committed checkout retries a previously unpublished receipt',t=>{const f=fixture(t);save(f.local,'receipts/FORGE-CODE-CHATGPT-TEST_TERMINAL.json',{runId:'retained'});commit(f.local,'retained after failed push');a.equal(g(f.local,'status','--porcelain'),'');publish(f.local);a.equal(JSON.parse(g(f.local,'show','origin/main:receipts/FORGE-CODE-CHATGPT-TEST_TERMINAL.json')).runId,'retained');});
test('push race retries fetch/rebase and preserves concurrent work',t=>{const f=fixture(t);save(f.local,'state/PROGRAMMED_COORDINATOR_REPORT.json',{runId:'new'});let races=0;const r=publish(f.local,{beforePush(n){if(n===0){save(f.bot,'independent.json',{race:true});commit(f.bot,'push race');g(f.bot,'push','origin','main');races++;}}});a.equal(races,1);a.equal(r.attempts,2);a.equal(JSON.parse(g(f.local,'show','origin/main:independent.json')).race,true);});
for(const extra of [{policyCommit:'new-policy'},{disabledRules:['real-policy-change']}])test('semantic guard conflict preserves evidence for operator: '+JSON.stringify(extra),t=>{const f=fixture(t);race(f,extra);a.throws(()=>publish(f.local),/Semantic guard conflict/);a.match(fs.readFileSync(p.join(f.local,guard),'utf8'),/<<<<<<< HEAD/);a.equal(JSON.parse(g(f.local,'show','REBASE_HEAD:receipts/FORGE-CODE-CHATGPT-TEST_TERMINAL.json')).runId,'test');});
test('unknown changes cannot be accidentally published',t=>{const f=fixture(t);save(f.local,'unexpected.json',{unsafe:true});a.throws(()=>publish(f.local),/Unexpected changed/);});

test('exception accounting publishes new immutable reviews and rejects changes to existing reviews',t=>{
 const f=fixture(t),file='receipts/AI_EXCEPTION_REVIEWS/'+'a'.repeat(64)+'-'+'b'.repeat(64)+'.json';save(f.local,'state/AI_EXCEPTION_WORK.json',{cases:{}});save(f.local,file,{disposition:'WAITING_SOURCE_CHANGE'});
 a.equal(publish(f.local).published,true);save(f.local,file,{disposition:'VERIFIED'});a.throws(()=>publish(f.local),/Immutable/);
 a.equal(require('./publish.cjs').allowed('receipts/AI_EXCEPTION_REVIEWS/private-mail.json'),false);
});
test('new transport accounting and immutable helper deliveries publish while private artifacts remain outside scope',t=>{
 const f=fixture(t);for(const [file,body]of [['state/HELPER_TRANSPORT.json',{schema:'test'}],['state/CODE_INTAKE_CONSUMPTION.json',{items:[]}],['receipts/FORGE-CODE-CHATGPT-TEST_TRANSPORT.json',{runId:'test'}],['control/grok-intake/FORGE-CODE-CHATGPT-TEST-0001.json',{items:[]}],['receipts/CLAUDE_RELEVANCE/CLAUDE-RELEVANCE-TEST.json',{items:[]}]])save(f.local,file,body);
 a.equal(publish(f.local).published,true);save(f.local,'receipts/CLAUDE_RELEVANCE/CLAUDE-RELEVANCE-TEST.json',{items:['changed']});a.throws(()=>publish(f.local),/Immutable accounting evidence changed/);
});
test('committed modifications to immutable evidence cannot bypass retained accounting checks',t=>{
 const f=fixture(t),file='receipts/FORGE-CODE-CHATGPT-TEST_TERMINAL.json';save(f.local,file,{runId:'original'});publish(f.local);save(f.local,file,{runId:'changed'});commit(f.local,'incorrect retained edit');a.throws(()=>publish(f.local),/Committed immutable evidence changed/);
});
test('leftover REBASE_HEAD without an active rebase does not strand published accounting',t=>{
 const f=fixture(t),old=g(f.local,'rev-parse','HEAD');g(f.local,'update-ref','REBASE_HEAD',old);
 save(f.local,'receipts/FORGE-CODE-CHATGPT-TEST_TERMINAL.json',{runId:'after-rebase'});
 a.equal(publish(f.local).published,true);
 a.equal(JSON.parse(g(f.local,'show','origin/main:receipts/FORGE-CODE-CHATGPT-TEST_TERMINAL.json')).runId,'after-rebase');
 // Git may clear the leftover pseudoref during the normal successful rebase.
});
for(const directory of ['rebase-merge','rebase-apply'])test('active '+directory+' blocks publication and preserves evidence',t=>{
 const f=fixture(t);fs.mkdirSync(p.resolve(f.local,g(f.local,'rev-parse','--git-path',directory)));
 save(f.local,'receipts/FORGE-CODE-CHATGPT-TEST_TERMINAL.json',{runId:'must-retain'});
 a.throws(()=>publish(f.local),/Prior rebase requires reconciliation/);
 a.ok(fs.existsSync(p.join(f.local,'receipts/FORGE-CODE-CHATGPT-TEST_TERMINAL.json')));
});
