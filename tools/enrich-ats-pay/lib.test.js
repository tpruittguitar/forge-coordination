'use strict';
// REV-116 unit tests: node --test tools/enrich-ats-pay/lib.test.js
const test = require('node:test'), assert = require('node:assert');
const L = require('./lib.js');
const pad = 'Role summary. '.repeat(20);

test('posting pay ranges parse; hourly and junk are refused', () => {
  assert.deepStrictEqual(L.payFromText('The range is $175,000 - $260,000.'), { low: 175000, high: 260000 });
  assert.deepStrictEqual(L.payFromText('$150,000.00/yr - $190,000.00/yr'), { low: 150000, high: 190000 });
  assert.deepStrictEqual(L.payFromText('$120K per year to $150K'), { low: 120000, high: 150000 });
  assert.strictEqual(L.payFromText('$45/hr - $60/hr'), null);
  assert.strictEqual(L.payFromText('$300,000 - $200,000'), null);
});
test('degree: required, preferred, not stated', () => {
  assert.strictEqual(L.degreeFromText("Bachelor's degree in Engineering required.").req, 'REQUIRED');
  assert.strictEqual(L.degreeFromText("BS preferred or equivalent experience.").req, 'PREFERRED');
  assert.strictEqual(L.degreeFromText('Lead the plant.').req, 'NOT_STATED');
  assert.strictEqual(L.degreeFromText("Experience Requirements Bachelor's degree in a science-related field (experience may substitute)").req, 'PREFERRED');
  const long = L.degreeFromText('Develop dashboards '.repeat(30) + 'BS Mechanical Engineering or equivalent related experience ' + 'Minimum 6 years '.repeat(30));
  assert.ok(long.text.length <= 500, long.text.length); assert.match(long.text, /BS Mechanical Engineering/); assert.strictEqual(long.req, 'PREFERRED');
});
test('ATS URLs map to public APIs', () => {
  assert.strictEqual(L.atsApi('https://jobs.lever.co/shieldai/0f1e2d3c-4b5a-6978-8a9b-0c1d2e3f4a5b').kind, 'lever');
  assert.match(L.atsApi('https://job-boards.greenhouse.io/anduril/jobs/4567890').api, /boards-api\.greenhouse\.io\/v1\/boards\/anduril\/jobs\/4567890\?pay_transparency=true/);
  assert.strictEqual(L.atsApi('https://jobs.ashbyhq.com/acme/0f1e2d3c-4b5a-6978-8a9b-0c1d2e3f4a5b').kind, 'ashby');
  assert.strictEqual(L.atsApi('https://www.linkedin.com/jobs/view/123456789'), null);
});
test('ATS parse: structured pay first, then pay in the text', () => {
  assert.deepStrictEqual(L.parseAts('lever', { salaryRange: { min: 180000, max: 220000, interval: 'per-year-salary' }, descriptionPlain: 'x', lists: [] }).pay, { low: 180000, high: 220000 });
  assert.deepStrictEqual(L.parseAts('greenhouse', { content: '&lt;p&gt;Base $160,000 - $200,000&lt;/p&gt;', pay_input_ranges: [] }).pay, { low: 160000, high: 200000 });
  assert.deepStrictEqual(L.parseAts('greenhouse', { content: 'x', pay_input_ranges: [{ min_cents: 15000000, max_cents: 19000000 }] }).pay, { low: 150000, high: 190000 });
  const ash = { jobs: [{ id: 'J1', descriptionPlain: 'Masters preferred', compensation: { summaryComponents: [{ compensationType: 'Salary', interval: '1 YEAR', minValue: 170000, maxValue: 210000 }] } }] };
  assert.deepStrictEqual(L.parseAts('ashby', ash, 'J1').pay, { low: 170000, high: 210000 });
  assert.strictEqual(L.parseAts('ashby', ash, 'missing'), null);
});
test('aggregator postings: LinkedIn and Indeed pay counts as posting pay; a site estimate is labelled', () => {
  const li = L.aggregatorPage('https://www.linkedin.com/jobs/view/director-quality-at-acme-4012345678?trk=x');
  assert.strictEqual(li.fetch, 'https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/4012345678');
  assert.strictEqual(L.aggregatorPage('https://www.indeed.com/viewjob?jk=0123456789abcdef').kind, 'indeed');
  const posted = L.parseAggregator('linkedin', '<p>' + pad + 'Base pay range $150,000.00/yr - $190,000.00/yr</p>');
  assert.deepStrictEqual([posted.pay, posted.basis], [{ low: 150000, high: 190000 }, 'EMPLOYER_POSTED']);
  assert.strictEqual(L.parseAggregator('indeed', '<p>' + pad + 'Estimated $120K - $150K a year</p>').basis, 'THIRD_PARTY_ESTIMATE');
  assert.strictEqual(L.parseAggregator('indeed', '<p>blocked</p>'), null);
});
test('estimate follows COMPENSATION_ESTIMATION: comparables share level and function; 1 = LOW, 2 close = MED', () => {
  const row = { PRIMARY_ID: 'X', TITLE: 'Director of Quality', LOCATION: 'Dayton, OH' };
  const mk = (id, lo, hi, loc, title) => L.postedAnchor({ PRIMARY_ID: id, COMPANY: 'C', TITLE: title || 'Director, Quality', LOCATION: loc }, { SALARY_BASIS: 'EMPLOYER_POSTED', SALARY_BASE_LOW: lo, SALARY_BASE_HIGH: hi });
  assert.strictEqual(L.estimate(row, [mk('A', 150000, 190000, 'Austin, TX', 'Plant Manager')]), null);
  const one = L.estimate(row, [mk('A', 150000, 190000, 'Austin, TX')]);
  assert.deepStrictEqual([one.low, one.high, one.conf], [150000, 190000, 'LOW']);
  const two = L.estimate(row, [mk('A', 150000, 190000, 'Detroit, MI'), mk('B', 160000, 200000, 'Columbus, OH')]);
  assert.deepStrictEqual([two.low, two.high, two.conf, two.n], [160000, 200000, 'MED', 2]); // exact-state evidence receives more weight
  assert.strictEqual(L.postedAnchor({ PRIMARY_ID: 'E' }, { SALARY_BASIS: 'FORGE-ESTIMATE', SALARY_BASE_LOW: 1e5, SALARY_BASE_HIGH: 2e5 }), null);
});

