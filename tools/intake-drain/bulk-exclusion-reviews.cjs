'use strict';
// Prepare reviews only. Existing independent verifier and observer own disposition.
const fs=require('node:fs'),path=require('node:path'),Q=require('./queue.cjs'),E=require('./exclusions.cjs'),S=require('../programmed-coordinator/store.cjs');
function prepare(root,{keys,runId,now=Date.now(),work=Q.sync(root,{now})}={}){
 if(!Array.isArray(keys)||!keys.length||keys.some(k=>typeof k!=='string')||new Set(keys).size!==keys.length)throw Error('EXPLICIT_UNIQUE_ASSIGNED_KEYS_REQUIRED');
 if(!/^FORGE-DRAIN-[A-Za-z0-9_-]+$/.test(runId||''))throw Error('EXPLICIT_RUN_ATTRIBUTION_REQUIRED');
 const bindings=[...S.read(root,'reference/EXCLUSION_BUSINESS_EVIDENCE.json',{entries:[]}).entries,...S.read(root,'reference/EXCLUSION_ROLE_EVIDENCE.json',{entries:[]}).entries];
 const reviews=[],skipped=[];
 for(const key of keys){
  const item=work.items[key];let reason;
  if(!item)reason='CURRENT_KEY_REQUIRED';
  else if(item.status!=='ACTION_REQUIRED')reason='EXISTING_WORK_OR_DISPOSITION';
  else if(item.review)reason='EXISTING_REVIEW_REQUIRES_OWNER_RECONCILIATION';
  else if(item.owner!=='ChatGPT'||!Object.values(Q.TASKS).includes(item.taskKey)||item.taskKey==='CODE')reason='ASSIGNED_RESEARCH_OWNER_REQUIRED';
  let matches=item?bindings.filter(b=>b.kind==='ROLE_TEMPLATE'?E.roleMatches(b,item.card):!b.kind&&b.company===item.card.company):[];
  if(item&&!reason&&!matches.length){const t=require('./title-exclusions.cjs').proposal(root,item.card);if(t)matches=[t];}
  if(!reason&&matches.length!==1)reason='ONE_REVIEWED_EXACT_EMPLOYER_BINDING_REQUIRED';
  if(reason){skipped.push({key,reason});continue;}
  const b=matches[0],role=['ROLE_TEMPLATE','TITLE_RULE'].includes(b.kind),r={schema:'forge.intake-drain-review.v1',key,sourceVersion:item.sourceVersion,provider:'ChatGPT',taskKey:item.taskKey,runId,observedAt:new Date(now).toISOString(),outcome:'EXCLUSION_CANDIDATE',originalCard:{...item.card},exclusionEvidence:{...(role?{kind:b.kind,title:b.title}:{}),company:b.company,ruleId:b.ruleId,url:b.url,quote:b.quote},reason:b.kind==='TITLE_RULE'?'Exact captured title matches a narrow role rule; independent current-card and active-rule validation required.':role?'Exact employer and title match reviewed role binding; independent active-rule and public-source validation required.':'Exact employer matches reviewed primary-business binding; independent active-rule and public-source validation required.',nextAction:b.kind==='TITLE_RULE'?'Existing verifier must validate exact current captured title and active rule; existing observer must protect canonical matches and independently account disposition.':'Existing verifier must validate active rule and reviewed public source; existing observer must protect canonical matches and independently account disposition.',attempts:[{action:b.kind==='TITLE_RULE'?'MATCH_EXACT_CAPTURED_TITLE_RULE':role?'MATCH_REVIEWED_EXACT_ROLE_BINDING':'MATCH_REVIEWED_EMPLOYER_BINDING',source:b.kind==='TITLE_RULE'?'reference/EXCLUSION_TITLE_RULES.json':role?'reference/EXCLUSION_ROLE_EVIDENCE.json':'reference/EXCLUSION_BUSINESS_EVIDENCE.json',bindingSha256:S.hash(b),result:(role?'Exact employer and title match;':'Exact employer match;')+' no source fetch, active-rule assertion or Writer submission.'}],writerSubmitted:false};
  try{Q.validate(r,item,now);reviews.push(r);}catch(e){skipped.push({key,reason:e.message});}
 }
 return{schema:'forge.bulk-exclusion-review-plan.v1',at:new Date(now).toISOString(),runId,requested:keys.length,prepared:reviews.length,skipped,reviews,canonicalWrites:0,published:0,independentlyVerified:0,excluded:0};
}
if(require.main===module){try{const [file]=process.argv.slice(2);if(!file)throw Error('Use bulk-exclusion-reviews.cjs <assigned-keys-and-run-id.json>');console.log(JSON.stringify(prepare(path.resolve(__dirname,'../..'),JSON.parse(fs.readFileSync(file,'utf8'))),null,2));}catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={prepare};
