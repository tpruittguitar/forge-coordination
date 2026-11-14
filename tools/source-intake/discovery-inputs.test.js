'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const D=require('./discovery-inputs'),E=require('../source-trial/evidence-store'),C=require('./captured-discovery'),A=require('./auto-run'),P=require('../source-trial/posted-pay');
const now=Date.parse('2026-11-11T18:00:00Z'),at='2026-10-01T12:00:00Z';
const base={company:'Acme',title:'Director of Manufacturing',location:'Austin, TX',url:'https://jobs.example.com/role',source:'JOBSPY:indeed',description:'Lead lean manufacturing operations, production engineering and quality systems. '.repeat(8).trim()};
function fixture(t,cards=[base],file='state/source-trial-report.json'){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'discovery-inputs-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 fs.mkdirSync(path.dirname(path.join(root,file)),{recursive:true});
 const value=file.includes('catch-up')?{roles:Object.fromEntries(cards.map((role,i)=>[i,{role,firstSeen:at}]))}:file.includes('UPSTREAM')?{entries:Object.fromEntries(cards.map((c,i)=>[i,{...c,firstSeen:at}]))}:{summary:{at},new_roles:cards};
 fs.writeFileSync(path.join(root,file),JSON.stringify(value));return{root,index:D.index(root),store:E.index(root)};
}
test('JobSpy, HiringCafe, LinkedIn, recruiter and employer descriptions have equal completeness with old dates retained',t=>{
 for(const source of ['JOBSPY:indeed','HIRINGCAFE','JOBSPY:linkedin','LINKEDIN','RECRUITER:Acme Search','BOARD:workday']){
  const card={...base,source},f=fixture(t,[card]),e=f.index.find(card,{now});a.ok(e);a.equal(e.card.description,card.description);a.equal(e.card.fullPosting,true);a.equal(e.observedAt,at);a.equal(e.postingStatus,'UNVERIFIED');a.equal(e.proof.sha256,E.hash(fs.readFileSync(path.join(f.root,e.proof.path),'utf8')));
 }
});
test('HiringCafe metadata with national location is a usable lead without a fabricated description or fresh fetch',async t=>{
 const card={...base,description:'',source:'HIRINGCAFE',location:'United States'},f=fixture(t,[card]);let fetches=0;
 const result=await A.sourceEvidence(card,{store:f.store,capturedInputs:f.index,fetchEvidence:()=>{fetches++;throw Error('no fetch');}});a.equal(fetches,0);a.ok(result.captured);a.equal(result.business,'');a.equal(result.captured.card.fullPosting,false);a.equal(result.captured.businessStatus,'UNKNOWN');a.equal(result.captured.card.contentBasis,'TITLE_ONLY');
 a.equal(f.index.find({...card,location:''},{now}),null);a.equal(f.index.find({...card,location:'Canada'},{now}),null);
});
test('saved backlog retains exact URL-host provenance when its old provider label was lost',t=>{
 const card={...base,source:'SAVED_DISCOVERY',description:''},f=fixture(t,[card],'receipts/auto-intake/catch-up/state.json'),e=f.index.find(card,{now});a.ok(e);a.equal(e.card.source,'URL:jobs.example.com');a.equal(e.proof.path,'receipts/auto-intake/catch-up/state.json');a.equal(e.observedAt,at);
});
test('saved ledger facts can supply a lead without latest report or cache publisher',t=>{
 const card={...base,source:undefined,discoveryReview:{source:'LINKEDIN',observedAt:at,sourceUrl:base.url},description:''},f=fixture(t,[card],'state/UPSTREAM_LEDGER.json');const e=f.index.find({...card,source:'INTAKE_DRAIN'},{now});a.ok(e);a.equal(e.card.source,'LINKEDIN');a.equal(e.proof.path,'state/UPSTREAM_LEDGER.json');
});
test('partial and short details remain partial while challenge text remains unknown',t=>{
 for(const [patch,expected]of [[{description:'Lead production teams.'},'Lead production teams.'],[{contentBasis:'PREVIOUSLY_CAPTURED_QUOTES'},base.description],[{fullPosting:false},base.description],[{discoveryReview:{fullPosting:false}},base.description],[{description:'Access denied. Enable JavaScript.'},'']]){
  const card={...base,...patch},f=fixture(t,[card]),e=f.index.find(card,{now});a.ok(e);a.equal(e.card.description,expected);a.equal(e.card.fullPosting,false);
 }
});
test('identity, URL, hash and timestamp mismatches cannot borrow another source observation',t=>{
 const f=fixture(t);for(const patch of [{company:'Other'},{title:'Other role'},{location:'Dallas, TX'},{url:'https://jobs.example.com/other'}])a.equal(f.index.find({...base,...patch},{now}),null);
 for(const review of [{sourceUrl:'https://jobs.example.com/other'},{sourceSha256:'a'.repeat(64)},{observedAt:'invalid'},{observedAt:'2099-01-01T00:00:00Z'},{preliminaryScreen:{atsGate:{sourceIdentity:{...base,location:'Dallas, TX'}}}}]){const bad=fixture(t,[{...base,discoveryReview:review}]);a.equal(bad.index.find(base,{now}),null);}
});
test('legacy cached JobSpy body survives stripped backlog card and age without mutating stored bytes',t=>{
 const f=fixture(t,[{...base,description:''}],'receipts/auto-intake/catch-up/state.json'),ref=E.capture(f.root,base,{observedAt:at,proof:'state/source-trial-report.json',fullPosting:false});
 // This models the old origin-only flag, not an explicitly incomplete capture.
 const old=E.read(f.root,ref);old.contentBasis='CAPTURED_ROLE_CONTENT';old.fullPosting=false;delete old.source;const hash=E.hash(old),file='state/discovery-evidence/'+hash+'.json';fs.writeFileSync(path.join(f.root,file),JSON.stringify(old)+'\n');
 fs.writeFileSync(path.join(f.root,'state/discovery-evidence/manifest.json'),JSON.stringify({schema:'forge.discovery-evidence-manifest.v1',entries:{one:{sourceUrl:base.url,evidenceRefs:[{...ref,path:file,sha256:hash}]}}}));
 const before=fs.readFileSync(path.join(f.root,file),'utf8'),e=D.index(f.root).find(base,{now});a.ok(e);a.equal(e.card.description,base.description);a.equal(e.card.fullPosting,true);a.equal(e.observedAt,at);a.equal(e.proof.path,file);a.equal(e.proof.sha256,hash);a.equal(fs.readFileSync(path.join(f.root,file),'utf8'),before);
});
test('AUTO candidate preparation carries estimated pay separately without claiming employer-posted salary or verified business',async t=>{
 const card={...base,source:'HIRINGCAFE',description:'',salaryText:'Estimated annual base salary $175,000-$200,000',salary_source:'THIRD_PARTY_ESTIMATE',min_amount:175000,max_amount:200000,currency:'USD',interval:'yearly'};card.postedPay=P.capture(card,{observedAt:at});a.equal(card.postedPay.status,'ESTIMATED');
 const f=fixture(t,[card]),record={COMPANY:card.company,TITLE:card.title,LOCATION:card.location,SOURCE_URL:card.url},candidate=await A.prepareCandidate(card,record,{discoveryEvidence:f.store,capturedInputs:f.index,rulesHash:'b'.repeat(64),fetchEvidence:()=>{throw Error('no fetch');}});
 a.ok(C.validate(candidate));a.equal(candidate.evidenceVerified,false);a.equal(candidate.businessEvidenceApproved,false);a.equal(candidate.postedPay.status,'ESTIMATED');a.equal(candidate.discoveryEvidence.card.postedPay.status,'ESTIMATED');a.equal(candidate.record.SALARY_BASE_LOW,undefined);a.equal(candidate.primaryBusiness,'');a.match(candidate.record.SCOUT_NOTES,/UNKNOWN/);
});
test('canonical-rule refresh screens captured facts without another posting lookup or changing source date',async t=>{
 const f=fixture(t),record={COMPANY:base.company,TITLE:base.title,LOCATION:base.location,SOURCE_URL:base.url},candidate=await A.prepareCandidate(base,record,{discoveryEvidence:f.store,capturedInputs:f.index,rulesHash:'old'}),raw='current canonical rules',ctx={rules:{raw,status:'ACTIVE',rules:[]}};
 const refreshed=await A.refreshCapturedReview(candidate,E.hash(raw),{context:async()=>ctx});a.ok(refreshed);a.equal(refreshed.rulesHash,E.hash(raw));a.equal(refreshed.businessEvidenceApproved,false);a.equal(refreshed.discoveryEvidence.observedAt,at);a.ok(C.validate({...candidate,...refreshed}));
 a.equal(await A.refreshCapturedReview(candidate,'c'.repeat(64),{context:async()=>ctx}),null);
});

