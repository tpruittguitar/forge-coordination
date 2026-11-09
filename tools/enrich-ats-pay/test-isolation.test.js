'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const script=path.join(__dirname,'test-isolated.sh');
function fixture(t,fail){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pay-isolation-check-')),repo=path.join(dir,'runtime checkout'),temp=path.join(dir,'runner temp');
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));fs.mkdirSync(path.join(repo,'tools/enrich-ats-pay'),{recursive:true});fs.mkdirSync(temp);
 const original={
  'state/enrich-ats-pay-report.json':'{"dry":false,"writer_ok":4}\n',
  'state/enrich-ats-pay.json':'{"pendingWrites":{"original":{"status":"POSTING_OR_UNCONFIRMED"}}}\n',
  'state/enrich-ats-pay-employer.json':'{"preserve":"cache manifest"}\n',
  'state/enrich-ats-pay-employer.parts/original.json.gz':'immutable binary part\0\r\n',
  'reference/COMPANY_SITE_CONTEXT.json':'{"preserve":"context"}\n',
  'receipts/FORGE-ENRICH_ATS-ATSBOT-original_NOT_ACCEPTED.json':'{"preserve":"refusal proof"}\n'
 };
 for(const[file,body]of Object.entries(original)){fs.mkdirSync(path.dirname(path.join(repo,file)),{recursive:true});fs.writeFileSync(path.join(repo,file),body);}
 fs.copyFileSync(script,path.join(repo,'tools/enrich-ats-pay/test-isolated.sh'));
 fs.writeFileSync(path.join(repo,'tools/enrich-ats-pay/fixture.test.js'),[
  "const fs=require('node:fs'),path=require('node:path'),os=require('node:os');",
  "require('node:test')('synthetic output stays isolated',()=>{",
  'for(const file of '+JSON.stringify(Object.keys(original))+")fs.writeFileSync(file,'synthetic test fixture');",
  "fs.writeFileSync('receipts/FORGE-ENRICH_ATS-ATSBOT-test_NOT_ACCEPTED.json','synthetic proof');",
  "fs.writeFileSync(path.join(os.tmpdir(),'PipelineProducts.js'),'synthetic module');",
  fail?"throw Error('intentional fixture failure');":"",
  '});'
 ].join('\n'));
 const git=(...args)=>cp.execFileSync('git',args,{cwd:repo,stdio:'pipe'});
 git('init','-q');git('add','.');git('-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-qm','fixture');
 const env={...process.env,RUNNER_TEMP:temp};delete env.NODE_TEST_CONTEXT;
 return {repo,temp,original,run:()=>cp.spawnSync('bash',[path.join(repo,'tools/enrich-ats-pay/test-isolated.sh')],{cwd:repo,env,encoding:'utf8'})};
}
for(const fail of [false,true])test('isolated '+(fail?'failing':'passing')+' tests cannot change runtime publication inputs',t=>{
 const f=fixture(t,fail),result=f.run();assert.equal(result.status,fail?1:0,result.stderr+result.stdout);
 for(const[file,body]of Object.entries(f.original))assert.equal(fs.readFileSync(path.join(f.repo,file),'utf8'),body,file);
 assert.equal(fs.existsSync(path.join(f.repo,'receipts/FORGE-ENRICH_ATS-ATSBOT-test_NOT_ACCEPTED.json')),false);
 assert.deepEqual(fs.readdirSync(f.temp),[],'disposable checkout removed even after failure');
 // A failed live run leaves these original inputs for always() preservation,
 // never the synthetic replacement or a replayable new pending request.
 assert.equal(JSON.parse(fs.readFileSync(path.join(f.repo,'state/enrich-ats-pay-report.json'))).writer_ok,4);
 assert.equal(JSON.parse(fs.readFileSync(path.join(f.repo,'state/enrich-ats-pay.json'))).pendingWrites.original.status,'POSTING_OR_UNCONFIRMED');
});
test('pay workflow isolates tests and still preserves failed-run evidence',()=>{
 const workflow=fs.readFileSync(path.join(__dirname,'../../.github/workflows/enrich-ats-pay.yml'),'utf8');
 assert.match(workflow,/run: bash tools\/enrich-ats-pay\/test-isolated\.sh/);
 assert.doesNotMatch(workflow,/run: node --test tools\/enrich-ats-pay/);
 assert.match(workflow,/- name: Preserve report and pending-write evidence\s+if: always\(\)/);
 assert.match(workflow,/- name: Commit report and ledger\s+if: always\(\)/);
});
