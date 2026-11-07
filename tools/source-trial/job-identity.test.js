'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),I=require('./job-identity'),L=require('./lib');
const row={PRIMARY_ID:'V2I-ONE',COMPANY:'AESC Group',TITLE:'Sr. Manager Operations',LOCATION:'Florence, SC',REQ_ID:'UNCAPTURED',p:{SOURCE_URL:'https://www.indeed.com/viewjob?jk=original'}};
const card={company:'AESC',title:'Senior Manager Operations',location:'Florence, South Carolina, USA',url:'https://jobs.aesc-group.com/en_US/careers/JobDetail/Florence-Sr-Manager-Operations/1129'};
const match=(card,rows=[row])=>I.match(I.index(rows),card);
test('company suffix, senior abbreviation, punctuation and US suffix agree across discovery and observer',()=>{const r=match(card);a.equal(r.status,'PRESENT');a.equal(r.primaryId,row.PRIMARY_ID);a.deepEqual(r.basis,['COMPANY_TITLE_LOCATION']);a.equal(L.novelty(L.masterIndex([row]),card.company,card.title,card.url,card.location),'EXISTING');});
test('query-based postings keep identity and tracking-only variants collapse',()=>{a.notEqual(I.normUrl('https://www.indeed.com/viewjob?jk=one'),I.normUrl('https://www.indeed.com/viewjob?jk=two'));a.notEqual(I.normUrl('https://jobs.example/view?id=one'),I.normUrl('https://jobs.example/view?id=two'));a.equal(I.urlKey('https://www.linkedin.com/jobs/view/a-role-123?trk=mail'),'linkedin:123');a.equal(I.urlKey('https://example.com/job/1?utm_source=a'),I.urlKey('https://example.com/job/1'));a.notEqual(I.urlKey('https://evil-linkedin.com/jobs/view/123'),'linkedin:123');});
test('different known city, state and requisition never collapse through names',()=>{for(const extra of [{location:'Columbia, SC'},{location:'Florence, AL'},{REQ_ID:'R-2'}])a.notEqual(match({...card,...extra},[{...row,REQ_ID:'R-1'}]).status,'PRESENT');});
test('same exact URL cannot override contradictory employer, title, worksite or requisition',()=>{for(const extra of [{company:'Other'},{title:'Manager Maintenance'},{location:'Columbia, SC'},{REQ_ID:'R-2'}])a.equal(match({...card,url:row.p.SOURCE_URL,...extra},[{...row,REQ_ID:'R-1'}]).status,'AMBIGUOUS');});
test('claimed ID cannot bypass identity conflicts',()=>{a.equal(match({...card,primaryId:row.PRIMARY_ID,location:'Blythewood, SC'}).status,'AMBIGUOUS');a.equal(match({...card,primaryId:row.PRIMARY_ID}).status,'PRESENT');});
test('distinct canonical IDs with equal normalized fields stay ambiguous',()=>{a.equal(match(card,[row,{...row,PRIMARY_ID:'V2I-TWO'}]).status,'AMBIGUOUS');});
test('master and archive copies of same canonical ID collapse safely',()=>{a.equal(match(card,[row,{...row,ARCHIVED_TERMINAL:true}]).status,'PRESENT');a.equal(L.novelty(L.masterIndex([row,{...row,ARCHIVED_TERMINAL:true}]),card.company,card.title,card.url,card.location),'EXISTING_PROTECTED');});
test('unknown, state-only, country-only and multi-city locations are not sufficient without exact source identity',()=>{for(const location of ['', 'Unknown','SC','United States','Remote','Florence / Columbia, SC','Florence, SC; Columbia, SC'])a.notEqual(match({...card,location}).status,'PRESENT');});
test('unknown-location equality and title-only equality cannot falsely close a job',()=>{for(const location of ['', 'UNKNOWN','United States','Remote'])a.notEqual(match({...card,location},[{...row,LOCATION:location}]).status,'PRESENT');});
test('parenthetical shifts and specialties are not discarded from the title',()=>{a.equal(match({...card,title:'Sr. Manager Operations (2nd Shift)'}).status,'ABSENT');a.notEqual(I.normTitle('Manager (Quality)'),I.normTitle('Manager (Operations)'));});
test('placeholder requisitions are not identity evidence',()=>{for(const REQ_ID of ['-','N/A','UNKNOWN','UNCAPTURED','NOT_CAPTURED','UNVERIFIED','0'])a.equal(match({...card,REQ_ID,location:'Columbia, SC'},[{...row,REQ_ID}]).status,'ABSENT');});
test('employer ATS tokens survive URL path case and tracking, but not lookalike domains',()=>{const url='https://jobs.ashbyhq.com/Crusoe/773c2712-82cf-4464-837e-436e5965b6ba';const r={...row,REQ_ID:'773c2712-82cf-4464-837e-436e5965b6ba',p:{}};a.equal(match({...card,url},[r]).status,'PRESENT');a.equal(I.atsId('https://evil-jobs.ashbyhq.com/Crusoe/773c2712-82cf-4464-837e-436e5965b6ba'),'');});
test('different ATS requisitions at the same worksite remain distinct',()=>{a.equal(match({...card,url:'https://job-boards.greenhouse.io/aesc/jobs/222'},[{...row,p:{SOURCE_URL:'https://job-boards.greenhouse.io/aesc/jobs/111'}}]).status,'ABSENT');});
test('review and salary comparable URLs never prove presence',()=>{a.equal(match({...card,company:'Other',location:'Unknown',url:'https://example.com/comp'},[{...row,p:{SALARY_EVIDENCE_URL:'https://example.com/comp',CLAUDE_REVIEW_EVIDENCE_URL:'https://example.com/comp'}}]).status,'ABSENT');});
test('an exact saved source key remains usable when legacy entry lacks its URL',()=>{a.equal(match({...card,key:'indeed:original',url:'',location:''}).status,'PRESENT');});

