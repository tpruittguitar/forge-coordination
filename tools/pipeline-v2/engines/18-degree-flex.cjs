'use strict';
// Engine 18: degree flexibility, moved out of the Writer. Uses the Writer's own FLEX rule (pipeline-policy.js
// flex with the SECTION=DEGREE_FLEX keys from Tim's canonical rules), so the class and modifier match.
const {filled}=require('../store.cjs');
const select=j=>!filled(j,'FLEX_CLASS');
function work(job,ctx){
 if(!filled(job,'DEGREE_TEXT'))return {status:'WAIT',reason:'WAITING_ON_14_DEGREE_TEXT'};
 if(!ctx.viewer||!ctx.flexPolicy)throw Error('VIEWER_MODULES_REQUIRED');
 const f=ctx.viewer.Policy.flex({DEGREE_TEXT:job.fields.DEGREE_TEXT.value},ctx.flexPolicy);
 const src='PIPELINE_V2_FLEX:'+(ctx.flexPolicy.FLEX_POLICY_VERSION||'DEFAULTS');
 return {status:'PASS',reason:'FLEX:'+f.class,fields:{FLEX_CLASS:{value:f.class,source:src},FLEX_MODIFIER:{value:f.modifier,source:src}}};
}
module.exports={id:'18',select,work};
