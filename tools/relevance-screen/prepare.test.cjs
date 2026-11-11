const{test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),p=require('node:path'),os=require('node:os'),H=require('../helper-routing/reservations.cjs'),P=require('./prepare.cjs');
function fixture(title,status='TITLE_SCOPE_REVIEW'){const root=fs.mkdtempSync(p.join(os.tmpdir(),'relevance-')),key='linkedin:4481234567',task=H.TASKS[H.shard(key)],batch='receipts/CLAUDE_HELPERS/b.json',work={schema:'forge.claude-helper-work.v1',enabled:false,assignmentId:'TEST',intake:[{key,task}],enrichment:[],released:[],transfer:{status:'COMPLETE',to:'ChatGPT',proof:'receipts/transfer.json'}};for(const dir of ['control','state','receipts/CLAUDE_HELPERS'])fs.mkdirSync(p.join(root,dir),{recursive:true});const save=(f,x)=>fs.writeFileSync(p.join(root,f),JSON.stringify(x)),e={company:'Factory',title,location:'Austin, TX',url:'https://www.linkedin.com/jobs/view/4481234567/'};save('control/CLAUDE_HELPER_WORK.json',work);save(batch,{schema:'forge.claude-helper-batch.v1',provider:'Claude',taskKey:task,assignmentId:'TEST',runId:'CLAUDE-TEST',instructionCommit:'abc',items:[{key,sourceEvidence:e,recommendation:'EXCLUSION_CANDIDATE',writerSubmitted:false}]});save('state/CLAUDE_HELPER_CONSUMPTION.json',{items:[{key,taskKey:task,batch,status,helperRunId:'CLAUDE-TEST'}]});save('state/EMAIL_RECOVERY_QUEUE.json',{schema:'forge.email-recovery.v1',sources:{},jobs:{[key]:{...e,key,status:'UNSCREENED',evidence:[{paragraphs:[title,'Factory','Austin, TX']}],submissions:[]}}});return{root,key,sourceAt:new Date().toISOString(),runId:'FORGE-TEST-RELEVANCE',rows:[],save};}
test('preview reuses withdrawn helper recommendations without mutating ledgers',()=>{const f=fixture('Director, Manufacturing'),before=fs.readFileSync(p.join(f.root,'state/CLAUDE_HELPER_CONSUMPTION.json'),'utf8'),r=P.prepare(f);a.equal(r.counts.READY,1);a.equal(r.items[0].record.TITLE,'Director, Manufacturing');a.equal(fs.readFileSync(p.join(f.root,'state/CLAUDE_HELPER_CONSUMPTION.json'),'utf8'),before);});
test('canonical presence outranks mismatch closure and original identity holds stay fenced',()=>{const f=fixture('Claims Director');f.rows=[{PRIMARY_ID:'V2I-X',COMPANY:'Factory',TITLE:'Claims Director',LOCATION:'Austin, TX',p:{SOURCE_URL:'https://www.linkedin.com/jobs/view/4481234567/'}}];a.equal(P.prepare(f).counts.EXISTING_CANONICAL,1);const g=fixture('Director, Manufacturing','HELD_WRITER_IDENTITY');a.equal(P.prepare(g).counts.HELD_WRITER_IDENTITY,1);a.equal(P.prepare(g).items.length,1);a.equal(P.prepare(g).items[0].status,'HELD_WRITER_IDENTITY');});
test('closure needs proven source identity and preserves exact policy and term',()=>{const f=fixture('Claims Director'),r=P.prepare(f);a.equal(r.counts.CLOSED_FUNCTION_MISMATCH,1);a.equal(r.items[0].screen.ruleId,'FM_CLAIMS');a.equal(r.items[0].screen.matchedTerm,'Claims');a.throws(()=>P.prepare({...f,sourceAt:'unknown'}),/Fresh canonical/);});
test('programmed source inspection reuses old facts but never quarantined or future-dated evidence',()=>{
 const f=fixture('Director, Manufacturing');f.save('state/EMAIL_RECOVERY_QUEUE.json',{schema:'forge.email-recovery.v1',sources:{},jobs:{}});
 const batch='receipts/programmed-source.json',sourceEvidence={company:'Factory',title:'Director, Manufacturing',location:'Austin, TX',url:'https://www.linkedin.com/jobs/view/4481234567/',observedAt:new Date().toISOString(),sourceSha256:'a'.repeat(64),independentlyVerified:true};
 const program={batches:{[batch]:{status:'VALIDATED'}},items:{source:{itemKey:f.key,batch,status:'SOURCE_VERIFIED',sourceEvidence}}};
 f.save('state/PROGRAMMED_COORDINATOR.json',program);a.equal(P.prepare(f).counts.READY,1);
 program.batches[batch].status='QUARANTINED';f.save('state/PROGRAMMED_COORDINATOR.json',program);a.equal(P.prepare(f).counts.SOURCE_REVALIDATION_REQUIRED,1);
 program.batches[batch].status='VALIDATED';sourceEvidence.observedAt='2020-01-01T00:00:00Z';f.save('state/PROGRAMMED_COORDINATOR.json',program);a.equal(P.prepare(f).counts.READY,1);sourceEvidence.observedAt='2999-01-01T00:00:00Z';f.save('state/PROGRAMMED_COORDINATOR.json',program);a.equal(P.prepare(f).counts.SOURCE_REVALIDATION_REQUIRED,1);
});
test('existing discovery closure persists proof and removes helper reservation without canonical writes',()=>{
 const f=fixture('Director, Manufacturing');f.rows=[{PRIMARY_ID:'V2I-EXISTING',COMPANY:'Factory',TITLE:'Director, Manufacturing',LOCATION:'Austin, TX',p:{SOURCE_URL:'https://www.linkedin.com/jobs/view/4481234567/'}}];
 const lock=p.join(f.root,'lock.json'),prior=process.env.FORGE_PRODUCTION_LOCK;require('../automation-run-lock.cjs').lock(lock,'acquire',f.runId);process.env.FORGE_PRODUCTION_LOCK=lock;
 try{const before=JSON.stringify(f.rows),out=P.prepare({...f,apply:true});a.equal(out.counts.EXISTING_CANONICAL,1);a.equal(JSON.stringify(f.rows),before);
 const read=name=>JSON.parse(fs.readFileSync(p.join(f.root,name))),state=read('state/CLAUDE_HELPER_CONSUMPTION.json'),queue=read('state/EMAIL_RECOVERY_QUEUE.json'),work=read('control/CLAUDE_HELPER_WORK.json'),proof=read('receipts/'+f.runId+'_SCREEN.json');
 a.equal(state.items[0].status,'VERIFIED_EXISTING');a.equal(queue.jobs[f.key].status,'VERIFIED_EXISTING');a.equal(work.intake.length,0);a.equal(work.released[0].reason,'VERIFIED_EXISTING');a.equal(proof.existingClosures[0].primaryId,'V2I-EXISTING');a.equal(proof.writerSubmissions,0);a.equal(proof.existingClosures[0].writeCompletionClaimed,false);
 }finally{if(prior===undefined)delete process.env.FORGE_PRODUCTION_LOCK;else process.env.FORGE_PRODUCTION_LOCK=prior;}
});
test('duplicate canonical roles and original queue submissions are not closed as existing',()=>{
 const f=fixture('Director, Manufacturing'),row={PRIMARY_ID:'V2I-ONE',COMPANY:'Factory',TITLE:'Director, Manufacturing',LOCATION:'Austin, TX',p:{SOURCE_URL:'https://www.linkedin.com/jobs/view/4481234567/'}};f.rows=[row,{...row,PRIMARY_ID:'V2I-TWO'}];a.equal(P.prepare(f).counts.EXISTING_CANONICAL,undefined);
 f.rows=[row];const queue=JSON.parse(fs.readFileSync(p.join(f.root,'state/EMAIL_RECOVERY_QUEUE.json')));queue.jobs[f.key].submissions=[{requestId:'ORIGINAL'}];queue.jobs[f.key].evidence=[];f.save('state/EMAIL_RECOVERY_QUEUE.json',queue);a.equal(P.prepare(f).counts.ORIGINAL_WRITER_FENCE,1);
});
test('a compatible canonical row with unresolved location cannot fall through to READY',()=>{const f=fixture('Director, Manufacturing');f.rows=[{PRIMARY_ID:'V2I-UNKNOWN',COMPANY:'Factory',TITLE:'Director, Manufacturing',LOCATION:'UNKNOWN',p:{}}];const out=P.prepare(f);a.equal(out.counts.HOLD_SOURCE_IDENTITY,1);a.equal(out.counts.READY,undefined);});
test('unresolved auto-intake and saved drain fences survive existing discovery across workflow boundaries',()=>{
 for(const source of ['auto','drain','prior']){const f=fixture('Director, Manufacturing');f.rows=[{PRIMARY_ID:'V2I-ONE',COMPANY:'Factory',TITLE:'Director, Manufacturing',LOCATION:'Austin, TX',p:{}}];
  if(source==='auto'){fs.mkdirSync(p.join(f.root,'receipts/auto-intake'));f.save('receipts/auto-intake/ORIGINAL.json',{requestIds:['ORIGINAL-AUTO'],results:{'ORIGINAL-AUTO':{status:'POST_IN_FLIGHT_UNKNOWN',source:{COMPANY:'Factory Group',TITLE:'Director, Manufacturing',LOCATION:'Austin, TX',SOURCE_URL:'https://other.example/job'}}}});}
  if(source==='drain')f.save('state/INTAKE_DRAIN.json',{items:{[f.key]:{key:f.key,aliases:[f.key],card:{company:'Factory',title:'Director, Manufacturing'},fence:{requestIds:['ORIGINAL-DRAIN'],proof:'original'}}}});
  if(source==='prior')f.save('state/RELEVANCE_INTAKE_PLAN.json',{items:[{key:f.key,status:'ORIGINAL_WRITER_FENCE',requestId:'ORIGINAL-PLAN'}]});
  const result=P.prepare(f);a.equal(result.counts.ORIGINAL_WRITER_FENCE,1,source);a.equal(result.counts.EXISTING_CANONICAL,undefined);a.match(result.items[0].requestId,/ORIGINAL/);a.equal(JSON.parse(fs.readFileSync(p.join(f.root,'control/CLAUDE_HELPER_WORK.json'))).intake.length,1);
 }
});
test('same-title cross-workflow fence at another clear worksite does not hold a distinct role',()=>{
 const f=fixture('Director, Manufacturing');fs.mkdirSync(p.join(f.root,'receipts/auto-intake'));f.save('receipts/auto-intake/ORIGINAL.json',{requestIds:['ORIGINAL-OTHER-SITE'],results:{'ORIGINAL-OTHER-SITE':{status:'POST_IN_FLIGHT_UNKNOWN',source:{COMPANY:'Factory',TITLE:'Director, Manufacturing',LOCATION:'La Porte, IN',SOURCE_URL:'https://other.example/job'}}}});
 a.equal(P.prepare(f).counts.READY,1);const original=JSON.parse(fs.readFileSync(p.join(f.root,'receipts/auto-intake/ORIGINAL.json')));a.equal(original.results['ORIGINAL-OTHER-SITE'].status,'POST_IN_FLIGHT_UNKNOWN');
 original.results['ORIGINAL-OTHER-SITE'].source.LOCATION='UNKNOWN';f.save('receipts/auto-intake/ORIGINAL.json',original);a.equal(P.prepare(f).counts.ORIGINAL_WRITER_FENCE,1);
});
test('READY Writer record retains uppercase and aliased worksite scope without arbitrary fields or new request identity',()=>{
 const f=fixture('Director, Manufacturing'),queue=JSON.parse(fs.readFileSync(p.join(f.root,'state/EMAIL_RECOVERY_QUEUE.json'))),job=queue.jobs[f.key];
 Object.assign(job,{REMOTE_HYBRID:'HYBRID',workArrangement:'ONSITE',OPERATING_SCOPE:'MULTI_SITE',OPERATING_SCOPE_EVIDENCE:'Oversees plants across states',REQ_ID:'SOURCE-REQ',COMPANY_SOURCE_URL:'https://ats.example.com/1',BUCKET:'APPLIED',UNSUPPORTED:'ignored'});f.save('state/EMAIL_RECOVERY_QUEUE.json',queue);
 const record=P.prepare(f).items[0].record;a.equal(record.REMOTE_HYBRID,'HYBRID');a.equal(record.OPERATING_SCOPE,'MULTI_SITE');a.equal(record.OPERATING_SCOPE_EVIDENCE,'Oversees plants across states');a.equal(record.COMPANY_SOURCE_URL,'https://ats.example.com/1');a.equal(record.REQUISITION_ID,undefined);a.equal(record.REQ_ID,undefined);a.equal(record.BUCKET,undefined);a.equal(record.UNSUPPORTED,undefined);
 const requestId=require('../source-intake/production-executor').requestId;a.equal(requestId(record),requestId({COMPANY:job.company,TITLE:job.title,LOCATION:job.location,SOURCE_URL:job.url}));
 delete job.REMOTE_HYBRID;delete job.OPERATING_SCOPE;delete job.OPERATING_SCOPE_EVIDENCE;job.workArrangement='REMOTE';job.operatingScope='REGIONAL';job.scopeEvidence='Across facilities';f.save('state/EMAIL_RECOVERY_QUEUE.json',queue);const aliases=P.prepare(f).items[0].record;a.equal(aliases.REMOTE_HYBRID,'REMOTE');a.equal(aliases.OPERATING_SCOPE,'REGIONAL');a.equal(aliases.OPERATING_SCOPE_EVIDENCE,'Across facilities');
});
function atsContext(){const profile={schema:'forge.resume-match-profile.v1',source:{fileId:'synthetic-resume',modifiedAt:'2026-01-01T00:00:00Z',textSha256:'a'.repeat(64)},competencies:[{id:'robotics',terms:['robotics'],resumeEvidenceSha256:'b'.repeat(64)}]};return{profile,documents:{resumes:[{id:profile.source.fileId,modifiedTime:profile.source.modifiedAt}]}};}
const unrelatedRole='The role develops editorial calendars and publishes articles for readers. Responsibilities include proofreading manuscripts, coordinating authors, and maintaining the publication schedule. The successful applicant writes clear prose, checks spelling and grammar, and communicates with subscribers about upcoming issues. This position reports to the publisher and works with freelance authors on weekly editions.';
test('preparation excludes current ATS zero without terminal disposition and rechecks on context changes',()=>{
 const f=fixture('Director, Manufacturing'),file=p.join(f.root,'state/EMAIL_RECOVERY_QUEUE.json'),q=JSON.parse(fs.readFileSync(file));q.jobs[f.key].description=unrelatedRole;f.save('state/EMAIL_RECOVERY_QUEUE.json',q);const before=fs.readFileSync(file,'utf8'),r=P.prepare({...f,screenContext:atsContext()});a.equal(r.counts.EXCLUDED_ATS_ZERO,1);a.equal(r.items[0].preliminaryScreen.atsGate.hits,0);a.equal(r.items[0].record,undefined);a.equal(fs.readFileSync(file,'utf8'),before);a.equal(P.prepare({...f,screenContext:{}}).counts.READY,1);const positive=atsContext();positive.profile.competencies[0].terms=['editorial'];a.equal(P.prepare({...f,screenContext:positive}).counts.READY,1);
});
test('preparation preserves canonical and writer dispositions over ATS zero and does not trust cached decisions',()=>{
 const f=fixture('Director, Manufacturing'),file=p.join(f.root,'state/EMAIL_RECOVERY_QUEUE.json'),q=JSON.parse(fs.readFileSync(file));q.jobs[f.key].preliminaryScreen={decision:'EXCLUDE_ATS_ZERO'};f.save('state/EMAIL_RECOVERY_QUEUE.json',q);a.equal(P.prepare({...f,screenContext:atsContext()}).counts.READY,1);
 q.jobs[f.key].description=unrelatedRole;q.jobs[f.key].submissions=[{requestId:'original'}];f.save('state/EMAIL_RECOVERY_QUEUE.json',q);a.equal(P.prepare({...f,screenContext:atsContext()}).counts.ORIGINAL_WRITER_FENCE,1);q.jobs[f.key].submissions=[];q.jobs[f.key].status='VERIFIED_EXISTING';f.save('state/EMAIL_RECOVERY_QUEUE.json',q);a.equal(P.prepare({...f,screenContext:atsContext()}).counts.REUSE_DURABLE_DISPOSITION,1);q.jobs[f.key].status='UNSCREENED';f.save('state/EMAIL_RECOVERY_QUEUE.json',q);f.rows=[{PRIMARY_ID:'V2I-X',COMPANY:'Factory',TITLE:'Director, Manufacturing',LOCATION:'Austin, TX',p:{SOURCE_URL:q.jobs[f.key].url}}];a.equal(P.prepare({...f,screenContext:atsContext()}).counts.EXISTING_CANONICAL,1);
});
test('fresh exact verified posting replaces alert text only for screening with bound content hashes',()=>{
 const f=fixture('Director, Manufacturing'),file=p.join(f.root,'state/EMAIL_RECOVERY_QUEUE.json'),q=JSON.parse(fs.readFileSync(file)),card=q.jobs[f.key],sha=s=>require('node:crypto').createHash('sha256').update(s).digest('hex');
 card.description='Salary and company advertising. '.repeat(12);card.discoveryReview={contentBasis:'EXACT_ORIGINAL_ALERT_CARD',fullPosting:false};f.save('state/EMAIL_RECOVERY_QUEUE.json',q);
 const batch='receipts/verified-posting.json',e={company:card.company,title:card.title,location:card.location,url:'https://employer.test/jobs/1',initiatingUrl:card.url,observedAt:new Date().toISOString(),sourceSha256:'c'.repeat(64),description:unrelatedRole,descriptionSha256:sha(unrelatedRole),contentBasis:'CAPTURED_ROLE_CONTENT',independentlyVerified:true},program={batches:{[batch]:{status:'VALIDATED'}},items:{one:{itemKey:f.key,batch,status:'SOURCE_VERIFIED',sourceEvidence:e}}};
 const check=()=>{f.save('state/PROGRAMMED_COORDINATOR.json',program);return P.prepare({...f,screenContext:atsContext()});};
 program.items.one.sourceEvidence={...e,observedAt:'2020-01-01T00:00:00Z'};let r=check();a.equal(r.counts.EXCLUDED_ATS_ZERO,1);a.equal(r.items[0].preliminaryScreen.sourceEvidence.sourceSha256,e.sourceSha256);a.equal(r.items[0].preliminaryScreen.atsGate.sourceUrl,e.url);a.equal(r.items[0].sourceProof,'state/EMAIL_RECOVERY_QUEUE.json#'+f.key);
 for(const changes of [{description:''},{descriptionSha256:'invalid'},{descriptionSha256:'d'.repeat(64)},{sourceSha256:'invalid'},{title:'Other Director'},{location:'Boston, MA'},{url:'https://other.test/jobs/1',initiatingUrl:null},{observedAt:'2999-01-01T00:00:00Z'}]){program.items.one.sourceEvidence={...e,...changes};r=check();a.equal(r.counts.READY,1,JSON.stringify(changes));a.equal(r.items[0].preliminaryScreen.atsGate.hits,null);a.equal(r.items[0].record.SOURCE_URL,card.url);}
 program.items.one.sourceEvidence={...e,description:unrelatedRole+' robotics',descriptionSha256:sha(unrelatedRole+' robotics')};r=check();a.equal(r.counts.READY,1);a.equal(r.items[0].record.SOURCE_URL,card.url);a.equal(r.items[0].record.TITLE,card.title);
 program.items.one.sourceEvidence=e;card.submissions=[{requestId:'original'}];f.save('state/EMAIL_RECOVERY_QUEUE.json',q);a.equal(check().counts.ORIGINAL_WRITER_FENCE,1);
});
test('scoped preparation preserves unrelated plan records, pending originals and source state',()=>{
 const f=fixture('Director, Manufacturing'),before=fs.readFileSync(p.join(f.root,'state/CLAUDE_HELPER_CONSUMPTION.json'),'utf8');
 const old=[{key:'unrelated',status:'READY',record:{TITLE:'Leave unchanged'},screen:{rank:1}},{key:'pending',status:'POST_IN_FLIGHT_UNKNOWN',requestId:'ORIGINAL',record:{TITLE:'Original'},screen:{rank:99}}];
 f.save('state/RELEVANCE_INTAKE_PLAN.json',{items:old});
 let out=P.prepare({...f,onlyKeys:new Set([f.key])});a.equal(out.counts.READY,2);a.equal(out.counts.POST_IN_FLIGHT_UNKNOWN,1);
 for(const item of old)a.deepEqual(out.items.find(i=>i.key===item.key),item);
 a.equal(fs.readFileSync(p.join(f.root,'state/CLAUDE_HELPER_CONSUMPTION.json'),'utf8'),before);
 out=P.prepare({...f,onlyKeys:new Set()});a.equal(out.items.length,2);for(const item of old)a.deepEqual(out.items.find(i=>i.key===item.key),item);
});
test('scoped apply under the shared lock preserves unrelated persisted plans, source items and pending originals',t=>{
 const f=fixture('Claims Director'),read=file=>JSON.parse(fs.readFileSync(p.join(f.root,file),'utf8'));
 const unrelatedPlan={key:'unrelated',status:'READY',record:{TITLE:'Leave unchanged'},screen:{rank:1},sourceProof:'original-evidence'};
 const pendingPlan={key:'pending',status:'POST_IN_FLIGHT_UNKNOWN',requestId:'ORIGINAL',record:{TITLE:'Original'},screen:{rank:99},fence:{requestIds:['ORIGINAL'],proof:'receipts/ORIGINAL_CHECKPOINT.json'}};
 const unrelatedSource={key:'unrelated',provider:'Claude',status:'TITLE_SCOPE_REVIEW',batch:'receipts/unchanged-source.json',sourceEvidence:{company:'Other factory',title:'Other director',location:'Boston, MA'},relevanceScreen:{outcome:'ADMIT',screenedAt:'2026-01-01T00:00:00Z'}};
 const pendingSource={key:'pending',provider:'CODE',status:'POST_IN_FLIGHT_UNKNOWN',requestId:'ORIGINAL',proof:'receipts/ORIGINAL_CHECKPOINT.json',submission:{payloadSha256:'a'.repeat(64)},sourceEvidence:{company:'Another factory',title:'Original director',location:'Dallas, TX'}};
 const legacy=read('state/CLAUDE_HELPER_CONSUMPTION.json');legacy.items.push(unrelatedSource);f.save('state/CLAUDE_HELPER_CONSUMPTION.json',legacy);
 f.save('state/CODE_INTAKE_CONSUMPTION.json',{schema:'forge.code-intake-consumption.v1',items:[pendingSource]});
 f.save('state/RELEVANCE_INTAKE_PLAN.json',{items:[unrelatedPlan,pendingPlan]});
 const queue=read('state/EMAIL_RECOVERY_QUEUE.json');queue.jobs.unrelated={key:'unrelated',status:'UNSCREENED',company:'Other factory',title:'Other director',location:'Boston, MA',evidence:[{paragraphs:['Other director','Other factory','Boston, MA']}],submissions:[]};queue.jobs.pending={key:'pending',status:'POST_IN_FLIGHT_UNKNOWN',company:'Another factory',title:'Original director',location:'Dallas, TX',submissions:[{requestId:'ORIGINAL',proof:pendingSource.proof,payloadSha256:'a'.repeat(64)}]};f.save('state/EMAIL_RECOVERY_QUEUE.json',queue);
 const lock=p.join(f.root,'shared-lock.json'),Lock=require('../automation-run-lock.cjs'),prior=process.env.FORGE_PRODUCTION_LOCK;
 t.after(()=>fs.rmSync(f.root,{recursive:true,force:true}));a.equal(Lock.lock(lock,'acquire',f.runId).acquired,true);process.env.FORGE_PRODUCTION_LOCK=lock;
 try{
  P.prepare({...f,apply:true,onlyKeys:new Set([f.key])});Lock.lock(lock,'check',f.runId);
  const savedPlan=read('state/RELEVANCE_INTAKE_PLAN.json'),savedLegacy=read('state/CLAUDE_HELPER_CONSUMPTION.json'),savedCode=read('state/CODE_INTAKE_CONSUMPTION.json'),savedQueue=read('state/EMAIL_RECOVERY_QUEUE.json');
  a.equal(savedPlan.items.find(i=>i.key===f.key).status,'CLOSED_FUNCTION_MISMATCH');a.equal(savedLegacy.items.find(i=>i.key===f.key).status,'CLOSED_FUNCTION_MISMATCH');a.equal(savedQueue.jobs[f.key].status,'OUT_OF_SCOPE');
  for(const item of [unrelatedPlan,pendingPlan])a.deepEqual(savedPlan.items.find(i=>i.key===item.key),item);
  a.deepEqual(savedLegacy.items.find(i=>i.key==='unrelated'),unrelatedSource);a.deepEqual(savedCode.items.find(i=>i.key==='pending'),pendingSource);
  for(const key of ['unrelated','pending'])a.deepEqual(savedQueue.jobs[key],queue.jobs[key]);
  const proof=read('receipts/'+f.runId+'_SCREEN.json');a.equal(proof.writerSubmissions,0);a.deepEqual(proof.closures.map(i=>i.key),[f.key]);a.equal(savedPlan.counts.POST_IN_FLIGHT_UNKNOWN,1);
 }finally{Lock.lock(lock,'release',f.runId);if(prior===undefined)delete process.env.FORGE_PRODUCTION_LOCK;else process.env.FORGE_PRODUCTION_LOCK=prior;}
});

