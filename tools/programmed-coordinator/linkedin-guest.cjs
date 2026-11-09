'use strict';
// Derive only a public LinkedIn job route. A helper's fetchUrl is never trusted.
const cp=require('node:child_process'),path=require('node:path');
function id(raw){
 try{const u=new URL(raw);if(u.protocol!=='https:'||!['www.linkedin.com','linkedin.com'].includes(u.hostname)||u.username||u.password||u.port)return null;
  return u.pathname.match(/^\/(?:comm\/)?jobs\/view\/(?:[^/]+-)?(\d+)\/?$/)?.[1]||null;
 }catch{return null;}
}
function routes(urls){const seen=new Set();return urls.flatMap(raw=>{const jobId=id(raw);if(!jobId||seen.has(jobId))return[];seen.add(jobId);return[{kind:'linkedin-guest',id:jobId,page:`https://www.linkedin.com/jobs/view/${jobId}`,api:`https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${jobId}`}];});}
function posting(raw,route,finalUrl){
 if(route?.kind!=='linkedin-guest'||!/^\d+$/.test(route.id)||route.api!==`https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${route.id}`||route.page!==`https://www.linkedin.com/jobs/view/${route.id}`||finalUrl!==route.api)throw Error('LINKEDIN_SOURCE_IDENTITY_CONFLICT');
 let found;try{found=JSON.parse(cp.execFileSync(process.env.FORGE_PYTHON||'python',[path.join(__dirname,'html-posting.py'),'--linkedin-guest'],{input:raw,encoding:'utf8',maxBuffer:5e6,windowsHide:true}));}catch{throw Error('LINKEDIN_SOURCE_EXTRACTION_FAILED');}
 if(!found)throw Error('STRUCTURED_POSTING_UNAVAILABLE');
 if(id(found.url)!==route.id||found.jobIds.length!==1||found.jobIds[0]!==route.id)throw Error('LINKEDIN_SOURCE_IDENTITY_CONFLICT');
 if(found.closed)throw Error('POSTING_EXPIRED');
 if(!found.title||!found.company||!found.location||!found.description)throw Error('INCOMPLETE_POSTING');
 return{'@type':'JobPosting',title:found.title,hiringOrganization:{name:found.company},jobLocation:{address:require('./posting-formats.cjs').address(found.location)},description:found.description,url:route.page,identifier:{value:route.id}};
}
function exactLink(source){posting(source.raw,source.route,source.finalUrl);return source.route.page;}
module.exports={id,routes,posting,exactLink};