test('explicit requisition cannot conflict with a known ATS-only identity',()=>{a.notEqual(match({...card,reqId:'222'},[{...row,p:{SOURCE_URL:'https://job-boards.greenhouse.io/aesc/jobs/111'}}]).status,'PRESENT');});
test('ATS numeric IDs are scoped to the board tenant',()=>{a.notEqual(match({...card,location:'',url:'https://job-boards.greenhouse.io/aesc-other/jobs/111'},[{...row,p:{SOURCE_URL:'https://job-boards.greenhouse.io/aesc/jobs/111'}}]).status,'PRESENT');});
test('strong posting identity disambiguates an unknown-location peer, weak names do not',()=>{
 const rows=[{...row,p:{SOURCE_URL:'https://example.com/1'}},{...row,PRIMARY_ID:'V2I-UNKNOWN',LOCATION:'UNKNOWN',p:{SOURCE_URL:'https://example.com/2'}}];
 a.equal(match({...card,url:'https://example.com/3'},rows).status,'AMBIGUOUS');a.equal(match({...card,url:'https://example.com/1'},rows).status,'PRESENT');
});
test('broad, foreign, city-only and unparsed locations need a source or requisition identity',()=>{for(const location of ['Remote, US','US Remote','Nationwide','Not specified','Canada','Austin','Multiple locations'])a.notEqual(match({...card,location},[{...row,LOCATION:location}]).status,'PRESENT');});
test('company normalization preserves divisions and meaningful internal words',()=>{a.notEqual(I.normCompany('Acme (Aviation)'),I.normCompany('Acme (Automotive)'));a.notEqual(I.normCompany('Co Pilot'),I.normCompany('Pilot'));a.equal(I.normCompany('The Acme Group, Inc.'),'acme');});
test('an absent claimed canonical ID cannot be silently remapped by names only',()=>{a.equal(match({...card,primaryId:'V2I-MISSING'}).status,'AMBIGUOUS');});
test('explicit former-name annotations do not change the current employer',()=>{a.equal(I.normCompany('Twenty-Six Defense (formerly Elbit Systems of America)'),I.normCompany('Twenty-Six Defense'));});
test('foreign worksite conflict is separate from sufficient precision for a weak match',()=>{for(const location of ['Paris, France','Toronto, ON, Canada','Berlin, Germany','Canada'])a.equal(match({...card,location,url:row.p.SOURCE_URL}).status,'AMBIGUOUS');a.equal(match({...card,location:'Florence',url:row.p.SOURCE_URL}).status,'PRESENT');});
test('common unambiguous title abbreviations and spelled-out words share one matcher',()=>{for(const [short,long]of [['Sr. Mgr. Mfg. Ops.','Senior Manager Manufacturing Operations'],['VP, Operations','Vice President Operations'],['S.V.P. Manufacturing','Senior Vice President Manufacturing'],['EVP Manufacturing','Executive Vice President Manufacturing'],['Dir. Manufacturing','Director Manufacturing'],['Jr. Manager','Junior Manager']]){a.equal(I.normTitle(short),I.normTitle(long));a.equal(match({...card,title:short},[{...row,TITLE:long}]).status,'PRESENT');}a.notEqual(I.normTitle('Sr. Manager'),I.normTitle('Manager'));a.notEqual(I.normTitle('Engineer'),I.normTitle('Engineering'));});
test('state abbreviations and names are case-insensitive, with or without US suffixes',()=>{for(const location of ['Florence, South Carolina','florence south carolina','Florence SC','florence sc','florence, sc, us','Florence, SC, U.S.','Florence, South Carolina, United States of America'])a.equal(match({...card,location}).status,'PRESENT',location);a.notEqual(match({...card,location:'Florence, Alabama'}).status,'PRESENT');});
test('different aggregator listing IDs need a shared employer requisition, not names/site only',()=>{
 for(const prefix of ['https://www.linkedin.com/jobs/view/','https://www.indeed.com/viewjob?jk=']){
  const r={...row,p:{SOURCE_URL:prefix+'12345678'}},c={...card,url:prefix+'23456789'};
  const weak=match(c,[r]);a.notEqual(weak.status,'PRESENT');a.ok(weak.basis.includes('CONFLICTING_POSTING_IDS'));a.equal(match({...c,REQ_ID:'REQ-77'},[{...r,REQ_ID:'REQ-77'}]).status,'PRESENT');a.notEqual(match({...c,primaryId:r.PRIMARY_ID},[r]).status,'PRESENT');
 }
});

