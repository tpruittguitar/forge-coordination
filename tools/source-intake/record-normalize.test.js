'use strict';
const test=require('node:test'),assert=require('node:assert');
const {normalizeCompany}=require('./record-normalize');
const {pick}=require('./auto-run');
const {requestId}=require('./production-executor');

test('employer is the text before " | ", matching the Writer identity compare',()=>{
 assert.deepStrictEqual(normalizeCompany('CEIS | Critical Energy Infrastructure Services'),{company:'CEIS',original:'CEIS | Critical Energy Infrastructure Services',changed:true});
 assert.strictEqual(normalizeCompany('Acme Corp').changed,false);
 assert.strictEqual(normalizeCompany('  Acme   Corp ').company,'Acme Corp');
});
test('a generic board label before the pipe is skipped',()=>{
 assert.strictEqual(normalizeCompany('Careers | Acme Robotics').company,'Acme Robotics');
 assert.strictEqual(normalizeCompany('Acme｜Careers').company,'Acme');
});
const role={company:'CEIS | Critical Energy Infrastructure Services',title:'Plant Manager',location:'El Paso, TX, USA',place:'TX',level:'DIRECTOR_PLUS',url:'https://www.linkedin.com/jobs/view/4483143371'};
test('pick sends the normalized employer',()=>{
 const out=pick({new_roles:[role]},{max:5,sent:new Set()});
 assert.strictEqual(out[0].record.COMPANY,'CEIS');
});
test('a role already sent under its raw name is not sent again',()=>{
 const raw=requestId({COMPANY:role.company,TITLE:role.title,LOCATION:role.location,SOURCE_URL:role.url});
 assert.deepStrictEqual(pick({new_roles:[role]},{max:5,sent:new Set([raw])}),[]);
});
