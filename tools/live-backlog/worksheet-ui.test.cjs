'use strict';
// Run: PLAYWRIGHT_MODULE=/path/to/playwright node tools/live-backlog/worksheet-ui.test.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const {annotate}=require('./occurrences.cjs');
const {display:atsDisplay}=require('./ats-hits.cjs');
const {display:salaryDisplay,savedIndex}=require('./salary.cjs');
const {key:sourceKey}=require('../pipeline-observability/upstream-flow');
const Resume=require('../source-trial/resume-match');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async () => {
  let items = Array.from({length: 6540}, (_, i) => ({key: `k${i}`, company: `Company ${i}`, title: i===6539 ? 'Unique distant job' : 'Engineer', location: 'Remote', status: 'ready', sourceUrl: 'https://example.com/job', firstSeen: '2026-11-06'}));
  let salaryIndex=new Map();
  let deleted = [], revision = 'rev1', posts = [], uncertain = false, disconnectOnce = false, receiptPending = false;
  const receipts = new Map(), applications = [];
  const server = http.createServer(async (req, res) => {
    if (req.url === '/') {res.setHeader('content-type','text/html');return res.end(fs.readFileSync(__dirname+'/worksheet.html','utf8').replace('__SESSION_TOKEN__','test-session'));}
    res.setHeader('content-type','application/json');
    if(req.headers['x-worksheet-session']!=='test-session'){res.statusCode=403;return res.end(JSON.stringify({error:'Session header required'}));}
    if(req.url==='/api/snapshot') return res.end(JSON.stringify({revision,items:annotate(items).map(item=>({...item,...atsDisplay(item),...salaryDisplay(item,salaryIndex)})),count:items.length,at:'now'}));
    if(req.url.startsWith('/api/receipt')) {const id=new URL(req.url,'http://localhost').searchParams.get('requestId');return res.end(JSON.stringify(receiptPending?{ok:false,status:'unknown'}:receipts.get(id)?.result||{ok:false,status:'unknown'}));}
    let body='';for await(const chunk of req)body+=chunk;const data=JSON.parse(body);posts.push({path:req.url,data,token:req.headers['x-worksheet-session']});
    // Transport may replay a POST after a dropped connection. A committed request
    // returns its original receipt before stale revision checks or another effect.
    const previous=receipts.get(data.requestId);
    if(previous){if(previous.path!==req.url||previous.body!==body){res.statusCode=409;return res.end(JSON.stringify({error:'Request ID reuse mismatch'}));}return res.end(JSON.stringify(previous.result));}
    if(req.url==='/api/delete'||req.url==='/api/restore') {
      applications.push(data.requestId);
      let result;
      if(req.url==='/api/delete') {deleted=items.filter(i=>data.keys.includes(i.key));items=items.filter(i=>!data.keys.includes(i.key));revision=`rev-delete-${applications.length}`;result={ok:true,revision,removed:deleted.length,receiptId:`receipt-${applications.length}`};}
      else {items.push(...deleted);revision=`rev-restore-${applications.length}`;result={ok:true,revision,restored:deleted.length,receiptId:`restore-${applications.length}`};}
      receipts.set(data.requestId,{path:req.url,body,result});
      if(disconnectOnce){disconnectOnce=false;return req.socket.destroy();}
      // A normal 503 is deterministic: the browser must expose this to the app,
      // allowing us to test uncertain receipt handling separately from transport retry.
      if(uncertain){res.statusCode=503;return res.end(JSON.stringify({error:'Commit response uncertain'}));}
      return res.end(JSON.stringify(result));
    }
    res.statusCode=404;res.end('{}');
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  let browser;
  try {
    browser=await chromium.launch({headless:true, ...(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {})});const page=await browser.newPage();await page.addInitScript(()=>{window.mutationFetches=[];const original=window.fetch;window.fetch=function(url,options){if(options?.method==='POST')window.mutationFetches.push(JSON.parse(options.body).requestId);return original.apply(this,arguments);};});await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.waitForFunction(()=>document.querySelector('#counts').textContent.includes('6,540'));
    assert.equal(await page.locator('#rows tr').count(),100);
    await page.locator('#rows input').first().click();await page.locator('#refresh').click();await page.waitForFunction(()=>!document.querySelector('#refresh').disabled);assert.match(await page.locator('#counts').textContent(),/1 selected/);
    revision='rev-updated';await page.locator('#refresh').click();await page.waitForFunction(()=>!document.querySelector('#refresh').disabled);assert.match(await page.locator('#counts').textContent(),/0 selected/);
    await page.locator('#search').fill('Unique distant');assert.equal(await page.locator('#rows tr').count(),1);
    await page.locator('#selectFiltered').click();await page.locator('#delete').click();assert.match(await page.locator('#confirmText').textContent(),/Delete 1 selected/);
    await page.locator('#cancelDelete').click();assert.equal(posts.length,0);
    await page.locator('#delete').click();await page.locator('#confirmDelete').click();await page.waitForFunction(()=>document.querySelector('#notice').textContent.includes('1 jobs deleted'));
    assert.equal(posts[0].token,'test-session');assert.deepEqual(posts[0].data.keys,['k6539']);assert.equal(posts[0].data.revision,'rev-updated');
    await page.locator('#undo').click();await page.waitForFunction(()=>document.querySelector('#notice').textContent.includes('1 jobs restored'));assert.equal(items.length,6540);
    await page.locator('#search').fill('');await page.locator('#rows input').nth(0).click();await page.locator('#rows input').nth(4).click({modifiers:['Shift']});assert.match(await page.locator('#counts').textContent(),/5 selected/);
    await page.locator('#clear').click();await page.locator('#grid').focus();await page.keyboard.press('Control+a');assert.match(await page.locator('#counts').textContent(),/6,540 selected/);await page.locator('#clear').click();
    disconnectOnce=true;await page.locator('#rows input').first().click();await page.locator('#delete').click();await page.locator('#confirmDelete').click();await page.waitForFunction(()=>document.querySelector('#notice').textContent.includes('1 jobs deleted'));
    assert.equal(items.length,6539);assert.equal(applications.length,3);assert.equal(new Set(posts.map(p=>p.data.requestId)).size,3);assert.equal(await page.evaluate(()=>window.mutationFetches.length),3);
    uncertain=true;receiptPending=true;await page.locator('#rows input').first().click();await page.locator('#delete').click();await page.locator('#confirmDelete').click();await page.waitForFunction(()=>document.querySelector('#notice').textContent.includes('not confirmed yet'));
    assert.equal(items.length,6538);assert.equal(applications.length,4);assert.equal(new Set(posts.map(p=>p.data.requestId)).size,4);assert.equal(await page.evaluate(()=>window.mutationFetches.length),4);assert.equal(await page.locator('#delete').isDisabled(),true);assert.equal(await page.locator('#reconcile').isVisible(),true);
    receiptPending=false;await page.locator('#reconcile').click();await page.waitForFunction(()=>document.querySelector('#notice').textContent.includes('1 jobs deleted'));
    assert.equal(items.length,6538);assert.equal(applications.length,4);assert.equal(new Set(applications).size,4);assert.equal(new Set(posts.map(p=>p.data.requestId)).size,4);assert.equal(await page.evaluate(()=>window.mutationFetches.length),4);
    items=Array.from({length:12},(_,i)=>({key:`repeat-${String(i).padStart(2,'0')}`,company:'Repeat Fixture',title:'Plant Manager',location:'Austin, TX',sourceUrl:`https://example.com/repeat/${i}`,status:'WAITING',firstSeen:'2026-11-06'}));
    items.push({key:'missing',company:'Repeat Fixture',title:'Plant Manager',location:'',status:'HELD'});revision='repeat-fixture';uncertain=false;
    await page.locator('#refresh').click();await page.waitForFunction(()=>!document.querySelector('#refresh').disabled);
    await page.locator('#repeatFilter').selectOption('extras');assert.equal(await page.locator('#rows tr').count(),11);assert.match(await page.locator('#counts').textContent(),/0 selected/);
    await page.locator('[data-sort=occurrence]').click();await page.locator('[data-sort=occurrence]').click();assert.equal(await page.locator('#rows tr').first().locator('td').nth(1).textContent(),'12');
    await page.locator('#search').fill('/repeat/5');assert.equal(await page.locator('#rows tr').count(),1);assert.equal(await page.locator('#rows tr td').nth(1).textContent(),'6');assert.equal(await page.locator('#rows tr td').nth(2).textContent(),'12');
    await page.locator('#search').fill('');await page.locator('#selectFiltered').click();assert.match(await page.locator('#counts').textContent(),/11 selected/);
    await page.evaluate(()=>{navigator.clipboard.writeText=async text=>{window.copied=text;};});await page.locator('#copy').click();const copied=await page.evaluate(()=>window.copied);assert.match(copied,/Occurrence\tMatches/);assert.match(copied,/Source identity/);assert.equal(copied.split('\n').length,12);
    await page.locator('#delete').click();await page.locator('#cancelDelete').click();assert.equal(items.length,13);
    await page.locator('#delete').click();await page.locator('#confirmDelete').click();await page.waitForFunction(()=>document.querySelector('#notice').textContent.includes('11 jobs deleted'));
    assert.deepEqual(items.map(i=>i.key),['repeat-00','missing']);assert.match(await page.locator('#rows').textContent(),/No jobs match/);
    await page.locator('#repeatFilter').selectOption('');assert.equal(await page.locator('#rows tr').count(),2);assert.match(await page.locator('#rows').textContent(),/Not counted: missing location/);
    await page.locator('#undo').click();await page.waitForFunction(()=>document.querySelector('#notice').textContent.includes('11 jobs restored'));assert.equal(items.length,13);
    await page.locator('#repeatFilter').selectOption('groups');assert.equal(await page.locator('#rows tr').count(),12);await page.locator('#repeatFilter').selectOption('uncounted');assert.equal(await page.locator('#rows tr').count(),1);
    const atsRecord=(title,description)=>({checkedAt:'2026-11-07T03:00:00Z',ats:Resume.match({title,description})});
    items=[{key:'unknown',company:'ATS Fixture',title:'Unknown',location:'TX'},{key:'zero',company:'ATS Fixture',title:'Zero matches',location:'TX',preliminaryScreen:atsRecord('Unrelated','Revenue analytics')},{key:'title',company:'ATS Fixture',title:'Title only',location:'TX',preliminaryScreen:atsRecord('Manufacturing Director','')},{key:'content',company:'ATS Fixture',title:'Content matches',location:'TX',preliminaryScreen:atsRecord('Manufacturing Director','Lead greenfield assembly launch, robotics commissioning, PPAP and MES traceability.')}];
    items[3].preliminaryScreen.ats.matches[0].postingQuotes.push('<img src=x onerror="window.injected=true">');items[3].preliminaryScreen.ats.matches[0].postingTerms.push('<img src=x onerror=\"window.injected=true\">');revision='ats-fixture';
    const postsBeforeATS=posts.length;await page.locator('#repeatFilter').selectOption('');await page.locator('#refresh').click();await page.waitForFunction(()=>!document.querySelector('#refresh').disabled);
    const atsCells=()=>page.locator('#rows td').filter({has:page.locator('.ats-basis')});
    await page.locator('[data-sort=atsHits]').click();assert.match(await atsCells().first().textContent(),/^0Captured content/);assert.match(await atsCells().last().textContent(),/^—Not recorded/);
    await page.locator('[data-sort=atsHits]').click();assert.match(await atsCells().first().textContent(),/^5Captured content/);assert.match(await atsCells().last().textContent(),/^—Not recorded/);
    const savedTerms=atsDisplay(items[3]).atsTerms;
    assert.equal(await atsCells().first().locator('.ats-terms').textContent(),`Matched words: ${savedTerms.join(', ')}`);
    assert.equal(await atsCells().first().locator('.ats-terms').isVisible(),true);
    assert.equal(await atsCells().first().locator('details').getAttribute('open'),null);
    assert.equal(await atsCells().last().locator('.ats-terms').textContent(),'Matched words unavailable');
    assert.equal(await page.locator('#rows tr').filter({hasText:'Zero matches'}).locator('.ats-terms').textContent(),'No matched words observed');
    if(process.env.WORKSHEET_TERMS_SCREENSHOT)await page.screenshot({path:process.env.WORKSHEET_TERMS_SCREENSHOT,fullPage:true});
    await atsCells().first().locator('summary').click();assert.match(await atsCells().first().textContent(),/Saved resume version:/);assert.equal(await page.locator('#rows img').count(),0);assert.equal(await page.evaluate(()=>window.injected),undefined);
    await page.locator('#search').fill('Title only');assert.equal(await page.locator('#rows tr').count(),1);assert.match(await atsCells().textContent(),/^1Title only/);await page.locator('#search').fill('PPAP');assert.equal(await page.locator('#rows tr').count(),1);
    await page.locator('#search').fill('');await page.locator('#selectFiltered').click();await page.locator('#copy').click();const atsTSV=await page.evaluate(()=>window.copied),tsv=atsTSV.split('\n').map(line=>line.split('\t')),headers=tsv[0];assert.equal(tsv.length,5);assert.ok(headers.includes('ATS matched words'));assert.equal(tsv.find(row=>row.includes('Content matches'))[headers.indexOf('ATS matched words')],savedTerms.join(', '));assert.equal(tsv.find(row=>row.includes('Unknown'))[headers.indexOf('ATS matched words')],'');assert.ok(headers.includes('ATS evidence basis'));assert.ok(headers.includes('ATS saved resume version'));assert.equal(tsv.find(row=>row.includes('Zero matches'))[headers.indexOf('ATS hits')],'0');assert.equal(tsv.find(row=>row.includes('Unknown'))[headers.indexOf('ATS hits')],'');
    await page.locator('#delete').click();await page.locator('#cancelDelete').click();assert.equal(posts.length,postsBeforeATS);await page.locator('#clear').click();await page.locator('#refresh').click();await page.waitForFunction(()=>!document.querySelector('#refresh').disabled);assert.equal(await page.locator('#rows tr').count(),4);assert.equal(posts.length,postsBeforeATS);
    // Numeric ATS filters use synthetic saved evidence and the mock server only.
    items=Array.from({length:240},(_,i)=>({key:`filter-${String(i).padStart(3,'0')}`,company:`Filter ${Math.floor(i/4)}`,title:'Filter fixture',location:'Remote',status:i%2?'HELD':'READY',firstSeen:'2026-11-06',...(i%4===3?{}:{preliminaryScreen:i%4===0?atsRecord('Unrelated','Revenue analytics'):i%4===1?atsRecord('Manufacturing Director',''):atsRecord('Manufacturing Director','Lead greenfield assembly launch, robotics commissioning, PPAP and MES traceability.')})}));
    revision='ats-filter-fixture';await page.locator('#refresh').click();await page.waitForFunction(()=>!document.querySelector('#refresh').disabled);
    const filterPosts=posts.length,filterApplications=applications.length;
    const countIs=async expected=>assert.match(await page.locator('#counts').textContent(),new RegExp(`^${expected} of 240 jobs`));
    await page.locator('#next').click();assert.match(await page.locator('#pageInfo').textContent(),/Page 2/);
    await page.locator('#atsFilter').selectOption('exact');await countIs(60);assert.match(await page.locator('#pageInfo').textContent(),/Page 1/);assert.match(await atsCells().first().textContent(),/^0Captured content/);
    await page.locator('#atsValue').fill('5');await countIs(60);assert.match(await atsCells().first().textContent(),/^5Captured content/);
    await page.locator('#atsFilter').selectOption('min');await page.locator('#atsValue').fill('1');await countIs(120);assert.equal(await page.locator('#rows tr').count(),100);await page.locator('#next').click();assert.equal(await page.locator('#rows tr').count(),20);
    await page.locator('#selectFiltered').click();assert.match(await page.locator('#counts').textContent(),/120 selected/);
    await page.locator('#atsFilter').selectOption('unavailable');await countIs(60);assert.match(await atsCells().first().textContent(),/^—Not recorded/);assert.equal(await page.locator('#atsValue').isVisible(),false);assert.match(await page.locator('#counts').textContent(),/120 selected/);
    await page.locator('#delete').click();assert.match(await page.locator('#confirmText').textContent(),/Delete 120 selected jobs, including selections outside/);await page.locator('#cancelDelete').click();assert.equal(posts.length,filterPosts);
    await page.locator('#clear').click();await page.locator('#atsFilter').selectOption('max');await page.locator('#atsValue').fill('0');await countIs(60);assert.match(await atsCells().first().textContent(),/^0Captured content/);
    await page.locator('#atsFilter').selectOption('range');await page.locator('#atsMax').fill('5');await page.locator('#atsValue').fill('1');await countIs(120);
    await page.locator('#statusFilter').selectOption('READY');await countIs(60);await page.locator('#repeatFilter').selectOption('extras');await countIs(60);await page.locator('#search').fill('Filter 59');await countIs(1);
    await page.locator('#selectFiltered').click();await page.locator('#copy').click();const numericTSV=await page.evaluate(()=>window.copied);assert.equal(numericTSV.split('\n').length,2);assert.match(numericTSV,/filter-238/);
    await page.locator('#search').fill('');await page.locator('#statusFilter').selectOption('');await page.locator('#repeatFilter').selectOption('');await countIs(120);
    for(const value of ['', '-1','1.5']){await page.locator('#atsValue').fill(value);await countIs(0);assert.equal(await page.locator('#atsFilterError').isVisible(),true);assert.equal(await page.locator('#atsValue').getAttribute('aria-invalid'),'true');assert.equal(await page.locator('#selectFiltered').isDisabled(),true);assert.match(await page.locator('#counts').textContent(),/1 selected/);}
    await page.locator('#atsValue').fill('6');await countIs(0);assert.match(await page.locator('#atsFilterError').textContent(),/Maximum must be at least/);
    await page.locator('#atsValue').fill('5');await countIs(60);assert.equal(await page.locator('#atsFilterError').isVisible(),false);
    await page.locator('#refresh').click();await page.waitForFunction(()=>!document.querySelector('#refresh').disabled);await countIs(60);assert.equal(await page.locator('#atsFilter').inputValue(),'range');assert.match(await page.locator('#counts').textContent(),/1 selected/);
    revision='ats-filter-refresh';await page.locator('#refresh').click();await page.waitForFunction(()=>!document.querySelector('#refresh').disabled);await countIs(60);assert.match(await page.locator('#counts').textContent(),/0 selected/);
    await page.locator('#atsFilter').selectOption('exact');await page.locator('#atsValue').fill('999');await countIs(0);assert.match(await page.locator('#rows').textContent(),/No jobs match/);assert.equal(await page.locator('#selectFiltered').isDisabled(),true);
    await page.locator('#atsFilter').selectOption('');await countIs(240);assert.equal(await page.locator('#atsValue').isVisible(),false);assert.equal(await page.locator('#atsMax').isVisible(),false);
    await page.locator('#atsFilter').selectOption('range');await page.locator('#atsValue').fill('1');await page.locator('#atsMax').fill('5');await countIs(120);
    if(process.env.WORKSHEET_SCREENSHOT)await page.screenshot({path:process.env.WORKSHEET_SCREENSHOT,fullPage:true});
    assert.equal(posts.length,filterPosts);assert.equal(applications.length,filterApplications);assert.equal(items.length,240);
    // Salary fixtures stay on this isolated mock source. No production reads or edits.
    const salaryRow={company:'Salary Fixture',title:'Saved report range',location:'TX',url:'https://jobs.example.test/123',pay:'$150K-$200K',source:'JOBSPY:indeed'};
    const salaryRef={path:'state/discovery-evidence/'+'a'.repeat(64)+'.json',sha256:'a'.repeat(64)};
    salaryIndex=savedIndex(()=>JSON.stringify({summary:{at:'2026-11-07T01:00:00Z'},new_roles:[salaryRow]}));
    items=[{...salaryRow,key:sourceKey(salaryRow.url)},{key:'hourly',company:'Salary Fixture',title:'Hourly CAD',location:'TX',evidenceRefs:[salaryRef],discoveredFacts:{pay:{low:75.25,high:99.5,currency:'CAD',period:'HOUR',quote:'<img src=x onerror="window.salaryInjected=true">'},sourceRef:salaryRef.path,observedAt:'2026-11-07T01:00:00Z',fullPosting:true}},{key:'salary-missing',company:'Salary Fixture',title:'Missing salary',location:'TX'},{key:'salary-ambiguous',company:'Salary Fixture',title:'Ambiguous salary',location:'TX',discoveredFacts:{payAmbiguous:true}}];
    revision='salary-fixture';await page.locator('#atsFilter').selectOption('');await page.locator('#refresh').click();await page.waitForFunction(()=>!document.querySelector('#refresh').disabled);
    const salaryCells=()=>page.locator('#rows td').filter({has:page.locator('.salary-range')});
    assert.equal(await salaryCells().count(),4);assert.match(await page.locator('#rows tr').filter({hasText:'Saved report range'}).textContent(),/\$150K-\$200K/);assert.match(await page.locator('#rows tr').filter({hasText:'Saved report range'}).textContent(),/Currency: not recorded · Period: not recorded/);
    assert.match(await page.locator('#rows tr').filter({hasText:'Hourly CAD'}).textContent(),/CAD 75.25–99.5 \/ hour/);assert.match(await page.locator('#rows tr').filter({hasText:'Ambiguous salary'}).textContent(),/—Ambiguous saved pay/);
    await page.locator('#rows tr').filter({hasText:'Hourly CAD'}).locator('.salary-details summary').click();assert.equal(await page.locator('#rows img').count(),0);assert.equal(await page.evaluate(()=>window.salaryInjected),undefined);
    await page.locator('[data-sort=salaryRange]').click();assert.equal(await salaryCells().last().locator('.salary-range').textContent(),'—');await page.locator('[data-sort=salaryRange]').click();assert.equal(await salaryCells().last().locator('.salary-range').textContent(),'—');
    await page.locator('#search').fill('$150K');assert.equal(await page.locator('#rows tr').count(),1);await page.locator('#search').fill('CAD');assert.equal(await page.locator('#rows tr').count(),1);await page.locator('#search').fill('');await page.locator('#selectFiltered').click();await page.locator('#copy').click();const salaryTSV=(await page.evaluate(()=>window.copied)).split('\n').map(line=>line.split('\t')),salaryHeaders=salaryTSV[0];
    assert.equal(salaryTSV.find(r=>r.includes('Hourly CAD'))[salaryHeaders.indexOf('Salary currency')],'CAD');assert.equal(salaryTSV.find(r=>r.includes('Hourly CAD'))[salaryHeaders.indexOf('Salary period')],'hour');assert.equal(salaryTSV.find(r=>r.includes('Missing salary'))[salaryHeaders.indexOf('Salary range')],'');assert.ok(salaryHeaders.includes('Salary source'));assert.ok(salaryHeaders.includes('Salary observed at'));
    await page.locator('#delete').click();await page.locator('#cancelDelete').click();await page.locator('#refresh').click();await page.waitForFunction(()=>!document.querySelector('#refresh').disabled);assert.equal(posts.length,filterPosts);assert.equal(applications.length,filterApplications);assert.equal(items.length,4);
    if(process.env.WORKSHEET_SALARY_SCREENSHOT)await page.screenshot({path:process.env.WORKSHEET_SALARY_SCREENSHOT,fullPage:true});
    console.log('PASS: saved salary ranges, explicit hourly CAD, missing currency/period warnings, unavailable/ambiguous values, provenance, safe text, salary sort/search, TSV, cancel and refresh without writes.');
    console.log('PASS: exact, minimum, maximum and inclusive range ATS filters, zero versus unavailable, compound filters, all pages, selection preservation, TSV, cancellation, invalid bounds, empty matches and refresh, without writes.');
    console.log('PASS: inline saved matched words, distinct competency counts, deduplication, zero/unavailable wording, explicit TSV words, shortened-excerpt caveat, ATS saved hit count, evidence, title-only, zero/unknown, numeric sorting with unknowns last, text-safe rendering, search, TSV, cancel and refresh without writes.');
    console.log('PASS: occurrence ordinal/total, numeric sort, stable filtered ranks, missing fields, source warnings, TSV, manual extras deletion retaining one, undo;  6,540 rows; full-dataset filtering; selection; range; keyboard; confirmation; delete; undo; uncertain outcome reconciliation without retry.');
  } finally {await browser?.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
