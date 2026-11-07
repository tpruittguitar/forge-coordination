'use strict';
// Writer sanitizeRecord-supported evidence only. Never change stable request-ID inputs.
const Identity=require('../source-trial/job-identity');
function writerIdentityFields(source={}){
 const saved=Identity.carry(source),out={};
 // Keep additional URLs only where Writer accepts them. SOURCE_URL is built by
 // the caller. Discovery ATS/req aliases remain saved source evidence, not new
 // REQ_ID inputs or unsupported payload fields silently discarded by Writer.
 for(const key of ['SOURCE','INITIATING_URL','COMPANY_SOURCE_URL'])if(saved[key])out[key]=saved[key];
 const first=(...keys)=>keys.map(k=>saved[k]).find(Boolean);
 for(const [key,aliases]of [
  ['REMOTE_HYBRID',['REMOTE_HYBRID','workArrangement','workMode']],
  ['OPERATING_SCOPE',['OPERATING_SCOPE','operatingScope','LOCATION_SCOPE','worksiteScope']],
  ['OPERATING_SCOPE_EVIDENCE',['OPERATING_SCOPE_EVIDENCE','operatingScopeEvidence','scopeEvidence']]
 ]){const value=first(...aliases);if(value)out[key]=value;}
 const scopeUrl=source.OPERATING_SCOPE_SOURCE_URL||(source.p||source.payload||{}).OPERATING_SCOPE_SOURCE_URL;
 if(typeof scopeUrl==='string'&&scopeUrl.trim())out.OPERATING_SCOPE_SOURCE_URL=scopeUrl;
 return out;
}
module.exports={writerIdentityFields};
