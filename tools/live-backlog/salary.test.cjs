'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{savedIndex,display}=require('./salary.cjs'),{key}=require('../pipeline-observability/upstream-flow');
const at='2026-11-07T01:00:00Z',url='https://jobs.example.test/123',row={company:'Example',title:'Plant Manager',location:'Austin, TX',url,pay:'$150K-$200K',source:'JOBSPY:indeed'},item={...row,key:key(url)},ref={path:'state/discovery-evidence/'+'a'.repeat(64)+'.json',sha256:'a'.repeat(64),fullPosting:true};
const index=(rows=[row],other)=>savedIndex(path=>JSON.stringify(path.includes('source-trial')?{summary:{at},new_roles:rows}:other||{}));
test('preserves current report range verbatim, missing units and dated provenance without source changes',()=>{
 const before=JSON.stringify(item),got=display(item,index());assert.equal(got.salaryRange,'$150K-$200K');assert.equal(got.salaryCurrency,null);assert.equal(got.salaryPeriod,null);assert.equal(got.salaryObservedAt,at);assert.match(got.salarySource,/JOBSPY:indeed/);assert.match(got.salaryBasis,/not verified/);assert.equal(JSON.stringify(item),before);
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
 for(const pay of ['',null,{},0,'estimated $200K','not recorded'])assert.equal(display(item,index([{...row,pay}])).salaryRange,null);
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
test('ambiguous saved posting pay blocks a weaker report fallback',()=>{
 assert.equal(display({...item,discoveredFacts:{payAmbiguous:true}},index()).salaryBasis,'Ambiguous saved pay');
});
