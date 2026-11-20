'use strict';
// Helper lanes may propose every job-text field; scores and bookkeeping stay with the Writer and code.
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const HF=require('./helper-fields.cjs'),H=require('./shared.cjs'),A=require('./shared-assignments.cjs');
const Source=require('../programmed-coordinator/source.cjs'),T=require('../programmed-coordinator/transactions.cjs'),S=require('../programmed-coordinator/store.cjs'),C=require('../programmed-coordinator/collect.cjs');

const POSTING=['Plant Manager - Factory 0 - Austin, TX','Requisition ID: R-12345','Posted on November 18, 2026',
 'This is a hybrid role with three days on site each week.','Hiring on behalf of our client Acme Aerospace.',
 'The base salary range for this role is $150,000 - $180,000 per year.',"Bachelor's degree in Engineering required.",
 'Lead quality, production and people across two shifts. '.repeat(8)].join('\n');
const NO_DEGREE=POSTING.replace("Bachelor's degree in Engineering required.",'Ten years of manufacturing leadership.');
const QUOTES={WORK_ARRANGEMENT:'This is a hybrid role with three days on site each week.',REQ_ID:'Requisition ID: R-12345',POSTING_DATE:'Posted on November 18, 2026',
 CLIENT_EMPLOYER:'Hiring on behalf of our client Acme Aerospace.',SALARY:'The base salary range for this role is $150,000 - $180,000 per year.',DEGREE:"Bachelor's degree in Engineering required."};
const RAW={WORK_ARRANGEMENT:'HYBRID',REMOTE_HYBRID:'HYBRID',REQ_ID:'R-12345',POSTING_DATE:'2026-11-18',CLIENT_EMPLOYER:'Acme Aerospace',
 SALARY_BASE_LOW:'150000',SALARY_BASE_HIGH:'180000',SALARY_BASIS:'EMPLOYER_POSTED',DEGREE_TEXT:"Bachelor's degree in Engineering required.",DEGREE_REQ:'REQUIRED'};
const evidence=(raw=RAW,quotes=QUOTES,extra={})=>({company:'Factory 0',title:'Plant Manager',location:'Austin, TX',url:'https://jobs.example.com/r-12345',observedAt:'2026-11-20T12:00:00Z',quote:QUOTES.REQ_ID,proposedRawFields:{...raw},fieldQuotes:{...quotes},...extra});
const row=(p={})=>({PRIMARY_ID:'V2I-ONE',COMPANY:'Factory 0',TITLE:'Plant Manager',LOCATION:'Austin, TX',BUCKET:'SCOUT_INTAKE',p});
const source=(o={})=>({format:'ATS_API',observedAt:'2026-11-20T12:00:00Z',identityVerified:true,sourceIdentity:{company:'Factory 0',title:'Plant Manager',location:'Austin, TX'},
 description:POSTING,sourceUrl:'https://jobs.example.com/r-12345',finalUrl:'https://jobs.example.com/r-12345',...o});
const withHelper=(src,e=evidence())=>({...src,helperFields:HF.verified(e,src)});

