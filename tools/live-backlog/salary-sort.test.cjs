'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {display,legacyTop}=require('./salary-sort.cjs'),{savedIndex}=require('./salary.cjs'),{key:sourceKey}=require('../pipeline-observability/upstream-flow');
const context=vm.createContext({});vm.runInContext(fs.readFileSync(__dirname+'/worksheet.html','utf8').match(/<script id="salary-sort-logic">([\s\S]*?)<\/script>/)[1],context);
const compare=context.compareSalaryTop;
const at='2026-11-07T01:00:00Z',ref={path:'state/discovery-evidence/'+'a'.repeat(64)+'.json',sha256:'a'.repeat(64)};
const card=(key,low,high,currency='USD',period='YEAR')=>({key,company:'Example',title:key,location:'TX',evidenceRefs:[ref],discoveredFacts:{pay:{low,high,currency,period},sourceRef:ref.path,observedAt:at,fullPosting:true}});
const sortable=item=>({...item,...display(item)});
const ordered=(items,direction)=>items.slice().sort((a,b)=>compare(a,b,direction)).map(item=>item.key);
test('numeric range tops, not lows, lexical strings or rounded display, control both directions',()=>{
 const items=[sortable(card('low-floor-high-top',100000,1000000)),sortable(card('high-floor-low-top',190000,200000)),sortable(card('decimal',9.99,99.95)),sortable(card('single',50000,50000))];
 assert.deepEqual(ordered(items,1),['decimal','single','high-floor-low-top','low-floor-high-top']);
 assert.deepEqual(ordered(items,-1),['low-floor-high-top','high-floor-low-top','single','decimal']);
 assert.equal(items[0].salaryUpperBound,1000000);assert.equal(items[0].salarySortGroup,'USD / year');
});
test('strict legacy parser handles saved K/M scales, commas, decimals, Unicode separators and single amounts',()=>{
 for(const [value,top]of [['$80K-$175K',175000],['$999,000–$1.2M',1200000],['USD 10,000.25 to 100,000.75 / YEAR',100000.75],['CAD 75.25–99.5 per hour',99.5],['$50',50],['100–200',200],['€12k-€19k',19000],['£50K',50000]])assert.equal(legacyTop(value).high,top,value);
 assert.deepEqual(legacyTop('$150K-$200K'),{high:200000,currency:null,period:null,symbol:'$'});
 assert.deepEqual(legacyTop('CAD 75.25–99.5 / hour'),{high:99.5,currency:'CAD',period:'hour',symbol:null});
});
test('missing, reversed, floors, malformed, ambiguous and nonfinite values never become zero or inferred tops',()=>{
 for(const value of [null,undefined,123,'','—','$100K+','from $100K','at least $100K','up to $200K','estimated $90K-$100K','$100-$50','$200-100K','$100-150K','USD 100-200 per constructor','USD 100-200 per toString','USD 100-200 per __proto__','$0-$100','USD 1-CAD 200','$1,00-$20,00','$1e3-$2e3','$100-$200 plus bonus','$10K-$20K / contract','USD 100-200 or EUR 300-400','100000000000000000000'])assert.equal(legacyTop(value),null,String(value));
 const unavailable=display({...card('unproved',1,200),evidenceRefs:[]});assert.equal(unavailable.salaryUpperBound,null);
 assert.equal(display({...card('ambiguous',1,200),discoveredFacts:{payAmbiguous:true}}).salaryUpperBound,null);
});
test('exact source report matching stays authoritative; legacy units are explicit, not assumed annual USD',()=>{
 const row={company:'Example',title:'Plant Manager',location:'TX',url:'https://example.test/jobs/123',pay:'$80K-$175K',source:'JOBSPY:indeed'},item={...row,key:sourceKey(row.url)};
 const index=savedIndex(()=>JSON.stringify({summary:{at},new_roles:[row]})),before=JSON.stringify(item),value=display(item,index);
 assert.equal(value.salaryUpperBound,175000);assert.equal(value.salaryRange,row.pay);assert.equal(value.salaryCurrency,null);assert.equal(value.salaryPeriod,null);assert.equal(value.salarySortUnitsKnown,false);assert.equal(value.salarySortGroup,'currency not recorded ($) / period not recorded');assert.equal(JSON.stringify(item),before);
 assert.equal(display({...item,location:'CA'},index).salaryUpperBound,null);
});
test('currency/period groups stay separate and fixed in both directions; incomplete units follow complete ones',()=>{
 const items=[sortable(card('usd-year-high',1,200000)),sortable(card('usd-year-low',1,100000)),sortable(card('cad-year',1,150000,'CAD')),sortable(card('usd-hour',1,99,'USD','HOUR')),sortable(card('currency-unknown',1,900000,undefined)),sortable(card('period-unknown',1,800000,'USD',null))];
 // Explicitly erase the default currency for the unknown-unit fixture.
 items[4]=sortable(card('currency-unknown',1,900000,null,'YEAR'));
 assert.deepEqual(ordered(items,1),['cad-year','usd-hour','usd-year-low','usd-year-high','currency-unknown','period-unknown']);
 assert.deepEqual(ordered(items,-1),['cad-year','usd-hour','usd-year-high','usd-year-low','currency-unknown','period-unknown']);
});
test('unknown tops stay last in both directions, ties are stable, and inputs remain unchanged',()=>{
 const items=[{key:'z',salaryUpperBound:null},sortable(card('b',10,100)),{key:'y',salaryUpperBound:'200',salarySortGroup:'USD / year'},sortable(card('a',1,100)),{key:'x',salaryUpperBound:NaN},{key:'w',salaryUpperBound:0},{key:'v',salaryUpperBound:Infinity},{key:'u',salaryUpperBound:200}];
 const before=JSON.stringify(items);for(const dir of [1,-1])assert.deepEqual(ordered(items,dir),['a','b','u','v','w','x','y','z']);assert.equal(JSON.stringify(items),before);
});
test('all numeric sorting happens before pagination and filtering does not reassign source bounds',()=>{
 const rows=Array.from({length:250},(_,i)=>sortable(card('row-'+i,1,1000-i)));
 assert.equal(rows.slice().sort((a,b)=>compare(a,b,1))[0].salaryUpperBound,751);
 assert.equal(rows.filter(row=>row.salaryUpperBound<760).sort((a,b)=>compare(a,b,-1))[0].salaryUpperBound,759);
});
