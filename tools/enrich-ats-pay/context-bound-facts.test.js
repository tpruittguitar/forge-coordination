'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),L=require('./lib'),Pay=require('./pay-values'),Public=require('./public-posting'),Source=require('../programmed-coordinator/source.cjs'),F=require('../programmed-coordinator/posting-formats.cjs');
test('academic credentials retain section, degree level, major preference and adjacent equivalency',()=>{
 const examples=[
  ["Bachelor's degree in Engineering (advanced degree preferred).",'REQUIRED'],
  ["Bachelor's degree in Chemical Engineering (strongly preferred) or a closely related engineering discipline.",'REQUIRED'],
  ['Bachelors degree required, with technical education in civil engineering or planning preferred but not required.','REQUIRED'],
  ['<h3>Preferred Qualifications</h3><ul><li>Advanced degree in engineering, operations, or related field.</li></ul>','PREFERRED'],
  ["<h3>Minimum Qualifications</h3><li>Bachelor's degree in engineering.</li><li>Or equivalent combination of education and experience.</li>",'PREFERRED'],
  ["Bachelor's degree in Engineering strongly preferred.",'PREFERRED'],
  ["Bachelor's degree preferred, but not required.",'PREFERRED'],
  ["Bachelor's degree preferred; Master's degree required.",'REQUIRED'],
  ["Bachelor's degree preferred and Master's degree required.",'REQUIRED'],
  ["Bachelor's degree preferred.\nMaster's degree required.",'REQUIRED'],
  ["Preferred Qualifications\nBachelor's degree, but not required.",'PREFERRED'],
  ['<h3>Preferred Qualifications</h3><li>Advanced degree in engineering.</li><h3>Required Qualifications</h3><li>Bachelor degree in engineering required.</li>','REQUIRED'],
  ["Bachelor's degree in STEM required; advanced degree preferred.\nProfessional certifications may be considered in lieu of advanced degrees or experience.",'REQUIRED']
 ];
 for(const [input,req] of examples){a.equal(L.degreeFromText(input)?.req,req,input);a.equal(F.degree(input,Source.text)?.req,req,input);}
 a.equal(L.degreeFromText('Operate with a high degree of independence, owning the details.'),null);
 a.equal(F.degree('<p>Work with a high degree of independence.</p>',Source.text),null);
 a.equal(L.degreeFromText('Bachelor degree preferred, but technical certification required.'),null,'unscoped competing modifiers remain unresolved');
 for(const input of ["Bachelor's degree is not required.","Bachelor's degree is optional.","No Bachelor's degree is required.","We don't require a Bachelor's degree.","Benefits\nWe offer tuition reimbursement for Bachelor's degree programs."])a.equal(L.degreeFromText(input),null,'absence of a requirement is not an invented preference: '+input);
 a.match(L.degreeFromText(examples[4][0]).text,/equivalent combination/);
});
test('all ATS paths reject non-USD, missing period, mixed compensation and unlabeled dollar bands',()=>{
 for(const [kind,j,id] of [
  ['lever',{salaryRange:{currency:'CAD',interval:'year',min:180000,max:240000}}],
  ['lever',{salaryRange:{currency:'USD',min:180000,max:240000}}],
  ['lever',{descriptionPlain:'Target total compensation is $180,000 - $240,000 including bonus and equity.'}],
  ['greenhouse',{content:'Annual base salary USD $180,000-$240,000',pay_input_ranges:[{currency_type:'CAD',title:'Annual salary',min_cents:18000000,max_cents:24000000}]}],
  ['workday',{jobPostingInfo:{jobDescription:'Salary range is $142,400 - $213,600 per year. This pay range includes base pay and short-term incentives.'}}],
  ['ashby',{jobs:[{id:'x',descriptionPlain:'Annual base salary USD $180,000-$240,000',compensation:{summaryComponents:[{compensationType:'Salary',currency:'CAD',interval:'YEAR',minValue:180000,maxValue:240000}]}}]},'x']
 ])a.equal(L.parseAts(kind,j,id)?.pay,null,kind);
 a.equal(Pay.employerText('Annual base salary USD $142,400-$213,600 includes base pay and short-term incentives.',L.payFromText),null);
 const safe=L.parseAts('lever',{salaryRange:{currency:'USD',interval:'year',min:180000,max:240000},descriptionPlain:'Lead plant quality.'});
 a.deepEqual(safe.pay,{low:180000,high:240000});a.equal(safe.payFacts.currency,'USD');a.equal(safe.payFacts.period,'YEAR');a.equal(safe.payFacts.basis,'BASE');
 const good={currency:'USD',compensationType:'Salary',title:'Annual base salary',value:{unitText:'YEAR',minValue:180000,maxValue:240000}};
 a.equal(Pay.structured(good).low,180000);
 for(const bad of [{...good,title:'Total compensation including bonuses'},{...good,type:'Incentive compensation'},{...good,value:{...good.value,title:'Salary plus equity'}},{...good,value:{...good.value,currency:'CAD'}},{...good,interval:'HOUR'}])a.equal(Pay.structured(bad),null,'all declared compensation metadata must agree');
});
test('a wrong site, expired posting or ambiguous salary never falls through to generic pay regex',()=>{
 const row={COMPANY:'Meta',TITLE:'Quality Manager',LOCATION:'Austin, TX'},body='Lead manufacturing quality and production operations. '.repeat(12)+'Annual base salary USD $180,000-$220,000.';
 const job={'@type':'JobPosting',title:row.TITLE,hiringOrganization:{name:row.COMPANY},jobLocation:{address:{addressLocality:'Dallas',addressRegion:'TX',addressCountry:'US'}},description:body,baseSalary:{currency:'USD',value:{unitText:'YEAR',minValue:180000,maxValue:220000}}},page=j=>'<script type="application/ld+json">'+JSON.stringify(j)+'</script>';
 a.equal(Public.parse(page(job),row),null);job.jobLocation.address.addressLocality='Austin';a.deepEqual(Public.parse(page(job),row).pay,{low:180000,high:220000});
 job.validThrough='2020-01-01';a.equal(Public.parse(page(job),row),null);delete job.validThrough;job.baseSalary.currency='CAD';a.equal(Public.parse(page(job),row).pay,null);
});
test('standard remote country declarations bind explicit US remote scope without fabricating a city',()=>{
 const row={COMPANY:'Meta',TITLE:'Quality Manager',LOCATION:'Remote, USA'},job={'@type':'JobPosting',title:row.TITLE,hiringOrganization:{name:row.COMPANY},description:'Lead manufacturing quality and production systems. '.repeat(12),jobLocationType:'TELECOMMUTE',applicantLocationRequirements:[{name:'United States of America'}],baseSalary:{currency:'USD',value:{unitText:'YEAR',minValue:180000,maxValue:220000}}},page=j=>'<script type="application/ld+json">'+JSON.stringify(j)+'</script>';
 a.deepEqual(Public.parse(page(job),row).pay,{low:180000,high:220000});
 for(const bad of [{...job,applicantLocationRequirements:[{name:'Canada'}]},{...job,jobLocationType:undefined},{...job,applicantLocationRequirements:[]}])a.equal(Public.parse(page(bad),row),null);
 a.equal(Public.parse(page(job),{...row,LOCATION:'Austin, TX'}),null);
 a.equal(Public.parse(page(job),{...row,LOCATION:'Remote, CA'}),null);
});
test('separate total compensation does not erase a distinct explicit base band',()=>{
 const text='Annual base salary USD $175,000 - $200,000.\nAnnual total compensation is USD $300,000 - $400,000 including bonuses and equity.';
 a.deepEqual(Pay.employerText(text,L.payFromText),{low:175000,high:200000});
 a.equal(Pay.conflicts(text,{low:175000,high:200000},L.payFromText),false);
 a.equal(Pay.conflicts(text,{low:300000,high:400000},L.payFromText),true);
 a.deepEqual(Pay.range(Pay.structured({currency:'USD',value:{unitText:'YEAR',value:180000}})),{low:180000,high:180000});
});
test('derived cache upgrades re-read retained bound text, never old derived facts or source time',()=>{
 const R=require('./recovery'),row={PRIMARY_ID:'x',COMPANY:'Acme',TITLE:'Quality Manager',LOCATION:'Austin, TX',p:{SOURCE_URL:'https://example.com/jobs/1'}},at=new Date(Date.now()-3600000).toISOString(),text='Lead quality operations. '.repeat(20)+"Bachelor's degree in Engineering (advanced degree preferred).\nSalary range is USD $142,400-$213,600 per year. This pay range includes base pay and short-term incentives.";
 const old={identity:JSON.stringify([row.COMPANY,row.TITLE,row.LOCATION]),at,fullPosting:true,text,degree:{text:'bad old degree',req:'PREFERRED'},pay:{low:142400,high:213600}};
 a.equal(R.cached({postingEvidence:{x:old}},row),null,'an old assertion is not independent source identity');
 const bound={...old,identityVerified:true,sourceIdentity:{company:row.COMPANY,title:row.TITLE,location:row.LOCATION}},out=R.cached({postingEvidence:{x:bound}},row);
 a.equal(out.degree.req,'REQUIRED');a.equal(out.pay,null);a.equal(out.at,at);a.equal(bound.degree.req,'PREFERRED','do not mutate prior evidence');
 a.equal(R.cached({postingEvidence:{x:{...bound,text:undefined}}},row),null,'derived-only evidence stays unresolved');
});