test('preparation refreshes cached captured-card sources on every invocation',t=>{
 const f=fixture('Director, Manufacturing');t.after(()=>fs.rmSync(f.root,{recursive:true,force:true}));
 const read=file=>JSON.parse(fs.readFileSync(p.join(f.root,file),'utf8')),queue=read('state/EMAIL_RECOVERY_QUEUE.json'),job=queue.jobs[f.key];job.evidence[0].cardHash='card';f.save('state/EMAIL_RECOVERY_QUEUE.json',queue);
 f.save('state/CLAUDE_HELPER_CONSUMPTION.json',{items:[]});
 const source={key:f.key,provider:'CODE',provenance:'CAPTURED_SOURCE_CARD',cardHash:'card',sourceEvidence:{company:job.company,title:job.title,location:job.location,url:job.url},status:'RETURNED_PENDING_SCREEN'};
 f.save('state/CODE_INTAKE_CONSUMPTION.json',{items:[source,{...source}]});
 const file=p.join(f.root,'state/EMAIL_RECOVERY_QUEUE.json'),original=fs.readFileSync;let reads=0;
 t.mock.method(fs,'readFileSync',function(name,...args){if(String(name)===file)reads++;return original.call(this,name,...args);});
 a.equal(P.prepare(f).counts.READY,2);a.equal(reads,3); // plan queue, fence queue, source snapshot, independent of item count.
 for(const change of [j=>j.company='Changed',j=>j.url='https://other.test/role',j=>j.evidence[0].cardHash='changed']){
  const altered=structuredClone(queue);change(altered.jobs[f.key]);f.save('state/EMAIL_RECOVERY_QUEUE.json',altered);
  a.equal(P.prepare(f).counts.SOURCE_REVALIDATION_REQUIRED,2);
 }
 f.save('state/EMAIL_RECOVERY_QUEUE.json',queue);a.equal(P.prepare(f).counts.READY,2);
});