test('Grok Bot QA: a sign-in or bot-check page is not a read posting, so it cannot unlock an estimate', () => {
  const row = { COMPANY: 'Acme Robotics', TITLE: 'Director of Quality Engineering' };
  const wall = '<div>' + 'Sign in to view more jobs. Join now to see who you know. '.repeat(10) + '</div>';
  assert.strictEqual(L.parseAggregator('linkedin', wall, row).wall, true);
  const real = '<div>' + 'Acme Robotics is hiring a Director of Quality Engineering to lead the plant quality team. '.repeat(6) + 'Base pay range $150,000.00/yr - $190,000.00/yr</div>';
  const ok = L.parseAggregator('linkedin', real, row);
  assert.strictEqual(ok.wall, undefined); assert.deepStrictEqual(ok.pay, { low: 150000, high: 190000 });
  const other = '<div>' + 'Globex is hiring a Senior Accountant for the finance team in Springfield. '.repeat(8) + '</div>';
  assert.strictEqual(L.parseAggregator('linkedin', other, row).wall, true, 'a different job is not this posting');
});
test('Grok Bot QA: 3+ tight same-region comparables reach HIGH; Head of = director band', () => {
  const mk = (id, lo, hi, loc) => L.postedAnchor({ PRIMARY_ID: id, COMPANY: 'C', TITLE: 'Director, Quality', LOCATION: loc }, { SALARY_BASIS: 'EMPLOYER_POSTED', SALARY_BASE_LOW: lo, SALARY_BASE_HIGH: hi });
  const row = { PRIMARY_ID: 'X', TITLE: 'Director of Quality', LOCATION: 'Dayton, OH' };
  const tight = L.estimate(row, [mk('A', 150000, 190000, 'Detroit, MI'), mk('B', 155000, 195000, 'Columbus, OH'), mk('C', 160000, 200000, 'Chicago, IL')]);
  assert.strictEqual(tight.conf, 'HIGH');
  const loose = L.estimate(row, [mk('A', 110000, 130000, 'Detroit, MI'), mk('B', 155000, 195000, 'Columbus, OH'), mk('C', 220000, 260000, 'Chicago, IL')]);
  assert.strictEqual(loose.conf, 'MED');
  assert.strictEqual(L.level('Head of Manufacturing'), 3); assert.strictEqual(L.level('VP Operations'), 4);
});

test('Grok Bot QA 19:32: the degree sentence is verbatim; the bachelor clause decides REQUIRED vs PREFERRED', () => {
  const html = '<ul><li>10+ years in manufacturing</li><li>B.S. in Mechanical Engineering required; MBA preferred</li></ul><p>Strong leader.</p>';
  const t = L.parseAts('greenhouse', { content: html.replace(/</g, '&lt;').replace(/>/g, '&gt;'), pay_input_ranges: [] }).text;
  assert.deepStrictEqual(L.degreeFromText(t), { text: 'B.S. in Mechanical Engineering required; MBA preferred', req: 'REQUIRED' });
  assert.deepStrictEqual(L.degreeFromText("Requirements: Bachelor's degree in Engineering. 10 years experience."), { text: "Requirements: Bachelor's degree in Engineering.", req: 'REQUIRED' });
  assert.strictEqual(L.degreeFromText("Bachelor's degree or equivalent experience. Lead teams.").req, 'PREFERRED');
  assert.strictEqual(L.degreeFromText("Bachelor's degree in Engineering, master's preferred.").req, 'REQUIRED');
});


