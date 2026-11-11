'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('fs'),path=require('path'),os=require('os'),E=require('./evidence-store');
const now=Date.parse('2026-11-05T23:00:00Z'),at=new Date(now-3600000).toISOString(),proof='state/board-discovery-report.json@'+'a'.repeat(40),card={company:'Acme',title:'Director of Manufacturing',location:'Austin, TX',url:'https://jobs.example.test/1',description:('Lead manufacturing, assembly, quality and production engineering teams. ').repeat(7)+'\nBachelor degree preferred, or equivalent experience accepted.\nThe annual base salary range is USD $175,000 - $200,000.'};
function dir(t){const r=fs.mkdtempSync(path.join(os.tmpdir(),'discovery-evidence-'));t.after(()=>fs.rmSync(r,{recursive:true,force:true}));return r;}
test('save once, reuse exact fresh source identity, preserve facts and explicit source provenance',t=>{
 const root=dir(t),ref=E.capture(root,card,{observedAt:at,proof,fullPosting:true}),second=E.capture(root,card,{observedAt:at,proof,fullPosting:true});a.equal(ref.path,second.path);a.equal(fs.readdirSync(path.join(root,'state/discovery-evidence')).length,1);
 const ledger={entries:{k:{sourceUrl:card.url,evidenceRefs:[ref]}}},found=E.index(root,ledger).find(card,{now});a.equal(found.doc.textSha256,E.hash(found.doc.text));a.match(found.doc.facts.degree.text,/Bachelor/);a.equal(found.doc.facts.pay.low,175000);a.equal(found.ref.proof,proof);a.equal(found.doc.canonicalWrites,0);
 a.equal(E.index(root,ledger).find({...card,company:'Other'}, {now}),null);a.equal(E.index(root,ledger).find(card,{now:now+7*3600000}),null);a.equal(E.index(root,ledger).find(card,{now:now-2*3600000}),null);
});
test('partial text cannot establish absent degree or posted pay; private mail cannot enter public cache',t=>{
 const root=dir(t),ref=E.capture(root,{...card,description:'Short alert excerpt'},{observedAt:at,proof});a.equal(E.read(root,ref).fullPosting,false);a.equal(E.read(root,ref).facts.degree,null);a.equal(E.capture(root,card,{observedAt:at,proof:'private/gmail-source.json',fullPosting:true}),null);
});
test('content hash mismatches and ambiguous compensation never become reusable salary facts',t=>{
 const root=dir(t),ref=E.capture(root,{...card,description:card.description+'\nAnnual total compensation is $300,000 - $400,000 including bonus.'},{observedAt:at,proof,fullPosting:true});a.equal(E.read(root,ref).facts.pay.low,175000);
 a.equal(E.annualBase('Annual base salary range $175,000 - $200,000 including bonus'),null);a.equal(E.annualBase('Hourly base salary range $50 - $75 per hour'),null);
 fs.writeFileSync(path.join(root,ref.path),'{}');a.equal(E.read(root,ref),null);
});
test('manifest supports enrichment reuse without rescanning the discovery ledger',t=>{
 const root=dir(t),ref=E.capture(root,card,{observedAt:at,proof,fullPosting:true});fs.writeFileSync(path.join(root,'state/discovery-evidence/manifest.json'),JSON.stringify({schema:'forge.discovery-evidence-manifest.v1',entries:{k:{sourceUrl:card.url,evidenceRefs:[ref]}}}));
 const r=E.forRow(E.index(root),{COMPANY:card.company,TITLE:card.title,LOCATION:card.location,p:{SOURCE_URL:card.url}},now);a.equal(r.degree.req,'PREFERRED');a.equal(r.pay.high,200000);a.equal(r.discoveryEvidence,ref.path);
});
test('legacy discovery artifacts keep raw bytes while enrichment rederives current qualification/pay facts',()=>{
 const row={COMPANY:card.company,TITLE:card.title,LOCATION:card.location,p:{SOURCE_URL:card.url}},text='Lead plant operations. '.repeat(20)+"Bachelor's degree in Engineering (advanced degree preferred).\nAnnual base salary USD $180,000-$220,000.";
 const doc={text,url:card.url,facts:{degree:{req:'PREFERRED',text:'old derived value'},pay:{low:1,high:2}}},before=JSON.stringify(doc),store={find:()=>({doc,ref:{observedAt:at,path:'saved-source.json'}})};
 const r=E.forRow(store,row,now);a.equal(r.degree.req,'REQUIRED');a.equal(r.pay.low,180000);a.equal(r.at,at);a.equal(JSON.stringify(doc),before);
});
test('structured posted salary survives saved evidence without description or a second fetch',t=>{
 const root=dir(t),P=require('./posted-pay'),c={...card,description:'',source:'BOARD:lever',payFacts:{low:180125,high:220875,currency:'USD',period:'YEAR',basis:'BASE',source:'STRUCTURED_ANNUAL_BASE'}};c.postedPay=P.capture(c,{observedAt:at});const ref=E.capture(root,c,{observedAt:at,proof,fullPosting:false}),store=E.index(root,{entries:{k:{sourceUrl:c.url,evidenceRefs:[ref]}}});
 a.equal(store.find(c,{now}),null);const r=E.forRow(store,{COMPANY:c.company,TITLE:c.title,LOCATION:c.location,p:{SOURCE_URL:c.url}},now+30*86400000);a.equal(r.pay.low,180125);a.equal(r.fullPosting,false);a.equal(r.degree,null);a.equal(r.postedPay.observedAt,at);
});
test('a new observation creates another immutable document without changing old evidence',t=>{const root=dir(t),ref=E.capture(root,card,{observedAt:at,proof,fullPosting:true}),before=fs.readFileSync(path.join(root,ref.path),'utf8');const next=E.capture(root,card,{observedAt:new Date(now).toISOString(),proof,fullPosting:true});a.notEqual(next.path,ref.path);a.equal(fs.readFileSync(path.join(root,ref.path),'utf8'),before);});
test('explicit full posting fills unknown units only when captured metadata is compatible',t=>{
 const root=dir(t),P=require('./posted-pay'),base={...card,source:'JOBSPY:indeed',min_amount:175000,max_amount:200000};
 for(const [patch,ok]of [[{},true],[{currency:'CAD'},false],[{interval:'hourly'},false],[{salary_source:'THIRD_PARTY_ESTIMATE'},false],[{min_amount:190000},false]]){const c={...base,...patch};c.postedPay=P.capture(c,{observedAt:at});const ref=E.capture(root,c,{observedAt:at,proof,fullPosting:true}),doc=E.read(root,ref);a.equal(!!doc.payFacts,ok);const row={COMPANY:c.company,TITLE:c.title,LOCATION:c.location,p:{SOURCE_URL:c.url}},r=E.forRow(E.index(root,{entries:{k:{sourceUrl:c.url,evidenceRefs:[ref]}}}),row,now);a.equal(!!r.pay,ok);}
});
test('saved posting facts remain reusable without age-only refetch or new observation/liveness claims',t=>{const root=dir(t),ref=E.capture(root,card,{observedAt:at,proof,fullPosting:true}),store=E.index(root,{entries:{k:{sourceUrl:card.url,evidenceRefs:[ref]}}}),r=E.forRow(store,{COMPANY:card.company,TITLE:card.title,LOCATION:card.location,p:{SOURCE_URL:card.url}},now+30*86400000);a.equal(r.pay.low,175000);a.equal(r.at,at);a.equal(r.fullPosting,true);a.equal(r.degree.req,'PREFERRED');a.equal(r.degreeAt,at);a.equal(r.postingStatus,'UNVERIFIED');});
test('legacy raw third-party estimate attribution survives full posting parsing',t=>{const root=dir(t),c={...card,pay:'estimated $175K-$200K',source:'JOBSPY:indeed'},ref=E.capture(root,c,{observedAt:at,proof,fullPosting:true}),doc=E.read(root,ref);a.equal(doc.postedPay.status,'ESTIMATED');a.equal(doc.payFacts,null);a.equal(doc.facts.pay,null);});
test('newer complete posting with no salary does not hide verified pay or misdate degree evidence',t=>{const root=dir(t),old=E.capture(root,card,{observedAt:at,proof,fullPosting:true}),recent=new Date(now).toISOString(),newer=E.capture(root,{...card,description:'Lead plant operations. '.repeat(20)+'Bachelor degree required.'},{observedAt:recent,proof,fullPosting:true}),store=E.index(root,{entries:{k:{sourceUrl:card.url,evidenceRefs:[old,newer]}}}),r=E.forRow(store,{COMPANY:card.company,TITLE:card.title,LOCATION:card.location,p:{SOURCE_URL:card.url}},now);a.equal(r.pay.low,175000);a.equal(r.at,at);a.equal(r.degreeAt,recent);a.equal(r.degree.req,'REQUIRED');a.equal(r.fullPosting,true);});
test('newer contradictory posted amounts or units block reuse of obsolete annual pay',t=>{const root=dir(t),P=require('./posted-pay'),old=E.capture(root,card,{observedAt:at,proof,fullPosting:true}),c={...card,description:'',min_amount:85,max_amount:100,interval:'hourly',salaryText:'$85-$100/hr'};c.postedPay=P.capture(c,{observedAt:new Date(now).toISOString()});const newer=E.capture(root,c,{observedAt:new Date(now).toISOString(),proof}),store=E.index(root,{entries:{k:{sourceUrl:card.url,evidenceRefs:[old,newer]}}}),r=E.forRow(store,{COMPANY:card.company,TITLE:card.title,LOCATION:card.location,p:{SOURCE_URL:card.url}},now);a.equal(r.pay,null);a.equal(r.postedPay.period,'hourly');});
test('an earlier row URL with no pay cannot hide bound salary on another exact posting URL',t=>{const root=dir(t),first={...card,url:'https://careers.example.com/a',description:'Lead manufacturing. '.repeat(20)+'Bachelor degree required.'},second={...card,url:'https://careers.example.com/b'},one=E.capture(root,first,{observedAt:new Date(now).toISOString(),proof,fullPosting:true}),two=E.capture(root,second,{observedAt:at,proof,fullPosting:true}),store=E.index(root,{entries:{a:{sourceUrl:first.url,evidenceRefs:[one]},b:{sourceUrl:second.url,evidenceRefs:[two]}}}),r=E.forRow(store,{COMPANY:card.company,TITLE:card.title,LOCATION:card.location,p:{SOURCE_URL:first.url,COMPANY_SOURCE_URL:second.url}},now);a.equal(r.pay.low,175000);a.equal(r.url,second.url);a.equal(r.at,at);a.equal(r.degreeUrl,first.url);a.equal(r.degreeAt,new Date(now).toISOString());});

