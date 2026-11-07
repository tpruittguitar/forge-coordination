'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{savedIndex,display}=require('./salary.cjs'),{key}=require('../pipeline-observability/upstream-flow');
const at='2026-11-07T01:00:00Z',url='https://jobs.example.test/123',row={company:'Example',title:'Plant Manager',location:'Austin, TX',url,pay:'$150K-$200K',source:'JOBSPY:indeed'},item={...row,key:key(url)},ref={path:'state/discovery-evidence/'+'a'.repeat(64)+'.json',sha256:'a'.repeat(64),fullPosting:true};
const index=(rows=[row],other)=>savedIndex(path=>JSON.stringify(path.includes('source-trial')?{summary:{at},new_roles:rows}:other||{}));
test('preserves current report range verbatim, missing units and dated provenance without source changes',()=>{
 const before=JSON.stringify(item),got=display(item,index());assert.equal(got.salaryRange,'$150K-$200K');assert.equal(got.salaryCurrency,null);assert.equal(got.salaryPeriod,null);assert.equal(got.salaryObservedAt,at);assert.match(got.salarySource,/JOBSPY:indeed/);assert.equal(got.salaryBasis,'Posted salary range');assert.equal(JSON.stringify(item),before);
});
test('source identity plus complete conservative company, title and location must all agree',()=>{
 for(const change of [{key:key(url+'4')},{company:'Other'},{title:'Senior Plant Manager'},{location:'Dallas, TX'},{location:''},{company:'Example, Inc.'}])assert.equal(display({...item,...change},index()).salaryRange,null);
 assert.equal(display({...item,company:' EXAMPLE ',location:'Austin,  TX'},index()).salaryRange,row.pay);
});
test('latest observation wins, an absent latest value is not replaced by older pay, equal-date conflicts are unavailable',()=>{
 const later={summary:{at:'2026-11-07T02:00:00Z'},new_roles:[{...row,pay:'$160K-$210K'}]};assert.equal(display(item,index([row],later)).salaryRange,'$160K-$210K');
 later.new_roles[0].pay='';assert.equal(display(item,index([row],later)).salaryRange,null);
 assert.equal(display(item,index([row,{...row,pay:'$1K-$2K'}])).salaryBasis,'Conflicting saved ranges');assert.equal(display(item,index([row,row])).salaryRange,row.pay);
});
test('missing, malformed reports and known estimates do not invent salary',()=>{
 assert.equal(display(item,savedIndex(()=>{throw Error('absent');})).salaryRange,null);
 assert.equal(display(item,savedIndex(()=>'{')).salaryRange,null);
 for(const pay of ['',null,{},0,'not recorded'])assert.equal(display(item,index([{...row,pay}])).salaryRange,null);
 assert.equal(display(item,savedIndex(()=>JSON.stringify({summary:{at:'bad'},new_roles:[row]}))).salaryRange,null);
});
test('explicit structured currencies and periods are retained without conversion or rounding',()=>{
 const card=pay=>({...item,evidenceRefs:[ref],discoveredFacts:{pay,sourceRef:ref.path,observedAt:at,fullPosting:true}});
 for(const [currency,period,expected]of [['USD','YEAR','year'],['CAD','HOUR','hour'],['EUR','MONTHLY','month']]){
  const got=display(card({low:75.25,high:99.5,currency,period,quote:'Saved source quote'}));assert.equal(got.salaryRange,`${currency} 75.25–99.5 / ${expected}`);assert.equal(got.salaryCurrency,currency);assert.equal(got.salaryPeriod,expected);assert.equal(got.salaryEvidence,'Saved source quote');
 }
 const unknown=display(card({low:120000,high:120000}));assert.equal(unknown.salaryRange,'120,000');assert.equal(unknown.salaryCurrency,null);assert.equal(unknown.salaryPeriod,null);
 for(const pay of [{low:0,high:2},{low:100,high:99},{low:'100',high:'200'},{low:Infinity,high:Infinity}])assert.equal(display(card(pay),index()).salaryRange,null);
 const noProof=card({low:100,high:200});noProof.evidenceRefs=[];assert.equal(display(noProof,index()).salaryRange,null);
 const partial=card({low:100,high:200});partial.discoveredFacts.fullPosting=false;assert.equal(display(partial,index()).salaryRange,null);
});
test('missing scoring units do not invalidate a saved posted range',()=>{
 const got=display({...item,discoveredFacts:{payAmbiguous:true}},index());assert.equal(got.salaryBasis,'Posted salary range');assert.equal(got.salaryRange,row.pay);assert.equal(got.salaryCurrency,null);assert.equal(got.salaryPeriod,null);
 assert.equal(display({...item,discoveredFacts:{payAmbiguous:true}}).salaryBasis,'Ambiguous saved pay');
});

