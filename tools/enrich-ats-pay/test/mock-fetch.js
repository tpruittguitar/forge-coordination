'use strict';
// Test-only fetch stub for run.test.js: canned ATS / aggregator responses, everything else fails.
const pad = 'Acme is hiring a Director of Quality. Lead the site. '.repeat(12);
const R = {
  'https://boards-api.greenhouse.io/v1/boards/acme/jobs/111?pay_transparency=true': { content: '&lt;p&gt;' + pad + 'Bachelor degree required. Base $170,000 - $210,000&lt;/p&gt;', pay_input_ranges: [] },
  'https://boards-api.greenhouse.io/v1/boards/acme/jobs/333?pay_transparency=true': { content: '&lt;p&gt;' + pad + 'BS preferred.&lt;/p&gt;', pay_input_ranges: [] },
  'https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/4012345678': '<div>' + pad + 'Base pay range $150,000.00/yr - $190,000.00/yr</div>',
};
const fs = require('fs');
globalThis.fetch = async (url, opts) => {
  if (/^https:\/\/script\.google\.com\//.test(url)) {   // Writer: row_readback answers from ENRICH_TEST_WRITER_ROWS; batch POSTs are logged
    const W = JSON.parse(fs.readFileSync(process.env.ENRICH_TEST_WRITER_ROWS, 'utf8'));
    let body;
    if (/action=row_readback/.test(url)) { const ids = decodeURIComponent(url.match(/ids=([^&]*)/)[1]).split(','); body = { ok: true, rows: ids.map(id => W[id] ? { primaryId: id, found: true, matches: 1, line: W[id] } : { primaryId: id, found: false, matches: 0 }) }; }
    else { const req = JSON.parse(opts.body); fs.appendFileSync(process.env.ENRICH_TEST_POSTS, JSON.stringify(req) + '\n'); body = { ok: true, results: req.requests.map(() => ({ ok: true })) }; }
    return { ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) };
  }
  if (!(url in R)) throw new Error('offline: ' + url);
  const body = R[url];
  return { ok: true, status: 200, json: async () => body, text: async () => (typeof body === 'string' ? body : JSON.stringify(body)) };
};
