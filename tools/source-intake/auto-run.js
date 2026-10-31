#!/usr/bin/env node
'use strict';
/* AUTO source intake (Tim 2026-10-23): run by .github/workflows/source-intake-auto.yml after each source trial on main.
 * Does nothing unless control/SOURCE_INTAKE_RELEASE.json is armed as AUTO and FORGE_WRITER_KEY is set.
 * 1. Refuses to start while an earlier AUTO run in receipts/auto-intake/ is unfinished (it needs a person). That refusal
 *    happens before any Writer call and exits 0 with a warning; the latch is listed on attention/NEEDS_TIM.json.
 * 2. Picks up to maxBatch NEW roles from state/source-trial-report.json with the 24-job stage's filters
 *    (Director+/Senior Manager, or Senior Staff/Principal engineer, core functions, no agencies, at most 2 per employer,
 *    never a role an earlier AUTO run already sent), and keeps only those whose posting page loads and names the employer.
 * 3. snapshot before -> auto (one insert at a time, waits for each receipt) -> snapshot after -> finalize, with the same
 *    executor gates as the stage. The Writer decides Never Consider; what it declines without writing is SKIPPED.
 * State and outcome go to receipts/auto-intake/<run>.json (Writer responses only, never the key).
 * Exit 1 = THIS run halted and needs a person (halt or reconcile HOLD); the workflow commits the state first.
 * Exit 0 = done, off, or latched by an earlier halted run (see tools/source-intake/auto-latch.js).
 * Run: node tools/source-intake/auto-run.js [--report state/source-trial-report.json] [--dry-run] */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {snapshot,auto,finalize}=require('./intake-cli');
const {read}=require('./writer-reader');
const {requestId,releaseRules}=require('./production-executor');
const {DIR,previous,latch,identityKey}=require('./auto-latch');
const {normalizeCompany}=require('./record-normalize');
const {carryForwardRoles}=require('./carry-forward');
const {knownRequestIds}=require('./known-requests');

const SWITCH='control/SOURCE_INTAKE_RELEASE.json';
const LEVELS=new Set(['DIRECTOR_PLUS','SR_MANAGER']);
// Tim 2026-10-26: "Sr staff on the west coast is also a high level good fit at most of those companies." Discovery tags
// Staff, Senior Staff and Principal engineer titles SR_STAFF; Senior Staff and Principal pass, plain Staff does not.
const SENIOR_IC=/\b(?:senior staff|sr\.? staff|principal)\b/i;
const levelOk=r=>LEVELS.has(r.level)||(r.level==='SR_STAFF'&&SENIOR_IC.test(r.title));
const CORE=/production|manufactur|quality|plant|test engineer|commissioning|operational excellence|continuous improvement|operations director|director of operations|npi|industrializ/i;
const OFF=/account|financ|compensation|payroll|\bhse\b|\behs\b|safety|environment|strateg|software|supply chain|procure|sourcing|purchas|\bml\b|data|analyst|marketing|sales|human resources|\bhr\b|talent|recruit|legal|\bit\b|cyber|operator|technician|intern/i;
// No location is dropped here (Tim 2026-10-26: "I would take a good fit offer on the west coast for 280k"; Memphis can
// be OK). Location is scored by the geo map / PAY_WORTH per the canonical rules, after intake.
const AGENCY=/staffing|recruit|talent|executive search|search partners|personnel|placement|consulting|hr solutions|workforce|\bcareers$/i;
// Tim 2026-10-23: no pharmaceutical or medical companies. Checked on company + title, then on the posting text.
const MEDICAL=/pharm|bio(?!fuel|diesel|plastic|mass|gas)|microbio|gene therap|cell therap|genetic|life science|biologic|therapeutic|diagnostic|medical|medtech|med tech|health ?care|health system|hospital|clinic|surgical|dental|orthop|patient|\bdrug|vaccine|genomic|oncolog|cardio|biopharm|\bhealth\b(?! ?(?:and|&) ?safety)/i;
const MEDICAL_TEXT=/pharmaceutical|gene therapy|cell therapy|orthopedic|surgical|biotech|biopharm|life sciences company|medical device|medtech|health ?care company|hospital|patients\b/i;

