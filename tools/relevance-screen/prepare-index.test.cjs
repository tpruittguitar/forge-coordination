'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),Identity=require('../source-trial/job-identity'),Index=require('./prepare-index.cjs');
const card=(extra={})=>({company:'The Factory Group',title:'Sr. Manufacturing Manager',location:'Austin, TX',url:'https://www.linkedin.com/jobs/view/4400000001/',...extra});
test('key indexes preserve first-match and source order for duplicate identities',()=>{
 const rows=[{key:'same',n:1},{key:'other',n:2},{key:'same',n:3}];
 a.equal(Index.firstByKey(rows).get('same'),rows[0]);
 a.deepEqual(Index.groupByKey(rows,x=>x.key).get('same'),[rows[0],rows[2]]);
});
test('fence candidate lookup keeps every original guard and first applicable fence',()=>{
 const cases=[
  [card(),card({company:'Different',title:'Other',location:'Boston, MA'}),true], // URL outranks labels.
  [card({primaryId:'V2I-ONE'}),card({url:'',company:'Different',primaryId:'V2I-ONE'}),true],
  [card({REQ_ID:'R1'}),card({url:'',title:'Other',REQ_ID:'R1'}),true],
  [card({REQ_ID:'123'}),card({url:'https://boards.greenhouse.io/factory/jobs/123',title:'Other'}),true],
  [card({url:'https://boards.greenhouse.io/factory/jobs/123'}),card({url:'',title:'Other',REQ_ID:'123'}),true],
  [card({url:'https://boards.greenhouse.io/factory/jobs/123'}),card({url:'https://job-boards.greenhouse.io/factory/jobs/123',title:'Other'}),true],
  [card(),card({url:'',company:'Factory, LLC',title:'Senior Manufacturing Manager',location:'Dallas, TX'}),true],
  [card(),card({url:'',location:'Boston, MA'}),false],
  [card(),card({url:'',location:'UNKNOWN'}),true],
  [card(),card({url:'',location:'Boston, MA',REMOTE_HYBRID:'HYBRID'}),true],
  [card(),card({url:'',location:'Boston, MA',BUCKET:'DUPLICATE'}),true],
  [card(),card({url:'',location:'Boston, MA',IDENTITY_EVIDENCE_CONFLICT:'YES'}),true],
  [card(),card({url:'',company:'Unrelated'}),false],
  [card({company:'',title:''}),card({company:'',title:''}),true],
  [{},undefined,false],
 ];
 for(const [candidate,record,expected]of cases){
  const fences=new Map([['unrelated',{record:{company:'Unrelated',title:'Other'}}],['first',{record,requestIds:['FIRST']}],['alias',{record,requestIds:['ALIAS']}]]);
  a.equal(Identity.fenceApplies(candidate,record),expected,JSON.stringify({candidate,record}));
  a.equal(Index.fenceLookup(fences)(candidate),[...fences.values()].find(f=>Identity.fenceApplies(candidate,f.record)));
 }
});
test('indexed fences agree with full scans across duplicate, ambiguous and aliased evidence',()=>{
 const records=[];
 for(let i=0;i<96;i++)records.push({company:['Factory','The Factory, LLC','Other',''][i%4],title:['Manufacturing Manager','Mfg Mgr','Regional Manufacturing Manager',''][Math.floor(i/4)%4],location:['Austin, TX','Dallas, TX','Boston, MA','UNKNOWN','Remote, US','Austin, TX; Boston, MA'][Math.floor(i/16)],...(i%3===0?{url:'https://www.linkedin.com/jobs/view/'+(4400000000+i%8)+'/'}:{}),...(i%5===0?{payload:{REQ_ID:'r'+i%7}}:{}),...(i%7===0?{primaryId:'V2I-'+i%5}:{}),...(i%11===0?{BUCKET:'DUPLICATE'}:{})});
 records.push({COMPANY:'Factory',TITLE:'Manufacturing Manager',LOCATION:'Austin, TX',p:{SOURCE_URL:'https://boards.greenhouse.io/factory/jobs/123',REQ_ID:'r1'}},undefined);
 const fences=new Map(records.map((record,i)=>['f'+i,{record,requestIds:[String(i)]}])),find=Index.fenceLookup(fences);
 for(const candidate of [...records,...records.map(r=>r&&({...r,url:'https://unrelated.test/role',location:'Denver, CO'}))])a.equal(find(candidate),[...fences.values()].find(f=>Identity.fenceApplies(candidate,f.record)));
});
test('fence lookup runs the original predicate only on possible identities',t=>{
 const fences=new Map(Array.from({length:1000},(_,i)=>['f'+i,{record:card({company:'Company '+i,url:'https://example.test/'+i}),requestIds:[String(i)]}]));
 const find=Index.fenceLookup(fences);let calls=0;const original=Identity.fenceApplies;
 t.mock.method(Identity,'fenceApplies',(...args)=>{calls++;return original(...args);});
 a.equal(find(card({company:'No match',url:'https://example.test/absent'})),undefined);a.equal(calls,0);
 a.equal(find(card({company:'Company 999',url:'https://example.test/absent'})).requestIds[0],'999');a.equal(calls,1);
});

test('fence URL and requisition adapters preserve normalized multi-field and ATS matches',()=>{
 const candidate={company:'Factory',title:'Director',location:'Austin, TX'},cases=[
  [{...candidate,url:'https://jobs.example.test/1?b=2&a=1&utm_campaign=old#part'},{url:'https://jobs.example.test/1?a=1&b=2'},true],
  [{...candidate,url:'https://jobs.example.test/1?a=1&a=2'},{url:'https://jobs.example.test/1?a=2&a=1'},false],
  [{...candidate,p:{SOURCE_URL:'https://one.test/a https://two.test/b;https://three.test/c'}},{COMPANY_SOURCE_URL:'https://two.test/b'},true],
  [{...candidate,REQ_ID:'123'},{company:'Factory',title:'Other',ATS_POSTING_URL:'https://boards.greenhouse.io/other-scope/jobs/123'},true],
  [{...candidate,url:'https://boards.greenhouse.io/one/jobs/123'},{company:'Factory',title:'Other',url:'https://boards.greenhouse.io/two/jobs/123'},false],
  [{...candidate,url:'https://boards.greenhouse.io/one/jobs/123'},{company:'Factory',title:'Other',REQ_ID:'123'},true],
  [{...candidate,REQ_ID:'LI 4400000001'},{url:'https://www.linkedin.com/jobs/view/title-4400000001/'},true],
 ];
 for(const [left,right,expected]of cases){const fence={record:right};a.equal(Identity.fenceApplies(left,right),expected);a.equal(Index.fenceLookup(new Map([['one',fence]]))(left),expected?fence:undefined);}
});
