const {test}=require('node:test'),assert=require('node:assert/strict'),U=require('./upstream-flow');
const now=Date.parse('2026-10-31T06:00:00Z'),at=new Date(now-3600000).toISOString();const c=(id,status='NEW')=>U.candidate({company:'Acme',title:'Quality Director',location:'Austin',url:'https://www.linkedin.com/jobs/view/'+id+'/',status},at,'fixture');const row={PRIMARY_ID:'V2I-ONE',COMPANY:'Acme',TITLE:'Quality Director',LOCATION:'Austin',p:{SOURCE_URL:'https://www.linkedin.com/jobs/view/123/',MASTER_LOADED_AT:at}};
test('source and admission windows use their actual timestamps and deduplicate archive copies',()=>{const records=[],rows=[];for(const [i,age] of [1,7,13,25,36].entries()){const stamp=new Date(now-age*3600000).toISOString();records.push({...c(100+i),firstSeen:stamp});rows.push({...row,PRIMARY_ID:'id'+i,p:{SOURCE_URL:'https://www.linkedin.com/jobs/view/'+(100+i)+'/',MASTER_LOADED_AT:stamp}});}const w=U.build({records,rows,archive:[rows[0]],now}).summary.ratesByWindow;for(const [h,n] of [[6,1],[12,2],[24,3],[36,4]]){assert.equal(w[h].intake.count,n);assert.equal(w[h].discovery.count,n);assert.equal(w[h].intake.perHour,n/h);}});
test('source repeats collapse, aliases share one canonical job, archive prevents new backlog',()=>{const a=c(123),b={...c(999),primaryId:'V2I-ONE'};const j=U.build({records:[a,a,b],rows:[],archive:[row],now}).summary;assert.equal(j.total,1);assert.equal(j.sourceIdentities,2);assert.equal(j.aliasesMerged,1);assert.equal(j.counts.PRESENT,1);assert.equal(j.waiting,0);assert.equal(j.rates.intake.count,1);});
test('pending identities persist when rolling reports omit them and queue movement balances',()=>{const first=U.build({records:[c(123)],rows:[],now});const second=U.build({records:[],rows:[],prior:first.ledger,now:now+60000});assert.equal(second.summary.waiting,1);const third=U.build({records:[],rows:[row],prior:second.ledger,now:now+120000});const r=third.summary.reconciliation;assert.equal(r.opening+r.arrivals-r.admitted-r.excluded-r.otherExits,r.closing);assert.equal(r.admitted,1);assert.equal(third.summary.waiting,0);});
test('ambiguous aliases stay held but count as captured discovery candidates',()=>{const j=U.build({records:[c(123)],rows:[row,{...row,PRIMARY_ID:'V2I-TWO'}],now}).summary;assert.equal(j.counts.IDENTITY_HOLD,1);assert.equal(j.rates.discovery.count,1);assert.equal(j.rates.discovery.unit,'candidate identities');assert.equal(j.accounted,j.total);});
test('missing previously present records cannot silently turn into new intake work',()=>{let j=U.build({records:[c(123)],rows:[row],now});j=U.build({records:[],rows:[],prior:j.ledger,now:now+60000});j=U.build({records:[],rows:[],prior:j.ledger,now:now+120000});assert.equal(j.summary.counts.MISSING_PREVIOUSLY_PRESENT,1);});
test('tracking parameters deduplicate without trusting lookalike domains',()=>{assert.equal(U.key('https://www.linkedin.com/jobs/view/123/?trk=a'),U.key('https://www.linkedin.com/jobs/view/123/'));assert.notEqual(U.key('https://evil-linkedin.com/jobs/view/123/'),'linkedin:123');});

test('a later provisional discovery cannot reopen a proved exclusion',()=>{const excluded={...c(123,'OUT_OF_SCOPE'),proof:'receipts/proof.json'};let j=U.build({records:[excluded],rows:[],now});assert.equal(j.summary.counts.EXCLUDED,1);j=U.build({records:[{...c(123),firstSeen:new Date(now).toISOString()}],rows:[],prior:j.ledger,now:now+60000});assert.equal(j.summary.counts.EXCLUDED,1);assert.equal(j.summary.waiting,0);});


test('discovery counts captures before intake and admission cannot create a discovery',()=>{
 const first=U.build({records:[c(123),c(123)],rows:[],now});
 assert.equal(first.summary.rates.discovery.count,1);assert.equal(first.summary.waiting,1);
 const second=U.build({records:[],rows:[row],prior:first.ledger,now:now+60000});
 assert.equal(second.summary.rates.discovery.count,1);assert.equal(second.summary.waiting,0);
});
test('screened-out captures remain discovery output; old WIP is not divided into a current rate',()=>{
 const j=U.build({records:[{...c(123),firstSeen:new Date(now-40*3600000).toISOString()},c(456,'OUT_OF_SCOPE')],rows:[],now}).summary;
 assert.equal(j.rates.discovery.count,1);assert.equal(j.total,2);
});

