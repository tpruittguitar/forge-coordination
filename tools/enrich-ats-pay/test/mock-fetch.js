'use strict';
// Test-only fetch stub for run.test.js: canned ATS / aggregator responses, everything else fails.
const pad = 'Acme is hiring a Director of Quality. Lead the site. '.repeat(12);
const R = {
  'https://careers.example.org/job/quality': '<script type="application/ld+json">'+JSON.stringify({'@type':'JobPosting',title:'Director of Quality',hiringOrganization:{name:'Acme'},jobLocation:{address:{addressLocality:'Dayton',addressRegion:'OH',addressCountry:'US'}},baseSalary:{currency:'USD',value:{unitText:'YEAR',minValue:170000,maxValue:210000}},description:pad+'Bachelor degree required. Annual base salary USD $170,000 - $210,000'})+'</script>',
  'https://boards-api.greenhouse.io/v1/boards/acme/jobs/111?pay_transparency=true': { content: '&lt;p&gt;' + pad + 'Bachelor degree required. Annual base salary USD $170,000 - $210,000&lt;/p&gt;', pay_input_ranges: [] },
  'https://boards-api.greenhouse.io/v1/boards/acme/jobs/333?pay_transparency=true': { content: '&lt;p&gt;' + pad + 'BS preferred.&lt;/p&gt;', pay_input_ranges: [] },
  'https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/4012345678': '<div>' + pad + 'Base pay range USD $150,000.00/yr - $190,000.00/yr</div>',
};
const fs = require('fs');
if(process.env.ENRICH_TEST_NOW){const now=Number(process.env.ENRICH_TEST_NOW);Date.now=()=>now;}
if(process.env.ENRICH_TEST_CLOCK_STEP){let clock=Date.now();Date.now=()=>clock;global.__advancePayClock=()=>{clock+=Number(process.env.ENRICH_TEST_CLOCK_STEP);};}
globalThis.fetch = async (url, opts) => {
  if(process.env.ENRICH_TEST_CLOCK_MATCH&&String(url).includes(process.env.ENRICH_TEST_CLOCK_MATCH))global.__advancePayClock?.();
  const sent=()=>fs.existsSync(process.env.ENRICH_TEST_POSTS||'')?fs.readFileSync(process.env.ENRICH_TEST_POSTS,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse):[];
  if(String(url).includes('forge-writer-state/main/PIPELINE_RECEIPT_INDEX.json'))return {ok:true,status:200,json:async()=>({requests:Object.fromEntries(sent().flatMap(b=>b.requests.map(q=>[q.ruling.requestId,{s:'COMPLETE'}])))})};
  if (/^https:\/\/script\.google\.com\//.test(url)) {   // Writer: row_readback answers from ENRICH_TEST_WRITER_ROWS; batch POSTs are logged
    const W = JSON.parse(fs.readFileSync(process.env.ENRICH_TEST_WRITER_ROWS, 'utf8'));
    let body;
    if(/action=master/.test(url)){body={ok:true,text:'V2_CURRENT_POPULATION_MASTER\n'+Object.values(W).join('\n')+'\nEND V2_CURRENT_POPULATION_MASTER\n'};return {ok:true,status:200,json:async()=>body};}
    if(/action=archive/.test(url))return {ok:true,status:200,json:async()=>({ok:true,text:''})};
    const wm = process.env.ENRICH_TEST_WRITER_MODE;
    if (/action=receipt_index/.test(url)) {   // REPLY_LOST: the batch was saved; REPLY_LOST_UNSAVED: nothing in the index
      const rid = decodeURIComponent(url.match(/requestId=([^&]*)/)[1]), sent = fs.existsSync(process.env.ENRICH_TEST_POSTS) ? fs.readFileSync(process.env.ENRICH_TEST_POSTS, 'utf8').trim().split('\n').map(JSON.parse) : [];
      const b = sent.find(x => x.requests.some(q => q.ruling.requestId === rid)), polls = (global.__receiptPolls = (global.__receiptPolls || 0) + 1);
      body = { ok: true, exists: true,source:'GITHUB',sha:'test-index', request: wm === 'REPLY_LOST' && b ? { s: polls === 1 ? 'PENDING' : 'COMPLETE' } : null };
      return { ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) };
    }
    if(/action=request_result/.test(url)){const requestId=new URL(url).searchParams.get('requestId');body={ok:true,found:true,requestId,status:'COMPLETE',durable:true};}
    else if (/action=row_readback/.test(url)) { const ids = decodeURIComponent(url.match(/ids=([^&]*)/)[1]).split(','); if(wm==='REPLY_LOST')for(const b of sent())for(const q of b.requests){const id=q.ruling.primaryId;if(W[id])W[id]+='; '+Object.entries(q.ruling.fields).map(([k,v])=>k+'='+String(v).replace(/; /g,', ')).join('; ');} body = { ok: true,master:{endMarkerPresent:true}, rows: ids.map(id => W[id] ? { primaryId: id, found: true, matches: 1, line: W[id] } : { primaryId: id, found: false, matches: 0 }) }; }
    else { const req = JSON.parse(opts.body); if(process.env.ENRICH_TEST_ATTEMPTS)fs.appendFileSync(process.env.ENRICH_TEST_ATTEMPTS,JSON.stringify(req)+'\n'); if(wm==='BUSY_NOT_ACCEPTED')return {ok:true,status:200,json:async()=>({ok:false,outcome:{schema:'forge.writer-outcome.v1',status:'NOT_ACCEPTED',phase:'BEFORE_MUTATION',code:'WRITER_BUSY',masterMutations:0,requestIds:req.requests.map(q=>q.ruling.requestId),retryAfterMs:60000}})}; fs.appendFileSync(process.env.ENRICH_TEST_POSTS, JSON.stringify(req) + '\n'); if (/^REPLY_LOST/.test(wm)) return { ok: false, status: 404, json: async () => { throw new Error('not json'); }, text: async () => 'Not Found' }; const nPost = (global.__writerPosts = (global.__writerPosts || 0) + 1); body = (wm === 'FENCE' || (wm === 'FENCE_ONCE' && nPost === 1)) ? { ok: false, mode: 'WRITE_FENCE', retryAfterMs: 30000, error: 'an earlier master write is not yet independently verified; retry after it is',outcome:{schema:'forge.writer-outcome.v1',status:'NOT_ACCEPTED',phase:'BEFORE_MUTATION',code:'WRITE_FENCE',masterMutations:0,requestIds:req.requests.map(q=>q.ruling.requestId),retryAfterMs:30000} } : wm === 'RETRY' ? { ok: false, mode: 'BATCH_RULING_RETRY', error: 'master changed',outcome:{schema:'forge.writer-outcome.v1',status:'NOT_ACCEPTED',phase:'BEFORE_MUTATION',code:'WRITE_FENCE',masterMutations:0,requestIds:req.requests.map(q=>q.ruling.requestId),retryAfterMs:60000},results:req.requests.map(q=>({ok:true,mode:'PLANNED',requestId:q.ruling.requestId})) } : { ok: true, mode: 'BATCH_RULING_SINGLE_COMMIT', writeId: 'W-TEST', results: req.requests.map(() => ({ ok: true })) }; }
    return { ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) };
  }
  if (/\/jobs\/404\?/.test(url)) return { ok: false, status: 404, json: async () => ({}), text: async () => '' };   // posting taken down
  if(process.env.ENRICH_TEST_PUBLIC_PAGES){const pages=JSON.parse(fs.readFileSync(process.env.ENRICH_TEST_PUBLIC_PAGES,'utf8'));if(Object.hasOwn(pages,url)){if(process.env.ENRICH_TEST_PUBLIC_READS)fs.appendFileSync(process.env.ENRICH_TEST_PUBLIC_READS,url+'\n');const body=pages[url];return {ok:true,status:200,text:async()=>body,json:async()=>JSON.parse(body)};}}
  if (!(url in R)) throw new Error('offline: ' + url);
  let body = R[url];
  if(/boards-api\.greenhouse\.io/.test(String(url))&&body&&typeof body==='object'){const lines=process.env.ENRICH_TEST_WRITER_ROWS&&fs.existsSync(process.env.ENRICH_TEST_WRITER_ROWS)?Object.values(JSON.parse(fs.readFileSync(process.env.ENRICH_TEST_WRITER_ROWS,'utf8'))):process.env.ENRICH_MASTER_FILE?fs.readFileSync(process.env.ENRICH_MASTER_FILE,'utf8').split('\n'):[];const id=String(url).match(/jobs\/(\d+)/)?.[1],line=lines.find(l=>l.includes('/jobs/'+id)),cells=line?.split(' | ');if(cells)body={...body,id:Number(id),title:cells[3],hiringOrganization:{name:cells[2]},location:{name:cells[8]}};}
  return { ok: true, status: 200, json: async () => body, text: async () => (typeof body === 'string' ? body : JSON.stringify(body)) };
};
