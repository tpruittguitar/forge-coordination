'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const E=require('../source-trial/evidence-store'),Lookup=require('./saved-text');
test('ChatGPT saved-text lookup reuses only a full, unexpired, identity-matched employer posting',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'saved-job-text-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const posting={company:'Acme Inc.',title:'Senior Director of Quality',location:'Dayton, Ohio',url:'https://careers.example.com/posting/11',description:'Manufacturing quality and operations. '.repeat(15),requisitionId:'Req-11'};
 const put=(card,options={})=>E.capture(root,card,{observedAt:new Date().toISOString(),proof:'state/board-discovery-report.json',...options});
 const entries=Object.fromEntries([
  [posting.url,{sourceUrl:posting.url,evidenceRefs:[put(posting)]}],
  ['partial',{sourceUrl:'https://careers.example.com/partial',evidenceRefs:[put({...posting,url:'https://careers.example.com/partial'},{fullPosting:false})]}],
  ['expired',{sourceUrl:'https://careers.example.com/expired',evidenceRefs:[put({...posting,url:'https://careers.example.com/expired',validThrough:'2020-01-01'})]}]
 ]);
 fs.writeFileSync(path.join(root,'state/discovery-evidence/manifest.json'),JSON.stringify({schema:'forge.discovery-evidence-manifest.v1',entries}));
 const read=Lookup.create(root),item={company:'Acme',title:'Sr. Director of Quality',location:'Dayton, OH',sourceUrls:['https://www.indeed.com/viewjob?jk=abc']};
 assert.equal(read(item,{identityFallback:false}),null);
 assert.equal(read(item).url,posting.url);
 assert.equal(read({...item,location:'Columbus, OH'}),null);
 assert.equal(read({...item,requisitionId:'Req-12'}),null);
});
