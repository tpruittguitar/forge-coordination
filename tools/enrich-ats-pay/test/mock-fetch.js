'use strict';
// Test-only fetch stub for run.test.js: canned ATS / aggregator responses, everything else fails.
const pad = 'Acme is hiring a Director of Quality. Lead the site. '.repeat(12);
const R = {
  'https://careers.example.org/job/quality': '<script type="application/ld+json">'+JSON.stringify({'@type':'JobPosting',title:'Director of Quality',hiringOrganization:{name:'Acme'},description:pad+'Bachelor degree required. Base $170,000 - $210,000'})+'</script>',
  'https://boards-api.greenhouse.io/v1/boards/acme/jobs/111?pay_transparency=true': { content: '&lt;p&gt;' + pad + 'Bachelor degree required. Base $170,000 - $210,000&lt;/p&gt;', pay_input_ranges: [] },
  'https://boards-api.greenhouse.io/v1/boards/acme/jobs/333?pay_transparency=true': { content: '&lt;p&gt;' + pad + 'BS preferred.&lt;/p&gt;', pay_input_ranges: [] },
  'https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/4012345678': '<div>' + pad + 'Base pay range $150,000.00/yr - $190,000.00/yr</div>',
};
const fs = require('fs');
globalThis.fetch = async (url, opts) => {
  if (/^https:\/\/script\.google\.com\//.test(url)) {   // Writer: row_readback answers from ENRICH_TEST_WRITER_ROWS; batch POSTs are logged
    const W = JSON.parse(fs.readFileSync(process.env.ENRICH_TEST_WRITER_ROWS, 'utf8'));
    let body;
    if(/action=master/.test(url)){body={ok:true,text:'V2_CURRENT_POPULATION_MASTER\n'+Object.values(W).join('\n')+'\nEND V2_CURRENT_POPULATION_MASTER\n'};return {ok:true,status:200,json:async()=>body};}
    if(/action=archive/.test(url))return {ok:true,status:200,json:async()=>({ok:true,text:''})};
    const wm = process.env.ENRICH_TEST_WRITER_MODE;
    if (/action=receipt_index/.test(url)) {   // REPLY_LOST: the batch was saved; REPLY_LOST_UNSAVED: nothing in the index
      const rid = decodeURIComponent(url.match(/requestId=([^&]*)/)[1]), sent = fs.existsSync(process.env.ENRICH_TEST_POSTS) ? fs.readFileSync(process.env.ENRICH_TEST_POSTS, 'utf8').trim().split('\n').map(JSON.parse) : [];
      const b = sent.find(x => x.requests.some(q => q.ruling.requestId === rid)), polls = (global.__receiptPolls = (global.__receiptPolls || 0) + 1);
      body = { ok: true, exists: true, request: wm === 'REPLY_LOST' && b ? { s: polls === 1 ? 'PENDING' : 'COMPLETE', items: b.requests.map(q => ({ pid: q.ruling.primaryId, op: 'RULING' })) } : null };
      return { ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) };
    }
    if (/action=row_readback/.test(url)) { const ids = decodeURIComponent(url.match(/ids=([^&]*)/)[1]).split(','); body = { ok: true, rows: ids.map(id => W[id] ? { primaryId: id, found: true, matches: 1, line: W[id] } : { primaryId: id, found: false, matches: 0 }) }; }
    else { const req = JSON.parse(opts.body); fs.appendFileSync(process.env.ENRICH_TEST_POSTS, JSON.stringify(req) + '\n'); if (/^REPLY_LOST/.test(wm)) return { ok: false, status: 404, json: async () => { throw new Error('not json'); }, text: async () => 'Not Found' }; const nPost = (global.__writerPosts = (global.__writerPosts || 0) + 1); body = (wm === 'FENCE' || (wm === 'FENCE_ONCE' && nPost === 1)) ? { ok: false, mode: 'WRITE_FENCE', retryAfterMs: 30000, error: 'an earlier master write is not yet independently verified; retry after it is' } : wm === 'RETRY' ? { ok: true, mode: 'BATCH_RULING_RETRY', error: 'master changed', results: req.requests.map(() => ({ ok: true, mode: 'PLANNED' })) } : { ok: true, mode: 'BATCH_RULING_SINGLE_COMMIT', writeId: 'W-TEST', results: req.requests.map(() => ({ ok: true })) }; }
    return { ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) };
  }
  if (/\/jobs\/404\?/.test(url)) return { ok: false, status: 404, json: async () => ({}), text: async () => '' };   // posting taken down
  if (!(url in R)) throw new Error('offline: ' + url);
  const body = R[url];
  return { ok: true, status: 200, json: async () => body, text: async () => (typeof body === 'string' ? body : JSON.stringify(body)) };
};
