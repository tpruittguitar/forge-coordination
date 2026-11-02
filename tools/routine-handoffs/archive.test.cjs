'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process'),R=require('./reports.cjs'),S=require('../programmed-coordinator/store.cjs');
const python=process.env.FORGE_PYTHON||'python';
function dir(t){const p=fs.mkdtempSync(path.join(os.tmpdir(),'forge-archive-'));t.after(()=>{a.ok(path.resolve(p).startsWith(path.resolve(os.tmpdir())+path.sep));fs.rmSync(p,{recursive:true,force:true});});return p;}
function zip(file,entries){cp.execFileSync(python,['-c',"import sys,json,zipfile; z=zipfile.ZipFile(sys.argv[1],'w'); [z.writestr(k,v) for k,v in json.load(sys.stdin).items()]; z.close()",file],{input:JSON.stringify(entries),windowsHide:true});}
test('archive reader handles nested full reports plus manifests without extracting or executing files',t=>{
 const root=dir(t),privateDir=dir(t),inbox=dir(t),taskKey='FORGE_GROK_INTAKE_HELPER',b={schema:'forge.intake-helper-batch.v1',provider:'Grok',taskKey,runId:'GROK-INTAKE-ARCHIVE'};
 zip(path.join(inbox,'forge-helper-test.zip'),{'manifest.json':'{"count":1}','nested/report.md':JSON.stringify(b),'do-not-run.py':'raise RuntimeError()'});
 const state=R.empty();S.save(root,'control/AI_AUTOMATION_TASKS.json',{tasks:{[taskKey]:{owner:'Grok'}}});
 // Use an already accepted immutable batch so this test isolates real ZIP
 // transport and canonical duplicate handling, independent of Git history.
 S.save(root,'receipts/GROK_HELPERS/'+taskKey+'/'+b.runId+'.json',b);
 const args={root,privateDir,state,inboxes:[{directory:inbox}],commit:'a'.repeat(40),python};
 a.equal(R.scanInboxes(args).imported,0);a.equal(Object.values(state.artifacts)[0].status,'COLLECTED');a.equal(Object.keys(state.exceptions).length,0);a.equal(Object.keys(state.reports).length,1);
 a.equal(R.scanInboxes(args).imported,0);a.equal(fs.existsSync(path.join(root,'do-not-run.py')),false);
});
test('path traversal and oversized archive entries fail closed without acknowledging report collection',t=>{
 for(const entries of [{'../escape.json':'{}'},{'C:/absolute.json':'{}'},{'report.json':'x'.repeat(2_000_001)}]){
  const folder=dir(t),file=path.join(folder,'bad.zip');zip(file,entries);
  const result=cp.spawnSync(python,[path.join(__dirname,'artifact-reader.py'),file],{encoding:'utf8',windowsHide:true});a.equal(result.status,1);a.match(result.stderr,/UNSAFE_ARCHIVE_PATH|REPORT_ARCHIVE_FORMAT_LIMIT/);a.equal(fs.readdirSync(folder).length,1);
 }
});
