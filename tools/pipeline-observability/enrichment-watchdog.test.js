const {test}=require('node:test'),assert=require('node:assert/strict'),{due}=require('./enrichment-watchdog');test('missed enrichment starts recover without duplicating running or recent attempts',()=>{const now=Date.now(),r={head_branch:'main',event:'schedule',status:'completed',created_at:new Date(now-2*3600000).toISOString()};assert.equal(due([r],now),true);assert.equal(due([{...r,status:'in_progress'}],now),false);assert.equal(due([{...r,created_at:new Date(now-1000).toISOString()}],now),false);assert.equal(due([],now),false);});

const fixedNow=Date.parse('2026-11-03T00:00:00Z');
const run=(minutes,status='completed',event='schedule',head_branch='main')=>({created_at:new Date(fixedNow-minutes*60000).toISOString(),status,event,head_branch});
test('35-minute threshold boundary',()=>{assert.equal(due([run(34)],fixedNow),false);assert.equal(due([run(35)],fixedNow),false);assert.equal(due([run(36)],fixedNow),true);});
test('queued and in-progress runs block dispatch',()=>{assert.equal(due([run(40),run(70,'queued')],fixedNow),false);assert.equal(due([run(40),run(70,'in_progress')],fixedNow),false);});
test('ignore PR and feature-branch runs; recent dispatch suppresses',()=>{assert.equal(due([run(50),run(1,'completed','pull_request'),run(2,'completed','schedule','feature')],fixedNow),true);assert.equal(due([run(50),run(10,'completed','workflow_dispatch')],fixedNow),false);});
