'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),p=require('node:path'),cp=require('node:child_process');
const {publish,timestampMerge}=require('./publish.cjs'),guard='state/RELEVANCE_SCREEN_GUARD.json';
const g=(root,...args)=>cp.execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
const value=(at='2026-11-02T03:00:00Z',extra={})=>({schema:'forge.relevance-guard.v1',at,policyCommit:'same-policy',disabledRules:[],...extra});
function save(root,f,j){fs.mkdirSync(p.dirname(p.join(root,f)),{recursive:true});fs.writeFileSync(p.join(root,f),JSON.stringify(j,null,2)+'\n');}
function commit(root,msg){g(root,'add','.');g(root,'commit','-m',msg);}
function fixture(t){const dir=fs.mkdtempSync(p.join(os.tmpdir(),'forge-publish-'));t.after(()=>{a.ok(p.resolve(dir).startsWith(p.resolve(os.tmpdir())+p.sep));fs.rmSync(dir,{recursive:true,force:true});});g(dir,'init','--bare','remote.git');g(dir,'clone','remote.git','local');const local=p.join(dir,'local'),remote=p.join(dir,'remote.git');g(local,'config','core.autocrlf','false');g(local,'config','user.name','Test');g(local,'config','user.email','test@example.invalid');g(local,'checkout','-b','main');save(local,guard,value());commit(local,'baseline');g(local,'push','-u','origin','main');g(dir,'clone','--branch','main','remote.git','bot');const bot=p.join(dir,'bot');g(bot,'config','core.autocrlf','false');g(bot,'config','user.name','Bot');g(bot,'config','user.email','bot@example.invalid');return{local,bot,remote};}
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
test('retained safe revision allows independent work during audit outage, but rejects changed code or active rebase',t=>{
 const f=fixture(t),{retainedSafe}=require('./publish.cjs');
 save(f.local,'state/PROGRAMMED_COORDINATOR_REPORT.json',{pending:true});commit(f.local,'retained audit');
 a.equal(retainedSafe(f.local).safe,true);
 save(f.local,'unsafe-code.js',{changed:true});a.throws(()=>retainedSafe(f.local),/Unexpected retained/);
 fs.unlinkSync(p.join(f.local,'unsafe-code.js'));fs.mkdirSync(p.resolve(f.local,g(f.local,'rev-parse','--git-path','rebase-merge')));
 a.throws(()=>retainedSafe(f.local),/Interrupted Git operation/);
});
function sharedFixture(root){const H=require('../helper-routing/shared.cjs');save(root,H.FILE,{schema:'forge.shared-helper-work.v1',assignmentId:'publish-test',enabled:true,routingActive:true,providers:Object.fromEntries(Object.entries(H.TASKS).map(([t,p])=>[t,{provider:p,available:true}])),items:[{key:'job',kind:'INTAKE',taskKey:'FORGE_CLAUDE_SHARED_HELPER',provider:'Claude',assignmentVersion:1,sourceVersion:'source',status:'ASSIGNED'}]});return H;}
test('derived current indexes publish with immutable pages, reject retained and uncommitted page edits',t=>{
 const f=fixture(t),P=require('../helper-routing/shared-pages.cjs');sharedFixture(f.local);P.generate(f.local,{checkLock(){}});a.equal(publish(f.local).published,true);
 const index=JSON.parse(fs.readFileSync(p.join(f.local,P.indexPath('FORGE_CLAUDE_SHARED_HELPER')))),file=index.pages[0].file;
 fs.appendFileSync(p.join(f.local,file),' ');a.throws(()=>require('./publish.cjs').retainedSafe(f.local),/Immutable/);a.throws(()=>publish(f.local),/Immutable/);commit(f.local,'bad page edit');a.throws(()=>require('./publish.cjs').retainedSafe(f.local),/immutable/);a.throws(()=>publish(f.local),/TAMPERED|INVALID_IMMUTABLE/);
});
test('fresh source binding checked after clean rebase; mismatched remote work never publishes stale pages',t=>{
 const f=fixture(t),P=require('../helper-routing/shared-pages.cjs'),H=sharedFixture(f.local);publish(f.local);g(f.bot,'pull','--ff-only','origin','main');
 P.generate(f.local,{checkLock(){}});const w=JSON.parse(fs.readFileSync(p.join(f.bot,H.FILE)));w.items[0].status='CONSUMED';save(f.bot,H.FILE,w);commit(f.bot,'new live source');g(f.bot,'push','origin','main');
 a.throws(()=>publish(f.local),/STALE/);a.equal(g(f.bot,'rev-parse','HEAD'),g(f.local,'rev-parse','origin/main'));
});
test('independently stale main projections do not strand unrelated retained accounting or publication',t=>{
 const f=fixture(t),P=require('../helper-routing/shared-pages.cjs'),H=sharedFixture(f.local),task='FORGE_CLAUDE_SHARED_HELPER';P.generate(f.local,{checkLock(){}});publish(f.local);g(f.bot,'pull','--ff-only','origin','main');
 const w=JSON.parse(fs.readFileSync(p.join(f.bot,H.FILE)));w.items[0].status='CONSUMED';save(f.bot,H.FILE,w);commit(f.bot,'independent work update without projection');g(f.bot,'push','origin','main');
 save(f.local,'state/PROGRAMMED_COORDINATOR_REPORT.json',{unrelated:true});a.equal(require('./publish.cjs').retainedSafe(f.local).safe,true);a.equal(publish(f.local).published,true);
 a.equal(require('./publish.cjs').retainedSafe(f.local).safe,true);a.throws(()=>P.validateStored(f.local),/STALE/);
 const index=JSON.parse(fs.readFileSync(p.join(f.local,P.indexPath(task))));a.throws(()=>P.validateIndex(index,{taskKey:task,workBlobSha:P.blob(fs.readFileSync(p.join(f.local,H.FILE)))}),/STALE/);
 // Once the stale baseline is already fetched, another unrelated receipt still publishes.
 save(f.local,'state/PROGRAMMED_COORDINATOR_REPORT.json',{unrelated:'again'});commit(f.local,'retained unrelated accounting');a.equal(require('./publish.cjs').retainedSafe(f.local).safe,true);a.equal(publish(f.local).published,true);
});
test('new unreferenced immutable pages must match their hash and provider page schema',t=>{
 const f=fixture(t),P=require('../helper-routing/shared-pages.cjs');sharedFixture(f.local);P.generate(f.local,{checkLock(){}});publish(f.local);
 const content=JSON.stringify({arbitrary:'not a provider page'})+'\n',file=P.BASE+'/FORGE_CLAUDE_SHARED_HELPER/'+require('./store.cjs').hash(content)+'.json';fs.writeFileSync(p.join(f.local,file),content);
 a.throws(()=>require('./publish.cjs').retainedSafe(f.local),/INVALID_IMMUTABLE/);a.throws(()=>publish(f.local),/INVALID_IMMUTABLE/);
});

