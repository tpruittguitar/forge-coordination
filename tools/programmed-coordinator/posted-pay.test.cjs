'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),Source=require('./source.cjs'),F=require('./posting-formats.cjs'),Public=require('../enrich-ats-pay/public-posting');
const row={COMPANY:'Acme',TITLE:'Quality Director',LOCATION:'Austin, TX',p:{}},expected={company:row.COMPANY,title:row.TITLE,location:row.LOCATION};
const body='Lead manufacturing quality and production operations. '.repeat(12);
const job=pay=>({'@type':'JobPosting',title:row.TITLE,hiringOrganization:{name:row.COMPANY},jobLocation:{address:{addressLocality:'Austin',addressRegion:'TX'}},description:body+'\n'+pay});
const sentence='Estimated annual base salary USD $180,000-$220,000.';
test('exact posting text supplies verified annual base facts without structured salary or a second review',()=>{
 const j=job(sentence),got=Source.inspectJobs([j],expected);
 a.deepEqual(got.pay,{low:180000,high:220000});a.equal(got.payFacts.currency,'USD');a.equal(got.payFacts.period,'YEAR');a.equal(got.payFacts.basis,'BASE');a.equal(got.identityVerified,true);
 const publicResult=Public.parse('<script type="application/ld+json">'+JSON.stringify(j)+'</script>',row);a.deepEqual(publicResult.payFacts,got.payFacts);
 for(const sourceUrl of ['https://careers.acme.example/jobs/1','https://www.indeed.com/viewjob?jk=123456789012','https://www.linkedin.com/jobs/view/1234567890']){
  const source={...got,sourceUrl,observedAt:'2026-11-07T01:00:00Z'},f=Source.enrichmentFields(source,row);
  a.equal(f.SALARY_BASIS,'EMPLOYER_POSTED');a.equal(f.SALARY_BASE_LOW,180000);a.equal(f.SALARY_SOURCE,sourceUrl);
  a.equal(Source.enrichmentFields({...source,identityVerified:false},row).SALARY_BASE_LOW,undefined);
  a.equal(Source.enrichmentFields({...source,sourceIdentity:{...expected,title:'Other'}},row).SALARY_BASE_LOW,undefined);
 }
});
test('unknown units, mixed compensation, site estimates and contradictory structured pay stay excluded',()=>{
 for(const text of ['Annual base salary $180,000-$220,000.','Base salary USD $180,000-$220,000.','Annual total compensation USD $180,000-$220,000 including bonuses.','Indeed estimated annual base salary USD $180,000-$220,000.'])a.equal(Source.inspectJobs([job(text)],expected).pay,null,text);
 const j={...job(sentence),baseSalary:{currency:'CAD',value:{unitText:'YEAR',minValue:180000,maxValue:220000}}};a.equal(Source.inspectJobs([j],expected).pay,null);
});
test('ATS normalization retains a rejected structured salary instead of resurrecting matching text',()=>{
 const id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',route={kind:'lever',api:'https://api.lever.co/v0/postings/acme/'+id},raw={id,text:row.TITLE,company:row.COMPANY,categories:{location:row.LOCATION},description:body+'\n'+sentence,salaryRange:{currency:'CAD',interval:'year',min:180000,max:220000}};
 const normalized=F.apiPosting(route,raw);a.equal(normalized.baseSalary,null);a.equal(normalized.forgePayRejected,true);a.equal(Source.inspectJobs([normalized],expected).pay,null);
 delete raw.salaryRange;const safe=F.apiPosting(route,raw);a.equal(safe.forgePayRejected,false);a.equal(Source.inspectJobs([safe],expected).pay.low,180000);
});

test('ATS employer estimates remain posted, explicitly attributed site estimates never become posted facts',()=>{
 const L=require('../enrich-ats-pay/lib');
 a.equal(L.parseAts('lever',{descriptionPlain:sentence}).pay.low,180000);
 for(const descriptionPlain of ['Indeed estimated annual base salary USD $180,000-$220,000.','Estimated annual base salary USD $180,000-$220,000 by Lensa.'])a.equal(L.parseAts('lever',{descriptionPlain}).pay,null);
});
