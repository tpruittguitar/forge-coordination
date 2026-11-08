'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createIdentity}=require('./writer-identity.cjs');
const fc=process.env.ACTIVITY_FC_DIR||process.env.ENRICH_FC_DIR;
test('Writer identity pure definitions remain byte-for-byte equivalent',{skip:!fc},()=>{
 const source=fs.readFileSync(path.join(fc,'apps-script/Code.gs'),'utf8'),local=fs.readFileSync(path.join(__dirname,'writer-identity.cjs'),'utf8');
 const pieces=[source.slice(source.indexOf('function normEmployer(s)'),source.indexOf('/** ATS job numbers')),source.slice(source.indexOf('var INTAKE_FACT_KEYS ='),source.indexOf('function planIntake(')),source.match(/function clean_\(v\)[^\n]+/)[0]];
 for(const piece of pieces){assert.ok(piece.length>40);assert.ok(local.includes(piece),'Writer pure helper drift requires review');}
 // Execute only the selected pure definitions, never Code.gs global runtime.
 const Policy=require(path.resolve(fc,'apps-script/PipelinePolicy.gs')),context={PipelinePolicy:Policy};vm.runInNewContext(pieces.join('\n'),context);
 const adapter=createIdentity(Policy);
 for(const fn of ['normEmployer','normTitle','normLocation'])for(const value of ['',null,'ACME & Co. / Careers','Sr. Director of Engineering','Costa Mesa, California, United States','New York, New York','NOT_STATED'])assert.equal(adapter[fn](value),context[fn](value));
 for(const rec of [null,{}, {COMPANY:'ACME\nCompany',TITLE:'Sr. Director | QA',LOCATION:'Costa Mesa, CA',SOURCE:'board',SOURCE_URL:'https://example.com/jobs/1',INITIAL_UNKNOWN_FIELDS:['pay','degree'],DEGREE_TEXT:'x'.repeat(13000)}, {SOURCE_URL:'javascript:alert(1)',COMPANY_SOURCE_URL:'https://example.com/jobs/2',SOURCE:'ATS',PAY_POSTED:'$100; USD'}])assert.equal(JSON.stringify(adapter.sanitizeRecord(rec)),JSON.stringify(context.sanitizeRecord(rec)));
});
test('pure helper import requires no Writer configuration',()=>{const c=createIdentity({links:()=>({preferred:''})});assert.equal(c.normEmployer('ACME Inc.'),'acme');assert.equal(c.normTitle('Sr. Director of QA'),'senior director qa');assert.equal(c.normLocation('Costa Mesa, California, United States'),'costa mesa ca');assert.equal(c.sanitizeRecord({COMPANY:'A\nB'}).COMPANY,'A B');});
