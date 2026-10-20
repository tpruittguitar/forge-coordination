'use strict';
// Test-only fetch stub for run.test.js: canned ATS / aggregator responses, everything else fails.
const pad = 'Lead the site. '.repeat(20);
const R = {
  'https://boards-api.greenhouse.io/v1/boards/acme/jobs/111?pay_transparency=true': { content: '&lt;p&gt;' + pad + 'Bachelor degree required. Base $170,000 - $210,000&lt;/p&gt;', pay_input_ranges: [] },
  'https://boards-api.greenhouse.io/v1/boards/acme/jobs/333?pay_transparency=true': { content: '&lt;p&gt;' + pad + 'BS preferred.&lt;/p&gt;', pay_input_ranges: [] },
  'https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/4012345678': '<div>' + pad + 'Base pay range $150,000.00/yr - $190,000.00/yr</div>',
};
globalThis.fetch = async url => {
  if (!(url in R)) throw new Error('offline: ' + url);
  const body = R[url];
  return { ok: true, status: 200, json: async () => body, text: async () => (typeof body === 'string' ? body : JSON.stringify(body)) };
};
