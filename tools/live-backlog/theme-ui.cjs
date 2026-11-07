'use strict';
// Uses synthetic rows, an ephemeral browser profile and a loopback mock only.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const items = [{key:'dark-1',company:'Example Manufacturing',title:'Manufacturing Director',location:'Remote',status:'HELD',sourceUrl:'https://example.com/jobs/1',firstSeen:'2026-11-06',occurrence:1,occurrences:2,matchEvidence:'Name/location match',repeatWarning:'Different source links; review before deleting',salaryRange:'$100,000–$145,000',salaryBasis:'Posted salary range',salaryCurrency:'USD',salaryPeriod:'year',salaryEvidence:'Synthetic saved posting quote',salarySource:'https://example.com/jobs/1',salaryObservedAt:'2026-11-06',atsHits:5,atsTerms:['manufacturing','robotics','PPAP'],atsBasis:'Captured content',atsEvidence:'Synthetic saved excerpt',holdReason:'Waiting for source verification',holdReasonBasis:'Recorded ledger classification',holdEvidence:'Synthetic hold evidence'}, {key:'dark-2',company:'Example Company',title:'Operations Director',location:'Austin, TX',status:'WAITING',occurrence:2,occurrences:2,atsHits:null}];
let fail=false, posts=0;
const server=http.createServer((req,res)=>{
  if(req.method!=='GET'){posts++;res.statusCode=405;return res.end('{}');}
  if(req.url==='/'){res.setHeader('content-type','text/html');return res.end(fs.readFileSync(__dirname+'/worksheet.html','utf8').replace('__SESSION_TOKEN__','theme-test'));}
  res.setHeader('content-type','application/json');
  if(fail){res.statusCode=503;return res.end(JSON.stringify({error:'Synthetic connection failure. No data changed.'}));}
  res.end(JSON.stringify({revision:'theme-fixture',items,at:'synthetic fixture'}));
});
const rgb = value => value.match(/[\d.]+/g).slice(0,3).map(Number);
const contrast=(a,b)=>{const L=v=>rgb(v).map(c=>c/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4).reduce((s,c,i)=>s+c*[.2126,.7152,.0722][i],0);const x=L(a),y=L(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try {
  browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
  const page=await browser.newPage({viewport:{width:1600,height:1000},colorScheme:'light'});
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.waitForFunction(()=>document.querySelector('#counts').textContent.includes('2 jobs'));
  const style=selector=>page.locator(selector).first().evaluate(e=>{const s=getComputedStyle(e);return {color:s.color,background:s.backgroundColor,outline:s.outlineColor,outlineWidth:s.outlineWidth,border:s.borderColor,scheme:s.colorScheme,opacity:s.opacity};});
  assert.equal((await style('body')).background,'rgb(17, 17, 17)');
  assert.equal((await style('html')).scheme,'dark');
  for(const selector of ['#search','#statusFilter','#refresh','#notice','.subtle','.salary-basis','.ats-basis','.source-key','.repeat-warning','a']){
   const s=await style(selector);assert.equal(new Set(rgb(s.color)).size,1,selector+' text is neutral');
   const bg=s.background==='rgba(0, 0, 0, 0)'?'rgb(25, 25, 25)':s.background;
   assert.ok(contrast(s.color,bg)>=4.5,selector+' text contrast');
  }
  await page.locator('#rows input').first().check();
  await page.locator('#rows tr').first().hover();assert.equal((await style('#rows tr td')).background,'rgb(64, 64, 64)');
  await page.locator('#search').focus();assert.equal((await style('#search')).outlineWidth,'3px');
  await page.locator('.salary-details summary').click();await page.locator('.ats-details summary').click();
  await page.locator('#search').fill('no matches');assert.match(await page.locator('#counts').textContent(),/1 selected/);
  await page.locator('#search').fill('');await page.locator('#refresh').click();await page.waitForFunction(()=>!document.querySelector('#refresh').disabled);
  assert.match(await page.locator('#counts').textContent(),/1 selected/);
  await page.locator('.salary-details summary').click();await page.locator('.ats-details summary').click();
  if(process.env.WORKSHEET_DARK_SCREENSHOT)await page.screenshot({path:process.env.WORKSHEET_DARK_SCREENSHOT,fullPage:true});
  for(let i=0;i<2;i++){
   await page.locator('#delete').click();assert.equal((await style('dialog')).background,'rgb(25, 25, 25)');
   assert.equal(await page.locator('#cancelDelete').evaluate(e=>e===document.activeElement),true);
   if(i===0)await page.keyboard.press('Escape');else await page.locator('#cancelDelete').click();
   assert.equal(await page.locator('#confirm').evaluate(e=>e.open),false);
  }
  await page.locator('#atsFilter').selectOption('range');await page.locator('#atsValue').fill('5');await page.locator('#atsMax').fill('2');
  assert.equal(await page.locator('#atsFilterError').isVisible(),true);
  assert.equal(await page.locator('#atsMax').evaluate(e=>getComputedStyle(e).borderStyle),'dashed');
  await page.locator('#atsFilter').selectOption('');fail=true;await page.locator('#refresh').click();await page.waitForFunction(()=>document.querySelector('#notice').dataset.tone==='error');
  assert.match(await page.locator('#notice').evaluate(e=>getComputedStyle(e,'::before').content),/Error:/);
  assert.ok(contrast((await style('#notice')).color,(await style('#notice')).background)>=4.5);
  await page.setViewportSize({width:650,height:900});assert.equal(await page.locator('#refresh').isVisible(),true);
  assert.equal(await page.locator('#grid').evaluate(e=>e.scrollWidth>e.clientWidth),true);
  assert.equal(posts,0);console.log('PASS dark theme: neutral palette, contrast, native controls, selected hover, focus, evidence, retained selection, repeated cancel/Escape, invalid filter, error and narrow viewport; zero POSTs.');
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
