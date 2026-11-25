'use strict';
// Card 14c6e4a / cs-c49f2bf8: Workday boards read from the box (TRIAL_WORKDAY_ONLY=1); GitHub runs never probe Workday.
const test=require('node:test'),assert=require('node:assert'),fs=require('fs'),os=require('os'),path=require('path'),cp=require('child_process');
const WD=require('./workday-box-pass'),H=require('./board-health');
const ROOT=path.resolve(__dirname,'../..'),FC=process.env.ENRICH_FC_DIR||path.resolve(ROOT,'../foreman-cockpit');
const NOW=Date.parse('2026-11-18T14:00:00Z'),wd=k=>({kind:'workday',key:'workday:'+k,host:k,tenant:'t',site:'s',companies:new Set([k])});

test('workday-only order: Workday boards only, cooling boards skipped, recoveries first, no duplicates',()=>{
 const health={boards:{'workday:cool':{status:'TEMPORARY_FAILURE',retryAt:'2026-11-18T15:00:00Z'},'workday:due':{status:'TEMPORARY_FAILURE',retryAt:'2026-11-18T13:00:00Z'},'workday:ok':{status:'OK',retryAt:null}}};
 const ranked=[{kind:'greenhouse',key:'greenhouse:acme'},wd('ok'),wd('cool'),wd('due'),wd('new')];
 assert.deepStrictEqual(WD.workdayOrder([wd('due')],ranked,health,NOW).map(b=>b.key),['workday:due','workday:ok','workday:new']);
});
test('a 429 at board k starts the next pass at k+1; the last board wraps; a finished pass clears the cursor',()=>{
 const due=[wd('a'),wd('b'),wd('c')];
 const health={boards:{'workday:a':{status:'OK',retryAt:null},'workday:b':{status:'OK',retryAt:null},'workday:c':{status:'OK',retryAt:null}}};
 const stopped=WD.cursorAfterStop(due,'workday:b');
 assert.equal(stopped.nextDue,'workday:c');
 assert.deepStrictEqual(stopped.dueOrder,['workday:a','workday:b','workday:c']);
 assert.deepStrictEqual(WD.workdayOrder(due,due,health,NOW,stopped).map(b=>b.key),['workday:c','workday:a','workday:b']);
 const wrap=WD.cursorAfterStop(due,'workday:c');
 assert.equal(wrap.nextDue,'workday:a');
 assert.deepStrictEqual(WD.workdayOrder(due,due,health,NOW,wrap).map(b=>b.key),['workday:a','workday:b','workday:c']);
 const cleared=WD.clearCursor();
 assert.equal(cleared.nextDue,null);
 assert.equal(WD.workdayOrder([wd('a')],due,health,NOW,cleared).map(b=>b.key)[0],'workday:a');
 assert.deepStrictEqual(WD.startFrom([wd('b'),wd('c'),wd('a')],stopped).map(b=>b.key),['workday:c','workday:a','workday:b']);
 assert.deepStrictEqual(WD.startFrom([wd('a'),wd('b')],{nextDue:'workday:c',dueOrder:['workday:a','workday:b','workday:c']}).map(b=>b.key),['workday:a','workday:b']);
});
test('box pass gap is 60 s before every Workday request',async()=>{
 const waits=[];const fetcher=async()=>({ok:true,status:200,headers:{get:()=>null},json:async()=>({jobPostings:[]})});
 const r=await H.readBoard(wd('a.wd1.myworkdayjobs.com'),['Quality','Manufacturing','Production'],{fetcher,wait:async ms=>waits.push(ms),gapMs:WD.GAP_MS});
 assert.equal(r.status,'OK');assert.equal(WD.GAP_MS,60000);assert.deepStrictEqual(waits,[60000,60000,60000]);
 assert.match(fs.readFileSync(path.join(__dirname,'run.js'),'utf8'),/gapMs:WORKDAY_ONLY\?WD\.GAP_MS:CONFIG\.gapMs/);
});
test('a Workday 429 stops the pass; other results do not',()=>{
 assert.equal(WD.stopsPass(wd('a'),{httpStatus:429}),true);assert.equal(WD.stopsPass(wd('a'),{httpStatus:null}),false);assert.equal(WD.stopsPass({kind:'greenhouse'},{httpStatus:429}),false);
});
test('box pass is fresh under 4 h only; missing or bad record is not fresh',()=>{
 assert.equal(WD.fresh({lastPassAt:'2026-11-18T10:30:00Z'},NOW),true);
 assert.equal(WD.fresh({lastPassAt:'2026-11-18T09:59:00Z'},NOW),false);
 assert.equal(WD.fresh(null,NOW),false);assert.equal(WD.fresh({lastPassAt:'x'},NOW),false);
});
test('GitHub skips Workday when the box pass is stale or missing, not only when it is fresh',()=>{
 assert.equal(WD.boxPassStale(null,NOW),true);
 assert.equal(WD.boxPassStale({lastPassAt:'2026-11-18T09:59:00Z'},NOW),true);
 assert.equal(WD.boxPassStale({lastPassAt:'x'},NOW),true);
 assert.equal(WD.boxPassStale({lastPassAt:'2026-11-18T10:30:00Z'},NOW),false);
 assert.equal(WD.githubSkipWorkday(),true);
});
test('health merge keeps the newer attempt per board from either side',()=>{
 const theirs={at:'2026-11-18T13:00:00Z',boards:{'greenhouse:acme':{lastAttemptAt:'2026-11-18T13:00:00Z',status:'OK'},'workday:a':{lastAttemptAt:'2026-11-18T09:00:00Z',status:'TEMPORARY_FAILURE'},'workday:old':{lastAttemptAt:'2026-11-18T09:00:00Z'}}};
 const ours={at:'2026-11-18T12:00:00Z',boards:{'greenhouse:acme':{lastAttemptAt:'2026-11-18T09:00:00Z',status:'TEMPORARY_FAILURE'},'workday:a':{lastAttemptAt:'2026-11-18T12:00:00Z',status:'OK'},'workday:new':{lastAttemptAt:'2026-11-18T12:00:00Z',repairedFrom:'workday:old'}}};
 const m=WD.mergeHealth(theirs,ours);
 assert.equal(m.boards['greenhouse:acme'].status,'OK');assert.equal(m.boards['workday:a'].status,'OK');assert.equal('workday:old' in m.boards,false);assert.equal(m.at,'2026-11-18T13:00:00Z');
});
test('runner: box pass reads Workday only and stops at the first 429; GitHub runs skip Workday whether the pass is fresh, stale, or missing',{skip:!fs.existsSync(path.join(FC,'apps-script/PipelineWorklists.gs'))&&'no foreman-cockpit checkout'},()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'wd-box-')),out=path.join(dir,'out'),log=path.join(dir,'fetch.log'),cursor=path.join(dir,'cursor.json');
 const row=(n,id,co,url)=>`${n} | ${id} | ${co} | Director of Quality | READY_TO_PURSUE | RESOLVED/PURSUE_CANDIDATE | - | - | Dayton, OH | SOURCE_URL=${url}`;
 fs.writeFileSync(path.join(dir,'master.txt'),[row(1,'V2I-00000000000A','Acme','https://job-boards.greenhouse.io/acme/jobs/111'),row(2,'V2I-00000000000B','Alpha','https://alpha.wd1.myworkdayjobs.com/ext/job/Dayton/Director_R1'),row(3,'V2I-00000000000C','Bravo','https://bravo.wd1.myworkdayjobs.com/ext/job/Dayton/Director_R2'),row(4,'V2I-00000000000D','Charlie','https://charlie.wd1.myworkdayjobs.com/ext/job/Dayton/Director_R3')].join('\n')+'\n');
 fs.writeFileSync(path.join(dir,'priority.txt'),'');fs.writeFileSync(path.join(dir,'archive.txt'),'V2_TERMINAL_ARCHIVE\n');
 const run=extra=>{fs.writeFileSync(log,'');cp.execFileSync(process.execPath,['--require',path.join(__dirname,'test/mock-fetch-workday.js'),path.join(__dirname,'run.js')],{env:{...process.env,TRIAL_FC_DIR:FC,TRIAL_MASTER_FILE:path.join(dir,'master.txt'),TRIAL_PRIORITY_FILE:path.join(dir,'priority.txt'),TRIAL_ARCHIVE_FILE:path.join(dir,'archive.txt'),TRIAL_OUT_DIR:out,TRIAL_CURSOR_FILE:cursor,TRIAL_FAST:'1',TRIAL_BOARDS_ONLY:'1',TRIAL_FETCH_LOG:log,TRIAL_WD_STATUS:JSON.stringify({'bravo.wd1.myworkdayjobs.com':429}),...extra},stdio:'pipe',timeout:60000});return fs.readFileSync(log,'utf8');};
 const fetched=run({TRIAL_WORKDAY_ONLY:'1'});
 const report=JSON.parse(fs.readFileSync(path.join(out,'workday-box-pass-report.json'),'utf8')),pass=JSON.parse(fs.readFileSync(path.join(out,WD.PASS_FILE),'utf8')),health=JSON.parse(fs.readFileSync(path.join(out,'board-health.json'),'utf8'));
 assert.deepStrictEqual(report.boards.map(b=>b.board),['workday:alpha.wd1.myworkdayjobs.com/ext','workday:bravo.wd1.myworkdayjobs.com/ext']);
 assert.equal(fetched.includes('greenhouse'),false);assert.equal(fetched.includes('charlie'),false);
 assert.equal(pass.read,2);assert.equal(pass.ok,1);assert.equal(pass.stoppedAt429,'workday:bravo.wd1.myworkdayjobs.com/ext');
 assert.equal(pass.nextDue,'workday:charlie.wd1.myworkdayjobs.com/ext');
 assert.equal(health.boards['workday:bravo.wd1.myworkdayjobs.com/ext'].httpStatus,429);assert.equal('workday:charlie.wd1.myworkdayjobs.com/ext' in health.boards,false);
 assert.equal(fs.existsSync(cursor),false,'the box pass leaves the GitHub cursor alone');
 const second=run({TRIAL_WORKDAY_ONLY:'1'});
 const report2=JSON.parse(fs.readFileSync(path.join(out,'workday-box-pass-report.json'),'utf8')),pass2=JSON.parse(fs.readFileSync(path.join(out,WD.PASS_FILE),'utf8'));
 assert.equal(report2.boards[0].board,'workday:charlie.wd1.myworkdayjobs.com/ext');
 assert.equal(second.includes('charlie.wd1.myworkdayjobs.com'),true);assert.equal(pass2.nextDue,null);
 const skipped=run({});
 assert.equal(skipped.includes('myworkdayjobs'),false);assert.equal(skipped.includes('greenhouse.io/v1/boards/acme'),true);
 const skippedReport=JSON.parse(fs.readFileSync(path.join(out,'board-discovery-report.json'),'utf8'));
 assert.equal(skippedReport.summary.boards.workday_skipped_for_box_pass,true);
 assert.equal(skippedReport.summary.boards.workday_box_pass_stale,false);
 fs.writeFileSync(path.join(out,WD.PASS_FILE),JSON.stringify({...pass,lastPassAt:new Date(Date.now()-5*3600000).toISOString()}));
 const stale=run({});
 assert.equal(stale.includes('myworkdayjobs'),false,'a stale box pass does not hand Workday back to the GitHub run');
 const staleReport=JSON.parse(fs.readFileSync(path.join(out,'board-discovery-report.json'),'utf8'));
 assert.equal(staleReport.summary.boards.workday_skipped_for_box_pass,true);
 assert.equal(staleReport.summary.boards.workday_box_pass_stale,true);
 fs.rmSync(path.join(out,WD.PASS_FILE),{force:true});
 const missing=run({});
 assert.equal(missing.includes('myworkdayjobs'),false,'a missing box pass does not let GitHub probe Workday');
 assert.equal(JSON.parse(fs.readFileSync(path.join(out,'board-discovery-report.json'),'utf8')).summary.boards.workday_box_pass_stale,true);
 fs.rmSync(dir,{recursive:true,force:true});
});