function reportCard(patch={}){
 const c={...card,source:'JOBSPY:indeed',...patch},text=require('../programmed-coordinator/source.cjs').text(c.description||'');
 return {...c,discoveryReview:{schema:'forge.discovery-review.v1',source:c.source,sourceUrl:c.url,observedAt:at,detailStatus:'SOURCE_CONTENT_REVIEWED',sourceSha256:E.hash(text),...patch.discoveryReview}};
}
function report(root,cards,file='state/source-trial-report.json'){
 fs.mkdirSync(path.join(root,'state'),{recursive:true});const raw=JSON.stringify({new_roles:cards});fs.writeFileSync(path.join(root,file),raw);return E.hash(raw);
}
test('intake gives captured Indeed text the same content-based completeness as employer text',t=>{
 const root=dir(t),c=reportCard(),ref=E.capture(root,c,{observedAt:at,proof}),store=E.index(root,{entries:{k:{sourceUrl:c.url,evidenceRefs:[ref]}}});
 a.ok(store.find(c,{now}));const found=store.forIntake(c,{now});a.equal(found.doc.text,c.description);a.equal(found.doc.fullPosting,true);a.match(found.doc.facts.degree.text,/Bachelor/);a.equal(found.ref.sha256,ref.sha256);
 a.equal(E.forRow(store,{COMPANY:c.company,TITLE:c.title,LOCATION:c.location,p:{SOURCE_URL:c.url}},now).degree.req,'PREFERRED');
});
test('fresh report supplies evidence before the manifest publisher without writing cache files',t=>{
 const root=dir(t),c=reportCard({source:'BOARD:workday'}),reportHash=report(root,[c],'state/board-discovery-report.json'),store=E.index(root,{entries:{}}),found=store.forIntake({...c,description:undefined,discoveryReview:undefined},{now});
 a.equal(found.doc.text,c.description);a.equal(found.doc.fullPosting,true);a.match(found.doc.facts.degree.text,/Bachelor/);a.equal(found.ref.origin,'DISCOVERY_REPORT');a.equal(found.ref.reportSha256,reportHash);a.equal(found.ref.sha256,E.hash(found.doc));a.equal(found.ref.observedAt,at);a.equal(found.doc.textSha256,E.hash(c.description));a.equal(fs.existsSync(path.join(root,'state/discovery-evidence')),false);
});
test('direct report reuse binds exact identity, source URL, content hash, provenance and freshness',t=>{
 const root=dir(t),c=reportCard();report(root,[c]);const store=E.index(root,{entries:{}});
 a.ok(store.forIntake(c,{now}));
 for(const patch of [{company:'Other'},{title:'Other role'},{location:'Dallas, TX'},{url:'https://example.com/other'}])a.equal(store.forIntake({...c,...patch},{now}),null);
 a.ok(store.forIntake(c,{now:now+30*86400000}));a.equal(store.forIntake(c,{now:now+7*3600000,maxAgeMs:6*3600000}),null);a.equal(store.forIntake(c,{now:now-2*3600000}),null);
 for(const patch of [{description:c.description+' changed'}, {discoveryReview:{...c.discoveryReview,sourceUrl:'https://example.com/other'}}, {discoveryReview:{...c.discoveryReview,source:'EMAIL'}}, {discoveryReview:{...c.discoveryReview,preliminaryScreen:{atsGate:{sourceIdentity:{...c,location:'Dallas, TX'}}}}}, {discoveryReview:{...c.discoveryReview,sourceSha256:null}}, {discoveryReview:{...c.discoveryReview,observedAt:'invalid'}}]){
  report(root,[{...c,...patch}]);a.equal(E.index(root,{entries:{}}).forIntake(c,{now}),null);
 }
});
test('selected quotes and challenge pages are not full role content; partial text remains usable for intake',t=>{
 const root=dir(t);
 for(const patch of [{source:'SAVED_DISCOVERY'}, {description:('Access denied. Enable JavaScript. ').repeat(20)}, {contentBasis:'EXACT_ORIGINAL_ALERT_CARD'}, {contentBasis:'PREVIOUSLY_CAPTURED_QUOTES'}]){
  const c=reportCard(patch);report(root,[c]);a.equal(E.index(root,{entries:{}}).forIntake(c,{now}),null);
 }
 for(const patch of [{source:'EMAIL'},{description:'Short source detail'}, {discoveryReview:{fullPosting:false}}]){const c=reportCard(patch);report(root,[c]);const found=E.index(root,{entries:{}}).forIntake(c,{now});a.ok(found);if(patch.source!=='EMAIL')a.equal(found.fullPosting,false);}
 const c=reportCard({contentBasis:'PREVIOUSLY_CAPTURED_QUOTES'}),ref=E.capture(root,c,{observedAt:at,proof});report(root,[]);a.equal(E.index(root,{entries:{k:{sourceUrl:c.url,evidenceRefs:[ref]}}}).forIntake(c,{now}),null);
});
test('newer report content supersedes an older exact cached observation without changing old bytes',t=>{
 const root=dir(t),c=reportCard(),ref=E.capture(root,c,{observedAt:at,proof}),bytes=fs.readFileSync(path.join(root,ref.path),'utf8'),newer=reportCard({description:c.description+'\nNew reporting responsibility.',discoveryReview:{observedAt:new Date(now).toISOString()}});report(root,[newer]);const found=E.index(root,{entries:{k:{sourceUrl:c.url,evidenceRefs:[ref]}}}).forIntake(c,{now});
 a.equal(found.doc.text,newer.description);a.equal(found.ref.observedAt,new Date(now).toISOString());a.equal(fs.readFileSync(path.join(root,ref.path),'utf8'),bytes);
});

