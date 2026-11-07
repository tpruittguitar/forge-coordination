const {test}=require('node:test'),a=require('node:assert/strict'),R=require('./recovery');const row={PRIMARY_ID:'x',COMPANY:'Acme',TITLE:'Director Quality',LOCATION:'Dayton, OH',p:{SOURCE_URL:'https://email.example.org/track',LIVENESS_EVIDENCE_URL:'https://careers.acme.com/job/1'}};
test('use saved posting links before tracking links and never trust identity candidates',()=>{a.equal(R.urls(row)[0],'https://careers.acme.com/job/1');a.deepEqual(R.urls({...row,p:{IDENTITY_CANDIDATE_URLS:'https://other.com/job'}}),[]);});
test('failed reads rotate behind never-attempted rows; changed evidence wakes immediately',()=>{const l={},now=Date.now();R.remember(l,row,'DEGREE','UNREADABLE',[],now);a.equal(R.due(row,'DEGREE',l,now+1000),false);a.equal(R.due(row,'SALARY,DEGREE',l,now+1000),true);a.equal(R.due({...row,p:{...row.p,DIRECT_JOB_URL:'https://acme.com/new'}},'DEGREE',l,now+1000),true);a.equal(R.order([row,{...row,PRIMARY_ID:'new'}],l)[0].PRIMARY_ID,'new');});
test('full posting evidence is reused for seven days only for the same job identity',()=>{const l={},now=Date.now();R.saveEvidence(l,row,'https://acme.com/job',{text:'Bachelor degree required.',pay:null,identityVerified:true,sourceIdentity:{company:row.COMPANY,title:row.TITLE,location:row.LOCATION}},now);a.equal(R.cached(l,row,now+1000).degree.req,'REQUIRED');a.equal(R.cached(l,{...row,TITLE:'Engineer'},now+1000),null);a.equal(R.cached(l,row,now+8*86400000),null);});
test('an ATS posting must bind exact title, employer, posting ID and location',()=>{const api={kind:'greenhouse',page:'https://job-boards.greenhouse.io/acme/jobs/123'},data={id:123,title:row.TITLE,location:{name:row.LOCATION},content:'Lead quality operations. '.repeat(20)+'Bachelor degree required.'};a.equal(R.exactApi(row,api,data).identityVerified,true);for(const change of [x=>x.title='Engineer',x=>x.location.name='Austin, TX',x=>x.id=124]){const bad=structuredClone(data);change(bad);a.equal(R.exactApi(row,api,bad),null);}a.equal(R.exactApi({...row,COMPANY:'Other'},api,data),null);});
test('known employer board can recover only a unique exact title and site',()=>{const p={title:'Director Quality',location:'Dayton, OH',page:'https://acme.com/job'};a.equal(R.boardMatch(row,[p]),p);a.equal(R.boardMatch(row,[p,p]),null);a.equal(R.boardMatch(row,[{...p,location:'Akron, OH'}]),null);});
test('disabled Indeed search links and tracking wrappers become research exceptions, not repeated HTTP calls',()=>{a.equal(R.readableRoute('https://www.indeed.com/jobs?q=Director',['indeed']),false);a.equal(R.readableRoute('https://email.lensa.com/f/a/x',[]),false);a.equal(R.readableRoute('https://careers.acme.com/job/1',['indeed']),true);});

test('Recruitics target is recovered before tracking, including clipped Meta query tails',()=>{
 const direct='https://www.metacareers.com/jobs/1065958456320572/',wrapped='https://jsv3.recruitics.com/redirect?rx_jobId=a1KiE00000019qrUAA&rx_url='+encodeURIComponent(direct+'?rx_a=0&rx_ts=2026');
 const urls=R.urls({p:{SOURCE_URL:wrapped}});a.equal(urls[0],direct);a.equal(R.readableRoute(wrapped),false);
 a.equal(R.urls({p:{SOURCE_URL:wrapped.replace('jsv3.recruitics.com','recruitics.com.other.example')}}).includes(direct),false);
 a.equal(R.urls({p:{SOURCE_URL:'https://jsv3.recruitics.com/redirect?rx_url='+encodeURIComponent('http://127.0.0.1/private')}}).length,1);
});
test('cross-store reuse keeps original pay and separate freshest full-posting degree provenance',()=>{
 const old={at:'2026-10-01T00:00:00Z',url:'https://acme.com/old',pay:{low:180000,high:220000},basis:'EMPLOYER_POSTED',fullPosting:false},fresh={at:'2026-11-07T00:00:00Z',url:'https://acme.com/new',pay:null,text:'Bachelor degree required.',degree:{req:'REQUIRED',text:'Bachelor degree required.'},fullPosting:true},before=JSON.stringify([old,fresh]);
 const got=R.combine(fresh,old);a.equal(got.pay.low,180000);a.equal(got.at,old.at);a.equal(got.url,old.url);a.equal(got.degreeAt,fresh.at);a.equal(got.degreeUrl,fresh.url);a.equal(got.degree.req,'REQUIRED');a.equal(JSON.stringify([old,fresh]),before);
 a.equal(R.combine({...fresh,text:'Manage budgets of $100,000-$150,000. Salary details are available on request.'},old).pay.low,180000);
 for(const change of [{postedPay:{status:'POSTED',low:150000,high:170000}},{postedPay:{status:'POSTED',currency:'CAD'}},{text:'Annual base salary USD $150,000-$170,000.'},{text:'Annual base salary CAD $180,000-$220,000.'},{text:'Hourly base pay USD $55-$75.'},{text:'Total compensation USD $180,000-$220,000 including bonuses.'}]){const out=R.combine({...fresh,...change},old);a.equal(out.pay,null,JSON.stringify(change));a.equal(out.payAmbiguous,true);}
 a.equal(R.combine({...fresh,pay:{low:200000,high:240000},basis:'EMPLOYER_POSTED'},old).pay.low,200000);
});
test('old cache reparse never infers USD from US location',()=>{
 const now=Date.now(),e={identity:JSON.stringify([row.COMPANY,row.TITLE,row.LOCATION]),at:new Date(now-1000).toISOString(),fullPosting:true,identityVerified:true,sourceIdentity:{company:row.COMPANY,title:row.TITLE,location:row.LOCATION},text:'Lead manufacturing quality operations. '.repeat(15)+'Annual base salary $180,000-$220,000.'};
 a.equal(R.cached({postingEvidence:{x:e}},row,now).pay,null);
 a.equal(R.cached({postingEvidence:{x:{...e,text:e.text.replace('salary $','salary USD $')}}},row,now).pay.low,180000);
});
test('fresh pay replaces retained pay only when changed, validated and posted',()=>{
 const current={low:180000,high:220000},fresh={pay:{low:190000,high:230000},identityVerified:true,basis:'EMPLOYER_POSTED'};
 a.equal(R.preferFreshPay(current,fresh),true);
 for(const parsed of [{...fresh,pay:current},{...fresh,pay:null},{...fresh,pay:{low:230000,high:190000}},{...fresh,basis:'THIRD_PARTY_ESTIMATE'},{...fresh,identityVerified:false}])a.equal(R.preferFreshPay(current,parsed),false);
});