test('preparation retains coordinator, immutable return and source hash guards with per-pass caching',t=>{
 const f=fixture('Director, Manufacturing');t.after(()=>fs.rmSync(f.root,{recursive:true,force:true}));
 const S=require('../programmed-coordinator/store.cjs'),job=JSON.parse(fs.readFileSync(p.join(f.root,'state/EMAIL_RECOVERY_QUEUE.json'))).jobs[f.key],batch='receipts/program-source.json',source={key:f.key,sourceEvidence:{company:job.company,title:job.title,location:job.location,url:job.url,sourceSha256:'a'.repeat(64)},recommendation:'INTAKE_READY'},inspection={key:'coordinator-item',itemKey:f.key,batch,version:S.hash(source),status:'SOURCE_VERIFIED',sourceEvidence:source.sourceEvidence},program={items:{[inspection.key]:inspection},batches:{[batch]:{status:'VALIDATED'}}};
 f.save('state/CLAUDE_HELPER_CONSUMPTION.json',{items:[]});f.save(batch,{items:[source]});f.save('state/PROGRAMMED_COORDINATOR.json',program);
 const si={key:f.key,provider:'CODE',provenance:'PROGRAMMED_SOURCE_VERIFIED',coordinatorKey:inspection.key,sourceVersion:inspection.version,sourceEvidence:source.sourceEvidence,status:'RETURNED_PENDING_SCREEN'};
 f.save('state/CODE_INTAKE_CONSUMPTION.json',{items:[si,{...si}]});
 const original=fs.readFileSync,reads=new Map();t.mock.method(fs,'readFileSync',function(name,...args){reads.set(String(name),(reads.get(String(name))||0)+1);return original.call(this,name,...args);});
 a.equal(P.prepare(f).counts.READY,2);a.equal(reads.get(p.join(f.root,'state/PROGRAMMED_COORDINATOR.json')),2);a.equal(reads.get(p.join(f.root,batch)),1);
 for(const change of [x=>x.batches[batch].status='QUARANTINED',x=>x.items[inspection.key].version='changed',x=>x.items[inspection.key].status='PENDING',x=>x.items[inspection.key].sourceEvidence.sourceSha256='b'.repeat(64),x=>delete x.items[inspection.key]]){
  const altered=structuredClone(program);change(altered);f.save('state/PROGRAMMED_COORDINATOR.json',altered);a.equal(P.prepare(f).counts.SOURCE_REVALIDATION_REQUIRED,2);
 }
 f.save('state/PROGRAMMED_COORDINATOR.json',program);f.save(batch,{items:[{...source,recommendation:'CHANGED'}]});a.equal(P.prepare(f).counts.SOURCE_REVALIDATION_REQUIRED,2);
 f.save(batch,{items:[]});a.equal(P.prepare(f).counts.SOURCE_REVALIDATION_REQUIRED,2);f.save(batch,{items:[source]});a.equal(P.prepare(f).counts.READY,2);
});

