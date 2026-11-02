'use strict';
const {test}=require('node:test'),a=require('node:assert/strict');
const {chromium}=require(process.env.FORGE_PLAYWRIGHT_MODULE||'playwright'),T=require('./page-tools.cjs');
const url='https://www.linkedin.com/jobs/search-results/?keywords=manufacturing';
// Synthetic UI only. No signed-in profile, network content, Apply or Dismiss.
const fixture=`<main></main><script>
 window.badClicks=0;window.resultClicks=0;window.duplicate=false;
 function render(){const start=Number(new URL(location.href).searchParams.get('start')||0);
 document.querySelector('main').innerHTML='<div><button id="carousel">Next</button></div>'+[1,2,3].map((n)=>'<div role="button" class="job" data-id="'+(window.duplicate&&n===3?start+1:start+n)+'"><p>Director of Manufacturing</p><p>Factory '+n+'</p><p>Austin, TX</p><button aria-label="Dismiss Director of Manufacturing job">Dismiss</button></div>').join('')+'<h2>Director of Manufacturing</h2><nav><button aria-label="Page 1">1</button><button aria-label="Page 2">2</button><button id="resultsNext" '+(start?'disabled':'')+'>Next</button></nav>';}
 document.addEventListener('click',e=>{if(e.target.closest('#carousel')||e.target.closest('button[aria-label^="Dismiss"]')){window.badClicks++;return;}
 if(e.target.closest('#resultsNext')){window.resultClicks++;const u=new URL(location.href);u.searchParams.set('start','25');u.searchParams.delete('currentJobId');history.replaceState(null,'',u);render();return;}
 const card=e.target.closest('.job');if(card)setTimeout(()=>{const u=new URL(location.href);u.searchParams.set('currentJobId',card.dataset.id);history.replaceState(null,'',u);},70);});render();</script>`;
