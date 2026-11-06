'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const F=require('./alert-formats.cjs'),R=require('./alert-recovery.cjs'),S=require('../programmed-coordinator/store.cjs'),U=require('../pipeline-observability/upstream-flow'),Q=require('../intake-drain/queue.cjs');
const at='2026-11-06T03:00:00Z';
function message(sender,body,htmlBody=''){return{id:'abc',fullBody:true,sender,body,htmlBody,at,sourceSha256:'a'.repeat(64)};}
function fixture(t){const root=fs.mkdtempSync(path.join(os.tmpdir(),'alert-layout-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));return root;}
const indeed='Indeed Job Alert\n\nDirector of Quality\nEquipment Company - Austin, TX\n$170,000 - $210,000 a year\nEasily apply\nLead manufacturing quality.\nJust posted\nhttps://www.indeed.com/rc/clk/dl?jk=1234567890abcdef&qd=private-personalized-value\n\nPlant Manager\nAnother Company - Dallas, TX\nBuild production systems.\nhttps://www.indeed.com/pagead/clk/dl?ad=private-ad-handle';
function glass(title='Quality Manager',company='Equipment Company',id='100001'){
 return '<a href="https://www.glassdoor.com/partner/jobListing.htm?jobListingId='+id+'&amp;guid=private"><table><span></span><span><span>'+company+'</span><span>4.2 ★</span></span><p>'+title+'</p><p>Nashville, TN</p><p>$60K (Employer est.)</p><p>5d</p></table></a>';
}
function submarine(title,company,location,id){return '<div style="padding:0 0 20px;border-bottom:1px solid gray"><div><strong><a class="alert-link" href="https://jobs.buildsubmarines.com/job_activities/track?data=private&amp;redirect_url='+encodeURIComponent('https://jobs.buildsubmarines.com/jobs/'+id+'-quality-manager')+'">'+title+'</a></strong></div><div><span><strong>'+company+'</strong></span> - <span>'+location+'</span></div><div style="margin:6px 0 10px">Lead quality across manufacturing operations.</div><a class="alert-button" href="https://jobs.buildsubmarines.com/">View Details</a></div>';}
test('observed Indeed plain layout preserves exact card facts, canonical jk and unresolved sponsored cards',t=>{
 const m=message('donotreply@jobalert.indeed.com',indeed),f=F.extract(m);a.equal(f.cards.length,2);a.deepEqual(f.pending,[]);
 a.equal(f.cards[0].url,'https://www.indeed.com/viewjob?jk=1234567890abcdef');a.equal(f.cards[0].company,'Equipment Company');a.equal(f.cards[1].url,null);a.equal(f.cards[1].jobId,null);
 const root=fixture(t);a.equal(R.recover(root,m).recovered,2);const l=S.read(root,'state/EMAIL_RECOVERY_QUEUE.json');
 a.ok(l.jobs['indeed:1234567890abcdef']);const opaque=Object.values(l.jobs).find(j=>!j.url);a.ok(opaque.key.startsWith('alert-card:'));a.equal(opaque.sourceRecovery.owner,'FORGE_INTAKE_SOURCE_RECOVERY');
 a.equal(opaque.discoveryReview.fullPosting,false);a.equal(l.sources.abc.historicalCoverage,'UNPROVEN');a.equal(JSON.stringify(l).includes('private-personalized-value'),false);a.equal(JSON.stringify(l).includes('private-ad-handle'),false);
 a.equal(l.jobs['indeed:1234567890abcdef'].description.includes('manufacturing quality'),true);a.equal(l.jobs['indeed:1234567890abcdef'].SALARY_BASE_LOW,undefined);
});
test('observed Glassdoor card anchor keeps employer separate from title, rating and location',()=>{
 const f=F.extract(message('info@glassdoor.com','Job alert: quality',glass()));a.equal(f.cards.length,1);a.equal(f.cards[0].company,'Equipment Company');a.equal(f.cards[0].title,'Quality Manager');a.equal(f.cards[0].location,'Nashville, TN');a.equal(f.cards[0].jobId,'100001');a.equal(f.cards[0].url,'https://www.glassdoor.com/partner/jobListing.htm?jobListingId=100001');
 a.equal(F.extract(message('info@glassdoor.com','Job alert',glass('Quality Manager','3M'))).cards[0].company,'3M');
});
test('Glassdoor match plain link requires exact HTML paragraph identity before retaining its listing ID',()=>{
 const link='https://www.glassdoor.com/recruiter/link/matches?matchId=private&jobListingId=100002';
 const body='Top job matches\n\nEquipment Company\nDirector of Manufacturing\nFort Wayne, IN\n$153K - $261K/yr (Employer est.)\n75%\nGreat job match\n'+link;
 const html='<p>Equipment Company</p><p>Director of Manufacturing</p><p>Fort Wayne, IN</p>';
 const m={...message('info@glassdoor.com',body,html),links:[link]},f=F.extract(m);a.equal(f.cards.length,1);a.equal(f.cards[0].company,'Equipment Company');a.equal(f.cards[0].title,'Director of Manufacturing');a.equal(f.cards[0].jobId,'100002');
 a.equal(F.extract({...m,htmlBody:html.replace('Equipment Company','Different Company')}).cards.length,0);
});
test('observed BuildSubmarines layout uses only the explicit same-provider redirect destination',()=>{
 const body=submarine('Quality Manager','Component Company','Piqua, OH, United States','637720138');const f=F.extract(message('jobs@updates.buildsubmarines.com',body));a.equal(f.cards.length,1);a.equal(f.cards[0].company,'Component Company');a.equal(f.cards[0].jobId,'637720138');a.equal(f.cards[0].url,'https://jobs.buildsubmarines.com/jobs/637720138-quality-manager');
 a.equal(F.publicJob('BUILD_SUBMARINES','https://jobs.buildsubmarines.com/job_activities/track?redirect_url=https%3A%2F%2Fevil.example%2Fjobs%2F1'),null);
});
test('observed Ladders layout preserves opaque-link facts without persisting or following tracking links',t=>{
 const html='<a class="mobileLink" href="https://t.ladders.co/f/a/private-token">Vice President/Branch Manager</a><a href="https://t.ladders.co/f/a/private-token"><span id="jobs-company-container">Equipment Company&nbsp;|&nbsp;Tampa, FL&nbsp;|&nbsp;$225K - $300K*</span></a>';
 const m=message('jobs@my.theladders.com','Saved Search Alert',html),root=fixture(t);R.recover(root,m);const l=S.read(root,'state/EMAIL_RECOVERY_QUEUE.json'),j=Object.values(l.jobs)[0];a.equal(j.title,'Vice President/Branch Manager');a.equal(j.location,'Tampa, FL');a.equal(j.url,null);a.equal(j.jobId,null);a.equal(JSON.stringify(l).includes('private-token'),false);
 const records=Object.values(l.jobs).map(j=>U.candidate(j,j.observedAt,'EMAIL_RECOVERY')),up=U.build({records,rows:[],now:Date.parse(at)});S.save(root,'state/UPSTREAM_LEDGER.json',up.ledger);
 const work=Q.sync(root,{now:Date.parse(at)}),item=Object.values(work.items)[0];a.equal(item.action,'RECOVER_SOURCE');a.equal(item.taskKey,'FORGE_INTAKE_SOURCE_RECOVERY');a.equal(item.card.url,'');a.equal(item.canonicalCompletion,false);a.ok(item.discoveryReview.sourceProof.includes(j.key));
});
test('Ladders alternate title, salary and company anchors retain separate meanings',()=>{
 const html='<a href="https://t.ladders.co/opaque">Remote</a><a href="https://t.ladders.co/title">Director, Application &amp; Technical Service</a><a href="https://t.ladders.co/pay">$135K - $160K*</a><a href="https://t.ladders.co/company"><span id="jobs-company-container">Equipment Company&nbsp;|&nbsp;Virtual / Travel</span></a>';
 const f=F.extract(message('jobs@my.theladders.com','Jobs that Pay More than You Make Now',html));a.equal(f.cards.length,1);a.equal(f.cards[0].title,'Director, Application & Technical Service');a.equal(f.cards[0].company,'Equipment Company');a.equal(f.cards[0].location,'Virtual / Travel');a.equal(f.cards[0].description,'$135K - $160K*');a.equal(f.cards[0].url,null);
});
test('one incomplete card stays pending while unrelated exact cards are recovered',t=>{
 const html=submarine('Quality Manager','','Piqua, OH','637720138')+submarine('Plant Manager','Equipment Company','Austin, TX','637720139');
 const m=message('jobs@updates.buildsubmarines.com',html),f=F.extract(m);a.equal(f.cards.length,1);a.equal(f.cards[0].jobId,'637720139');a.equal(f.pending.length,1);
 const root=fixture(t);S.save(root,'state/MAIL_SOURCE_HANDOFFS.json',{messages:{abc:{classification:'JOB_ALERT'}}});R.recover(root,m);a.throws(()=>R.handoff(root,m),/ALERT_CARD_SOURCE_RESEARCH_REQUIRED/);a.equal(Object.keys(S.read(root,'state/EMAIL_RECOVERY_QUEUE.json').jobs).length,1);a.equal(S.read(root,'state/MAIL_SOURCE_HANDOFFS.json').messages.abc.status,'PENDING_SOURCE_ACCOUNTING');
});
test('BuildSubmarines missing identity never borrows from an adjacent unstyled card',()=>{
 const first='<div><a class="alert-link" href="https://jobs.buildsubmarines.com/jobs/111111-first">Quality Manager</a></div>';
 const second='<div><a class="alert-link" href="https://jobs.buildsubmarines.com/jobs/222222-second">Plant Manager</a><div><span><strong>Second Company</strong></span> - <span>Austin, TX</span></div></div>';
 const f=F.extract(message('jobs@updates.buildsubmarines.com',first+second));a.equal(f.cards.length,1);a.equal(f.cards[0].jobId,'222222');a.equal(f.cards[0].company,'Second Company');a.equal(f.pending.length,1);
});
test('Glassdoor missing location cannot turn salary text or a prior card into identity',()=>{
 const partial='<a href="https://www.glassdoor.com/partner/jobListing.htm?jobListingId=111"><span>First Company</span><p>Quality Manager</p><p>$150K - $200K</p></a>';
 const f=F.extract(message('info@glassdoor.com','Job alert',partial+glass('Plant Manager','Second Company','222')));a.equal(f.cards.length,1);a.equal(f.cards[0].jobId,'222');a.equal(f.pending.length,1);
 const first='https://www.glassdoor.com/recruiter/link/matches?jobListingId=333',second='https://www.glassdoor.com/recruiter/link/matches?jobListingId=444';
 const plain='First Company\nQuality Manager\nAustin, TX\n'+first+'\nSecond Company\nPlant Manager\n'+second;
 const h='<p>First Company</p><p>Quality Manager</p><p>Austin, TX</p><p>Second Company</p><p>Plant Manager</p>';
 const fallback=F.extract({...message('info@glassdoor.com',plain,h),links:[first,second]});a.equal(fallback.cards.length,1);a.equal(fallback.cards[0].jobId,'333');a.equal(fallback.pending.length,1);
});
test('Ladders missing title or company cannot borrow an adjacent card identity',()=>{
 const known='<a class="mobileLink" href="https://t.ladders.co/first">First Director</a><a href="https://t.ladders.co/co"><span id="jobs-company-container">First Company | Austin, TX</span></a>';
 const missingTitle='<a href="https://t.ladders.co/second"><span id="jobs-company-container">Second Company | Dallas, TX</span></a>';
 const missingCompany='<a class="mobileLink" href="https://t.ladders.co/third">Third Director</a>';
 const f=F.extract(message('jobs@my.theladders.com','Saved search',known+missingTitle+missingCompany));a.equal(f.cards.length,1);a.equal(f.cards[0].company,'First Company');a.equal(f.pending.length,2);
});
test('Indeed incomplete identity stays within its source paragraph and cannot borrow the next job',()=>{
 const partial='Indeed Job Alert\n\nQuality Manager\nMissing company and location\nhttps://www.indeed.com/viewjob?jk=1111111111111111\n\n';
 const known='Plant Manager\nSecond Company - Austin, TX\nhttps://www.indeed.com/viewjob?jk=2222222222222222';
 const f=F.extract(message('donotreply@jobalert.indeed.com',partial+known));a.equal(f.cards.length,1);a.equal(f.cards[0].jobId,'2222222222222222');a.equal(f.pending.length,1);
});
test('duplicate or contradictory URLs never select an arbitrary identity',()=>{
 const equal=F.extract(message('info@glassdoor.com','Job alert',glass()+glass()));a.equal(equal.cards.length,1);a.equal(equal.pending.length,0);
 const conflict=F.extract(message('info@glassdoor.com','Job alert',glass()+glass('Quality Manager','Different Company')));a.equal(conflict.cards.length,0);a.equal(conflict.pending[0].reason,'CONFLICTING_ALERT_CARD_IDENTITY');
});
test('incomplete sources and unknown senders cannot create candidate facts',()=>{a.equal(F.extract({...message('info@glassdoor.com','Job alert',glass()),fullBody:false}),null);a.equal(F.extract(message('person@example.com','Job alert',glass())),null);});
test('candidate capture is idempotent and cannot overwrite protected dispositions',t=>{
 const root=fixture(t),m=message('info@glassdoor.com','Job alert',glass());R.recover(root,m);const l=S.read(root,'state/EMAIL_RECOVERY_QUEUE.json'),j=Object.values(l.jobs)[0];j.status='VERIFIED_EXISTING';j.disposition={proof:'retained',reason:'Exact job'};delete l.sources.abc.originalAlertRecovery;S.save(root,'state/EMAIL_RECOVERY_QUEUE.json',l);
 R.recover(root,m);const after=S.read(root,'state/EMAIL_RECOVERY_QUEUE.json');a.equal(Object.values(after.jobs)[0].status,'VERIFIED_EXISTING');a.equal(Object.values(after.jobs)[0].evidence.length,1);a.equal(R.recover(root,m).duplicate,true);
});
