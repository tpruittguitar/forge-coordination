const {test}=require('node:test'),assert=require('node:assert/strict'),U=require('./upstream-flow');
const now=Date.parse('2026-10-31T06:00:00Z'),at=new Date(now-3600000).toISOString();const c=(id,status='NEW')=>U.candidate({company:'Acme',title:'Quality Director',location:'Austin',url:'https://www.linkedin.com/jobs/view/'+id+'/',status},at,'fixture');const row={PRIMARY_ID:'V2I-ONE',COMPANY:'Acme',TITLE:'Quality Director',LOCATION:'Austin',p:{SOURCE_URL:'https://www.linkedin.com/jobs/view/123/',MASTER_LOADED_AT:at}};
test('source and admission windows use their actual timestamps and deduplicate archive copies',()=>{const records=[],rows=[];for(const [i,age] of [1,7,13,25,36].entries()){const stamp=new Date(now-age*3600000).toISOString();records.push({...c(100+i),firstSeen:stamp});rows.push({...row,PRIMARY_ID:'id'+i,p:{SOURCE_URL:'https://www.linkedin.com/jobs/view/'+(100+i)+'/',MASTER_LOADED_AT:stamp}});}const w=U.build({records,rows,archive:[rows[0]],now}).summary.ratesByWindow;for(const [h,n] of [[6,1],[12,2],[24,3],[36,4]]){assert.equal(w[h].intake.count,n);assert.equal(w[h].discovery.count,n);assert.equal(w[h].intake.perHour,n/h);}});
test('source repeats collapse, aliases share one canonical job, archive prevents new backlog',()=>{const a=c(123),b={...U.candidate({company:'Acme',title:'Quality Director',location:'Austin',url:'https://employer.example/job/123'},at,'fixture'),primaryId:'V2I-ONE'};const j=U.build({records:[a,a,b],rows:[],archive:[row],now}).summary;assert.equal(j.total,1);assert.equal(j.sourceIdentities,2);assert.equal(j.aliasesMerged,1);assert.equal(j.counts.PRESENT,1);assert.equal(j.waiting,0);assert.equal(j.rates.intake.count,1);});
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
  const legacy=U.collect(root,{...ledger,reportHistory:{...ledger.reportHistory,schema:'forge.discovery-report-history.v1'}});assert.equal(legacy.coverage.newReportCommits,1);assert.equal(legacy.records.length,1);assert.equal(legacy.reportHistory.schema,'forge.discovery-report-history.v2');
  fs.writeFileSync(report,JSON.stringify({summary:{at:new Date(now).toISOString()},new_roles:[{company:'Acme',title:'Plant Manager',location:'Austin',url:'https://example.test/2'}]}));git('add','.');git('commit','-m','second');const next=U.collect(root,ledger);assert.equal(next.coverage.newReportCommits,1);assert.equal(next.coverage.reportRevisions,2);assert.equal(U.build({...next,prior:ledger,rows:[],now}).summary.total,2);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('source-bound posted salary survives candidate and durable upstream representation',()=>{const P=require('../source-trial/posted-pay'),r={company:'Acme',title:'Quality Director',location:'Austin',url:'https://www.linkedin.com/jobs/view/123/',source:'JOBSPY:linkedin',pay:'$180K-$220K',payFacts:{low:180125,high:220875,currency:'USD',period:'YEAR',basis:'BASE',source:'EXPLICIT_ANNUAL_BASE_TEXT'}};r.postedPay=P.capture(r,{observedAt:at});const candidate=U.candidate(r,at,'fixture'),result=U.build({records:[candidate],rows:[],now}),entry=result.ledger.entries[candidate.key];assert.equal(entry.payFacts.low,180125);assert.deepEqual(entry.postedPay,r.postedPay);const again=U.build({records:[],rows:[],prior:result.ledger,now:now+60000});assert.deepEqual(again.ledger.entries[candidate.key].postedPay,r.postedPay);});