test('source-bound posted salary survives incomplete posting text and missing scoring metadata',()=>{
 const Posted=require('../source-trial/posted-pay'),postedPay=Posted.capture({...row,min_amount:150125,max_amount:200875},{observedAt:at});
 const got=display({...item,postedPay,discoveredFacts:{payAmbiguous:true,fullPosting:false}});assert.equal(got.salaryBasis,'Posted salary range');assert.equal(got.salaryRange,'150,125–200,875');assert.equal(got.salaryUpperBound,200875);assert.equal(got.salaryCurrency,null);assert.equal(got.salaryPeriod,null);assert.equal(got.salaryObservedAt,at);
 const bad=structuredClone(postedPay);bad.company='Other';assert.equal(display({...item,postedPay:bad}).salaryRange,null);
});
test('posted and estimated ranges retain their distinct classification',()=>{
 const Posted=require('../source-trial/posted-pay');
 const estimated=Posted.capture({...row,salary_source:'indeed_estimate'},{observedAt:at});assert.equal(display({...item,postedPay:estimated}).salaryBasis,'Estimated salary range');
 assert.equal(display(item,index([{...row,pay:'estimated $200K'}])).salaryBasis,'Estimated salary range');
 assert.equal(display(item,index([{...row,pay:'Employer estimated base salary USD $150,000-$200,000 per year'}])).salaryBasis,'Posted salary range');
});
test('explicit posted metadata drives exact range and sort upper bound without inferring units',()=>{
 const Posted=require('../source-trial/posted-pay'),postedPay=Posted.capture({...row,min_amount:75.25,max_amount:99.5,currency:'CAD',interval:'hourly',salaryText:'CAD 75.25-99.5 per hour'},{observedAt:at});
 const got=display({...item,postedPay});assert.equal(got.salaryRange,'CAD 75.25–99.5 / hour');assert.equal(got.salaryUpperBound,99.5);assert.equal(got.salaryPeriod,'hour');assert.equal(got.salaryCurrency,'CAD');
 assert.equal(display(item,index()).salaryUpperBound,null,'rounded legacy strings are not exact numeric evidence');
});

const excerptCard=(quote='$71,300 - $95,000 a year Provide hands-on engineering support to production personnel.')=>({key:'indeed:0331b9c22bc86d04',company:'Daher',title:'Liaison Engineer (Manufacturing Engineer)',location:'Stuart, FL',sourceUrl:'https://www.indeed.com/viewjob?jk=0331b9c22bc86d04',preliminaryScreen:{schema:'forge.discovery-preliminary-screen.v1',contentBasis:'CAPTURED_ROLE_CONTENT',sourceObservedAt:'2026-11-01T01:52:38.000Z',checkedAt:at,neverConsider:{sourceUrl:'https://www.indeed.com/viewjob?jk=0331b9c22bc86d04'},ats:{schema:'forge.resume-overlap.v1',contentBasis:'TITLE_AND_ROLE_CONTENT',matches:[{postingQuotes:[quote]}]}}});
test('existing source-bound posting excerpts recover salary systemically without fetching or inventing currency',()=>{
 const card=excerptCard(),before=JSON.stringify(card),got=display(card);assert.equal(got.salaryRange,'$71,300 - $95,000 a year');assert.equal(got.salaryUpperBound,95000);assert.equal(got.salaryPeriod,'year');assert.equal(got.salaryCurrency,null);assert.equal(got.salaryBasis,'Posted salary range');assert.equal(got.salaryObservedAt,'2026-11-01T01:52:38.000Z');assert.equal(JSON.stringify(card),before);
 const other={...excerptCard('Base salary CAD $80,000 - $110,000 per year'),company:'Another Company',title:'Another Role'};assert.equal(display(other).salaryRange,'CAD 80,000–110,000 / year');
 const mismatched=excerptCard();mismatched.preliminaryScreen.neverConsider.sourceUrl='https://www.indeed.com/viewjob?jk=other';assert.equal(display(mismatched).salaryRange,null);
 assert.equal(display(excerptCard('$71,300 - $95,000 a year. Alternate $100,000 - $120,000 a year.')).salaryBasis,'Conflicting saved ranges');
 assert.equal(display(excerptCard('Indeed estimated salary $71,300 - $95,000 a year')).salaryBasis,'Estimated salary range');
});