test('REV-136: ATS links found in any posting field, API forms and Workday', () => {
  const wd = L.atsApi('https://blueorigin.wd5.myworkdayjobs.com/en-US/BlueOrigin/job/Seattle-WA/Director-Manufacturing_R12345?source=x');
  assert.strictEqual(wd.kind, 'workday');
  assert.strictEqual(wd.api, 'https://blueorigin.wd5.myworkdayjobs.com/wday/cxs/blueorigin/BlueOrigin/job/Seattle-WA/Director-Manufacturing_R12345');
  assert.strictEqual(wd.page, 'https://blueorigin.wd5.myworkdayjobs.com/en-US/BlueOrigin/job/Seattle-WA/Director-Manufacturing_R12345');
  assert.strictEqual(L.atsApi('https://acme.wd1.myworkdayjobs.com/Careers/job/Austin/Plant-Manager_JR1').api, 'https://acme.wd1.myworkdayjobs.com/wday/cxs/acme/Careers/job/Austin/Plant-Manager_JR1');
  assert.strictEqual(L.atsApi('https://boards-api.greenhouse.io/v1/boards/anduril/jobs/4567890').page, 'https://job-boards.greenhouse.io/anduril/jobs/4567890');
  assert.strictEqual(L.atsApi('https://api.lever.co/v0/postings/shieldai/0f1e2d3c-4b5a-6978-8a9b-0c1d2e3f4a5b').kind, 'lever');
  const p = { SOURCE_URL: 'https://www.linkedin.com/jobs/view/1', ATS_POSTING_URL: 'https://job-boards.greenhouse.io/anduril/jobs/4567890' };
  assert.strictEqual(L.atsFor(p).key, 'ATS_POSTING_URL');
  assert.strictEqual(L.atsFor({ SOURCE_URL: 'https://www.linkedin.com/jobs/view/1', LIVENESS_EVIDENCE_URL: 'https://boards-api.greenhouse.io/v1/boards/a/jobs/9' }).kind, 'greenhouse');
  assert.strictEqual(L.atsFor({ SOURCE_URL: 'https://www.linkedin.com/jobs/view/1' }), null);
  const info = { jobPostingInfo: { jobDescription: '<p>Requires a Bachelor&#39;s degree.</p><p>Pay range: $165,000 - $210,000 per year</p>' } };
  assert.deepStrictEqual(L.parseAts('workday', info).pay, { low: 165000, high: 210000 });
  assert.match(L.parseAts('workday', info).text, /Bachelor's degree/);
  assert.strictEqual(L.parseAts('workday', {}), null);
});

test('REV-138: same-employer source, board parsing, BLS series and cross-check', () => {
  assert.strictEqual(L.normCo('Blue Origin, LLC'), L.normCo('Blue Origin'));
  // Grok Bot QA #21: foreign and ambiguous locations are not US states
  assert.deepStrictEqual(['Toronto, ON, CA', 'Bangalore, IN', 'Munich, DE', 'Remote OR Hybrid', 'Mexico City, Mexico', 'London, United Kingdom', 'Remote'].map(L.stateFrom), ['', '', '', '', '', '', '']);
  assert.deepStrictEqual(['Kent, WA', 'US-CA-Irvine', 'Seattle, Washington, United States', 'Austin, TX 78701', 'Indianapolis, IN', 'Dover, DE, US', 'Costa Mesa, CA', 'London, KY', 'Paris, TX'].map(L.stateFrom), ['WA', 'CA', 'WA', 'TX', 'IN', 'DE', 'CA', 'KY', 'TX']);
  assert.deepStrictEqual(L.boardOf({ ATS_POSTING_URL: 'https://job-boards.greenhouse.io/anduril/jobs/4567890' }), { kind: 'greenhouse', key: 'greenhouse:anduril', board: 'anduril' });
  const wd = L.boardOf({ SOURCE_URL: 'https://blueorigin.wd5.myworkdayjobs.com/en-US/BlueOrigin/job/Seattle-WA/Director_R1' });
  assert.deepStrictEqual([wd.kind, wd.tenant, wd.site], ['workday', 'blueorigin', 'BlueOrigin']);
  const q = L.boardListRequest(wd, 'Manufacturing Director - Lunar Tanks');
  assert.strictEqual(q.method, 'POST'); assert.match(q.url, /\/wday\/cxs\/blueorigin\/BlueOrigin\/jobs$/); assert.strictEqual(JSON.parse(q.body).searchText, 'Manufacturing Lunar Tanks');
  const gh = L.parseBoard({ kind: 'greenhouse' }, { jobs: [
    { title: 'Director of Manufacturing', location: { name: 'Costa Mesa, CA' }, content: '&lt;p&gt;Base pay $200,000 - $260,000&lt;/p&gt;', absolute_url: 'u1' },
    { title: 'Director, Manufacturing', location: { name: 'Atlanta, GA' }, content: 'no pay', absolute_url: 'u2' },
    { title: 'Technician', location: { name: 'Seattle, WA' }, content: '$60,000 - $80,000', absolute_url: 'u3' }] });
  assert.deepStrictEqual(gh.map(x => x.state), ['CA', 'GA', 'WA']);
  const row = { PRIMARY_ID: 'X', COMPANY: 'Anduril', TITLE: 'Director of Manufacturing Operations', LOCATION: 'Huntsville, AL' };
  const sim = L.similarPostings(row, gh); assert.deepStrictEqual(sim.map(x => x.page), ['u1'], 'same level and function, with pay');
  assert.deepStrictEqual(L.similarPostings(row, [{ title: 'Director of Manufacturing', location: 'Toronto, ON, CA', state: L.stateFrom('Toronto, ON, CA'), pay: { low: 200000, high: 250000 } }]), [], 'a posting abroad is never a comparable');
  const est = L.sameEmployerEstimate(row, sim, st => st === 'CA' ? 0.8 : null);
  assert.deepStrictEqual([est.low, est.high, est.conf, est.source], [160000, 208000, 'LOW', 'SAME_EMPLOYER']); // one posting cannot establish MED confidence
  assert.match(est.basis, /Director of Manufacturing \(CA\) \$200K-\$260K x0\.80 BLS state ratio/);
  assert.strictEqual(L.sameEmployerEstimate(row, sim, () => 0.5).low, 150000, 'state ratio floored at 0.75');
  const anchors = [{ id: 'A1', co: 'Anduril Industries', title: 'Director, Manufacturing', low: 190000, high: 240000, level: 2, func: 'MFG', state: 'CA' },
    { id: 'A2', co: 'Other Co', title: 'Director, Manufacturing', low: 150000, high: 190000, level: 2, func: 'MFG', state: 'AL' }];
  assert.deepStrictEqual(L.sameEmployerAnchors({ PRIMARY_ID: 'X', COMPANY: 'Anduril Industries, Inc.', TITLE: 'Director of Manufacturing' }, anchors).map(a => a.id), ['A1']);
  assert.strictEqual(L.socOf('Plant Manager'), '113051'); assert.strictEqual(L.socOf('Director, Supply Chain'), '113071');
  assert.strictEqual(L.blsSeries('TN', '113051', '12'), 'OEUS470000000000011305112'); assert.strictEqual(L.blsSeries('XX', '113051', '12'), null);
  const w = { state: 'AL', soc: '113051', p25: 90000, median: 120000, p90: 180000 };
  assert.deepStrictEqual([L.blsCheck({ mid: 200000, high: 230000, conf: 'MED' }, w).flag, L.blsCheck({ mid: 200000, high: 230000, conf: 'MED' }, w).conf], ['OK', 'MED']);
  assert.deepStrictEqual([L.blsCheck({ mid: 300000, high: 330000, conf: 'HIGH' }, w).flag, L.blsCheck({ mid: 300000, high: 330000, conf: 'HIGH' }, w).conf], ['ABOVE', 'MED']);
  assert.deepStrictEqual([L.blsCheck({ mid: 80000, high: 85000, conf: 'MED' }, w).flag, L.blsCheck({ mid: 80000, high: 85000, conf: 'MED' }, w).conf], ['BELOW', 'LOW']);
  assert.strictEqual(L.blsCheck({ mid: 1, high: 1, conf: 'MED' }, null).flag, 'NO_BLS');
});

test('aggregator recovery uses saved direct evidence when the original source is a tracking URL',()=>{const a=L.aggregatorFor({SOURCE_URL:'https://www.ziprecruiter.com/km/tracking',LIVENESS_EVIDENCE_URL:'https://www.linkedin.com/jobs/view/4485233648/'});assert.equal(a.kind,'linkedin');assert.equal(a.id,'4485233648');assert.equal(L.aggregatorFor({SOURCE_URL:'https://email.lensa.com/opaque'}),null);});