test('legacy rounded source salary becomes bound disclosure without invented exact amounts or units',()=>{const r={company:'Acme',title:'Quality Director',location:'Austin',url:'https://www.linkedin.com/jobs/view/123/',source:'JOBSPY:linkedin',pay:'$180K-$220K'};const candidate=U.candidate(r,at,'fixture');assert.equal(candidate.postedPay.status,'POSTED');assert.equal(candidate.postedPay.text,r.pay);assert.equal(candidate.postedPay.low,null);assert.equal(candidate.postedPay.currency,null);assert.equal(candidate.postedPay.period,null);assert.equal(candidate.postedPay.observedAt,at);assert.equal(candidate.payFacts,undefined);});
test('historical bound email quote and original alert description reach upstream without replaying capture',()=>{const P=require('../source-trial/posted-pay'),r={company:'Acme',title:'Liaison Engineer',location:'Stuart, FL',url:'https://www.indeed.com/viewjob?jk=abc123',observedAt:at,description:'$71,300 - $95,000 a year Provide hands-on support.',discoveryReview:{contentBasis:'EXACT_ORIGINAL_ALERT_CARD',fullPosting:false}};for(const card of [r,{...r,description:'',sourcePayEvidence:[{quote:r.description,sourceUrl:r.url,observedAt:at,classification:'EXACT_SOURCE_QUOTE_NOT_EMPLOYER_VERIFIED'}]}]){const c=U.candidate(card,new Date(now).toISOString(),'state/EMAIL_RECOVERY_QUEUE.json');assert.equal(c.postedPay.low,71300);assert.equal(c.postedPay.observedAt,at);assert.equal(P.eligible(c),null);const e=U.build({records:[c],rows:[],now}).ledger.entries[c.key];assert.equal(e.postedPay.high,95000);}});

test('existing/protected normalization removes stale discovery holds without changing canonical rows',()=>{
 const canonical={PRIMARY_ID:'V2I-AESC',COMPANY:'AESC Group',TITLE:'Sr. Manager Operations',LOCATION:'Florence, SC',REQ_ID:'UNCAPTURED',BUCKET:'APPLIED',p:{SOURCE_URL:'https://www.indeed.com/viewjob?jk=original'}},source=U.candidate({company:'AESC',title:'Senior Manager Operations',location:'Florence, SC, USA',url:'https://jobs.aesc-group.com/jobs/1129',status:'EXISTING_PROTECTED'},at,'fixture');
 const before=U.build({records:[source],rows:[],now}),original=JSON.stringify(canonical),out=U.build({records:[],rows:[canonical],prior:before.ledger,now:now+60000});
 assert.equal(before.summary.counts.HELD,1);assert.equal(out.summary.waiting,0);assert.equal(out.summary.reconciliation.admitted,1);assert.equal(out.summary.reconciled,true);assert.equal(out.ledger.entries[source.key].status,'PRESENT');assert.equal(out.ledger.entries[source.key].canonicalMatch.primaryId,canonical.PRIMARY_ID);assert.equal(JSON.stringify(canonical),original);
 const queues=require('./waiting-queues').build({states:{},queues:{enrichment:0,readyForReview:0}},out,out.ledger.at);assert.equal(queues.index.counts.intake,0);
});
test('canonical conflict stays held even with matching URL or claimed primary ID',()=>{
 for(const extra of [{location:'Dallas, TX'},{title:'Different role'},{company:'Different Employer'},{REQ_ID:'R-2'}]){
  const source=U.candidate({company:'Acme',title:'Quality Director',location:'Austin, TX',url:row.p.SOURCE_URL,primaryId:row.PRIMARY_ID,REQ_ID:'R-1',...extra},at,'fixture');
  const out=U.build({records:[source],rows:[{...row,LOCATION:'Austin, TX',REQ_ID:'R-1'}],now});assert.equal(out.summary.counts.PRESENT,0);assert.equal(out.summary.counts.IDENTITY_HOLD,1);
 }
});
test('archive aliases use the same exact normalized matcher without resurrection',()=>{
 const source=U.candidate({company:'Acme LLC',title:'Senior Quality Director',location:'Austin, Texas, United States',url:'https://example.test/source',status:'EXISTING_PROTECTED'},at,'fixture'),canonical={...row,TITLE:'Sr. Quality Director',LOCATION:'Austin, TX',ARCHIVED_TERMINAL:true};
 const out=U.build({records:[source],rows:[],archive:[canonical],now});assert.equal(out.summary.counts.PRESENT,1);assert.equal(out.summary.waiting,0);assert.equal(out.summary.coverage.masterRows,0);
});


