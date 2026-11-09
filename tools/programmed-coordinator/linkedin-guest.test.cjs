'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const LinkedIn=require('./linkedin-guest.cjs'),Source=require('./source.cjs'),S=require('./store.cjs'),Resume=require('../source-trial/resume-match');
const id='4481710055',url=`https://www.linkedin.com/jobs/view/${id}`,route=LinkedIn.routes([url])[0];
const expected={company:'Factory',title:'Plant Manager',location:'Austin, TX'};
const quote='Lead manufacturing production and quality systems across the plant.';
const raw=(patch={})=>`<section class="top-card-layout"><a class="topcard__link" href="${patch.link||url}"><h2 class="top-card-layout__title">${patch.title||expected.title}</h2></a><a class="topcard__org-name-link">Factory</a><span class="topcard__flavor--bullet">Austin, TX</span>${patch.closed?'No longer accepting applications':''}<a data-semaphore-content-urn="urn:li:jobPosting:${patch.id||id}"></a></section><div class="description__text"><div class="show-more-less-html__markup"><p>${quote}</p><p>${'Required plant management and quality responsibilities. '.repeat(8)}</p><p>Bachelor's degree in Engineering required.</p></div></div>${patch.extra||''}`;
const item=()=>({sourceEvidence:{url,fit:{resumeTextSha256:Resume.load().source.textSha256,requirements:[{quote,competencyIds:['manufacturing_leadership']}]}}});
function dir(t){const p=fs.mkdtempSync(path.join(os.tmpdir(),'linkedin-guest-'));t.after(()=>fs.rmSync(p,{recursive:true,force:true}));return p;}
test('guest routes derive exact LinkedIn job IDs, never arbitrary helper URLs',()=>{
 a.deepEqual(LinkedIn.routes([url,url+'/',`https://www.linkedin.com/comm/jobs/view/${id}/?trk=x`,`https://www.linkedin.com/jobs/view/plant-manager-at-factory-${id}`]),[route]);
 for(const bad of [`https://www.linkedin.com.attacker.example/jobs/view/${id}`,`https://attacker.example/www.linkedin.com/jobs/view/${id}`,`http://www.linkedin.com/jobs/view/${id}`,`https://user@www.linkedin.com/jobs/view/${id}`,`https://www.linkedin.com:444/jobs/view/${id}`,'https://www.linkedin.com/jobs/search/?keywords=manager'])a.deepEqual(LinkedIn.routes([bad]),[]);
});
test('guest posting binds returned route, embedded job ID, card identity and full description',()=>{
 const job=LinkedIn.posting(raw(),route,route.api);const source=Source.inspectJobs([job],expected,quote);a.equal(source.identityVerified,true);a.equal(source.degree.req,'REQUIRED');a.equal(source.postingFacts.url,url);
 for(const patch of [{id:'1234'},{link:'https://www.linkedin.com/jobs/view/1234'},{extra:'<a data-id="urn:li:jobPosting:5678"></a>'}])a.throws(()=>LinkedIn.posting(raw(patch),route,route.api),/IDENTITY/);
 a.throws(()=>LinkedIn.posting(raw(),route,url),/IDENTITY/);
 a.throws(()=>LinkedIn.posting(raw(),{...route,api:'https://attacker.example/job'},'https://attacker.example/job'),/IDENTITY/);
 a.throws(()=>Source.inspectJobs([LinkedIn.posting(raw({title:'Other role'}),route,route.api)],expected),/IDENTITY/);
});
test('closed, incomplete and duplicate guest cards cannot become enrichment evidence',()=>{
 a.throws(()=>LinkedIn.posting(raw({closed:true}),route,route.api),/POSTING_EXPIRED/);
 a.throws(()=>LinkedIn.posting(raw().replace('description__text','missing'),route,route.api),/STRUCTURED_POSTING_UNAVAILABLE/);
 a.throws(()=>LinkedIn.posting(raw()+raw(),route,route.api),/STRUCTURED_POSTING_UNAVAILABLE/);
});
test('source verifier independently fetches guest posting and binds exact link, without accepting helper fetchUrl or hash',async t=>{
 const privateDir=dir(t),calls=[],options={privateDir,expected,item:item(),fetchPage:async u=>{calls.push(u);return{url:u,raw:raw()};}};
 options.item.sourceEvidence.fetchUrl='https://attacker.example/invented';options.item.sourceEvidence.sourceSha256='not-trusted';
 const verified=await Source.verify(options);a.deepEqual(calls,[route.api]);a.equal(verified.format,'LINKEDIN_GUEST');a.equal(verified.sourceSha256,S.hash(raw()));a.equal(verified.exactLink,url);a.equal(verified.fitEvidence.requirements[0].quote,quote);
 const fields=Source.enrichmentFields(verified,{COMPANY:'Factory',TITLE:'Plant Manager',LOCATION:'Austin, TX',p:{}});a.equal(fields.SOURCE_URL,url);a.equal(fields.COMPANY_SOURCE_URL,undefined);a.equal(fields.DEGREE_REQ,'REQUIRED');
 options.item.sourceEvidence.fit.requirements[0].competencyIds=['invented'];await a.rejects(Source.verify(options),/MAPPING/);a.equal(calls.length,1);
});
test('source host backoff remains binding on public guest route',async t=>{
 const privateDir=dir(t),now=Date.parse('2026-11-09T12:00:00Z');S.save(privateDir,'source-routes.json',{'www.linkedin.com':{retryAfter:new Date(now+900000).toISOString()}});
 let calls=0;await a.rejects(Source.verify({privateDir,now,expected,item:item(),fetchPage:async()=>{calls++;return{raw:raw(),url:route.api};}}),/SOURCE_ROUTE_BACKOFF/);a.equal(calls,0);
});
test('boolean class attributes in real HTML parsing are absent tokens, not extraction failures or identity evidence',()=>{
 const fixture=fs.readFileSync(path.join(__dirname,'fixtures/linkedin-guest-boolean-class.html'),'utf8');
 const parsed=LinkedIn.posting(fixture,route,route.api),source=Source.inspectJobs([parsed],expected,quote);
 a.equal(source.identityVerified,true);a.equal(source.degree.req,'REQUIRED');
 for(const name of ['top-card-layout','topcard__link','top-card-layout__title','topcard__org-name-link','topcard__flavor--bullet','description__text','show-more-less-html__markup']){
  const missing=fixture.replace(`class="${name}"`,'class');
  a.throws(()=>LinkedIn.posting(missing,route,route.api),/STRUCTURED_POSTING_UNAVAILABLE/,name);
 }
 a.throws(()=>LinkedIn.posting(fixture.replace('urn:li:jobPosting:4481710055','urn:li:jobPosting:1234'),route,route.api),/IDENTITY/);
 a.throws(()=>LinkedIn.posting(fixture,route,url),/IDENTITY/);
});
test('boolean microdata attributes do not crash source extraction or supply required property tokens',()=>{
 const fixture='<div itemtype></div><section itemscope itemtype="https://schema.org/JobPosting"><span itemprop></span><h1 itemprop="title">Plant Manager</h1><span itemprop="hiringOrganization"><span itemprop="name">Factory</span></span><span itemprop="jobLocation"><span itemprop="addressLocality">Austin</span><span itemprop="addressRegion">TX</span></span><div itemprop="description">'+quote.repeat(10)+'</div></section>';
 a.equal(Source.inspect(fixture,expected).identityVerified,true);
 a.throws(()=>Source.inspect(fixture.replace('itemprop="title"','itemprop'),expected),/IDENTITY/);
 a.throws(()=>Source.inspect(fixture.replace('itemtype="https://schema.org/JobPosting"','itemtype'),expected),/STRUCTURED_POSTING_UNAVAILABLE/);
});
