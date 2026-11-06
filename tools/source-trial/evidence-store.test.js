'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('fs'),path=require('path'),os=require('os'),E=require('./evidence-store');
const now=Date.parse('2026-11-05T23:00:00Z'),at=new Date(now-3600000).toISOString(),proof='state/board-discovery-report.json@'+'a'.repeat(40),card={company:'Acme',title:'Director of Manufacturing',location:'Austin, TX',url:'https://jobs.example.test/1',description:('Lead manufacturing, assembly, quality and production engineering teams. ').repeat(7)+'\nBachelor degree preferred, or equivalent experience accepted.\nThe annual base salary range is $175,000 - $200,000.'};
function dir(t){const r=fs.mkdtempSync(path.join(os.tmpdir(),'discovery-evidence-'));t.after(()=>fs.rmSync(r,{recursive:true,force:true}));return r;}
test('save once, reuse exact fresh source identity, preserve facts and explicit source provenance',t=>{
 const root=dir(t),ref=E.capture(root,card,{observedAt:at,proof,fullPosting:true}),second=E.capture(root,card,{observedAt:new Date(now).toISOString(),proof,fullPosting:true});a.equal(ref.path,second.path);a.equal(fs.readdirSync(path.join(root,'state/discovery-evidence')).length,1);
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
