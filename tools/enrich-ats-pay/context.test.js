'use strict';
const test=require('node:test'),a=require('node:assert/strict'),C=require('./context'),L=require('./lib'),Cal=require('./calibration');
const now=Date.parse('2026-10-31'),fact=(value,date='2026-09-01')=>({value,asOf:date,status:'CONFIRMED',sourceUrl:'https://example.com/annual-report',quote:'Public disclosure'});
const ref={schema:'forge.company-site-context.v1',companies:[{company:'Big Co',facts:{employees:fact(100000)},sites:[{location:'Austin, TX',facts:{employees:fact(5000)}}]},{company:'Small Co',facts:{employees:fact(50)}}],roles:[]};
const row={PRIMARY_ID:'T',COMPANY:'Big Co',TITLE:'Senior Manager, Quality',LOCATION:'Austin, TX'};
test('sourced fresh company size and exact site are separate; ambiguous/stale/unsourced facts stay unknown',()=>{
 a.deepEqual(C.lookup(row,ref,now),{employees:100000,siteEmployees:5000});a.deepEqual(C.lookup({...row,LOCATION:'Dallas, TX'},ref,now),{employees:100000});
 a.equal(C.fact(fact(20,'2023-01-01'),now),null);a.equal(C.fact({...fact(20),sourceUrl:''},now),null);a.equal(C.fact({...fact(20),status:'INFERRED'},now),null);
 a.deepEqual(C.lookup(row,{companies:[ref.companies[0],ref.companies[0]]},now),{});
});
test('size selects evidence, never inflates pay; explicit scope conflicts excluded and missing facts are not blockers',()=>{
 a.equal(C.weightedMedian([{low:150000,weight:1},{low:200000,weight:1}],'low'),175000,'balanced evidence must not bias toward the lower salary');
 a.ok(C.similarity({employees:100000},{employees:90000}).weight>C.similarity({employees:100000},{employees:50}).weight);
 a.equal(C.similarity({management:'MANAGES_MANAGERS'},{management:'INDIVIDUAL_CONTRIBUTOR'}).weight,0);
 const anchors=[{id:'A',co:'Small Co',title:row.TITLE,location:'Austin, TX',low:100000,high:150000,asOf:'2026-09-01'},{id:'B',co:'Big Co',title:row.TITLE,location:'Austin, TX',low:200000,high:250000,asOf:'2026-09-01'}];
 const ranked=C.rank(row,anchors,ref,now);a.equal(ranked[0].id,'B');a.equal(C.weightedMedian(ranked,'high'),250000);
 a.equal(C.confidence({conf:'HIGH'},ranked),'LOW');a.equal(C.rank(row,[anchors[0]],{},now).length,1);
});
test('posting copies do not multiply evidence; age lowers weight, future/obsolete dates excluded',()=>{
 const x={id:'A',co:'C',title:row.TITLE,location:'Austin, TX',low:150000,high:200000,sourceUrl:'https://www.linkedin.com/jobs/view/4484240468/',asOf:'2026-09-01'};
 a.equal(C.rank(row,[x,{...x,id:'B',sourceUrl:'https://www.linkedin.com/jobs/view/senior-manager-4484240468?trk=copy'}],{},now).length,1);
 a.ok(C.rank(row,[{...x,asOf:'2026-09-01'}],{},now)[0].weight>C.rank(row,[{...x,asOf:'2025-09-01'}],{},now)[0].weight);
 a.equal(C.rank(row,[{...x,asOf:'2027-09-01'}],{},now).length,0);
 a.equal(L.comparable(row,{title:'Senior Quality Program Manager'}),false);
});
test('explicit posting facts are learned with provenance; role facts never become company/site headcount',()=>{
 const r=JSON.parse(JSON.stringify(ref));a.equal(C.learn(r,row,'Lead a team of 12 engineers. Manage a team of managers. Responsible for operations across multiple plants.','https://employer.com/jobs/123','2026-10-31'),true);
 a.equal(C.lookup(row,r,now).teamSize,12);a.equal(C.lookup(row,r,now).management,'MANAGES_MANAGERS');a.equal(C.lookup(row,r,now).reach,'MULTI_SITE');a.equal(C.lookup(row,r,now).employees,100000);
 a.equal(C.learn(r,row,'Build 50,000 engines annually','https://employer.com/jobs/123','2026-10-31'),false);
 const fresh={schema:ref.schema,companies:[],roles:[]};a.equal(C.learn(fresh,{...row,COMPANY:'New Employer'},'New Employer employs 1200 people worldwide.','https://employer.com/jobs/123','2026-10-31'),true);a.equal(C.lookup({...row,COMPANY:'New Employer'},C.merge(ref,fresh),now).employees,1200);
 const unclear={schema:ref.schema,companies:[],roles:[]};C.learn(unclear,row,'Manage a team of managers. This position is an individual contributor. Lead a team of 12 engineers.','https://employer.com/jobs/123','2026-10-31');a.equal(C.lookup(row,unclear,now).management,undefined,'contradictory responsibilities need research, not an arbitrary choice');
 const newer=JSON.parse(JSON.stringify(r));newer.roles[0].facts.teamSize=fact(20,'2026-10-31');r.roles[0].facts.teamSize=fact(10,'2026-10-01');a.equal(C.merge(newer,r).roles[0].facts.teamSize.value,20);
});
test('calibration excludes target salary aliases and reports non-estimable cases',()=>{
 const rows=[{...row,PRIMARY_ID:'A',p:{SALARY_BASIS:'EMPLOYER_POSTED',SALARY_BASE_LOW:150000,SALARY_BASE_HIGH:200000,SALARY_SOURCE:'https://employer.com/jobs/a',SALARY_ASOF:'2026-09-01'}}];
 const anchors=rows.map(r=>L.postedAnchor(r,r.p));const result=Cal.evaluate(rows,[...anchors,{...anchors[0],id:'COPY'}],ref,now);
 a.equal(result.eligible,1);a.equal(result.evaluated,0);a.equal(result.noComparables,1);a.equal(result.meanAbsoluteErrorPct,null);
});