test('missing or malformed discovery reports do not break the existing cache/fetch fallback',t=>{
 const root=dir(t),c=reportCard();fs.mkdirSync(path.join(root,'state'),{recursive:true});
 for(const raw of ['{broken', 'null', JSON.stringify({new_roles:{not:'an array'}}), JSON.stringify({new_roles:[null,42]})]){
  fs.writeFileSync(path.join(root,'state/source-trial-report.json'),raw);a.equal(E.index(root,{entries:{}}).forIntake(c,{now}),null);
 }
});

test('known explicit expiry remains a condition distinct from retained text age',t=>{
 const root=dir(t),c={...card,validThrough:new Date(now-1000).toISOString()},ref=E.capture(root,c,{observedAt:at,proof}),store=E.index(root,{entries:{k:{sourceUrl:c.url,evidenceRefs:[ref]}}});a.equal(store.forIntake(c,{now}).doc.validThrough,c.validThrough);a.equal(E.forRow(store,{COMPANY:c.company,TITLE:c.title,LOCATION:c.location,p:{SOURCE_URL:c.url}},now),null);
});

test('latest exact-bound immutable expiry constrains old full text and salary without losing dates',t=>{
 const root=dir(t),expired=new Date(now-1000).toISOString(),old=E.capture(root,card,{observedAt:at,proof}),closed=E.capture(root,{...card,description:'Saved partial detail.',validThrough:expired},{observedAt:new Date(now).toISOString(),proof}),ledger={entries:{k:{sourceUrl:card.url,evidenceRefs:[old,closed]}}},store=E.index(root,ledger),row={COMPANY:card.company,TITLE:card.title,LOCATION:card.location,p:{SOURCE_URL:card.url}};
 const constraint=store.constraints(card,{now})[0];a.equal(constraint.validThrough,expired);a.equal(constraint.proof.path,closed.path);a.equal(E.forRow(store,row,now),null);
 const unknown=E.capture(root,card,{observedAt:new Date(now+1000).toISOString(),proof});ledger.entries.k.evidenceRefs.push(unknown);a.equal(E.forRow(E.index(root,ledger),row,now+1000),null);
 const extended=new Date(now+86400000).toISOString(),extension=E.capture(root,{...card,description:'Extended partial detail.',validThrough:extended},{observedAt:new Date(now+2000).toISOString(),proof});ledger.entries.k.evidenceRefs.push(extension);
 const reused=E.forRow(E.index(root,ledger),row,now+2000);a.ok(reused);a.equal(reused.at,new Date(now+1000).toISOString());a.equal(reused.postingFacts.validThrough,extended);a.equal(reused.validThroughEvidence.proof.path,extension.path);
});
test('metadata report expiry constrains immutable enrichment while malformed unrelated cards are ignored',t=>{
 const root=dir(t),ref=E.capture(root,card,{observedAt:at,proof}),expired=new Date(now-1000).toISOString();report(root,[{...card,description:'',validThrough:expired,observedAt:new Date(now).toISOString()},{company:'Other',validThrough:expired},{...card,url:'not a URL',validThrough:expired}]);
 const store=E.index(root,{entries:{k:{sourceUrl:card.url,evidenceRefs:[ref]}}});a.equal(store.constraints(card,{now})[0].validThrough,expired);a.equal(E.forRow(store,{COMPANY:card.company,TITLE:card.title,LOCATION:card.location,p:{SOURCE_URL:card.url}},now),null);
});
test('immutable constraints retain exact requisition and reject corrupted or future evidence',t=>{
 const root=dir(t),one={...card,reqId:'REQ-1'},two={...card,reqId:'REQ-2',validThrough:new Date(now-1000).toISOString()},good=E.capture(root,one,{observedAt:at,proof}),other=E.capture(root,two,{observedAt:at,proof}),future=E.capture(root,{...one,validThrough:'2030-01-01T00:00:00Z'},{observedAt:'2029-01-01T00:00:00Z',proof}),store=E.index(root,{entries:{k:{sourceUrl:card.url,evidenceRefs:[good,other,future]}}});
 a.equal(store.constraints(one,{now}).length,0);a.equal(store.constraints(two,{now}).length,1);fs.writeFileSync(path.join(root,other.path),'{}');a.equal(E.index(root,{entries:{k:{sourceUrl:card.url,evidenceRefs:[other]}}}).constraints(two,{now}).length,0);
});
test('a new requisition extension cannot revive old text for another requisition on a reused URL',t=>{
 const root=dir(t),old=E.capture(root,{...card,reqId:'REQ-1',validThrough:new Date(now-1000).toISOString()},{observedAt:at,proof}),extension=E.capture(root,{...card,reqId:'REQ-2',description:'New requisition partial detail.',validThrough:'2030-01-01T00:00:00Z'},{observedAt:new Date(now).toISOString(),proof}),store=E.index(root,{entries:{k:{sourceUrl:card.url,evidenceRefs:[old,extension]}}});
 a.equal(E.forRow(store,{COMPANY:card.company,TITLE:card.title,LOCATION:card.location,p:{SOURCE_URL:card.url}},now),null);
});
