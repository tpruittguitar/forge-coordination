'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),Cache=require('./posting-cache'),Search=require('./source-search'),R=require('./recovery');
const at=Date.parse('2026-11-08T01:00:00Z'),url='https://job-boards.greenhouse.io/acme/jobs/123',row={PRIMARY_ID:'x',COMPANY:'Acme',TITLE:'Director Quality',LOCATION:'Dayton, OH',p:{SOURCE_URL:url}},text='Lead manufacturing quality operations. '.repeat(20)+'Bachelor degree required.';
const parsed=(pay=null)=>({identityVerified:true,sourceIdentity:{company:row.COMPANY,title:row.TITLE,location:row.LOCATION},text,pay,basis:'EMPLOYER_POSTED'});
test('full posting cache retains source, original observation and exact identity across IDs and ATS URL aliases',()=>{
 const cache={},writer=Cache.create({cache,now:()=>at}),e=writer.save(row,url,parsed({low:180000,high:220000}));
 const before=JSON.stringify(cache),reader=Cache.create({cache,now:()=>at+86400000}),got=reader.find({...row,PRIMARY_ID:'another'},['https://boards-api.greenhouse.io/v1/boards/acme/jobs/123?pay_transparency=true']);
 a.equal(got.at,e.at);a.equal(got.url,url);a.equal(got.text,text);a.equal(got.degree.req,'REQUIRED');a.equal(got.payStatus,'PAY_FOUND');a.deepEqual(got.sourceIdentity,e.sourceIdentity);a.equal(JSON.stringify(cache),before);
 for(const change of [{COMPANY:'Other'},{TITLE:'Manager Quality'},{LOCATION:'Akron, OH'}])a.equal(reader.find({...row,...change}),null);
 a.equal(reader.find(row,['https://job-boards.greenhouse.io/acme/jobs/124']),null);
 a.equal(Cache.create({cache,now:()=>at-1}).find(row),null);for(const now of [at+7*86400000,at+30*86400000]){const old=Cache.create({cache,now:()=>now}).find(row);a.equal(old.at,e.at);a.equal(old.postingStatus,'UNVERIFIED');}
 e.at='invalid';a.equal(reader.find(row),null);
});
test('no-pay full reads remain reusable while unreadable, incomplete, unbound and future evidence never enters the cache',()=>{
 const cache={},c=Cache.create({cache,now:()=>at});
 for(const bad of [null,{...parsed(),text:'short'},{...parsed(),identityVerified:false},{...parsed(),sourceIdentity:{...parsed().sourceIdentity,location:'Austin, TX'}},{...parsed(),text:text+' verify you are human'},{...parsed(),fullPosting:false}])a.equal(c.save(row,url,bad),null);
 a.equal(c.save(row,url,parsed(),{at:new Date(at+1).toISOString()}),null);a.equal(Object.keys(cache.postingEvidence).length,0);
 c.save(row,url,parsed());a.equal(c.find(row).payStatus,'NO_PAY_STATED');a.equal(c.find(row).pay,null);a.equal(c.find(row).fullPosting,true);
 c.save(row,url,{...parsed(),structuredBaseSalary:{currency:'CAD',value:{unitText:'YEAR',minValue:180000,maxValue:220000}}},{at:new Date(at-1000).toISOString()});
 a.equal(c.find(row).pay,null);
});
test('pay, no-pay and unsupported pay preserve distinct observations without erasing earlier disclosure',()=>{
 const cache={},c=Cache.create({cache,now:()=>at});c.save(row,url,parsed({low:180000,high:220000}),{at:new Date(at-1000).toISOString()});c.save(row,url,parsed());
 const got=c.find(row);a.equal(got.pay.low,180000);a.equal(got.at,new Date(at-1000).toISOString());a.equal(got.degreeAt,new Date(at).toISOString());
 const bad=Cache.create({cache:{},now:()=>at});bad.save(row,url,{...parsed(),payAmbiguous:true});a.equal(bad.find(row).payStatus,'PAY_UNRESOLVED');
 const expired=Cache.create({cache:{},now:()=>at});expired.save(row,url,{...parsed(),postingFacts:{validThrough:new Date(at-1).toISOString()}});a.equal(expired.find(row),null);
});
test('full-page parser keeps no-pay and rejected currency evidence separate from salary-only anchor eligibility',()=>{
 const card={co:row.COMPANY,title:row.TITLE,location:row.LOCATION,sourceUrl:url},j={'@type':'JobPosting',title:row.TITLE,hiringOrganization:{name:row.COMPANY},jobLocation:{address:{addressLocality:'Dayton',addressRegion:'OH'}},description:text},page=x=>'<script type="application/ld+json">'+JSON.stringify(x)+'</script>';
 a.equal(Search.parsePage(page(j),card),null);const full=Search.parsePosting(page(j),card);a.equal(full.identityVerified,true);a.equal(full.payAmbiguous,false);
 const rejected=Search.parsePosting(page({...j,baseSalary:{currency:'CAD',value:{unitText:'YEAR',minValue:180000,maxValue:220000}}}),card);a.equal(rejected.pay,null);a.equal(rejected.payAmbiguous,true);
 a.equal(Search.parsePosting(page({...j,validThrough:'invalid'}),card),null);
 const api=R.exactApi(row,{kind:'greenhouse',page:url},{id:123,title:row.TITLE,location:{name:row.LOCATION},content:text,pay_input_ranges:[{currency_type:'CAD',min_cents:18000000,max_cents:22000000,title:'Annual base salary'}]});a.equal(api.pay,null);a.equal(api.payAmbiguous,true);
 a.equal(require('./public-posting').parse(page({...j,baseSalary:{currency:'CAD'}}),row).payAmbiguous,true);
});
test('pruning keeps old captured facts without renewing observations',()=>{
 const cache={},c=Cache.create({cache,now:()=>at});c.save(row,url,parsed());const reader=Cache.create({cache,now:()=>at+7*86400000});const before=JSON.stringify(cache);reader.prune();a.equal(JSON.stringify(cache),before);a.equal(reader.find(row).at,new Date(at).toISOString());
});
test('distinct Ashby requisitions on one board and provider-looking query strings do not alias',()=>{
 const a1='https://jobs.ashbyhq.com/acme/00000000-0000-0000-0000-000000000001',a2=a1.slice(0,-1)+'2',c=Cache.create({cache:{},now:()=>at});c.save(row,a1,parsed());a.equal(c.find(row,[a2]),null);a.notEqual(Cache.route(a1),Cache.route(a2));
 a.notEqual(Cache.route('https://evil.example/?next='+url),Cache.route(url));
});
test('newer unresolved salary cannot resurrect an earlier cache range',()=>{
 const c=Cache.create({cache:{},now:()=>at});c.save(row,url,parsed({low:180000,high:220000}),{at:new Date(at-1000).toISOString()});c.save(row,url,{...parsed(),payAmbiguous:true,structuredBaseSalary:{currency:'CAD'}});
 a.equal(c.find(row).pay,null);a.equal(c.find(row).payAmbiguous,true);a.equal(c.find(row).payStatus,'PAY_UNRESOLVED');
});
test('parser migration reports current derived pay status without re-dating stored evidence',()=>{
 const cache={},c=Cache.create({cache,now:()=>at}),e=c.save(row,url,parsed({low:180000,high:220000}));e.factsVersion='obsolete';
 const before=JSON.stringify(cache),got=c.find(row);a.equal(got.pay,null);a.equal(got.payStatus,'PAY_UNRESOLVED');a.equal(got.at,e.at);a.equal(JSON.stringify(cache),before);
});
test('pay parser migration never revives structured rejection or attributed estimate text',()=>{
 const text='Lead manufacturing operations. '.repeat(20)+'Annual base salary USD $180,000-$220,000.';
 for(const p of [{...parsed(),text,payAmbiguous:true,structuredBaseSalary:{currency:'CAD',value:{unitText:'YEAR',minValue:180000,maxValue:220000}}},{...parsed(),text:text+' Salary.com estimated this range.',payAmbiguous:true}]){
  const cache={},c=Cache.create({cache,now:()=>at}),e=c.save(row,url,p);a.equal(e.pay,null);e.factsVersion='obsolete';
  const got=c.find(row);a.equal(got.pay,null);a.equal(got.payStatus,'PAY_UNRESOLVED');a.equal(got.payNeedsRefresh,true);a.equal(got.fullPosting,true);a.equal(got.at,e.at);
 }
});
test('a newer current-parser no-pay observation clears migration-only uncertainty for its source',()=>{
 const cache={},c=Cache.create({cache,now:()=>at}),old=c.save(row,url,parsed(),{at:new Date(at-1000).toISOString()});old.factsVersion='obsolete';a.equal(c.find(row).payNeedsRefresh,true);
 c.save(row,url,parsed());const got=c.find(row);a.equal(got.payNeedsRefresh,false);a.equal(got.payAmbiguous,false);a.equal(got.payStatus,'NO_PAY_STATED');a.equal(got.at,new Date(at).toISOString());
});
test('identity index avoids unrelated bodies and follows saves and pruning',()=>{
 const cache={postingEvidence:{}};let inspected=0,now=at;
 for(let i=0;i<1000;i++)cache.postingEvidence['other'+i]={identity:JSON.stringify(['Other'+i,row.TITLE,row.LOCATION]),get at(){inspected++;return new Date(at).toISOString();}};
 const c=Cache.create({cache,now:()=>now});c.save(row,url,parsed({low:180000,high:220000}));
 a.equal(c.find(row).pay.low,180000);a.equal(inspected,0);
 now=at+7*86400000;c.prune();a.equal(c.find(row).pay.low,180000);
});