test('salary comparables and review evidence cannot create identity conflicts or prove a job present',()=>{
 const anchor={...row,PRIMARY_ID:'V2I-OTHER',COMPANY:'Other Factory',TITLE:'Plant Manager',p:{SALARY_ANCHORS:row.p.SOURCE_URL,CLAUDE_REVIEW_EVIDENCE_URL:row.p.SOURCE_URL}};
 let j=U.build({records:[c(123)],rows:[row,anchor],now}).summary;assert.equal(j.counts.PRESENT,1);assert.equal(j.counts.IDENTITY_HOLD,0);
 j=U.build({records:[c(123)],rows:[anchor],now}).summary;assert.equal(j.counts.PRESENT,0);assert.equal(j.waiting,1);
});
test('multiple actual posting identity URLs remain an identity hold',()=>{
 const j=U.build({records:[c(123)],rows:[row,{...row,PRIMARY_ID:'V2I-SECOND',p:{LINKEDIN_URL:row.p.SOURCE_URL}}],now}).summary;assert.equal(j.counts.IDENTITY_HOLD,1);assert.equal(j.counts.PRESENT,0);
});

test('saved public posting survives report rollover and is screened again with current rules',()=>{
 const fs=require('fs'),os=require('os'),p=require('path'),root=fs.mkdtempSync(p.join(os.tmpdir(),'discovery-rescreen-'));
 try {
  const profile=require('../source-trial/resume-match').load(),rules={status:'ACTIVE',raw:'current fixture',rules:require('../source-trial/never-consider-patterns.json').rules.map(r=>({RULE_ID:r.id,CATEGORY:r.category,MATCH:r.match,ACTION:'DO_NOT_ADD',active:true}))};
  const description='We are a food manufacturer. '+('Lead manufacturing and production teams. '.repeat(12));
  const record=U.candidate({company:'Acme',title:'Quality Director',location:'Austin',url:'https://example.test/1',source:'BOARD:greenhouse',description},at,'state/board-discovery-report.json');
  const first=U.build({records:[record],rows:[],now,root,screenContext:{profile,rules:null}});const before=Object.values(first.ledger.entries)[0];assert.equal(before.evidenceRefs.length,1);assert.equal(before.discoveredFacts.fullPosting,true);
  const second=U.build({records:[],rows:[],prior:first.ledger,now:now+60000,root,screenContext:{profile,rules}});const after=Object.values(second.ledger.entries)[0];assert.equal(after.preliminaryScreen.decision,'EXCLUDE_NEVER_CONSIDER');assert.equal(after.firstSeen,before.firstSeen);assert.deepEqual(after.sources,before.sources);assert.deepEqual(after.evidenceRefs,before.evidenceRefs);assert.equal(second.summary.screening.canonicalWrites,0);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('history checkpoint only parses new report revisions without dropping prior candidates',()=>{
 const fs=require('fs'),os=require('os'),p=require('path'),{execFileSync}=require('child_process'),root=fs.mkdtempSync(p.join(os.tmpdir(),'discovery-history-'));
 const git=(...args)=>execFileSync('git',args,{cwd:root,stdio:'pipe'});
 try{
  fs.mkdirSync(p.join(root,'state'));fs.mkdirSync(p.join(root,'receipts'));fs.writeFileSync(p.join(root,'state/EMAIL_RECOVERY_QUEUE.json'),JSON.stringify({jobs:{},sources:{}}));git('init');git('config','user.name','test');git('config','user.email','test@example.test');
  const report=p.join(root,'state/board-discovery-report.json');fs.writeFileSync(report,JSON.stringify({summary:{at},new_roles:[{company:'Acme',title:'Quality Director',location:'Austin',url:'https://example.test/1'}]}));git('add','.');git('commit','-m','first');
  const first=U.collect(root,null),ledger=U.build({...first,rows:[],now}).ledger;assert.equal(first.coverage.newReportCommits,1);
  const same=U.collect(root,ledger);assert.equal(same.coverage.newReportCommits,0);assert.equal(same.records.length,0);assert.equal(U.build({...same,prior:ledger,rows:[],now}).summary.total,1);
  fs.writeFileSync(report,JSON.stringify({summary:{at:new Date(now).toISOString()},new_roles:[{company:'Acme',title:'Plant Manager',location:'Austin',url:'https://example.test/2'}]}));git('add','.');git('commit','-m','second');const next=U.collect(root,ledger);assert.equal(next.coverage.newReportCommits,1);assert.equal(next.coverage.reportRevisions,2);assert.equal(U.build({...next,prior:ledger,rows:[],now}).summary.total,2);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
