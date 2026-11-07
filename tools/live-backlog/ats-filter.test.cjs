'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(__dirname+'/worksheet.html','utf8');
const script=html.match(/<script id="ats-filter-logic">([\s\S]*?)<\/script>/)[1];
const context=vm.createContext({});vm.runInContext(script,context);
const filter=context.buildAtsFilter;
const values=[null,undefined,0,1,5,10,100];
const matching=(mode,first,second)=>values.filter(filter(mode,first,second).matches);
test('all counts and unavailable evidence are separate from real zero',()=>{
 assert.deepEqual(matching('','garbage',''),values);
 assert.deepEqual(matching('unavailable','garbage',''),[null,undefined]);
 assert.deepEqual(matching('exact','0',''),[0]);
 assert.deepEqual(matching('max','0',''),[0]);
 assert.deepEqual(matching('min','0',''),[0,1,5,10,100]);
});
test('numeric count comparisons and inclusive ranges are not lexical',()=>{
 assert.deepEqual(matching('exact','5',''),[5]);
 assert.deepEqual(matching('min','5',''),[5,10,100]);
 assert.deepEqual(matching('max','10',''),[0,1,5,10]);
 assert.deepEqual(matching('range','1','10'),[1,5,10]);
 assert.deepEqual(matching('range','5','5'),[5]);
 assert.deepEqual(matching('exact','05',''),[5]);
 assert.deepEqual(matching('exact','6',''),[]);
});
test('blank, negative, fractional, exponent, nonfinite and unsafe bounds fail closed',()=>{
 for(const value of ['', '-1', '1.5', 'NaN', 'Infinity','1e2',' ','abc',String(Number.MAX_SAFE_INTEGER+1)]){
  for(const mode of ['exact','min','max','range']){
   const result=filter(mode,value,'10');assert.match(result.error,/whole number/);assert.equal(result.firstInvalid,true);assert.equal(values.some(result.matches),false);
  }
  const upper=filter('range','0',value);assert.equal(upper.secondInvalid,true);assert.equal(values.some(upper.matches),false);
 }
 assert.equal(filter('exact',String(Number.MAX_SAFE_INTEGER),'').matches(Number.MAX_SAFE_INTEGER),true);
 const reversed=filter('range','10','1');assert.match(reversed.error,/Maximum/);assert.equal(reversed.secondInvalid,true);assert.equal(values.some(reversed.matches),false);
});
test('unknown counts do not coerce to zero or numeric strings',()=>{
 for(const value of [null,undefined,'0','5',NaN,Infinity,-1,1.5]){
  assert.equal(filter('min','0','').matches(value),false);
  assert.equal(filter('unavailable','','').matches(value),true);
 }
 assert.equal(filter('exact','5','invalid hidden maximum').matches(5),true);
});