const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const strip=h=>String(h).replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&amp;/g,'&').replace(/&#39;|&rsquo;/g,"'").replace(/&quot;/g,'"').replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim();
const meta=(h,n)=>(h.match(new RegExp('<meta[^>]+(?:name|property)=["\']'+n+'["\'][^>]+content=["\']([^"\']{20,})','i'))||[])[1];

function screenReason(r){if(!levelOk(r))return 'LEVEL_FILTER';if(!CORE.test(r.title)||OFF.test(r.title))return 'FUNCTION_FILTER';if(AGENCY.test(r.company))return 'AGENCY_FILTER';if(MEDICAL.test(r.company+' '+r.title))return 'INDUSTRY_FILTER';return null;}
function pick(report,{max,sent,blockedIdentities=new Set()}){
 const per={},out=[];
 for(const r of report.new_roles||[]){
  if(out.length>=max)break;
  if(screenReason(r))continue;
  if(!/^https:\/\/[^\s/]+\//i.test(r.url||'')||!r.location)continue;
  // Employer as the Writer compares it (text before " | "); the raw name's request ID is still checked so a role an
  // earlier run sent under the raw name is never sent again under the normalized one.
  const company=normalizeCompany(r.company).company;
  const k=company.toLowerCase();if((per[k]||0)>=2)continue;
  const record={COMPANY:company,TITLE:r.title,LOCATION:r.location,SOURCE_URL:r.url};
  if(blockedIdentities.has(identityKey(record)))continue; // a changed URL cannot bypass an uncertain prior write
  if(sent.has(requestId(record))||sent.has(requestId({...record,COMPANY:r.company})))continue;
  per[k]=(per[k]||0)+1;out.push({r,record});
 }
 return out;
}
// The posting must load and name the employer; its description is the employer-business evidence the Writer screens.
async function evidence(url,company,fetcher=globalThis.fetch){
 try{
  const res=await fetcher(url,{redirect:'follow',signal:AbortSignal.timeout(20000),headers:{'User-Agent':'Mozilla/5.0 (forge-source-intake)'}});
  if(!res.ok)return null;
  const html=await res.text(),text=strip(html);
  if(!text.toLowerCase().includes(company.toLowerCase().split(/[ ,]/)[0]))return null;
  if(MEDICAL_TEXT.test(text.slice(0,4000)))return null;
  const d=meta(html,'og:description')||meta(html,'description')||text;
  const at=d.toLowerCase().indexOf(company.toLowerCase().split(/[ ,]/)[0]);
  return strip(d.slice(Math.max(0,at>=0?at:0),(at>=0?at:0)+300))||null;
 }catch{return null}
}
async function main(argv=process.argv.slice(2)){
 const opt=k=>{const i=argv.indexOf(k);return i>=0?argv[i+1]:null},dry=argv.includes('--dry-run');
 const rules=releaseRules(JSON.parse(fs.readFileSync(SWITCH,'utf8')));
 if(!dry&&(!rules||rules.mode!=='AUTO'))return console.log('AUTO intake off: release switch is not armed as AUTO');
 const key=process.env.FORGE_WRITER_KEY;
 if(!key)return console.log('AUTO intake off: FORGE_WRITER_KEY is not set');
 let prior=previous();
 // One bounded transport recovery per scheduled pass; same workflow concurrency and Writer locks apply.
 if(!dry){for(const p of prior)require("./unknown-recovery").contain(p.file);prior=previous();const unresolved=prior.find(p=>p.state.quarantine&&!require("./unknown-recovery").resolved(p.state));if(unresolved){console.log("UNKNOWN recovery",JSON.stringify(await require("./unknown-recovery").recover(unresolved.file,{key})));prior=previous();}}
 // An earlier run that halted needs a person (UNKNOWN POST, HOLD, a switch change, ...). This run then stops HERE, before
 // any Writer call, and exits 0: it is a deliberate latch, not a new failure (2026-10-24 11:30Z to 2026-10-26: 8 red runs in a row
 // only repeated the 2026-10-24 05:11Z UNKNOWN halt). The halt itself was red once; the latch is on attention/NEEDS_TIM.json and
 // in a ::warning:: annotation. Never auto-clears: UNKNOWN is reconciled against the receipt index, never retried.
 // A single, DURABLY captured identity mismatch may be isolated from unrelated future work (quarantined below).
 const {blocking,quarantined}=latch(prior);
 if(blocking.length){
  for(const b of blocking){
   const msg='NEEDS TIM: AUTO intake latched by earlier unfinished run '+b.file+' ('+b.message+(b.requestId?'; request '+b.requestId:'')+'). No Writer call was made. Reconcile that run, then later runs resume.';
   console.log('::warning title=AUTO intake latched::'+msg);
   console.error(msg);
  }
  return {latched:blocking};
 }
 if(quarantined.length)console.error('NEEDS TIM: isolated identity HOLD(s), NOT resolved: '+JSON.stringify(quarantined));
 // Count only attempts actually recorded; unattempted tail candidates are safe to
 // consider again. Quarantined and all other attempted requests remain excluded.
 const sent=knownRequestIds(prior);
 const report=JSON.parse(fs.readFileSync(opt('--report')||'state/source-trial-report.json','utf8'));
 const carried=carryForwardRoles(prior);
 // A rolled-over discovery report must not lose a reconciled run's untouched candidates.
 const uniqueRoles=new Map();
 for(const r of [...carried,...(report.new_roles||[])]){
  const id=requestId({COMPANY:normalizeCompany(r.company).company,TITLE:r.title,LOCATION:r.location,SOURCE_URL:r.url});
  if(!uniqueRoles.has(id))uniqueRoles.set(id,r);
 }
 report.new_roles=[...uniqueRoles.values()];
 const rulesHash=sha((await read('rules',{key})).data.rules.raw);
 const blockedIdentities=new Set(quarantined.filter(q=>q.identityKey).map(q=>q.identityKey));
 const picked=pick(report,{max:(rules?.maxBatch||25)*3,sent,blockedIdentities}),candidates=[];
 for(const {r,record} of picked){
  if(candidates.length>=(rules?.maxBatch||25))break;
  const business=await evidence(r.url,r.company);
  if(!business)continue;
  candidates.push({record,expectedOutcome:'NEW',evidenceVerified:true,evidenceSource:'INDEPENDENT_VERIFIED',evidenceUrl:r.url,primaryBusiness:business,
   reviewedNeverConsider:false,rulesHash,businessEvidenceApproved:true,source:r.source,family:r.family,level:r.level,
   approval:{by:'AUTO',basis:'SOURCE_INTAKE_AUTO_V1 armed by Tim; report '+(report.summary?.run||'')}});
 }
 const run='FORGE-AUTO-'+new Date().toISOString().replace(/[-:]/g,'').slice(0,13)+'Z';
 console.log(JSON.stringify({run,carriedForward:carried.length,newRoles:(report.new_roles||[]).length,filtered:picked.length,candidates:candidates.length}));
 if(dry){fs.writeFileSync('/tmp/auto-candidates.json',JSON.stringify(candidates,null,1));return}
 fs.mkdirSync(DIR,{recursive:true});
 const statePath=path.join(DIR,run+'.json');
 if(!candidates.length){fs.writeFileSync(statePath,JSON.stringify({run,noCandidates:true,at:new Date().toISOString()}));return}
 fs.writeFileSync(path.join(DIR,run+'.candidates.json'),JSON.stringify(candidates,null,1));
 await snapshot('before',{statePath,candidates,sourceRunId:run,key,mode:'AUTO'});
 const r=await auto({statePath,candidates,key});
 console.log(JSON.stringify({status:r.status,message:r.message||'',outcomes:(r.outcomes||[]).map(o=>o.status)}));
 if(r.status!=='ALL_CASES_ACCOUNTED'&&r.status!=='ALREADY_COMPLETE')throw Error('NEEDS TIM: AUTO run halted: '+r.message);
 await snapshot('after',{statePath,candidates,key});
 const rec=finalize({statePath,candidates});
 console.log(JSON.stringify(rec));
 if(rec.status==='HOLD')throw Error('NEEDS TIM: AUTO reconcile HOLD '+rec.reason);
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1});
module.exports={pick,evidence,main,screenReason};
