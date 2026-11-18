'use strict';
// Card e51fff1: intake reads the Workday box pass report beside the board-discovery report.
const test=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),p=require('node:path');
const B=require('./box-pass-report'),C=require('./catch-up');
const wd={company:'Bravo',title:'Director of Quality',location:'Dayton, OH',url:'https://bravo.wd1.myworkdayjobs.com/ext/job/Dayton/Director_R2'};
const gh={company:'Acme',title:'Plant Manager',location:'Reno, NV',url:'https://job-boards.greenhouse.io/acme/jobs/1'};
const root=files=>{const d=fs.mkdtempSync(p.join(os.tmpdir(),'box-pass-'));fs.mkdirSync(p.join(d,'state'));for(const [f,t] of Object.entries(files))fs.writeFileSync(p.join(d,f),t);return d;};
test('box report roles are admitted to the catch-up queue beside the board-discovery report',()=>{
 const d=root({[B.FILE]:JSON.stringify({summary:{run:'R1'},new_roles:[wd]})});
 try{const box=B.load(d);a.equal(box.stat.status,'READ');a.equal(box.stat.roles,1);a.equal(box.keys.has(C.id(wd)),true);
  const s=C.ingest({roles:{}},[{new_roles:[gh]},{new_roles:box.roles}],1000);a.deepEqual(C.due(s,1000).map(r=>r.company).sort(),['Acme','Bravo']);}
 finally{fs.rmSync(d,{recursive:true,force:true});}
});
test('a role in both reports is admitted once',()=>{
 const d=root({[B.FILE]:JSON.stringify({new_roles:[wd,{...wd}]})});
 try{const box=B.load(d);a.equal(B.merge([wd,gh],box.roles).length,2);a.equal(C.due(C.ingest({roles:{}},[{new_roles:[wd,gh]},{new_roles:box.roles}],1000),1000).length,2);}
 finally{fs.rmSync(d,{recursive:true,force:true});}
});
test('a missing box report is a no-op; a malformed one is ignored and recorded, never fatal',()=>{
 const d=root({});
 try{const box=B.load(d);a.deepEqual(box.roles,[]);a.equal(box.stat.status,'MISSING');a.equal(C.due(C.ingest({roles:{}},[{new_roles:[gh]},{new_roles:box.roles}],1000),1000).length,1);
  fs.writeFileSync(p.join(d,B.FILE),'{not json');let m=B.load(d);a.equal(m.stat.status,'MALFORMED');a.deepEqual(m.roles,[]);
  fs.writeFileSync(p.join(d,B.FILE),JSON.stringify({new_roles:'x'}));m=B.load(d);a.equal(m.stat.status,'MALFORMED');}
 finally{fs.rmSync(d,{recursive:true,force:true});}
});
test('auto-run reads the box report in both the catch-up and plain paths and reports it in stats',()=>{
 const src=fs.readFileSync(p.join(__dirname,'auto-run.js'),'utf8');
 a.match(src,/reports\.push\(\{new_roles:box\.roles\}\)/);a.match(src,/\.\.\.\(catchUp\?\[\]:box\.roles\)/);a.match(src,/workdayBoxPass:/);
});