test('scope and additional posting identities survive capture, ledger persistence and rollover',()=>{
 const original={company:'Acme',title:'Quality Director',location:'Austin, TX',url:'https://example.test/scope',p:{OPERATING_SCOPE:'LOCATION_OPEN',REMOTE_HYBRID:'Hybrid',ATS_POSTING_URL:'https://example.test/ats/555',REQ_ID:'EMPLOYER-555'}};
 const source=U.candidate(original,at,'fixture'),canonical={...row,LOCATION:'Austin, TX',REQ_ID:'UNKNOWN',p:{}};
 assert.equal(source.OPERATING_SCOPE,'LOCATION_OPEN');assert.equal(source.ATS_POSTING_URL,original.p.ATS_POSTING_URL);
 const first=U.build({records:[source],rows:[canonical],now});assert.equal(first.summary.counts.IDENTITY_HOLD,1);
 const again=U.build({records:[],rows:[canonical],prior:first.ledger,now:now+60000});assert.equal(again.summary.counts.IDENTITY_HOLD,1);assert.equal(again.ledger.entries[source.key].REQ_ID,'EMPLOYER-555');
 const strong={...canonical,REQ_ID:'EMPLOYER-555',p:{SOURCE_URL:original.p.ATS_POSTING_URL}};
 assert.equal(U.build({records:[],rows:[strong],prior:first.ledger,now:now+60000}).summary.counts.PRESENT,1);
});