test('LF attributes preserve byte-hashed shared projections through CRLF checkout and real publication rebase',t=>{
 const f=fixture(t),P=require('../helper-routing/shared-pages.cjs');
 // Use the repository's actual policy, not a test-only substitute.
 fs.copyFileSync(p.resolve(__dirname,'../../.gitattributes'),p.join(f.local,'.gitattributes'));commit(f.local,'line ending policy');g(f.local,'push','origin','main');g(f.bot,'pull','--ff-only','origin','main');
 g(f.local,'config','core.autocrlf','true');g(f.local,'config','core.eol','crlf');
 const H=sharedFixture(f.local);P.generate(f.local,{checkLock(){}});commit(f.local,'retained pages');
 const files=[H.FILE,...g(f.local,'ls-files','control/shared-helper-pages').split('\n')];
 const original=new Map(files.map(file=>[file,fs.readFileSync(p.join(f.local,file))]));
 for(const file of files)fs.unlinkSync(p.join(f.local,file));g(f.local,'checkout','--',...files);
 for(const file of files)a.deepEqual(fs.readFileSync(p.join(f.local,file)),original.get(file),file);
 save(f.bot,'independent.json',{race:true});commit(f.bot,'concurrent main');g(f.bot,'push','origin','main');
 a.equal(publish(f.local).published,true);a.equal(P.validateStored(f.local,{allowExpired:true}).valid,true);
 for(const file of files){a.deepEqual(fs.readFileSync(p.join(f.local,file)),original.get(file),file);a.equal(P.blob(original.get(file)),g(f.local,'rev-parse','origin/main:'+file));}
 a.equal(g(f.local,'status','--porcelain'),'');
});
test('publication rejects Git normalization of otherwise valid source-bound bytes before committing',t=>{
 const f=fixture(t),P=require('../helper-routing/shared-pages.cjs'),H=sharedFixture(f.local);
 g(f.local,'config','core.autocrlf','true');const source=p.join(f.local,H.FILE);
 fs.writeFileSync(source,fs.readFileSync(source,'utf8').replace(/\n/g,'\r\n'));P.generate(f.local,{checkLock(){}});
 a.equal(P.validateStored(f.local).valid,true);const before=g(f.local,'rev-parse','HEAD');
 a.throws(()=>publish(f.local),/Git bytes differ/);a.equal(g(f.local,'rev-parse','HEAD'),before);a.equal(g(f.local,'rev-parse','origin/main'),before);
 a.equal(P.validateStored(f.local).valid,true);
});
test('retained committed projection is checked against Git bytes even when rebase makes no changes',t=>{
 const f=fixture(t),P=require('../helper-routing/shared-pages.cjs'),H=sharedFixture(f.local);
 g(f.local,'config','core.autocrlf','true');const source=p.join(f.local,H.FILE);
 fs.writeFileSync(source,fs.readFileSync(source,'utf8').replace(/\n/g,'\r\n'));P.generate(f.local,{checkLock(){}});commit(f.local,'retained normalized source');
 a.equal(P.validateStored(f.local).valid,true);const remote=g(f.local,'rev-parse','origin/main');
 a.throws(()=>publish(f.local),/Git bytes differ/);a.equal(g(f.local,'rev-parse','origin/main'),remote);
 a.equal(P.validateStored(f.local).valid,true);
});