async function browser(t){const b=await chromium.launch({headless:true,...(process.env.FORGE_TEST_CHROME?{executablePath:process.env.FORGE_TEST_CHROME}:{})});t.after(()=>b.close());const p=await b.newPage();await p.route('**/*',route=>route.fulfill({contentType:'text/html',body:fixture}));await p.goto(url);return p;}
test('actual DOM adapter binds same-title cards to observed URLs and only clicks results Next',async t=>{
 const p=await browser(t),first=await p.evaluate(T.readResults,{expectedUrl:url});
 a.deepEqual(first.jobs.map(j=>j.jobId),['1','2','3']);a.equal(first.next.available,true);
 const after=await p.evaluate(T.clickResultsNext,{expectedUrl:first.url,controlProof:first.next.proof});a.equal(new URL(after.url).searchParams.get('start'),'25');
 const last=await p.evaluate(T.readResults,{expectedUrl:after.url});a.deepEqual(last.jobs.map(j=>j.jobId),['26','27','28']);a.equal(last.endConfirmed,true);
 a.deepEqual(await p.evaluate(()=>({bad:badClicks,result:resultClicks})),{bad:0,result:1});
});
test('hydrated title links bind exact posting IDs after the server placeholder list changes',async t=>{
 const p=await browser(t);await p.evaluate(()=>{
  const tracked=new URL(location.href);tracked.searchParams.set('eBP','opaque-attribution');tracked.searchParams.set('trackingId','tracking');tracked.searchParams.set('refId','referral');history.replaceState(null,'',tracked);
  const original=render;window.render=()=>{original();document.querySelector('main h2').remove();};render();document.querySelector('.job p').innerText='Server placeholder title';
  function detail(){document.querySelector('#postingTitle')?.remove();const a=document.createElement('a');a.id='postingTitle';a.href='/jobs/view/'+new URL(location.href).searchParams.get('currentJobId')+'/';a.innerText='Director of Manufacturing';document.querySelector('main').append(a);}
  document.addEventListener('click',e=>{if(e.target.closest('.job'))setTimeout(detail,100);});
  setTimeout(()=>{render();const u=new URL(location.href);u.searchParams.set('currentJobId','1');history.replaceState(null,'',u);detail();},150);
 });
 const first=await p.evaluate(T.readResults,{expectedUrl:url});a.deepEqual(first.jobs.map(j=>j.jobId),['1','2','3']);a.equal(first.jobs[0].paragraphs[0],'Director of Manufacturing');a.equal(await p.evaluate(()=>badClicks),0);
 const after=await p.evaluate(T.clickResultsNext,{expectedUrl:first.url,controlProof:first.next.proof});await p.evaluate(()=>{const u=new URL(location.href);u.searchParams.set('currentJobId','26');history.replaceState(null,'',u);const a=document.createElement('a');a.id='postingTitle';a.href='/jobs/view/26/';a.innerText='Director of Manufacturing';document.querySelector('main').append(a);});const last=await p.evaluate(T.readResults,{expectedUrl:after.url});a.deepEqual(last.jobs.map(j=>j.jobId),['26','27','28']);a.equal(last.endConfirmed,true);
});
test('changed card/control proof prevents Next, and duplicate selected IDs remain an exception',async t=>{
 const p=await browser(t),first=await p.evaluate(T.readResults,{expectedUrl:url});
 await p.evaluate(()=>document.querySelector('.job p').innerText='Changed title');
 await a.rejects(p.evaluate(T.clickResultsNext,{expectedUrl:first.url,controlProof:first.next.proof}),/PAGINATION_CONTROL_CHANGED/);
 a.equal(await p.evaluate(()=>resultClicks),0);
 await p.goto(url);await p.evaluate(()=>{duplicate=true;render();});
 await a.rejects(p.evaluate(T.readResults,{expectedUrl:url}),/AMBIGUOUS_RESULT_CARD/);
});
test('empty live UI requires explicit empty evidence and never clicks carousel Next',async t=>{
 const p=await browser(t);await p.evaluate(()=>document.querySelector('main').innerHTML='<p>No results found</p><button id="carousel">Next</button>');
 const result=await p.evaluate(T.readResults,{expectedUrl:url});a.equal(result.emptyConfirmed,true);a.equal(result.endConfirmed,true);a.equal(result.jobs.length,0);a.equal(await p.evaluate(()=>badClicks),0);
});
test('a source challenge remains an access exception and never becomes a changed-query or empty-page success',async t=>{const p=await browser(t);await p.evaluate(()=>{document.title='Attention Required! | Cloudflare';document.querySelector('main').innerHTML='';});await a.rejects(p.evaluate(T.readResults,{expectedUrl:url}),/SOURCE_ACCESS_BLOCKED/);a.equal(await p.evaluate(()=>resultClicks),0);});
test('WebMCP adapter registers known DOM tools, consumes configured report tools and closes only owned pages',async()=>{
 const B=require('./browser.cjs'),vm=require('node:vm');let disconnected=false,closed=0,registered=[];
 const registry={getTools:async()=>registered.map(name=>({name})),addTool:async d=>{a.ok(d.code.includes('async function'));registered.push(d.name);},getTool:async name=>({inputSchema:{type:'object'},execute:async input=>({name,input})})};
 const page={goto:async()=>{},close:async()=>{closed++;},evaluate:async(fn,arg)=>vm.runInNewContext('('+fn.toString()+')(input)',{input:arg,globalThis:{__PLUNO_WEBMCP_TOOLS__:registry}})};
 const attached={contexts:()=>[{newPage:async()=>page}],close:async()=>{disconnected=true;}};
 const browser=await B.connect({endpoint:'http://127.0.0.1:9222'},{chromium:{connectOverCDP:async()=>attached}}),session=await browser.pagination.open({url});
 a.equal((await session.observe()).name,'forge_read_results_v1');a.deepEqual(registered,['forge_read_results_v1']);await session.close();
 registered.push('list_full_reports','read_full_report');const feed=await browser.feed({id:'feed',automationId:'native',taskKey:'FORGE_GROK_INTAKE_HELPER',provider:'Grok',url:'https://grok.com/',listTool:'list_full_reports',readTool:'read_full_report'});
 a.equal((await feed.list({cursor:'c1'})).input.cursor,'c1');a.equal((await feed.read({id:'r1'})).input.reportId,'r1');await browser.close();a.equal(closed,2);a.equal(disconnected,true);
});
