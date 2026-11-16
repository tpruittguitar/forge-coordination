'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),R=require('./resume-match');
test('explicit variants retain actual source terms and count each competency once',()=>{
 for(const [text,id] of [['Factories','manufacturing_leadership'],['PLCs','automation_robotics'],['batteries','ev_battery'],['corrective actions','supplier_quality'],['root–cause','supplier_quality'],['line-balancing','lean_operations'],['plant start up','startup_launch'],['electric vehicles','ev_battery'],['manufacturing execution systems','manufacturing_systems'],['computer-aided design','engineering_design'],['Operational Excellence','lean_operations'],['Supplier Development','supplier_quality']]){
  const m=R.match({title:text}),hit=m.matches.find(x=>x.competencyId===id);a.ok(hit,text);a.ok(hit.postingTerms.includes(text),text);a.ok(hit.postingQuotes.some(q=>q.includes(text)),text);
 }
 const m=R.match({description:'robotics, robots, robot, robotic; PLC and PLCs; machine vision'});a.equal(m.matches.filter(x=>x.competencyId==='automation_robotics').length,1);
});
test('benefits and corporate vision do not imply machine vision',()=>{
 for(const description of ['Health, dental, vision insurance.','Vision coverage and life insurance.','Set the strategic vision for the company.','Close vision, distance vision and color vision required.'])a.equal(R.match({description}).matches.some(x=>x.competencyId==='automation_robotics'),false,description);
 for(const description of ['Machine vision inspection','Vision-guided robots','Commissioned conveyors and robot vision'])a.ok(R.match({description}).matches.some(x=>x.competencyId==='automation_robotics'),description);
});
test('generic leadership titles and substrings do not invent evidence',()=>{
 for(const title of ['General Manager','Director of Operations','Director of MRO Transformation','CNC Machining','cloudplatform datawarehouse evasion robotically'])a.equal(R.match({title}).matches.length,0,title);
 a.ok(R.match({title:'General Manager',description:'Lead manufacturing and quality.'}).matches.length>=2);
 const m=R.match({title:'General Manager',description:'  \n\t'});a.equal(m.contentBasis,'TITLE_ONLY');a.deepEqual(m.unresolved,['ROLE_CONTENT_NOT_REVIEWED']);
});
test('wrapped phrases keep the observed text and supporting quote',()=>{
 const m=R.match({description:'Lead continuous\nimprovement and machine\nvision.'});a.ok(m.matches.some(x=>x.competencyId==='lean_operations'));for(const hit of m.matches)a.ok(hit.postingQuotes.length&&hit.postingQuotes.some(q=>hit.postingTerms.some(t=>q.includes(t))));
});

test('quoted evidence uses validated word offsets and preserves first observed casing',()=>{
 const m=R.match({description:'robotically '+ 'x'.repeat(800)+' robot'}).matches[0];a.ok(m.postingQuotes.some(q=>/(?:^|[^a-z])robot(?:$|[^a-z])/i.test(q)));
 a.ok(R.match({description:'robots ROBOTS Robots'}).matches[0].postingTerms.includes('robots'));
});

test('unbounded layout gaps cannot create a phrase with unsupported truncated evidence',()=>{
 a.equal(R.match({description:'continuous'+' '.repeat(700)+'improvement'}).matches.length,0);
});
test('separate vocabulary leaves stored provenance untouched and does not extend custom profile files',t=>{
 const fs=require('fs'),path=require('path'),os=require('os'),file=path.resolve(__dirname,'../../control/RESUME_MATCH_PROFILE.json'),before=fs.readFileSync(file,'utf8'),raw=JSON.parse(before);
 const loaded=R.load();a.deepEqual(loaded.source,raw.source);a.equal(fs.readFileSync(file,'utf8'),before);a.ok(loaded.competencies.find(x=>x.id==='automation_robotics').terms.includes('robot'));
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ats-custom-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const custom=path.join(dir,'profile.json');fs.writeFileSync(custom,before);a.deepEqual(R.load(custom),raw);
 const vocabulary=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../control/RESUME_MATCH_VARIANTS.json')));a.equal('source' in vocabulary,false);a.equal(JSON.stringify(vocabulary).includes(raw.source.fileId),false);
});