test('program source index preserves first matching inspection and latest valid posting tie order',t=>{
 const f=fixture('Director, Manufacturing');t.after(()=>fs.rmSync(f.root,{recursive:true,force:true}));
 const file=p.join(f.root,'state/EMAIL_RECOVERY_QUEUE.json'),queue=JSON.parse(fs.readFileSync(file)),card=queue.jobs[f.key],sha=s=>require('node:crypto').createHash('sha256').update(s).digest('hex'),batch='receipts/verified-posting.json';
 const e={company:card.company,title:card.title,location:card.location,url:'https://employer.test/jobs/1',initiatingUrl:card.url,observedAt:new Date().toISOString(),sourceSha256:'a'.repeat(64),description:unrelatedRole,descriptionSha256:sha(unrelatedRole),contentBasis:'CAPTURED_ROLE_CONTENT',independentlyVerified:true};
 const item=sourceEvidence=>({itemKey:f.key,batch,status:'SOURCE_VERIFIED',sourceEvidence}),program={batches:{[batch]:{status:'VALIDATED'}},items:{unrelated:{...item(e),itemKey:'other'},first:item(e),second:item({...e,sourceSha256:'b'.repeat(64)})}};
 f.save('state/PROGRAMMED_COORDINATOR.json',program);a.equal(P.prepare({...f,screenContext:atsContext()}).items[0].preliminaryScreen.sourceEvidence.sourceSha256,e.sourceSha256);
 // An earlier inspected identity mismatch must not be replaced by a later one.
 card.evidence=[];f.save('state/EMAIL_RECOVERY_QUEUE.json',queue);program.items.first.sourceEvidence={...e,company:'Other'};f.save('state/PROGRAMMED_COORDINATOR.json',program);
 a.equal(P.prepare({...f,screenContext:atsContext()}).counts.SOURCE_REVALIDATION_REQUIRED,1);
});

