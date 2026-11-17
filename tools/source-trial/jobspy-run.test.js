'use strict';
// jobspy_run.py against a stub jobspy module: LinkedIn descriptions are requested and is_remote survives.
const test=require('node:test'),assert=require('node:assert'),fs=require('fs'),os=require('os'),path=require('path'),cp=require('child_process');
test('jobspy_run.py asks LinkedIn for descriptions and keeps is_remote',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'jobspy-run-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 fs.mkdirSync(path.join(dir,'jobspy'));
 fs.writeFileSync(path.join(dir,'jobspy','__init__.py'),[
  'import json, os',
  'class _DF:',
  '    def __init__(self, rows): self.rows = rows',
  '    def __len__(self): return len(self.rows)',
  '    def to_json(self, **kw): return json.dumps(self.rows)',
  'def scrape_jobs(**kw):',
  '    with open(os.environ["JOBSPY_STUB_LOG"], "a") as f: f.write(json.dumps(kw, sort_keys=True) + "\\n")',
  '    return _DF([{"title": "Director of Quality", "company": "Acme", "location": "Dayton, OH", "job_url": "https://www.linkedin.com/jobs/view/1", "is_remote": True, "description": "Lead quality."}])',
 ''].join('\n'));
 const cfg=path.join(dir,'config.json'),out=path.join(dir,'out.json'),log=path.join(dir,'kw.jsonl');
 fs.writeFileSync(cfg,JSON.stringify({jobspy:{sites:['linkedin'],searches:['Director of Quality'],location:'United States',resultsWanted:1,hoursOld:24}}));
 cp.execFileSync('python3',[path.join(__dirname,'jobspy_run.py'),cfg,out],{env:{...process.env,PYTHONPATH:dir,JOBSPY_STUB_LOG:log},stdio:'pipe',timeout:20000});
 const kw=JSON.parse(fs.readFileSync(log,'utf8').trim().split('\n')[0]);
 assert.equal(kw.linkedin_fetch_description,true);
 const job=JSON.parse(fs.readFileSync(out,'utf8')).jobs[0];
 assert.equal(job.is_remote,true);assert.equal(job.description,'Lead quality.');
});