test('explicit posting expiry is preserved in the hashed envelope, never inferred from capture age',t=>{
 const card={...base,postingFacts:{validThrough:'2026-11-01T00:00:00Z'}},f=fixture(t,[card]),e=f.index.find(card,{now});a.ok(e);a.equal(e.card.validThrough,card.postingFacts.validThrough);a.equal(e.cardSha256,C.hash(e.card));a.equal(A.pick({new_roles:[card]},{max:1,sent:new Set(),capturedInputs:f.index}).length,0);a.equal(C.validEnvelope({...e,card:{...e.card,validThrough:'2027-01-01T00:00:00Z'}},{now}),false);
 const bad=fixture(t,[{...base,validThrough:'not-a-date'}]);a.equal(bad.index.find(base,{now}).reason,'POSTING_EXPIRY_INVALID');
});

function saveDocument(root,card,observedAt){
 const ref=E.capture(root,card,{observedAt,proof:'state/source-trial-report.json'});
 const file=path.join(root,'state/discovery-evidence/manifest.json');let entries={};try{entries=JSON.parse(fs.readFileSync(file)).entries;}catch{}
 entries[ref.sha256]={sourceUrl:card.url,evidenceRefs:[ref]};fs.writeFileSync(file,JSON.stringify({schema:'forge.discovery-evidence-manifest.v1',entries}));return ref;
}
const expiry='2026-11-10T01:00:00Z',recent='2026-11-10T12:00:00Z';
test('newer metadata expiry constrains old text with separate proof/date and no source refetch',async t=>{
 const f=fixture(t,[{...base,observedAt:at}]);
 const file='state/board-discovery-report.json',closed={...base,description:'',validThrough:expiry,observedAt:recent};fs.writeFileSync(path.join(f.root,file),JSON.stringify({new_roles:[closed]}));
 const index=D.index(f.root),e=index.find(base,{now});a.equal(e.card.description,base.description);a.equal(e.observedAt,at);a.equal(e.proof.path,'state/source-trial-report.json');a.equal(e.card.validThrough,expiry);a.equal(e.card.validThroughEvidence.observedAt,recent);a.equal(e.card.validThroughEvidence.proof.path,file);a.ok(C.validEnvelope(e,{now}));
 a.equal(A.pick({new_roles:[base]},{max:1,sent:new Set(),capturedInputs:index}).length,0);
 let fetches=0;const candidate=await A.prepareCandidate(base,{COMPANY:base.company,TITLE:base.title,LOCATION:base.location,SOURCE_URL:base.url},{discoveryEvidence:E.index(f.root),capturedInputs:index,fetchEvidence:()=>{fetches++;throw Error('no fetch');}});a.equal(candidate.evidenceSource,'CAPTURED_DISCOVERY');a.equal(C.validate(candidate,{now}),false);
 await a.rejects(require('../programmed-coordinator/source.cjs').verify({root:f.root,discovery:index,item:{sourceEvidence:{url:base.url}},expected:base,now,requireRoleText:true,fetchPage:()=>{fetches++;throw Error('no fetch');}}),/POSTING_EXPIRED/);a.equal(fetches,0);
});
test('new unknown observation retains expiry and a newer explicit extension supersedes it without renewing text',t=>{
 const closed={...base,description:'',validThrough:expiry,observedAt:recent},unknown={...base,description:'',observedAt:'2026-11-11T00:00:00Z'};
 for(const extension of [null,'2026-12-01T00:00:00Z']){
  const cards=[{...base,observedAt:at},closed,unknown,...(extension?[{...unknown,validThrough:extension,observedAt:'2026-11-11T01:00:00Z'}]:[])],f=fixture(t,cards),e=f.index.find(base,{now});
  a.equal(e.card.validThrough,extension||expiry);a.equal(e.observedAt,at);a.equal(e.card.description,base.description);a.equal(e.card.validThroughEvidence.observedAt,extension?'2026-11-11T01:00:00Z':recent);
 }
});
test('immutable text cannot mask later metadata expiry and immutable expiry cannot be erased by later unknown text',t=>{
 for(const immutableExpiry of [false,true]){
  const cards=immutableExpiry?[{...base,observedAt:recent}]:[{...base,description:'',observedAt:recent,validThrough:expiry}],f=fixture(t,cards);
  const ref=saveDocument(f.root,{...base,...(immutableExpiry?{description:'Older partial posting.',validThrough:expiry}:{})},at),e=D.index(f.root).find(base,{now});
  a.equal(e.card.validThrough,expiry);a.equal(e.card.validThroughEvidence.proof.path,immutableExpiry?ref.path:'state/source-trial-report.json');a.equal(e.proof.path,immutableExpiry?'state/source-trial-report.json':ref.path);
 }
});
test('immutable-only source remains captured and original expiry provenance survives',async t=>{
 const f=fixture(t,[]),ref=saveDocument(f.root,{...base,validThrough:'2026-12-01T00:00:00Z'},at),index=D.index(f.root),e=index.find(base,{now});a.ok(e);a.equal(e.proof.path,ref.path);a.equal(e.observedAt,at);a.equal(e.card.source,base.source);
 const candidate=await A.prepareCandidate(base,{COMPANY:base.company,TITLE:base.title,LOCATION:base.location,SOURCE_URL:base.url},{discoveryEvidence:E.index(f.root),capturedInputs:index,fetchEvidence:()=>{throw Error('no fetch');}});a.equal(candidate.evidenceSource,'CAPTURED_DISCOVERY');a.equal(candidate.evidenceVerified,false);a.equal(candidate.primaryBusiness,'');a.equal(candidate.record.COMPANY,base.company);a.equal(candidate.record.TITLE,base.title);a.equal(candidate.record.SOURCE_URL,base.url);a.ok(!JSON.stringify(candidate.record).includes(base.description));a.ok(C.validate(candidate,{now}));
 const result=await require('../programmed-coordinator/source.cjs').verify({root:f.root,discovery:index,item:{sourceEvidence:{url:base.url}},expected:base,now,fetchPage:()=>{throw Error('no fetch');}});a.equal(result.sourceCaptured,true);a.equal(result.independentlyVerified,false);
});
test('expiry never crosses identity, source URL, or conflicting explicit requisitions',t=>{
 for(const patch of [{company:'Other'},{title:'Other'},{location:'Dallas, TX'},{url:'https://jobs.example.com/other'},{reqId:'REQ-2'}]){
  const card={...base,reqId:'REQ-1'},f=fixture(t,[card,{...card,...patch,description:'',observedAt:recent,validThrough:expiry}]),e=f.index.find(card,{now});a.ok(e);a.equal(e.card.validThrough,undefined);
 }
 const f=fixture(t,[{...base,reqId:'REQ-1'},{...base,reqId:'REQ-2',description:'',observedAt:recent,validThrough:expiry}]);a.equal(f.index.find(base,{now}).reason,'CONFLICTING_SOURCE_IDENTITY');
});
test('malformed explicit expiry cannot fall through to an older independently verified cache path',async t=>{
 const f=fixture(t,[{...base,description:'',validThrough:'invalid',observedAt:recent}]);saveDocument(f.root,base,at);let fetched=0;
 const result=await A.sourceEvidence(base,{store:E.index(f.root),capturedInputs:D.index(f.root),fetchEvidence:()=>{fetched++;return 'unreachable';}});a.equal(result.blocked.reason,'POSTING_EXPIRY_INVALID');a.equal(result.cached,null);a.equal(fetched,0);
});
test('expiry-only metadata still blocks enrichment before its missing-text fallback',async t=>{
 const card={...base,description:'',validThrough:expiry},f=fixture(t,[card]);await a.rejects(require('../programmed-coordinator/source.cjs').verify({root:f.root,item:{sourceEvidence:{url:card.url}},expected:base,now,requireRoleText:true,fetchPage:()=>{throw Error('must not fetch');}}),/POSTING_EXPIRED/);
});
test('invalid expiry and conflicting requisition holds are isolated while healthy sibling AUTO and catch-up work continues',async t=>{
 const good={...base,url:'https://jobs.example.com/good'},bad={...base,validThrough:'bad',observedAt:recent},conflict={...base,url:'https://jobs.example.com/conflict'},f=fixture(t,[bad,good,{...conflict,reqId:'one'},{...conflict,reqId:'two',validThrough:expiry}]),index=f.index;
 const picked=A.pick({new_roles:[bad,conflict,good]},{max:3,sent:new Set(),capturedInputs:index});a.deepEqual(picked.map(x=>x.r.url),[good.url]);
 let legacyReads=0,fetches=0;const store={find:()=>{legacyReads++;throw Error('legacy fallback');},forIntake:()=>{legacyReads++;throw Error('legacy fallback');}};
 for(const card of [bad,conflict]){
  const source=await A.sourceEvidence(card,{store,capturedInputs:index,fetchEvidence:()=>{fetches++;}});a.equal(source.blocked.blocked,true);a.equal(source.cached,null);
  a.equal(await A.prepareCandidate(card,{},{discoveryEvidence:store,capturedInputs:index,fetchEvidence:()=>{fetches++;}}),null);
  await a.rejects(require('../programmed-coordinator/source.cjs').verify({root:f.root,discovery:index,item:{sourceEvidence:{url:card.url}},expected:card,now,fetchPage:()=>{fetches++;}}),/POSTING_EXPIRY_INVALID|CONFLICTING_SOURCE_IDENTITY/);
 }
 a.equal(legacyReads,0);a.equal(fetches,0);
 const Catch=require('./catch-up'),state=Catch.ingest({roles:{}},[{new_roles:[bad,conflict,good]}],now);for(const card of [bad,conflict,good])Catch.defer(state,card,now);
 const before=JSON.stringify([state.roles[Catch.id(bad)],state.roles[Catch.id(conflict)]]);a.equal(Catch.releaseSourceHolds(state,r=>index.find(r,{now}),now),1);a.equal(JSON.stringify([state.roles[Catch.id(bad)],state.roles[Catch.id(conflict)]]),before);a.equal(state.roles[Catch.id(good)].status,'PENDING_INTAKE');
});
test('compatible requisition aliases on one capture do not introduce an identity gate',t=>{
 const aliases={...base,reqId:'REQ-1',JOB_ID:'JOB-2'},constraint={...base,description:'',reqId:'JOB-2',validThrough:'2026-12-01T00:00:00Z',observedAt:recent},f=fixture(t,[aliases,constraint]),e=f.index.find(base,{now});
 a.ok(C.validEnvelope(e,{now}));a.deepEqual(e.card.requisitionIds,['job-2','req-1']);a.equal(e.card.validThrough,constraint.validThrough);
});
