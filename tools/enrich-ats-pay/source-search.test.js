'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),S=require('./source-search'),Profile=require('./source-profile');
const at='2026-10-31T22:00:00Z',target={PRIMARY_ID:'TARGET',COMPANY:'Target',TITLE:'Director of Quality',LOCATION:'Dayton, OH'};
test('concurrent profile publication preserves the newer complete snapshot',()=>{const {newest}=require('./merge-source-profile.cjs'),a={schema:'forge.employer-pay-sources.v1',asOf:'2026-10-31T23:00:00Z',companies:[]},b={...a,asOf:'2026-10-31T22:00:00Z'};assert.equal(newest(a,b),a);assert.equal(newest(b,a),a);assert.throws(()=>newest(a,{asOf:'bad'}));});
function profile(){return Profile.build(['Dayton','Cleveland','Akron'].map((city,i)=>({PRIMARY_ID:'V2I-SOURCE'+i,COMPANY:'Payco',TITLE:'Director of Quality',LOCATION:city+', OH',store:'MASTER',p:{SALARY_BASIS:'EMPLOYER_POSTED',SALARY_BASE_LOW:150000,SALARY_BASE_HIGH:200000,SALARY_SOURCE:'https://payco.example/jobs/'+i,SALARY_ASOF:'2026-07-01'}})),{asOf:at});}
test('bounded source refresh uses cache, failure backoff, and never becomes target posted pay',async()=>{
 const p=profile(),cache={},job=()=>({identityVerified:true,basis:'EMPLOYER_POSTED',pay:{low:220000,high:260000}});let reads=0;
 const s=S.create({profile:p,cache,now:()=>Date.parse(at),maxReads:2,maxPerTarget:1,readSource:async()=>{reads++;return job();}});
 const a=await s.find(target,[]);assert.equal(a.length,1);assert.equal(a[0].id,'V2I-SOURCE0');assert.equal(s.stats.reads,1);await s.find(target,[]);assert.equal(reads,2);s.count({ids:[a[0].id]});assert.equal(s.stats.estimates_with_profile_sources,1);
 const reuse=S.create({profile:p,cache,now:()=>Date.parse(at),maxReads:0,readSource:async()=>{throw Error('No read allowed');}});assert.equal((await reuse.find(target,[])).length,2);assert.equal(reuse.stats.cache_hits,2);
 const failCache={},fail=S.create({profile:p,cache:failCache,now:()=>Date.parse(at),readSource:async()=>null});assert.equal((await fail.find(target,[])).length,0);await fail.find(target,[]);assert.equal(fail.stats.backoff,2);assert.equal(fail.stats.failed,3);
});
test('fresh saved ranges avoid network and missing source profile is nonblocking',async()=>{const p=profile();for(const d of p.companies[0].disclosures)d.asOf='2026-10-30';const anchors=p.companies[0].disclosures.map(d=>({id:d.primaryId,co:'Payco',title:d.title,location:d.location,sourceUrl:d.sourceUrl,low:d.low,high:d.high}));const s=S.create({profile:p,now:()=>Date.parse(at),readSource:async()=>{throw Error('No network');}});assert.equal((await s.find(target,anchors)).length,3);assert.equal(s.stats.reads,0);assert.equal(s.stats.saved_reused,3);assert.deepEqual(await S.create({profile:null}).find(target,[]),[]);});
test('strict page identity and compensation checks reject wrong site, role, currency, units and snippets',()=>{
 const a={co:'Payco',title:'Director of Quality',location:'Dayton, OH'};
 const j={'@type':'JobPosting',title:a.title,hiringOrganization:{name:a.co},jobLocation:{address:{addressLocality:'Dayton',addressRegion:'OH',addressCountry:'US'}},description:'A full role description. '.repeat(20),baseSalary:{currency:'USD',value:{unitText:'YEAR',minValue:220000,maxValue:260000}}};
 const page=x=>'<script type="application/ld+json">'+JSON.stringify(x)+'</script>';
 assert.equal(S.parsePage(page(j),a).pay.high,260000);
 for(const change of [x=>x.title='Quality Manager',x=>x.jobLocation.address.addressLocality='Akron',x=>x.hiringOrganization.name='Other',x=>x.baseSalary.currency='CAD',x=>x.baseSalary.value.unitText='HOUR',x=>x.description='Salary snippet',x=>x.validThrough='2020-01-01']){const k=structuredClone(j);change(k);assert.equal(S.parsePage(page(k),a),null);}
});
