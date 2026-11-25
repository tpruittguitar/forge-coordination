'use strict';
// Engine 19: final score, moved out of the Writer, runs last. Calls the Writer's own scoreRow
// (pipeline-scoring.js) with Tim's published scoring model and FLEX policy; bots never tune the formula.
// Missing AI inputs give a partial score that is redone when they land.
const {filled}=require('../store.cjs');
const OUT=['OVERALL','OVERALL_RATING','EXPERIENCE_FIT','GEO','NET_COMP','RATING_CONFIDENCE','FLEX_RATING_IMPACT','ADJUSTED_FIT','PURSUIT_STATUS','PAY_WORTH','FLEX_MODIFIER'];
const select=j=>!filled(j,'OVERALL')||(String(j.fields.OVERALL.source).includes('PARTIAL')&&filled(j,'SCOPE_FIT_RAW'));
function work(job,ctx){
 for(const [k,step] of [['PAY_POSTED','13'],['SALARY_BASIS','17'],['FLEX_CLASS','18'],['REMOTE_HYBRID','11']])if(!filled(job,k))return {status:'WAIT',reason:'WAITING_ON_'+step};
 if(!ctx.viewer||!ctx.scoringModel||!ctx.flexPolicy)throw Error('SCORING_MODEL_REQUIRED');
 const payload={};for(const [k,v] of Object.entries(job.fields))if(!OUT.includes(k))payload[k]=String(v.value);
 payload.SOURCE_URL=job.url;payload.ROLE_TEXT=String(job.description||'').slice(0,4000);
 const config=Object.assign({},ctx.scoringModel,{flexPolicy:ctx.flexPolicy,targetCompanies:ctx.flexPolicy._TARGET_COMPANIES||[]});
 const s=ctx.viewer.Scoring.scoreRow({COMPANY:job.company,TITLE:job.title,LOCATION:job.location,payload},config);
 const missing=['SCOPE_FIT_RAW','EMPLOYER_PRIMARY_BUSINESS'].filter(k=>!filled(job,k));
 const src='PIPELINE_V2_SCORE:'+s.modelId+' '+s.modelVersion+(missing.length?':PARTIAL':'');
 const val=x=>x==null?'UNKNOWN':x;
 return {status:'PASS',reason:missing.length?'PARTIAL_SCORE:MISSING_'+missing.join('+'):'SCORED',fields:{
  OVERALL:{value:val(s.overall),source:src},RATING_CONFIDENCE:{value:s.confidence,source:src},
  GEO:{value:s.parts.geo.known?s.parts.geo.score:'UNKNOWN',source:src},NET_COMP:{value:s.parts.compensation.known?s.parts.compensation.score:'UNKNOWN',source:src},
  ADJUSTED_FIT:{value:val(s.assessment.adjustedFit),source:src},PURSUIT_STATUS:{value:val(s.assessment.decision),source:src},
  PAY_WORTH:{value:s.payWorth&&s.payWorth.score!=null?s.payWorth.score:'UNKNOWN',source:src},SCORE_BAND:{value:val(s.band),source:src},
  SCORE_INPUTS_MISSING:{value:missing.join(',')||'NONE',source:src}}};
}
module.exports={id:'19',select,work};
