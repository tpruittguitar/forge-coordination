'use strict';
const { test } = require('node:test'), assert = require('node:assert/strict');
const M = require('./match');
const line = (id, co, title, status, { tags = '-', req = 'UNKNOWN', loc = 'UNKNOWN', kv = '' } = {}) => `1 | ${id} | ${co} | ${title} | ${status} | X/Y | ${tags} | ${req} | ${loc} | ${kv}`;
const one = (rows, id) => M.classify(rows, { waitingIds: new Set([id]) }).items[0];

test('same ATS posting closes even with a reworded title', () => {
  const r = one([
    line('V2I-A', 'Hadrian', 'Director, Supplier Quality & Development', 'SCOUT_INTAKE', { kv: 'POSTING_URL=https://jobs.ashbyhq.com/hadrian-automation/abd87b56-2905-409e-9e32-54e9e31b5abd; DATE_ADDED=2026-10-18' }),
    line('V2E-B', 'Hadrian Automation', 'Director Supplier Quality and Development', 'APPLIED', { tags: 'APPLIED_2026-10-19', kv: 'APPLY_URL=https://jobs.ashbyhq.com/hadrian-automation/ABD87B56-2905-409e-9e32-54e9e31b5abd' })], 'V2I-A');
  assert.equal(r.outcome, 'CLOSE_CANDIDATE'); assert.equal(r.rule, 'SAME_POSTING_ID');
});

test('a different Workday requisition is a new opening even after a rejection', () => {
  const r = one([
    line('V2I-A', 'Blue Origin', 'Lunar Manufacturing & Assembly Manager', 'SCOUT_INTAKE', { req: 'R69279', kv: 'SOURCE_URL=https://blueorigin.wd5.myworkdayjobs.com/en-US/BlueOrigin/job/Space-Coast-FL/Lunar-Manufacturing---Assembly-Manager_R69279; POSTED_AT=2026-09-13' }),
    line('V2I-B', 'Blue Origin', 'Lunar Manufacturing & Assembly Manager', 'REJECTED_BY_EMPLOYER', { req: 'R61000', tags: 'APPLIED_2026-07-01; EMPLOYER_REJECTION_2026-08-04' })], 'V2I-A');
  assert.equal(r.outcome, 'KEEP_LABEL'); assert.equal(r.rule, 'NEW_REQUISITION');
  assert.match(r.label, /Applied 2026-07-01 · Rejected 2026-08-04 · this is a new posting/);
});

test('different Greenhouse jobs with the same title stay open', () => {
  const r = one([
    line('V2I-A', 'SpaceX', 'Director, Starlink Production (Assembly)', 'SCOUT_INTAKE', { kv: 'POSTING_URL=https://job-boards.greenhouse.io/spacex/jobs/8697970002' }),
    line('V2I-B', 'SpaceX', 'Director, Starlink Production (Assembly)', 'APPLIED', { req: '8468502002', kv: 'SOURCE_URL=https://job-boards.greenhouse.io/spacex/jobs/8468502002' })], 'V2I-A');
  assert.equal(r.outcome, 'KEEP_LABEL');
});

test('posting seen before the application date is likely the same posting; LinkedIn IDs never prove a new requisition', () => {
  const r = one([
    line('V2I-A', 'GE Vernova', 'Repair Quality Leader', 'SCOUT_INTAKE', { kv: 'SOURCE_URL=https://www.linkedin.com/comm/jobs/view/4483177110/?trackingId=x; DATE_ADDED=2026-10-25' }),
    line('V2E-B', 'GE Vernova', 'Repair Quality Leader', 'APPLIED', { tags: 'EMAIL_UPSERT_2026-10-26; APPLIED_2026-10-25', kv: 'SOURCE_URL=https://www.linkedin.com/jobs/view/4400000000' })], 'V2I-A');
  assert.equal(r.outcome, 'CLOSE_CANDIDATE'); assert.equal(r.rule, 'SAME_BY_TIMELINE');
});

test('first seen after the rejection asks Tim; reworded titles never close on timeline', () => {
  const rejected = line('V2F-B', 'Anduril Industries', 'Deputy Head of Production, Connected Warfare', 'REJECTED_BY_EMPLOYER', { tags: 'APPLIED_2026-09-28; EMPLOYER_REJECTION_2026-10-16' });
  assert.equal(one([line('V2I-A', 'Anduril Industries', 'Deputy Head of Production, Connected Warfare', 'SCOUT_INTAKE', { kv: 'DATE_ADDED=2026-10-18' }), rejected], 'V2I-A').rule, 'POSSIBLE_REPOST');
  const reworded = one([line('V2I-C', 'Anduril', 'Production Deputy Head - Connected Warfare Programs', 'SCOUT_INTAKE', { kv: 'DATE_ADDED=2026-09-20' }), rejected], 'V2I-C');
  assert.notEqual(reworded?.outcome, 'CLOSE_CANDIDATE');
});

test('different worksite keeps the job; unrelated titles and other companies do not match', () => {
  const applied = line('V2E-B', 'Tesla', 'Production Manager', 'APPLIED', { loc: 'Austin, TX', tags: 'APPLIED_2026-10-01' });
  assert.equal(one([line('V2I-A', 'Tesla', 'Production Manager', 'SCOUT_INTAKE', { loc: 'Fremont, CA', kv: 'DATE_ADDED=2026-09-01' }), applied], 'V2I-A').rule, 'DIFFERENT_SITE');
  assert.equal(one([line('V2I-C', 'Tesla', 'Supplier Quality Program Manager', 'SCOUT_INTAKE'), applied], 'V2I-C'), undefined);
  assert.equal(one([line('V2I-D', 'Blue Bird', 'Production Manager', 'SCOUT_INTAKE', { loc: 'Austin, TX' }), applied], 'V2I-D'), undefined);
});

test('generic confidential employers match only on a shared posting identity', () => {
  const rows = [line('V2I-A', 'Confidential Company', 'Plant Manager', 'SCOUT_INTAKE', { kv: 'DATE_ADDED=2026-09-01' }), line('V2I-B', 'Confidential Company', 'Plant Manager', 'DECLINED_BY_TIM', { tags: 'TIM_DECLINE_2026-10-01' })];
  assert.equal(one(rows, 'V2I-A'), undefined);
});

test('decided rows are never reported, and counts add up', () => {
  const rows = [line('V2I-A', 'Acme Robotics', 'Plant Manager', 'SCOUT_INTAKE', { kv: 'DATE_ADDED=2026-10-01' }), line('V2E-B', 'Acme Robotics', 'Plant Manager', 'APPLIED', { tags: 'APPLIED_2026-10-02' })];
  const r = M.classify(rows);
  assert.equal(r.counts.waiting, 1); assert.equal(r.counts.matched, 1); assert.equal(r.items[0].id, 'V2I-A');
  assert.equal(r.counts.CLOSE_CANDIDATE + r.counts.KEEP_LABEL + r.counts.ASK_TIM, r.counts.matched);
});