test('report order never lets old narrow scope overwrite newer location-open evidence',()=>{
 const base={company:'Acme',title:'Quality Director',location:'Austin, TX',url:'https://example.test/scope-order'},canonical={...row,LOCATION:'Austin, TX',p:{}};
 const older=U.candidate({...base,OPERATING_SCOPE:'SINGLE_FACILITY',REQ_ID:'OLD-REQ'},'2026-11-01T00:00:00Z','old-report');
 const newer=U.candidate({...base,OPERATING_SCOPE:'LOCATION_OPEN',REQ_ID:'NEW-REQ'},'2026-11-07T00:00:00Z','new-report');
 for(const records of [[newer,older],[older,newer]]){
  const result=U.build({records,rows:[canonical],now}),entry=result.ledger.entries[newer.key];
  assert.equal(entry.OPERATING_SCOPE,'LOCATION_OPEN');assert.equal(entry.REQ_ID,'NEW-REQ');assert.equal(entry.reqId,'NEW-REQ');assert.equal(result.summary.counts.IDENTITY_HOLD,1);
  const rollover=U.build({records:[older],rows:[canonical],prior:result.ledger,now});assert.equal(rollover.ledger.entries[newer.key].OPERATING_SCOPE,'LOCATION_OPEN');
  const omitted=U.candidate(base,'2026-11-08T00:00:00Z','later-incomplete');assert.equal(U.build({records:[omitted],rows:[canonical],prior:result.ledger,now}).ledger.entries[newer.key].OPERATING_SCOPE,'LOCATION_OPEN');
 }
});
test('equally timed conflicting source evidence holds instead of choosing iteration order',()=>{
 const base={company:'Acme',title:'Quality Director',location:'Austin, TX',url:row.p.SOURCE_URL};
 const a=U.candidate({...base,OPERATING_SCOPE:'LOCATION_OPEN'},at,'one'),b=U.candidate({...base,OPERATING_SCOPE:'SINGLE_FACILITY'},at,'two');
 for(const records of [[a,b],[b,a]]){const out=U.build({records,rows:[{...row,LOCATION:'Austin, TX'}],now});assert.equal(out.summary.counts.IDENTITY_HOLD,1);assert.equal(out.ledger.entries[a.key].IDENTITY_EVIDENCE_CONFLICT,'scope');}
});
test('same company, normalized title and explicit location is excluded and the existing row stays occurrence #1',()=>{
 const kept={PRIMARY_ID:'V2I-HOWMET00001',COMPANY:'Howmet',TITLE:'VP of Operations',LOCATION:'Morristown, TN',p:{SOURCE_URL:'https://example.test/howmet/tn'}};
 const later={PRIMARY_ID:'V2I-HOWMET00002',COMPANY:'Howmet',TITLE:'Vice President of Operations',LOCATION:'Morristown, Tennessee',p:{SOURCE_URL:'https://example.test/howmet/tn-2'}};
 const source=U.candidate({company:'Howmet',title:'Vice President of Operations (m/f/d)',location:'Morristown, TN (m/f/d)',url:'https://example.test/howmet/again'},at,'fixture');
 const before=JSON.stringify([kept,later]),out=U.build({records:[source],rows:[later,kept],now}),entry=out.ledger.entries[source.key];
 assert.equal(entry.status,'EXCLUDED');assert.equal(entry.primaryId,undefined);assert.equal(out.summary.counts.IDENTITY_HOLD,0);assert.equal(out.summary.counts.PRESENT,0);assert.equal(out.summary.counts.EXCLUDED,1);assert.equal(JSON.stringify([kept,later]),before);
});
test('VP and Vice President are the same title, and a trailing parenthetical is stripped',()=>{
 const master={PRIMARY_ID:'V2I-TITLE',COMPANY:'Howmet',TITLE:'Plant Manager',LOCATION:'Knoxville, TN',p:{SOURCE_URL:'https://example.test/howmet/title'}};
 const source=U.candidate({company:'Howmet',title:'VP of Operations (m/f/d)',location:'Knoxville, Tennessee (m/f/d)',url:'https://example.test/howmet/vp'},at,'fixture');
 assert.equal(U.build({records:[source],rows:[{...master,TITLE:'Vice President of Operations'}],now}).summary.counts.EXCLUDED,1);
 const paren=U.candidate({company:'Howmet',title:'Plant Manager (m/f/d)',location:'Knoxville, TN',url:'https://example.test/howmet/paren'},at,'fixture');
 assert.equal(U.build({records:[paren],rows:[master],now}).ledger.entries[paren.key].status,'EXCLUDED');
});
test('two explicit different locations stay distinct, and unresolved or conflicting posting identities stay held',()=>{
 const tennessee={PRIMARY_ID:'V2I-HOWMET-TN',COMPANY:'Howmet',TITLE:'VP of Operations',LOCATION:'Morristown, TN',p:{SOURCE_URL:'https://www.linkedin.com/jobs/view/1111111111/'}};
 const indiana=U.candidate({company:'Howmet',title:'Vice President of Operations',location:'La Porte, IN',url:'https://example.test/howmet/in'},at,'fixture');
 const distinct=U.build({records:[indiana],rows:[tennessee],now});assert.equal(distinct.summary.counts.WAITING,1);assert.equal(distinct.summary.counts.EXCLUDED,0);assert.equal(distinct.summary.counts.IDENTITY_HOLD,0);
 const unresolved=U.candidate({company:'Howmet',title:'VP of Operations',location:'Tennessee',url:'https://example.test/howmet/state'},at,'fixture');
 assert.equal(U.build({records:[unresolved],rows:[tennessee],now}).summary.counts.IDENTITY_HOLD,1);
 const conflict=U.candidate({company:'Howmet',title:'VP of Operations',location:'Morristown, TN',url:'https://www.linkedin.com/jobs/view/2222222222/',REQ_ID:'GH-2222222222'},at,'fixture');
 const held=U.build({records:[conflict],rows:[{...tennessee,REQ_ID:'GH-1111111111',p:{SOURCE_URL:'https://job-boards.greenhouse.io/howmet/jobs/1111111111'}}],now});
 assert.equal(held.summary.counts.IDENTITY_HOLD,1);assert.equal(held.summary.counts.EXCLUDED,0);
});
test('missing or placeholder company or location leaves the backlog; a missing title or non-https URL does not',()=>{
 const missing=U.candidate({company:'Howmet',title:'VP of Operations',location:'',url:'https://example.test/howmet/noloc'},at,'fixture');
 assert.equal(U.build({records:[missing],rows:[],now}).ledger.entries[missing.key].status,'EXCLUDED');
 const placeholder=U.candidate({company:'CONFIDENTIAL',title:'VP of Operations',location:'Nashville, TN',url:'https://example.test/howmet/noco'},at,'fixture');
 assert.equal(U.build({records:[placeholder],rows:[],now}).summary.counts.EXCLUDED,1);
 const http=U.candidate({company:'Howmet',title:'VP of Operations',location:'',url:'http://example.test/howmet/http'},at,'fixture');
 const httpOut=U.build({records:[http],rows:[],now});assert.equal(httpOut.ledger.entries[http.key].relevanceScreen.outcome,'HOLD_SOURCE_IDENTITY');assert.equal(httpOut.summary.counts.WAITING,1);
});
