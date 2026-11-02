'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),F=require('./posting-formats.cjs'),Source=require('./source.cjs');
const expected={company:'Example Manufacturing',title:'Plant Manager',location:'Austin, TX'},description='<p>Lead the manufacturing facility and production team. '+('Maintain quality and operational standards. '.repeat(9))+'</p><p>Bachelor’s Degree with 12 years experience. In lieu of a degree, 16 years of related experience.</p>';
test('public Greenhouse and Lever formats bind posting IDs, organization and annual base pay',()=>{
 const gh=F.routes(['https://job-boards.greenhouse.io/example/jobs/123'])[0];a.equal(gh.companyApi,'https://boards-api.greenhouse.io/v1/boards/example');
 const job=F.apiPosting(gh,{id:123,title:expected.title,location:{name:expected.location},content:description,pay_input_ranges:[{currency_type:'USD',min_cents:10000000,max_cents:15000000,title:'Annual salary'}]},{name:expected.company});
 const facts=Source.inspectJobs([job],expected);a.deepEqual(facts.pay,{low:100000,high:150000});a.equal(facts.degree.req,'PREFERRED');a.match(facts.degree.text,/In lieu/);
 a.throws(()=>F.apiPosting(gh,{id:124},{}),/ID_CONFLICT/);
 const lever=F.routes(['https://jobs.lever.co/example/12345678-1234-1234-1234-123456789012'])[0];
 const data={id:'12345678-1234-1234-1234-123456789012',text:expected.title,company:expected.company,categories:{location:expected.location},description,salaryRange:{currency:'USD',interval:'per-year-salary',min:100000,max:150000}};
 a.deepEqual(Source.inspectJobs([F.apiPosting(lever,data)],expected).pay,facts.pay);a.equal(F.annual({...data.salaryRange,interval:'hourly'}),null);
 a.throws(()=>F.apiPosting(lever,{...data,company:null}),/INCOMPLETE_ATS/);
});
test('nested JSON-LD and declared microdata preserve exact source identity and degree equivalency',()=>{
 const job={'@type':'JobPosting',title:expected.title,hiringOrganization:{name:expected.company},jobLocation:{address:{addressLocality:'Austin',addressRegion:'TX'}},description};
 const html='<script type="application/ld+json">'+JSON.stringify({'@type':'ItemList',itemListElement:[{item:job}]})+'</script>';
 a.match(Source.inspect(html,expected).description,/quality/);
 const micro='<section itemscope itemtype="https://schema.org/JobPosting"><h1 itemprop="title">Plant Manager</h1><span itemprop="hiringOrganization"><span itemprop="name">Example Manufacturing</span></span><span itemprop="jobLocation"><span itemprop="addressLocality">Austin</span><span itemprop="addressRegion">TX</span></span><div itemprop="description">'+description+'</div></section>';
 a.match(Source.inspect(micro,expected).description,/In lieu/);a.throws(()=>Source.inspect(micro,{...expected,location:'Dallas, TX'}),/IDENTITY/);
 a.equal(Source.inspectJobs([{...job,description:'Lead the facility. '.repeat(30)}],expected).degree,null);
});
test('API route fallback continues after blocked HTML, retains original raw sources and rechecks cache hashes',async t=>{
 const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),S=require('./store.cjs'),privateDir=fs.mkdtempSync(path.join(os.tmpdir(),'forge-source-format-'));t.after(()=>fs.rmSync(privateDir,{recursive:true,force:true}));
 let reads=0;const source='https://www.linkedin.com/jobs/view/123/',ats='https://job-boards.greenhouse.io/example/jobs/123',fetchPage=async url=>{reads++;if(url.includes('boards-api'))return{url,raw:JSON.stringify(url.includes('/jobs/')?{id:123,title:expected.title,location:{name:expected.location},content:description}:{name:expected.company})};throw Error('SOURCE_HTTP_403');};
 const args={item:{sourceEvidence:{url:source}},expected,privateDir,sourceUrls:[ats],fetchPage};const got=await Source.verify(args);a.equal(got.format,'ATS_API');a.equal(got.sourceSha256,S.hash(got.raw));await Source.verify(args);a.equal(reads,2);
 const file=fs.readdirSync(path.join(privateDir,'sources'))[0],cache=S.read(privateDir,'sources/'+file);cache.companyRaw='{}';S.save(privateDir,'sources/'+file,cache);await Source.verify(args);a.equal(reads,4);
});