const enrichFile='control/ENRICHMENT_HELPER_WORK.json';
function enrichmentWork(ids=['BASE1','BASE2','BASE3']){return{schema:'forge.enrichment-helper-work.v1',assignmentId:'publish-enrichment-test',enabled:true,provider:'ChatGPT',taskKey:'FORGE_CHATGPT_ENRICHMENT_RESEARCH',items:ids.map(id=>({primaryId:'V2I-'+id,owner:'ChatGPT',taskKey:'FORGE_CHATGPT_ENRICHMENT_RESEARCH',status:'ASSIGNED',company:'Example '+id,sourceProof:{preserve:'unchanged'},canonicalObservedAt:'2026-11-10T21:00:00Z'}))};}
function enrichmentBaseline(f){save(f.local,enrichFile,enrichmentWork());commit(f.local,'enrichment baseline');g(f.local,'push','origin','main');g(f.bot,'pull','--ff-only','origin','main');}
test('duplicate enrichment changes fail before staging; unrelated original transaction evidence remains',t=>{
 const f=fixture(t);enrichmentBaseline(f);const before=g(f.local,'rev-parse','HEAD'),w=enrichmentWork();w.items.push({...w.items[0]});save(f.local,enrichFile,w);
 save(f.local,'receipts/FORGE-CODE-CHATGPT-PENDING_CHECKPOINT.json',{requestId:'ORIGINAL',status:'POST_IN_FLIGHT'});
 a.throws(()=>require('./publish.cjs').retainedSafe(f.local),/Invalid enrichment membership/);a.throws(()=>publish(f.local),/Invalid enrichment membership/);
 a.equal(g(f.local,'rev-parse','HEAD'),before);a.equal(g(f.local,'diff','--cached','--name-only'),'');a.equal(JSON.parse(fs.readFileSync(p.join(f.local,'receipts/FORGE-CODE-CHATGPT-PENDING_CHECKPOINT.json'))).requestId,'ORIGINAL');
});
for(const duringPush of [false,true])test('clean rebase cannot restore duplicate enrichment after '+(duringPush?'a failed push':'concurrent publication'),t=>{
 const f=fixture(t);enrichmentBaseline(f);const local=enrichmentWork(['NEW','BASE1','BASE2','BASE3']),remote=enrichmentWork(['BASE1','BASE2','BASE3','NEW']);remote.items.at(-1).canonicalObservedAt='2026-11-10T21:02:00Z';
 save(f.local,enrichFile,local);commit(f.local,'retained first observation');save(f.local,'receipts/FORGE-CODE-CHATGPT-RETAINED_CHECKPOINT.json',{pending:'original'});
 const advance=()=>{save(f.bot,enrichFile,remote);commit(f.bot,'concurrent second observation');g(f.bot,'push','origin','main');};if(!duringPush)advance();
 a.throws(()=>publish(f.local,{beforePush(n){if(duringPush&&n===0)advance();}}),/Invalid enrichment membership/);
 a.equal(g(f.local,'diff','--name-only','--diff-filter=U'),'');const kept=JSON.parse(g(f.local,'show','HEAD:'+enrichFile));a.equal(kept.items.filter(i=>i.primaryId==='V2I-NEW').length,2);
 a.equal(g(f.local,'rev-parse','origin/main'),g(f.bot,'rev-parse','HEAD'));a.equal(JSON.parse(g(f.local,'show','HEAD:receipts/FORGE-CODE-CHATGPT-RETAINED_CHECKPOINT.json')).pending,'original');
});
test('invalid inherited enrichment does not strand unrelated accounting; changing it is still guarded',t=>{
 const f=fixture(t),w=enrichmentWork(['BASE1','BASE1']);save(f.local,enrichFile,w);commit(f.local,'broken external baseline');g(f.local,'push','origin','main');
 save(f.local,'state/PROGRAMMED_COORDINATOR_REPORT.json',{unrelated:true});a.equal(require('./publish.cjs').retainedSafe(f.local).safe,true);a.equal(publish(f.local).published,true);
 w.items[0].canonicalObservedAt='2026-11-11T00:00:00Z';save(f.local,enrichFile,w);a.throws(()=>publish(f.local),/Invalid enrichment membership/);
});
test('membership repair and new immutable audit publish together, without allowing later audit edits',t=>{
 const f=fixture(t);enrichmentBaseline(f);save(f.local,enrichFile,enrichmentWork(['BASE1','BASE2']));const file='receipts/ENRICHMENT_MEMBERSHIP_REPAIRS/FORGE-MEMBERSHIP-CHATGPT-TEST.json';save(f.local,file,{observations:[{preserved:true}],canonicalWrites:0});
 a.equal(publish(f.local).published,true);a.equal(JSON.parse(g(f.local,'show','origin/main:'+file)).canonicalWrites,0);
 save(f.local,file,{overwritten:true});a.throws(()=>publish(f.local),/Immutable accounting evidence/);a.throws(()=>require('./publish.cjs').retainedSafe(f.local),/Immutable accounting evidence/);
});
test('concurrent identical enrichment additions with snapshot-only metadata resolve alongside guard',t=>{
 const f=fixture(t);enrichmentBaseline(f);
 const make=(at,h)=>{const w=enrichmentWork();w.items.push({...w.items[0],primaryId:'V2I-NEW',canonicalObservedAt:at,rowSha256:'a'.repeat(64),researchProvenance:{schema:'forge.enrichment-research-provenance.v1',sourceFingerprint:'b'.repeat(64),canonicalSourceSha256:h.repeat(64)}});return w;};
 const local=make('2026-11-13T02:00:00Z','c'),remote=make('2026-11-13T01:00:00Z','d');local.items[0].status='PROTECTED_SKIP';
 save(f.local,enrichFile,local);save(f.local,guard,value('2026-11-13T02:00:00Z'));save(f.local,'receipts/FORGE-CODE-CHATGPT-TEST_TERMINAL.json',{preserve:true});commit(f.local,'coordinator observations');
 save(f.bot,enrichFile,remote);save(f.bot,guard,value('2026-11-13T01:00:00Z'));commit(f.bot,'concurrent research assignments');g(f.bot,'push','origin','main');
 a.equal(publish(f.local).published,true);const published=JSON.parse(g(f.local,'show','origin/main:'+enrichFile));a.deepEqual(published,local);a.equal(g(f.local,'status','--porcelain'),'');
});
test('unsafe enrichment conflict leaves every conflict unstaged and immutable receipt retained',t=>{
 const f=fixture(t);enrichmentBaseline(f);const l=enrichmentWork(),r=enrichmentWork();l.items[0].status='CONSUMED';r.items[0].status='RELEASED';save(f.local,enrichFile,l);save(f.local,guard,value('2026-11-13T02:00:00Z'));save(f.local,'receipts/FORGE-CODE-CHATGPT-TEST_TERMINAL.json',{preserve:true});commit(f.local,'local changes');save(f.bot,enrichFile,r);save(f.bot,guard,value('2026-11-13T01:00:00Z'));commit(f.bot,'remote changes');g(f.bot,'push','origin','main');a.throws(()=>publish(f.local),/Semantic enrichment/);a.match(fs.readFileSync(p.join(f.local,guard),'utf8'),/<<<<<<< HEAD/);a.match(g(f.local,'ls-files','-u','--',enrichFile),/ 3\t/);a.equal(JSON.parse(g(f.local,'show','REBASE_HEAD:receipts/FORGE-CODE-CHATGPT-TEST_TERMINAL.json')).preserve,true);
});
