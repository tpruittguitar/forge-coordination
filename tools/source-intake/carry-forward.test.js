'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {carryForwardRoles}=require('./carry-forward'),{requestId}=require('./production-executor'),{pick}=require('./auto-run');
function fixture(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'forge-carry-'));
 const candidates=['A','B'].map(x=>({record:{COMPANY:'Factory '+x,TITLE:'Director of Manufacturing',LOCATION:'Austin, TX',SOURCE_URL:'https://example.com/jobs/'+x},level:'DIRECTOR_PLUS',family:'MANUFACTURING'}));
 const ids=candidates.map(c=>requestId(c.record)),file='receipts/auto-intake/R.json';
 fs.mkdirSync(path.join(root,'receipts/auto-intake'),{recursive:true});
 fs.writeFileSync(path.join(root,file.replace('.json','.candidates.json')),JSON.stringify(candidates));
 const state={sourceRunId:'R',requestIds:ids,results:{[ids[0]]:{ok:true}},candidatesHash:crypto.createHash('sha256').update(JSON.stringify(candidates)).digest('hex'),reconciliation:{carryForwardRequestIds:[ids[1]]}};
 return {root,candidates,ids,prior:[{file,state}]};
}
test('untouched candidate survives report rollover and passes normal discovery filters',()=>{
 const f=fixture(),roles=carryForwardRoles(f.prior,{root:f.root});
 assert.equal(roles.length,1);assert.equal(roles[0].company,'Factory B');
 assert.equal(pick({new_roles:roles},{max:25,sent:new Set()}).length,1);
});
test('attempt in a later run removes carried candidate without replaying the original',()=>{
 const f=fixture();f.prior.push({file:'later.json',state:{results:{[f.ids[1]]:{ok:false}}}});
 assert.deepEqual(carryForwardRoles(f.prior,{root:f.root}),[]);
});
test('cannot declare an attempted candidate or alter the bound candidate file',()=>{
 const f=fixture();f.prior[0].state.reconciliation.carryForwardRequestIds=[f.ids[0]];
 assert.throws(()=>carryForwardRoles(f.prior,{root:f.root}),/untouched/);
 f.prior[0].state.reconciliation.carryForwardRequestIds=[f.ids[1]];f.prior[0].state.candidatesHash='wrong';
 assert.throws(()=>carryForwardRoles(f.prior,{root:f.root}),/hash mismatch/);
});
test('carry-forward leaves employer Never Consider to Writer and logs off-function closures',()=>{
 const f=fixture(),roles=carryForwardRoles(f.prior,{root:f.root});
 roles[0].company='Medical Devices';assert.equal(pick({new_roles:roles},{max:25,sent:new Set()}).length,1);roles[0].title='Director of Clinical Care';assert.deepEqual(pick({new_roles:roles},{max:25,sent:new Set()}),[]);
});
