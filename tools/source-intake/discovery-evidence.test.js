'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const A=require('./auto-run'),E=require('../source-trial/evidence-store'),Preliminary=require('../source-trial/preliminary-screen'),{requestId}=require('./production-executor');
function fixture(t,{source='JOBSPY:indeed',description='Acme manufactures industrial automation equipment. '.repeat(12)+'Bachelor degree required.',review={}}={}){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'intake-discovery-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const c={company:'Acme',title:'Plant Manager',location:'Austin, TX',url:'https://careers.example.com/plant',source,description};
 c.discoveryReview={schema:'forge.discovery-review.v1',source,sourceUrl:c.url,observedAt:new Date().toISOString(),detailStatus:'SOURCE_CONTENT_REVIEWED',sourceSha256:E.hash(description),...review};
 fs.mkdirSync(path.join(root,'state'),{recursive:true});fs.writeFileSync(path.join(root,'state/source-trial-report.json'),JSON.stringify({new_roles:[c]}));
 return{root,card:c,store:E.index(root,{entries:{}})};
}
test('captured evidence eliminates the duplicate source fetch and preserves the complete text and provenance in candidate preparation',async t=>{
 const {card,store}=fixture(t),stripped={...card,description:undefined,discoveryReview:undefined,source:'SAVED_DISCOVERY'};let fetches=0;
 const result=await A.sourceEvidence(stripped,{store,fetchEvidence:async()=>{fetches++;throw Error('must not fetch');}});
 a.equal(fetches,0);a.equal(result.business,card.description);a.equal(result.provenance.textSha256,E.hash(card.description));a.match(result.provenance.reportSha256,/^[a-f0-9]{64}$/);a.equal(result.provenance.fullPosting,false);a.deepEqual(result.provenance.identity,E.identity(card));a.equal(result.provenance.origin,'DISCOVERY_REPORT');
});
test('unusable or mismatched saved evidence falls back exactly once without manufacturing evidence',async t=>{
 const {card,store}=fixture(t);let fetches=0;
 const result=await A.sourceEvidence({...card,location:'Dallas, TX'},{store,fetchEvidence:async(url,company)=>{fetches++;a.equal(url,card.url);a.equal(company,card.company);return null;}});
 a.equal(fetches,1);a.equal(result.business,null);a.equal(result.provenance,null);
});
test('captured text reaches current exclusion screening and is not mislabeled a full posting',t=>{
 const {card,store}=fixture(t),prior=Preliminary.screen;let calls=0;
 Preliminary.screen=(c)=>{calls++;a.equal(c.description,card.description);a.equal(c.discoveryReview.fullPosting,false);return{decision:'EXCLUDE_NEVER_CONSIDER'};};
 try{a.deepEqual(A.pick({new_roles:[{...card,description:undefined}]},{max:10,sent:new Set(),screenContext:{},discoveryEvidence:store}),[]);a.equal(calls,1);}finally{Preliminary.screen=prior;}
});
test('saved text never overrides function exclusions, dismissed identities, or previously attempted request fences',t=>{
 const {card,store}=fixture(t),options={max:10,sent:new Set(),discoveryEvidence:store};
 const [picked]=A.pick({new_roles:[card]},options);a.ok(picked);
 a.deepEqual(A.pick({new_roles:[card]},{...options,sent:new Set([requestId(picked.record)])}),[]);
 a.deepEqual(A.pick({new_roles:[card]},{...options,blockedRecords:[picked.record]}),[]);
 a.deepEqual(A.pick({new_roles:[card]},{...options,dismissedKeys:new Set([require('../pipeline-observability/upstream-flow').key(card.url)])}),[]);
 a.deepEqual(A.pick({new_roles:[{...card,title:'Claims Operations Director'}]},options),[]);
});

test('real ATS screen never rejects partial business text for missing competency hits, but still excludes a complete zero',()=>{
 const profile=require('../source-trial/resume-match').load(),screenContext={profile,documents:{resumes:[{id:profile.source.fileId,modifiedTime:profile.source.modifiedAt}]}},text=('Oversee customer support across all regions. Coordinate client appointments, resolve account inquiries, and report monthly service results. Set budgets and direct branch administrators, including daily scheduling and customer correspondence. ').repeat(2);
 const card={company:'Acme',title:'Director of Operational Excellence',location:'Austin, TX',url:'https://careers.example.com/role'},options={max:10,sent:new Set(),screenContext};
 a.equal(Preliminary.screen({...card,description:text},screenContext).decision,'EXCLUDE_ATS_ZERO','fixture has a true zero when complete');
 for(const contentBasis of ['CAPTURED_ROLE_CONTENT','PREVIOUSLY_CAPTURED_QUOTES']){
  const store={forIntake:()=>({doc:{text,fullPosting:false,contentBasis}})};
  a.equal(A.pick({new_roles:[card]},{...options,discoveryEvidence:store}).length,1);
 }
 a.equal(A.pick({new_roles:[card]},{...options,discoveryEvidence:{forIntake:()=>({doc:{text,fullPosting:true,contentBasis:'CAPTURED_ROLE_CONTENT'}})}}).length,0);
});

test('reusing the exact direct JobSpy card cannot erase its current grounded ATS exclusion',t=>{
 const description=('Oversee customer support across all regions. Coordinate client appointments, resolve account inquiries, and report monthly service results. Set budgets and direct branch administrators, including daily scheduling and customer correspondence. ').repeat(2).trim(),{root,card}=fixture(t,{description});card.title='Director of Operational Excellence';
 const profile=require('../source-trial/resume-match').load(),screenContext={profile,documents:{resumes:[{id:profile.source.fileId,modifiedTime:profile.source.modifiedAt}]}};
 card.discoveryReview.preliminaryScreen=Preliminary.screen(card,screenContext);a.equal(card.discoveryReview.preliminaryScreen.decision,'EXCLUDE_ATS_ZERO');
 fs.writeFileSync(path.join(root,'state/source-trial-report.json'),JSON.stringify({new_roles:[card]}));const store=E.index(root,{entries:{}}),options={max:10,sent:new Set(),screenContext};
 a.equal(store.forIntake(card).doc.fullPosting,false);a.equal(A.pick({new_roles:[card]},options).length,0);a.equal(A.pick({new_roles:[card]},{...options,discoveryEvidence:store}).length,0);
 a.equal(A.pick({new_roles:[{...card,description:undefined}]},{...options,discoveryEvidence:store}).length,1,'a stale stored decision without direct complete evidence does not create an exclusion');
});
