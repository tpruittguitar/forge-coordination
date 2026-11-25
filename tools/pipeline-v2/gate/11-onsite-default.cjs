'use strict';
// Step 11: onsite default. Work mode is ONSITE unless the posting states remote or hybrid.
const {filled}=require('../store.cjs');
module.exports=function onsiteDefault(job){
 if(filled(job,'REMOTE_HYBRID'))return {status:'SKIP',reason:'ALREADY_RECORDED'};
 const loc=String(job.location||''),head=String(job.description||'').slice(0,4000);
 let mode='ONSITE',source='DEFAULT_ONSITE_UNLESS_STATED';
 if(/\bhybrid\b/i.test(loc)){mode='HYBRID';source='LOCATION_TEXT';}
 else if(/\bremote\b/i.test(loc)){mode='REMOTE';source='LOCATION_TEXT';}
 else if(/\b(this (?:role|position) is (?:fully )?remote|remote[- ]first|work from home|fully remote)\b/i.test(head)){mode='REMOTE';source='POSTING_TEXT';}
 else if(/\b(this (?:role|position) is hybrid|hybrid (?:role|schedule|work))\b/i.test(head)){mode='HYBRID';source='POSTING_TEXT';}
 return {status:'PASS',reason:mode+':'+source,fields:{REMOTE_HYBRID:{value:mode,source}}};
};
