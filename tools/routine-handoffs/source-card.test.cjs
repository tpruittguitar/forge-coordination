'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const S=require('../programmed-coordinator/store.cjs'),R=require('./source-card.cjs');
function fixture(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'forge-source-card-'));
 t.after(()=>{a.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir())+path.sep));fs.rmSync(root,{recursive:true,force:true});});
 const key='indeed:1234567890abcdef',file='receipts/EMAIL_CANDIDATE_LEDGER_TEST.json';
 const candidate={company:'Factory',title:'Director of Operations',location:'Austin, TX',source_url:'https://www.indeed.com/rc/clk/dl?jk=1234567890abcdef&token=PRIVATE',disposition:{status:'OUT_OF_SCOPE'}};
 S.save(root,'state/UPSTREAM_LEDGER.json',{entries:{[key]:{sources:[path.basename(file)]}}});S.save(root,file,{new_candidates:[candidate]});
 return{root,key,file,candidate,card:{company:'Factory',title:'Director of Operations',location:null,url:null}};
}
test('missing fields recover from an exact original email card without copying tracking or old exclusions',t=>{
 const f=fixture(t),original=structuredClone(f.card),r=R.recover(f.root,f.key,f.card);
 a.equal(r.url,'https://www.indeed.com/viewjob?jk=1234567890abcdef');a.equal(r.location,'Austin, TX');a.equal(r.disposition,undefined);
 a.equal(r.sourceRecovery.postingFetched,false);a.deepEqual(r.sourceRecovery.fields,['location','url']);a.equal(r.sourceRecovery.proofs[0].sourceSha256,S.hash(f.candidate));
 a.deepEqual(f.card,original);a.deepEqual(S.read(f.root,f.file).new_candidates,[f.candidate]);a.equal(JSON.stringify(r).includes('PRIVATE'),false);
 const Next=require('./next.cjs'),w={taskKey:'FORGE_GROK_INTAKE_HELPER',pages:[{path:'control/page.json'}]};S.save(f.root,'control/page.json',{items:[{key:f.key,sourceEvidence:f.card}]});
 a.deepEqual(Next.intake(f.root,w,{items:{}}).items[0].sourceEvidence,r);
});
test('conflicting historical or assigned identities cannot be filled from a convenient matching job key',t=>{
 const f=fixture(t);S.save(f.root,f.file,{new_candidates:[f.candidate,{...f.candidate,company:'Other Factory'}]});a.throws(()=>R.recover(f.root,f.key,f.card),/CONFLICTING_ORIGINAL/);
 S.save(f.root,f.file,{new_candidates:[f.candidate]});a.throws(()=>R.recover(f.root,f.key,{...f.card,location:'Boston, MA'}),/CONFLICTING_ASSIGNMENT/);
 a.throws(()=>R.recover(f.root,f.key,{...f.card,url:'https://www.indeed.com/viewjob?jk=abcdef1234567890'}),/CONFLICTING_ASSIGNMENT_SOURCE_URL/);
});
test('missing, malformed, unrelated and unsafe source references do not create evidence',t=>{
 const f=fixture(t);
 for(const url of ['invalid','https://www.indeed.com/viewjob?jk=abcdef1234567890','https://other.example/viewjob?jk=1234567890abcdef','https://user:password@www.indeed.com/viewjob?jk=1234567890abcdef','https://www.indeed.com/viewjob?jk=1234567890abcdef&jk=abcdef1234567890']){
  S.save(f.root,f.file,{new_candidates:[{...f.candidate,source_url:url}]});a.equal(R.recover(f.root,f.key,f.card),f.card);
 }
 S.save(f.root,f.file,{new_candidates:[{...f.candidate,location:null}]});a.equal(R.recover(f.root,f.key,f.card),f.card);
 S.save(f.root,'state/UPSTREAM_LEDGER.json',{entries:{[f.key]:{sources:['../outside.json','EMAIL_CANDIDATE_LEDGER_ABSENT.json']}}});a.equal(R.recover(f.root,f.key,f.card),f.card);
});
