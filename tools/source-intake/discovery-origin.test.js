'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const O=require('./discovery-origin'),A=require('./auto-run'),U=require('../pipeline-observability/upstream-flow');
const role={company:'Acme',title:'Plant Manager',location:'Austin, TX',url:'https://www.linkedin.com/jobs/view/1234567890/'};
function fixture(t,{sources=['EMAIL_RECOVERY'],job={},entry={}}={}){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'origin-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));fs.mkdirSync(path.join(root,'state'));
 fs.writeFileSync(path.join(root,'state/EMAIL_RECOVERY_QUEUE.json'),JSON.stringify({jobs:{one:{...role,sourceEmails:['1a1cc4119ad913fb'],...job}}}));
 fs.writeFileSync(path.join(root,'state/UPSTREAM_LEDGER.json'),JSON.stringify({entries:{[U.key(role.url)]:{...role,sources,...entry}}}));return O.index(root);
}
test('email-only exact historical evidence survives automatic intake without replacing provider or run',t=>{
 const idx=fixture(t);a.equal(idx.find(role).origin,'EMAIL');a.equal(idx.find(role).proofs.length,2);
 const [picked]=A.pick({new_roles:[{...role,source:'URL:www.linkedin.com'}]},{max:1,sent:new Set(),originIndex:idx});
 a.equal(picked.record.DISCOVERY_SOURCE,'EMAIL');a.equal(picked.record.SCOUT_RUN_ID,undefined);a.equal(picked.r.source,'URL:www.linkedin.com');
});
test('posting host, rediscovery and mixed-source chronology never manufacture email initiation',t=>{
 a.equal(fixture(t,{sources:['state/source-trial-report.json','EMAIL_RECOVERY']}).find(role),null);
 a.equal(fixture(t,{sources:['state/source-trial-report.json']}).find(role),null);
 a.equal(fixture(t,{job:{sourceEmails:[]}}).find(role),null);
 a.equal(fixture(t,{sources:[]}).find(role),null);
});
test('exact identity, requisition and conflict fences bind origin',t=>{
 a.equal(fixture(t).find({...role,location:'Dallas, TX'}),null);
 a.equal(fixture(t,{job:{REQ_ID:'A'}}).find({...role,REQ_ID:'B'}),null);
 a.equal(fixture(t,{entry:{IDENTITY_EVIDENCE_CONFLICT:'reqs'}}).find(role),null);
 a.equal(fixture(t,{entry:{company:'Other'}}).find(role),null);
});
test('already recorded initiation source remains stable and untouched carry-forward records retain it',t=>{
 const idx=fixture(t),[p]=A.pick({new_roles:[{...role,DISCOVERY_SOURCE:'WEB'}]},{max:1,sent:new Set(),originIndex:idx});a.equal(p.record.DISCOVERY_SOURCE,'WEB');
 const [email]=A.pick({new_roles:[{...role,DISCOVERY_SOURCE:'EMAIL'}]},{max:1,sent:new Set()});a.equal(email.record.DISCOVERY_SOURCE,'EMAIL');
});
