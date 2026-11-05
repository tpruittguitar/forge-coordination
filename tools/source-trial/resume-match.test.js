'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),R=require('./resume-match');
test('matching uses the exact user-supplied resume version and source-supported competencies',()=>{
 const p=R.load(),m=R.match({title:'Director of Manufacturing',description:'Lead greenfield assembly launch, robotics commissioning, PPAP and MES traceability.'},p);a.equal(p.source.uploadedFileName,'Tim_Pruitt_Resume_Oct_13_2026.pdf');a.match(p.source.uploadedPdfSha256,/^[a-f0-9]{64}$/);a.equal(m.resumeTextSha256,p.source.textSha256);for(const id of ['manufacturing_leadership','startup_launch','quality_systems','automation_robotics','manufacturing_systems'])a.ok(m.matches.some(x=>x.competencyId===id));a.equal(m.finalFit,false);
});
test('no resume evidence overlap or missing source content is not an automatic rejection',()=>{
 const m=R.match({title:'General Manager'});a.equal(m.matches.length,0);a.equal(m.automaticRejection,false);a.equal(m.contentBasis,'TITLE_ONLY');a.ok(m.unresolved.includes('ROLE_CONTENT_NOT_REVIEWED'));a.equal(R.match({description:'devops revenue analytics'}).matches.length,0);
});
test('resume matching cannot invent credentials or expose resume text/contact information',()=>{
 const p=R.load(),m=R.match({description:'PhD, Top Secret clearance and medical license required'});a.equal(m.matches.length,0);a.equal(p.competencies.some(c=>/degree|clearance|license/.test(c.id)),false);a.equal(/@|205-332|37323/.test(JSON.stringify(p)),false);a.equal('score' in m,false);
});
