'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{display}=require('./ats-hits.cjs'),Resume=require('../source-trial/resume-match');
const match=()=>Resume.match({title:'Director of Manufacturing',description:'Lead greenfield assembly launch, robotics commissioning, PPAP and MES traceability.'});
const card=ats=>({preliminaryScreen:{checkedAt:'2026-11-07T03:00:00Z',ats}});
test('display counts saved distinct supported competencies without running a new score',()=>{
 const ats=match(),item=card(ats),before=JSON.stringify(item),out=display(item);
 assert.equal(out.atsHits,ats.matches.length);assert.equal(out.atsBasis,'Captured content');assert.match(out.atsEvidence,/quality systems: PPAP/i);assert.equal(out.atsCheckedAt,item.preliminaryScreen.checkedAt);assert.equal(out.atsResumeVersion,ats.resumeVersion);assert.equal(JSON.stringify(item),before);assert.equal('score' in out,false);assert.equal('resumeFileId' in out,false);assert.equal('resumeTextSha256' in out,false);
 ats.matches.push(structuredClone(ats.matches[0]));assert.equal(display(item).atsHits,out.atsHits);
});
test('zero observed hits differs from unavailable and title-only remains visibly incomplete',()=>{
 const zero=Resume.match({description:'Revenue analytics'}),title=Resume.match({title:'Manufacturing Director'});
 assert.equal(display(card(zero)).atsHits,0);assert.equal(display(card(zero)).atsBasis,'Captured content');assert.equal(display(card(title)).atsHits,1);assert.equal(display(card(title)).atsBasis,'Title only');assert.equal(display(card(Resume.match({title:'General Manager'}))).atsHits,0);
 assert.equal(display({}).atsHits,null);assert.equal(display({}).atsBasis,'Not recorded');
});
test('supports existing discovery record locations and never replaces a current failure with older success',()=>{
 const ats=match(),discoveryReview={observedAt:'2026-11-06T03:00:00Z',resumeMatch:ats};
 assert.equal(display({discoveryReview}).atsHits,ats.matches.length);assert.equal(display({discoveryReview:{preliminaryScreen:card(ats).preliminaryScreen}}).atsHits,ats.matches.length);
 for(const status of ['RESUME_UPDATE_REQUIRED','RESUME_UNAVAILABLE','UNKNOWN_STATUS'])assert.equal(display({discoveryReview,preliminaryScreen:{ats:{...ats,status}}}).atsHits,null);
 assert.equal(display({discoveryReview,preliminaryScreen:{}}).atsHits,null);
 assert.equal(display({discoveryReview,preliminaryScreen:{ats}}).atsCheckedAt,null);
 for(const invalid of [false,'',0,[]])assert.equal(display({discoveryReview,preliminaryScreen:invalid}).atsHits,null);
});
test('invalid or partial saved evidence does not become zero or inflate a count',()=>{
 for(const patch of [{schema:'other'},{method:'NEW_PERCENTAGE'},{resumeTextSha256:'missing'},{resumeVersion:''},{contentBasis:'UNKNOWN'},{finalFit:true},{automaticRejection:true},{matches:null},{matches:[{}]},{matches:[{...match().matches[0],postingQuotes:[]}]},{matches:[{...match().matches[0],postingTerms:['']}]},{matches:[{...match().matches[0],resumeEvidenceSha256:'no'}]}])assert.equal(display(card({...match(),...patch})).atsHits,null,JSON.stringify(patch));
 const item=card(match());item.preliminaryScreen.checkedAt='unknown';assert.equal(display(item).atsCheckedAt,null);
});
test('matched words use saved posting terms, deduplicate spelling variants, and never infer words',()=>{
 const ats=match(),first=ats.matches[0];
 first.postingTerms=['PPAP',' ppap ','MES','multi word phrase','<img src=x onerror=alert(1)>'];
 ats.matches=[first,{...first,postingTerms:['mes','Additional saved term']}];
 const item=card(ats),before=JSON.stringify(item),out=display(item);
 assert.equal(out.atsHits,1);
 assert.deepEqual(out.atsTerms,['PPAP','MES','multi word phrase','<img src=x onerror=alert(1)>','Additional saved term']);
 assert.equal(out.atsTerms.includes(first.competencyId),false);
 assert.equal(out.atsTerms.includes('Director of Manufacturing'),false);
 assert.equal(JSON.stringify(item),before);
});
test('shortened excerpts do not truncate or invent saved matched words',()=>{
 const ats=match(),terms=Array.from({length:80},(_,i)=>`Saved phrase ${i}`);
 ats.matches=[{...ats.matches[0],postingTerms:terms,postingQuotes:['x'.repeat(600)]}];
 assert.deepEqual(display(card(ats)).atsTerms,terms);
 ats.matches[0].postingTerms=[];
 assert.equal(display(card(ats)).atsTerms,null);
 assert.equal(display(card(ats)).atsHits,null);
});
test('zero, missing, and failed evidence preserve distinct term states',()=>{
 assert.deepEqual(display(card(Resume.match({description:'Revenue analytics'}))).atsTerms,[]);
 assert.equal(display({}).atsTerms,null);
 assert.equal(display(card({...match(),status:'RESUME_UPDATE_REQUIRED'})).atsTerms,null);
 const ats=match();ats.matches[0].postingQuotes=[];
 assert.equal(display(card(ats)).atsTerms,null);
});
