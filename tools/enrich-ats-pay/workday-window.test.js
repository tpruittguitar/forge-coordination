'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const W=require('./workday-window');
const live=fs.readFileSync(path.join(__dirname,'../../.github/workflows/board-discovery.yml'),'utf8');
const utc=(h,m)=>Date.UTC(2026,10,17,h,m);
test('the window comes from the cron and timeout that board-discovery declares',()=>{
 const s=W.parseSchedule(live);
 assert.deepEqual(s.hours,[2,6,10,14,18,22]);assert.deepEqual(s.minutes,[13]);assert.equal(s.timeoutMinutes,25);
 assert.equal(W.windowActive(s,utc(10,12)),false);
 assert.equal(W.windowActive(s,utc(10,13)),true);
 assert.equal(W.windowActive(s,utc(10,13)+W.LATE_START_MS+25*60000-1),true);
 assert.equal(W.windowActive(s,utc(10,13)+W.LATE_START_MS+25*60000),false);
 assert.equal(W.windowActive(s,utc(12,0)),false);
});
test('a window that crosses midnight is still found',()=>{
 const s=W.parseSchedule("on:\n  schedule:\n    - cron: '50 23 * * *'\njobs:\n  x:\n    timeout-minutes: 25\n");
 assert.equal(W.windowActive(s,Date.UTC(2026,10,18,0,10)),true);
 assert.equal(W.windowActive(s,Date.UTC(2026,10,18,1,0)),false);
});
test('a schedule that cannot be understood gives no window, and the env override wins',()=>{
 assert.equal(W.parseSchedule("cron: '13 2 * * 1'\n"),null);assert.equal(W.parseSchedule('no schedule'),null);
 assert.equal(W.windowActive(null,Date.now()),false);
 assert.equal(W.active(utc(10,20),{env:{ENRICH_BOARD_DISCOVERY_ACTIVE:'0'}}),false);
 assert.equal(W.active(utc(12,0),{env:{ENRICH_BOARD_DISCOVERY_ACTIVE:'1'}}),true);
 assert.equal(W.active(utc(10,20),{env:{}}),true);assert.equal(W.active(utc(12,0),{env:{}}),false);
});
test('only Workday hosts are paused, and only inside the window',()=>{
 const wd='https://acme.wd1.myworkdayjobs.com/wday/cxs/acme/Careers/jobs';
 assert.equal(W.paused(wd,utc(10,20),{env:{}}),true);
 assert.equal(W.paused(wd,utc(12,0),{env:{}}),false);
 for(const u of ['https://boards-api.greenhouse.io/v1/boards/acme/jobs','https://example.com/?x=myworkdayjobs.com',''])assert.equal(W.paused(u,utc(10,20),{env:{}}),false);
});
