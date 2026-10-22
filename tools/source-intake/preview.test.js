'use strict';
const test=require('node:test'),assert=require('node:assert/strict');const {adapt}=require('./preview');
const job=(company,title,location,url)=>({status:'NEW',source:'JobSpy',company,title,location,url});
test('never exclude from title/company terms; detect Memphis; preserve priority',()=>{
 const r=adapt({new_roles:[
 job('Baxter','Director Quality','TN','https://example.com/a'),
 job('Tesla','Director Clinical Quality','Austin, TX','https://example.com/b'),
 job('Packaging Systems','Director Food Safety Quality','Memphis, TN','https://example.com/c'),
 job('Shield AI','Director Manufacturing','San Diego, CA','https://example.com/d')
 ]},{targetRegistry:{shieldai:'DREAM'}});
 assert.equal(r.counts.CANDIDATE_REQUIRES_WRITER_CHECK,4);
 assert(r.rows[2].flags.includes('MEMPHIS_STRONG_NEGATIVE'));
 assert.equal(r.rows[3].tier,'DREAM');
 assert.equal(r.rows[3].verdict,'CANDIDATE_REQUIRES_WRITER_CHECK');
 assert.equal(r.rows[0].industry,'NEVER_CONSIDER_REVIEW');
});
test('normalize Austin variants; no Workday city slug ID collision',()=>{
 const r=adapt({new_roles:[
 job('Acme','Director Manufacturing','Austin TX','https://acme.wd1.myworkdayjobs.com/en-US/Jobs/job/San-Diego-California/Position-One_R100'),
 job('Acme','Director Manufacturing','Austin, Texas','https://acme.wd1.myworkdayjobs.com/en-US/Jobs/job/San-Diego-California/Position-Two_R200'),
 job('Acme','Director Manufacturing','Dallas, TX','https://example.com/unique'),
 ]});
 assert.equal(r.counts.DUPLICATE_IN_REPORT||0,0);
 assert.equal(r.counts.CANDIDATE_REQUIRES_WRITER_CHECK,3);
 assert.notEqual(r.rows[0].record.REQ_ID,'San-Diego-California');
});
test('ET timestamps, no Writer, 200 records max',()=>{
 const a=[];for(let i=0;i<205;i++)a.push(job('Acme','Director Manufacturing '+i,'Austin, TX','https://example.com/jobs/'+i));
 const r=adapt({new_roles:a},{discoveredAt:'2026-10-22T11:00:00Z'});
 assert.equal(r.batches.length,2);assert.equal(r.batches[0].records.length,200);
 assert.match(r.rows[0].record.DISCOVERED_AT_ET,/ET$/);
 assert.equal(r.counts.writer_submission_count,0);
});

test('CLI priority registry parses source text for JobSpy Shield AI without supplied tier',()=>{
 const {priorityRegistry,priority}=require('./preview');
 const txt='STATUS=ACTIVE\nSECTION=TARGET_COMPANIES\nDREAM\n- Shield AI | careers: https://jobs.lever.co/shieldai\nP1\n- Anduril | careers: UNKNOWN\n';
 const reg=priorityRegistry(txt);
 assert.equal(priority({company:'Shield AI',tier:''},reg),'DREAM');
 assert.equal(priority({company:'Some firm',tier:'DREAMY'},reg),'UNKNOWN');
 assert.equal(priority({company:'Some firm',tier:'xxP1'},reg),'UNKNOWN');
});

test('CLI loads the registry file and tags Shield AI JobSpy result DREAM',()=>{
 const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forge-intake-'));
 try{
 const report=path.join(dir,'report.json'),output=path.join(dir,'output.json'),registry=path.join(dir,'priority.txt');
 fs.writeFileSync(report,JSON.stringify({new_roles:[job('ShieldAI','Director Quality','San Diego, CA','https://example.com/jobs/111'),job('Anduril Industries','Director Manufacturing','Costa Mesa, CA','https://example.com/jobs/222')]}));
 fs.writeFileSync(registry,'DREAM (every discovery run, first): 1\n- Shield AI | careers: https://shield.ai/careers | Dallas, TX\n'+'TARGET_COMPANY='+JSON.stringify({company:'Shield AI',aliases:['ShieldAI','Shield AI Inc.'],priority:'DREAM',status:'ACTIVE'})+'\n'+'TARGET_COMPANY='+JSON.stringify({company:'Anduril',aliases:['Anduril Industries'],priority:'P1',status:'ACTIVE'})+'\n');
 const done=cp.spawnSync(process.execPath,[path.join(__dirname,'preview.js'),report,output,'FORGE-CLI-TEST',registry],{encoding:'utf8'});
 assert.equal(done.status,0,done.stderr);
 const rows=JSON.parse(fs.readFileSync(output,'utf8')).rows;assert.equal(rows[0].tier,'DREAM');assert.equal(rows[1].tier,'P1');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
