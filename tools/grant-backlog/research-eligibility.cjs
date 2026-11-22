'use strict';
// Early research admission only. Reuses existing screens; never changes policy.
const S=require('../programmed-coordinator/store.cjs'),T=require('../programmed-coordinator/transactions.cjs');
const P=require('../source-trial/preliminary-screen'),Titles=require('../intake-drain/title-exclusions.cjs');
const patterns=require('../source-trial/never-consider-patterns.json').rules;
const fail=c=>{throw Error(c);};
function evaluate({root,row,rules,policyProof,evidence,readAt,now=Date.now(),classifyNeverConsider}){
 if(typeof classifyNeverConsider!=='function')fail('SUPPORTED_WRITER_CLASSIFIER_REQUIRED');
 if(T.protectedRow(row))fail('PROTECTED_SKIP');
 if(rules?.source!=='TIM_PIPELINE_RULES_CANONICAL'||rules.status!=='ACTIVE'||!rules.raw||policyProof?.rawSha256!==S.hash(rules.raw))fail('CURRENT_POLICY_SOURCE_CHAIN_REQUIRED');
 const active=rules.rules?.filter(r=>r.active);
 if(!active||new Set(active.map(r=>r.RULE_ID)).size!==active.length||patterns.some(p=>!active.some(r=>r.RULE_ID===p.id)))fail('COMPLETE_SUPPORTED_RULE_SET_REQUIRED');
 const roleDefs=S.read(root,'reference/EXCLUSION_TITLE_RULES.json',{rules:[]}).rules;
 for(const r of active){
  if(r.ACTION!=='DO_NOT_ADD')fail('REVIEW_RULE_CHANGED');
  const b=patterns.find(p=>p.id===r.RULE_ID&&p.category===r.CATEGORY&&p.matchSha256===S.hash(r.MATCH||''));
  const role=roleDefs.find(p=>p.ruleId===r.RULE_ID&&p.category===r.CATEGORY);
  const lines=rules.raw.split(/\r?\n/).filter(l=>l.startsWith('- '+r.RULE_ID+' '));
  if(lines.length!==1||!(b&&lines[0]==='- '+r.RULE_ID+' '+r.CATEGORY+': '+r.MATCH||role&&S.hash(lines[0])===role.definitionSha256))fail('REVIEW_RULE_CHANGED');
 }
 const posting=require('./worker.cjs').publicEvidence(evidence?.posting,row),quote=evidence.employerBusinessQuote;
 const at=Date.parse(posting.observedAt),observed=Date.parse(readAt);
 if(!Number.isFinite(observed)||observed>now||now-observed>900000||!Number.isFinite(at)||at>now||now-at>86400000||posting.fullPosting!==true||evidence.businessScopeReviewed!==true||posting.text.length<300||typeof quote!=='string'||quote.length<30||!posting.text.includes(quote))fail('COMPLETE_CURRENT_BUSINESS_EVIDENCE_REQUIRED');
 const card={company:posting.company,title:posting.title,location:posting.location,url:posting.url,description:posting.text};
 // Explicit null prevents loading a resume. ATS is outside this research gate.
 const context={profile:null,documents:null,rules,checkedAt:readAt,now};
 const screen=P.screen(card,context),business=P.screen({...card,description:quote},context);
 if([screen,business].some(s=>s.neverConsider.status!=='NO_CONFIRMED_EXCLUSION'||s.unresolved.includes('EMPLOYER_BUSINESS_NOT_REVIEWED')||s.unresolved.includes('CANONICAL_RULES_NOT_VERIFIED')))fail('NEVER_CONSIDER_REVIEW_OR_EXCLUSION');
 if(Titles.proposal(root,card))fail('NEVER_CONSIDER_TITLE_HOLD');
 // ALLOW is required but insufficient: all evidence/screen gates above run first.
 const classified=classifyNeverConsider({COMPANY:row.COMPANY,TITLE:row.TITLE,EMPLOYER_PRIMARY_BUSINESS:quote},rules);
 if(classified?.outcome!=='ALLOW')fail('WRITER_CLASSIFIER_REVIEW_OR_EXCLUSION');
 return {schema:'forge.early-research-admission.v1',status:'RESEARCH_ADMITTED',scope:'MISSING_PUBLIC_FACTS_ONLY',
  primaryId:row.PRIMARY_ID,rowSha256:S.hash(row.line),policySha256:policyProof.rawSha256,policyCommit:policyProof.commit,
  readAt,sourceUrl:posting.url,sourceSha256:posting.sha256,evidenceSha256:S.hash(evidence),
  businessQuote:quote,screenStatus:screen.neverConsider.status,writerClassification:classified.outcome,
  coveredRuleIds:active.map(r=>r.RULE_ID).sort(),canonicalEligibility:false,writerAuthorized:false};
}
function validate(proof,row,snapshot){
 if(proof?.schema!=='forge.early-research-admission.v1'||proof.status!=='RESEARCH_ADMITTED'||proof.scope!=='MISSING_PUBLIC_FACTS_ONLY'||
  proof.canonicalEligibility!==false||proof.writerAuthorized!==false||proof.primaryId!==row.PRIMARY_ID||proof.rowSha256!==S.hash(row.line)||
  proof.readAt!==snapshot.source.readAt||proof.policySha256!==snapshot.policyProof?.rawSha256||proof.policyCommit!==snapshot.policyProof?.commit||
  !/^[a-f0-9]{64}$/.test(proof.evidenceSha256||'')||!/^[a-f0-9]{64}$/.test(proof.sourceSha256||'')||proof.screenStatus!=='NO_CONFIRMED_EXCLUSION'||proof.writerClassification!=='ALLOW')fail('CURRENT_RESEARCH_ADMISSION_REQUIRED');
 return true;
}
module.exports={evaluate,validate};