test('a preparation source reader still rechecks live shared ownership on each item',t=>{
 const f=fixture('Director, Manufacturing');t.after(()=>fs.rmSync(f.root,{recursive:true,force:true}));
 const I=require('../routine-handoffs/intake-state.cjs'),S=require('../programmed-coordinator/store.cjs'),taskKey='FORGE_GROK_SHARED_HELPER',batch='receipts/shared-source.json',assignment={key:f.key,kind:'INTAKE',provider:'Grok',taskKey,assignmentVersion:1,sourceVersion:'source-v1',status:'ASSIGNED'},work={schema:'forge.shared-helper-work.v1',enabled:true,routingActive:true,assignmentId:'SHARED-TEST',providers:{FORGE_GROK_SHARED_HELPER:{provider:'Grok',available:true},FORGE_CLAUDE_SHARED_HELPER:{provider:'Claude',available:true}},items:[assignment]},source={key:f.key,kind:'INTAKE',assignmentVersion:1,sourceVersion:'source-v1',writerSubmitted:false,recommendation:'INTAKE_READY',sourceEvidence:{company:'Factory',title:'Director, Manufacturing',location:'Austin, TX',url:'https://careers.example.com/jobs/1',observedAt:new Date().toISOString(),sourceSha256:'a'.repeat(64),quote:'Synthetic role source.'}};
 const envelope={schema:'forge.shared-helper-batch.v1',provider:'Grok',taskKey,assignmentId:work.assignmentId,runId:'FORGE-GROK-TEST',instructionCommit:'a'.repeat(40),items:[source]},inspection={key:'one',itemKey:f.key,batch,status:'SOURCE_VERIFIED',version:S.hash(source),sourceEvidence:source.sourceEvidence},si={key:f.key,provider:'CODE',provenance:'PROGRAMMED_SOURCE_VERIFIED',coordinatorKey:inspection.key,sourceVersion:inspection.version,sourceEvidence:source.sourceEvidence};
 f.save(batch,envelope);f.save('state/PROGRAMMED_COORDINATOR.json',{items:{one:inspection},batches:{[batch]:{status:'VALIDATED'}}});f.save('control/SHARED_HELPER_WORK.json',work);
 const read=I.originalReader(f.root);a.deepEqual(read(si,{}),source);
 assignment.status='CONSUMED';f.save('control/SHARED_HELPER_WORK.json',work);a.throws(()=>read(si,{}),/SHARED_RESERVATION_CLOSED/);
 assignment.status='ASSIGNED';assignment.assignmentVersion=2;f.save('control/SHARED_HELPER_WORK.json',work);a.throws(()=>read(si,{}),/STALE_OR_UNASSIGNED_SHARED_ITEM/);
 assignment.assignmentVersion=1;f.save('control/SHARED_HELPER_WORK.json',work);a.deepEqual(read(si,{}),source);
 // Non-preparation callers never share this source snapshot.
 f.save(batch,{...envelope,items:[{...source,recommendation:'CHANGED'}]});a.throws(()=>I.original(f.root,si,{}),/IMMUTABLE_SOURCE_RETURN_REQUIRED/);
});