test('every job-text field passes with exact quotes; computed and bookkeeping columns stay out',()=>{
 a.deepEqual(HF.check(evidence(),{capture:POSTING}).sort(),['CLIENT_EMPLOYER','DEGREE','POSTING_DATE','REQ_ID','SALARY','WORK_ARRANGEMENT']);
 for(const k of [...HF.COMPUTED,'BUCKET','DISPOSITION','PRIMARY_ID','COMPANY','TITLE','LOCATION','REQ','TIM_DECISION','LOCATION_NOTE','SALARY_EVIDENCE_QUOTE'])
  a.throws(()=>HF.check(evidence({...RAW,[k]:'x'})),/HELPER_PROTECTED_FIELDS_FORBIDDEN/,k);
 for(const k of HF.COMPUTED)a.equal(HF.FIELDS.has(k),false,k);
});
test('new fields need a quote; shortened or invented quotes fail',()=>{
 const {WORK_ARRANGEMENT,...noWork}=QUOTES;a.throws(()=>HF.check(evidence(RAW,noWork)),/HELPER_FIELD_QUOTE_REQUIRED: WORK_ARRANGEMENT/);
 a.throws(()=>HF.check(evidence(RAW,{...QUOTES,SALARY:'The base salary range for this role is $150,000 - $180,000...'})),/HELPER_FIELD_QUOTE_SHORTENED/);
 a.throws(()=>HF.check(evidence(RAW,{...QUOTES,SALARY:'The base salary range … per year.'})),/HELPER_FIELD_QUOTE_SHORTENED/);
 a.throws(()=>HF.check(evidence(RAW,{...QUOTES,REQ_ID:'Requisition ID: R-99999'}),{capture:POSTING}),/HELPER_FIELD_QUOTE_NOT_IN_CAPTURE/);
 a.throws(()=>HF.check(evidence(RAW,{...QUOTES,BONUS:'x'})),/HELPER_FIELD_QUOTE_UNKNOWN_GROUP/);
 a.throws(()=>HF.verified(evidence(RAW,{...QUOTES,REQ_ID:'Requisition ID: R-99999'}),source()),/HELPER_FIELD_QUOTE_NOT_IN_POSTING: REQ_ID/);
});
test('values must match their quotes',()=>{
 const bad=(patch,re)=>a.throws(()=>HF.check(evidence({...RAW,...patch})),re,JSON.stringify(patch));
 bad({SALARY_BASE_LOW:'0'},/SALARY_ZERO_OR_INVALID/);bad({SALARY_BASE_LOW:'190000'},/SALARY_RANGE_INVERTED/);bad({SALARY_BASE_HIGH:'185000'},/SALARY_NOT_IN_QUOTE/);
 bad({SALARY_BASIS:'ESTIMATE'},/HELPER_SALARY_MUST_BE_EMPLOYER_POSTED/);bad({REMOTE_HYBRID:'REMOTE'},/WORK_ARRANGEMENT_CONFLICT/);
 bad({WORK_ARRANGEMENT:'REMOTE',REMOTE_HYBRID:'REMOTE'},/WORK_ARRANGEMENT_NOT_IN_QUOTE/);bad({REQ_ID:'R-12346'},/REQ_ID_NOT_IN_QUOTE/);
 bad({POSTING_DATE:'2026-11-19'},/POSTING_DATE_NOT_IN_QUOTE/);bad({POSTING_DATE:'2026-02-30'},/POSTING_DATE_INVALID/);bad({CLIENT_EMPLOYER:'Boeing'},/CLIENT_EMPLOYER_NOT_IN_QUOTE/);
 bad({DEGREE_TEXT:"Bachelor's degree in Physics required."},/DEGREE_TEXT_NOT_IN_QUOTE/);bad({DEGREE_REQ:'MAYBE'},/DEGREE_REQ_INVALID/);
 a.throws(()=>HF.check(evidence({...RAW,SALARY_BASE_LOW:'45',SALARY_BASE_HIGH:'55'},{...QUOTES,SALARY:'Pay is $45 - $55 per hour.'})),/SALARY_NOT_ANNUAL_BASE/);
});
test('a high school diploma is not a degree',()=>{
 const raw={DEGREE_TEXT:'High school diploma or GED required.',DEGREE_REQ:'REQUIRED'};
 a.throws(()=>HF.check(evidence(raw,{DEGREE:'High school diploma or GED required.'})),/HIGH_SCHOOL_IS_NOT_A_DEGREE/);
 a.equal(HF.highSchoolOnly("High school diploma required; bachelor's degree preferred."),false);
});
test('NOT_STATED needs a full, uncut posting read',()=>{
 const raw={DEGREE_TEXT:'NOT_STATED',DEGREE_REQ:'NOT_STATED'},q={DEGREE:QUOTES.REQ_ID};
 a.throws(()=>HF.check(evidence(raw,q)),/NOT_STATED_REQUIRES_FULL_POSTING/);
 a.deepEqual(HF.check(evidence(raw,q,{fullPostingRead:true}),{capture:NO_DEGREE}),['DEGREE']);
 a.throws(()=>HF.check(evidence(raw,q,{fullPostingRead:true}),{capture:NO_DEGREE+'\nShow more'}),/NOT_STATED_REQUIRES_FULL_POSTING/);
 a.throws(()=>HF.check(evidence(raw,q,{fullPostingRead:true}),{capture:NO_DEGREE+' Responsibilities include...'}),/NOT_STATED_REQUIRES_FULL_POSTING/);
 const cut=source({description:NO_DEGREE,sourceCaptured:true,fullPosting:false});
 a.deepEqual(HF.verified(evidence(raw,q,{fullPostingRead:true}),cut),{});
});
test('old-style degree and salary returns without quotes still validate, with the zero-salary rule',()=>{
 const raw={DEGREE_TEXT:"Bachelor's degree in Engineering required.",DEGREE_EVIDENCE_URL:'https://jobs.example.com/r-12345',SOURCE_URL:'https://jobs.example.com/r-12345'};
 a.deepEqual(HF.check({proposedRawFields:raw}),['DEGREE']);
 a.throws(()=>HF.check({proposedRawFields:{SALARY_BASE_LOW:'0',SALARY_BASE_HIGH:'0'}}),/SALARY_ZERO_OR_INVALID/);
 a.throws(()=>HF.check({proposedRawFields:{SOURCE_URL:'http://x'}}),/EXACT_SOURCE_URL_REQUIRED/);
});
test('shared batch validation accepts the new fields and keeps the assignment checks',()=>{
 const task='FORGE_CLAUDE_SHARED_HELPER',w={schema:'forge.shared-helper-work.v1',assignmentId:'SHARED-TEST',enabled:true,routingActive:true,
  providers:{[task]:{provider:'Claude',available:true},FORGE_GROK_SHARED_HELPER:{provider:'Grok',available:true}},
  items:[{kind:'ENRICHMENT',primaryId:'V2I-ONE',provider:'Claude',taskKey:task,assignmentVersion:1,sourceVersion:'a'.repeat(64),status:'ASSIGNED'}]};
 const e={...evidence(),capture:{kind:'TEXT_EXTRACT',text:POSTING}};
 const b={schema:'forge.shared-helper-batch.v1',provider:'Claude',taskKey:task,assignmentId:'SHARED-TEST',runId:'FORGE-CLAUDE-TEST',instructionCommit:'b'.repeat(40),
  items:[{...w.items[0],writerSubmitted:false,recommendation:'ENRICHMENT_EVIDENCE_READY',sourceEvidence:e}]};
 a.equal(H.validateBatch(b,w).valid,true);
 const stale=structuredClone(b);stale.items[0].assignmentVersion=2;a.throws(()=>H.validateBatch(stale,w),/STALE_OR_UNASSIGNED_SHARED_ITEM/);
 const scored=structuredClone(b);scored.items[0].sourceEvidence.proposedRawFields.PAY_WORTH='9';a.throws(()=>H.validateBatch(scored,w),/HELPER_PROTECTED_FIELDS_FORBIDDEN/);
 const bad=structuredClone(b);bad.items[0].sourceEvidence.fieldQuotes.REQ_ID='Requisition ID: R-55555';a.throws(()=>H.validateBatch(bad,w),/HELPER_FIELD_QUOTE_NOT_IN_CAPTURE/);
});
test('coordinator fills blanks from checked helper facts; code-read values win',()=>{
 const f=Source.enrichmentFields(withHelper(source()),row());
 a.equal(f.WORK_ARRANGEMENT,'HYBRID');a.equal(f.REMOTE_HYBRID,'HYBRID');a.equal(f.REQ_ID,'R-12345');a.equal(f.POSTING_DATE,'2026-11-18');a.equal(f.CLIENT_EMPLOYER,'Acme Aerospace');
 a.equal(f.SALARY_BASE_LOW,150000);a.equal(f.SALARY_BASE_HIGH,180000);a.equal(f.SALARY_MIDPOINT,165000);a.equal(f.SALARY_BASIS,'EMPLOYER_POSTED');a.equal(f.SALARY_SOURCE,'https://jobs.example.com/r-12345');
 a.equal(f.DEGREE_REQ,'REQUIRED');a.equal(f.REQUIREMENTS_REVIEWED,'YES');
 for(const k of Object.keys(f))a.equal(HF.COMPUTED.includes(k)&&!['SALARY_MIDPOINT','SALARY_ASOF','SALARY_CONF','DEGREE_ASOF','REQUIREMENTS_REVIEWED'].includes(k),false,k);
 const code=Source.enrichmentFields(withHelper(source({pay:{low:155000,high:175000},degree:{text:'Code read',req:'PREFERRED'}})),row());
 a.equal(code.SALARY_BASE_LOW,155000);a.equal(code.DEGREE_REQ,'PREFERRED');
 const kept=Source.enrichmentFields(withHelper(source()),row({REQ_ID:'OLD-1',CLIENT_EMPLOYER:'Other',REMOTE_HYBRID:'ONSITE',WORK_ARRANGEMENT:'ONSITE',POSTING_DATE:'2026-10-01'}));
 for(const k of ['REQ_ID','CLIENT_EMPLOYER','REMOTE_HYBRID','WORK_ARRANGEMENT','POSTING_DATE'])a.equal(Object.hasOwn(kept,k),false,k);
 const other=withHelper(source());other.sourceIdentity={...other.sourceIdentity,company:'Someone Else'};a.deepEqual(Source.enrichmentFields(other,row()),{});
});
test('helper NOT_STATED is written only when code agrees and the whole posting was read',()=>{
 const e=evidence({DEGREE_TEXT:'NOT_STATED',DEGREE_REQ:'NOT_STATED'},{DEGREE:QUOTES.REQ_ID},{fullPostingRead:true});
 const f=Source.enrichmentFields(withHelper(source({description:NO_DEGREE}),e),row());
 a.equal(f.DEGREE_REQ,'NOT_STATED');a.equal(f.REQUIREMENTS_REVIEWED,'YES');
 a.equal(Object.hasOwn(Source.enrichmentFields(withHelper(source(),e),row()),'DEGREE_REQ'),false);
 a.deepEqual(A.needs(row({DEGREE_REQ:'NOT_STATED',DEGREE_TEXT:'NOT_STATED',REQUIREMENTS_REVIEWED:'YES',SALARY_BASE_LOW:1,SCOPE_FIT_RAW:1,SOURCE_URL:'x'})),[]);
 a.deepEqual(A.needs(row({DEGREE_REQ:'NOT_STATED',SALARY_BASE_LOW:1,SCOPE_FIT_RAW:1,SOURCE_URL:'x'})),['DEGREE']);
});
test("Tim's rule: a newer employer-site read replaces older stored degree and salary",()=>{
 const old={SALARY_BASE_LOW:'120000',SALARY_BASE_HIGH:'140000',SALARY_ASOF:'2026-09-01',DEGREE_TEXT:"Bachelor's degree preferred.",DEGREE_REQ:'PREFERRED',DEGREE_ASOF:'2026-09-01'};
 const meta={},f=Source.enrichmentFields(withHelper(source()),row(old),meta);
 a.equal(f.SALARY_BASE_LOW,150000);a.equal(f.DEGREE_REQ,'REQUIRED');a.deepEqual(meta.replace.sort(),['DEGREE','SALARY']);
 const code={},c=Source.enrichmentFields(source({pay:{low:150000,high:180000}}),row(old),code);a.equal(c.SALARY_BASE_LOW,150000);a.deepEqual(code.replace,['SALARY']);
 for(const [why,src]of [['aggregator',source({format:'HTML',finalUrl:'https://www.indeed.com/viewjob?jk=0123456789abcdef'})],['linkedin',source({format:'LINKEDIN_GUEST'})],['captured card',source({sourceCaptured:true,fullPosting:true})]]){
  const m={},r=Source.enrichmentFields(withHelper(src),row(old),m);a.equal(Object.hasOwn(r,'SALARY_BASE_LOW'),false,why);a.equal(m.replace,undefined,why);
 }
 a.equal(Source.employerOwned(source({format:'HTML',finalUrl:'https://careers.factory.example/jobs/1'})),true);
 const same={},s=Source.enrichmentFields(withHelper(source()),row({...old,SALARY_ASOF:'2026-11-20',DEGREE_ASOF:'2026-11-20'}),same);
 a.equal(Object.hasOwn(s,'SALARY_BASE_LOW'),false);a.equal(same.replace,undefined);
});
test('Writer submit allows new fields and only a dated replace may overwrite stored values',async t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'helper-fields-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const state=C.empty(),id='V2I-ONE',key='TEST:'+id;state.items[key]={status:'READY_ENRICHMENT'};
 const r=row({SALARY_BASE_LOW:'120000',SALARY_BASE_HIGH:'140000',SALARY_ASOF:'2026-09-01'});
 const fields={SALARY_BASE_LOW:150000,SALARY_BASE_HIGH:180000,SALARY_MIDPOINT:165000,SALARY_BASIS:'EMPLOYER_POSTED',SALARY_SOURCE:'https://jobs.example.com/r-12345',SALARY_ASOF:'2026-11-20',SALARY_CONF:'HIGH',REMOTE_HYBRID:'HYBRID',REQ_ID:'R-12345'};
 const run=async job=>{const bad=[];await T.submit({root,privateDir:root,state,jobs:[{itemKey:key,primaryId:id,identity:T.identity(r),...job}],runId:'FORGE-TEST',onInvalid:(j,e)=>bad.push(e.message),
  deps:{checkLock(){},async snapshot(){return{rows:[r],status:{freeze:null,level:'OK',errors:[],unverified:{}}};},async exists(){return true;}}}).catch(e=>bad.push(e.message));return bad;};
 a.deepEqual(await run({fields}),['CONFLICTING_CURRENT_EVIDENCE']);
 a.deepEqual(await run({fields,replace:['SALARY']}),['ORIGINAL_REQUEST_ALREADY_EXISTS']);
 a.deepEqual(await run({fields:{...fields,SALARY_ASOF:'2026-08-01'},replace:['SALARY']}),['CONFLICTING_CURRENT_EVIDENCE']);
 a.deepEqual(await run({fields:{...fields,PAY_WORTH:'9'},replace:['SALARY']}),['Unsupported enrichment fields']);
});
test('work arrangement quotes must state how the job is worked, without negation (real postings, Nov 20)',()=>{
 const yes=[['ONSITE','* This position will be located onsite 5 days a week in East Peoria, IL (Building KK).'],['ONSITE','**New Jersey, USA | On-site | Dechra Pharmaceuticals**'],
  ['ONSITE','Work Location - This position will be onsite 4 to 5 days per week at our Long Beach, CA facility'],['HYBRID','This is a hybrid role with three days on site each week.'],
  ['HYBRID','Workplace type: Hybrid'],['REMOTE','This is a fully remote position.'],['REMOTE','Location: Remote (US)']];
 const no=[['REMOTE',"Our Facility Remote Operations Center is the nerve center for this footprint"],['REMOTE','Residing in New York City : This role is not eligible for remote work in New York City.'],
  ['HYBRID','Experience with hybrid electric vehicle powertrains.'],['ONSITE','We have an onsite gym and cafeteria.'],['REMOTE','Support remote monitoring of equipment.'],['REMOTE','This is not a remote position.']];
 for(const [v,q]of yes)a.equal(HF.statesMode(q,v),true,q);
 for(const [v,q]of no)a.equal(HF.statesMode(q,v),false,q);
 a.throws(()=>HF.check(evidence({WORK_ARRANGEMENT:'REMOTE',REMOTE_HYBRID:'REMOTE'},{WORK_ARRANGEMENT:'This is not a remote position.'})),/WORK_ARRANGEMENT_NOT_IN_QUOTE/);
});