test('common employer/title at clearly different single worksites is not the same no-replay fence',()=>{
 const original={COMPANY:'Howmet Aerospace',TITLE:'Manufacturing Manager',LOCATION:'La Porte, IN',SOURCE_URL:'https://www.indeed.com/viewjob?jk=82ab8121f9585ac6'};
 for(const location of ['Morristown, TN','Morristown, Tennessee, United States','morristown tn'])a.equal(I.fenceApplies({company:'Howmet Aerospace',title:'Mfg. Mgr.',location,url:'https://www.indeed.com/viewjob?jk=0abce625e44b2a5e'},original),false,location);
 for(const location of ['La Porte, Indiana','la porte in','Indianapolis, IN','UNKNOWN','Indiana','Remote','La Porte / Morristown, TN','Morristown Area, TN'])a.equal(I.fenceApplies({company:'Howmet Aerospace',title:'Manufacturing Manager',location,url:'https://other.example/job'},original),true,location);
});
test('same original source or requisition is never unfenced by changing its worksite',()=>{
 const original={COMPANY:'Howmet Aerospace',TITLE:'Manufacturing Manager',LOCATION:'La Porte, IN',SOURCE_URL:'https://www.indeed.com/viewjob?jk=82ab8121f9585ac6',REQ_ID:'REQ-123'};
 for(const c of [{SOURCE_URL:original.SOURCE_URL},{SOURCE_URL:'https://other.example/job',REQ_ID:'REQ-123'},{PRIMARY_ID:'V2I-ORIGINAL'}])a.equal(I.fenceApplies({COMPANY:original.COMPANY,TITLE:original.TITLE,LOCATION:'Morristown, TN',...c},{...original,PRIMARY_ID:'V2I-ORIGINAL'}),true);
 a.equal(I.fenceApplies({COMPANY:original.COMPANY,TITLE:original.TITLE,LOCATION:'Morristown, TN',SOURCE_URL:'https://other.example/job'}, {...original,REMOTE_HYBRID:'Remote'}),true);
});


test('location-open and explicit multisite scope preserve family fences on either side',()=>{
 const original={COMPANY:'Acme',TITLE:'Manufacturing Manager',LOCATION:'La Porte, IN'},candidate={COMPANY:'Acme',TITLE:'Manufacturing Manager',LOCATION:'Morristown, TN'};
 for(const extra of [{OPERATING_SCOPE:'MULTI_SITE'},{OPERATING_SCOPE:'MULTI_SITES'},{OPERATING_SCOPE:'MULTI_LOCATIONS'},{OPERATING_SCOPE:'MULTI_PLANT'},{OPERATING_SCOPE:'REGIONAL'},{REMOTE_HYBRID:'Hybrid'},{OPERATING_SCOPE_EVIDENCE:'Responsibility across facilities'},{OPERATING_SCOPE:'NATIONAL'}]){
  a.equal(I.fenceApplies({...candidate,...extra},original),true,JSON.stringify(extra));
  a.equal(I.fenceApplies(candidate,{...original,p:extra}),true,JSON.stringify(extra));
 }
 for(const TITLE of ['Manufacturing Manager (Location Open)','Regional Manufacturing Manager'])a.equal(I.fenceApplies({...candidate,TITLE},{...original,TITLE}),true,TITLE);
 for(const [location,other] of [['Merritt Island, FL','Space Coast, FL'],['Bellevue, WA','Seattle, WA']])a.equal(I.fenceApplies({...candidate,LOCATION:location},{...original,LOCATION:other}),true);
});


test('broad scope cannot prove presence or independence from only names and a board city',()=>{
 for(const extra of [{OPERATING_SCOPE:'LOCATION_OPEN'},{OPERATING_SCOPE:'MULTI_PLANT'},{OPERATING_SCOPE:'MULTI_SITE'},{REMOTE_HYBRID:'Remote'}])for(const location of [card.location,'Morristown, TN']){
  a.equal(match({...card,location},[{...row,p:{...row.p,...extra}}]).status,'UNRESOLVED');
  a.equal(match({...card,location,...extra}).status,'UNRESOLVED');
 }
 a.equal(match({...card,url:row.p.SOURCE_URL},[{...row,p:{...row.p,OPERATING_SCOPE:'LOCATION_OPEN'}}]).status,'PRESENT');
 a.equal(match({...card,location:'Florence Area, SC'}).status,'UNRESOLVED');
 a.equal(I.fenceApplies({company:'AESC',title:row.TITLE,location:'Morristown, TN'},{...row,BUCKET:'DUPLICATE'}),true);
});