test('saved source-bound cards bypass scope and level review but preserve evidence and original-write guards',()=>{
 for(const title of ['General Manager','Director, Data Center Operations','Production Engineer']){
  const f=fixture(title);let out=P.prepare(f);a.equal(out.counts.READY,1,title);a.equal(out.items[0].record.TITLE,title);
  const queue=JSON.parse(fs.readFileSync(p.join(f.root,'state/EMAIL_RECOVERY_QUEUE.json')));queue.jobs[f.key].evidence=[];f.save('state/EMAIL_RECOVERY_QUEUE.json',queue);a.equal(P.prepare(f).counts.SOURCE_REVALIDATION_REQUIRED,1);
  queue.jobs[f.key].submissions=[{requestId:'ORIGINAL'}];f.save('state/EMAIL_RECOVERY_QUEUE.json',queue);a.equal(P.prepare(f).counts.ORIGINAL_WRITER_FENCE,1);
 }
});
test('a bad captured expiry remains an item hold without aborting healthy preparation or bypassing original fences',()=>{
 const f=fixture('Director, Manufacturing'),read=file=>JSON.parse(fs.readFileSync(p.join(f.root,file))),state=read('state/CLAUDE_HELPER_CONSUMPTION.json'),batch=read(state.items[0].batch),queue=read('state/EMAIL_RECOVERY_QUEUE.json'),work=read('control/CLAUDE_HELPER_WORK.json');
 let goodId=4481234568;while(H.shard('linkedin:'+goodId)!==H.shard(f.key))goodId++;const goodKey='linkedin:'+goodId,good={...batch.items[0].sourceEvidence,company:'Other Factory',url:'https://www.linkedin.com/jobs/view/'+goodId+'/'};batch.items.push({...batch.items[0],key:goodKey,sourceEvidence:good});state.items.push({...state.items[0],key:goodKey});work.intake.push({...work.intake[0],key:goodKey});queue.jobs[goodKey]={...queue.jobs[f.key],...good,key:goodKey};
 f.save(state.items[0].batch,batch);f.save('state/CLAUDE_HELPER_CONSUMPTION.json',state);f.save('control/CLAUDE_HELPER_WORK.json',work);f.save('state/EMAIL_RECOVERY_QUEUE.json',queue);f.save('state/source-trial-report.json',{summary:{at:'2026-01-01T00:00:00Z'},new_roles:[{...batch.items[0].sourceEvidence,source:'LINKEDIN',description:'',validThrough:'bad'}, {...good,source:'LINKEDIN',description:''}]});
 const result=P.prepare(f);a.equal(result.counts.POSTING_EXPIRY_INVALID,1);a.equal(result.counts.READY,1);a.equal(result.items.find(x=>x.key===f.key).record,undefined);
 queue.jobs[f.key].submissions=[{requestId:'ORIGINAL'}];f.save('state/EMAIL_RECOVERY_QUEUE.json',queue);a.equal(P.prepare(f).counts.ORIGINAL_WRITER_FENCE,1);
});
