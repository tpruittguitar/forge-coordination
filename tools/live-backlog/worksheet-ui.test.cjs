'use strict';
// Run: PLAYWRIGHT_MODULE=/path/to/playwright node tools/live-backlog/worksheet-ui.test.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async () => {
  let items = Array.from({length: 6540}, (_, i) => ({key: `k${i}`, company: `Company ${i}`, title: i===6539 ? 'Unique distant job' : 'Engineer', location: 'Remote', status: 'ready', sourceUrl: 'https://example.com/job', firstSeen: '2026-11-06'}));
  let deleted = [], revision = 'rev1', posts = [], uncertain = false, receiptPending = false;
  const server = http.createServer(async (req, res) => {
    if (req.url === '/') {res.setHeader('content-type','text/html');return res.end(fs.readFileSync(__dirname+'/worksheet.html','utf8').replace('__SESSION_TOKEN__','test-session'));}
    res.setHeader('content-type','application/json');
    if(req.headers['x-worksheet-session']!=='test-session'){res.statusCode=403;return res.end(JSON.stringify({error:'Session header required'}));}
    if(req.url==='/api/snapshot') return res.end(JSON.stringify({revision,items,count:items.length,at:'now'}));
    if(req.url.startsWith('/api/receipt')) return res.end(JSON.stringify(receiptPending?{ok:false,status:'unknown'}:{ok:true,revision,receiptId:'receipt1',removed:deleted.length}));
    let body='';for await(const chunk of req)body+=chunk;const data=JSON.parse(body);posts.push({path:req.url,data,token:req.headers['x-worksheet-session']});
    if(req.url==='/api/delete') {deleted=items.filter(i=>data.keys.includes(i.key));items=items.filter(i=>!data.keys.includes(i.key));revision='rev2';if(uncertain)return req.socket.destroy();return res.end(JSON.stringify({ok:true,revision,removed:deleted.length,receiptId:'receipt1'}));}
    if(req.url==='/api/restore'){items.push(...deleted);revision='rev3';return res.end(JSON.stringify({ok:true,revision,restored:deleted.length,receiptId:'restore1'}));}
    res.statusCode=404;res.end('{}');
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  let browser;
  try {
    browser=await chromium.launch({headless:true, ...(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {})});const page=await browser.newPage();await page.goto(`http://127.0.0.1:${server.address().port}`);
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
    uncertain=true;receiptPending=true;await page.locator('#rows input').first().click();await page.locator('#delete').click();await page.locator('#confirmDelete').click();await page.waitForFunction(()=>document.querySelector('#notice').textContent.includes('not confirmed yet'));
    assert.equal(posts.length,3);assert.equal(await page.locator('#delete').isDisabled(),true);assert.equal(await page.locator('#reconcile').isVisible(),true);
    receiptPending=false;await page.locator('#reconcile').click();await page.waitForFunction(()=>document.querySelector('#notice').textContent.includes('1 jobs deleted'));assert.equal(posts.length,3);
    console.log('PASS: 6,540 rows; full-dataset filtering; selection; range; keyboard; confirmation; delete; undo; uncertain outcome reconciliation without retry.');
  } finally {await browser?.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
