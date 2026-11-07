'use strict';
// Bounded URL parsing only. No fetches, arbitrary redirects, fuzzy req IDs or ATS writes.
function tokens(raw,nested=false){
 if(typeof raw!=='string'||raw.length>8192)return [];
 let u;try{u=new URL(raw);}catch{return [];}
 if(!['http:','https:'].includes(u.protocol)||u.username||u.password||u.port)return [];
 const h=u.hostname,p=u.pathname.replace(/\/$/,''),out=[];
 const add=(scope,id,label)=>out.push({scope,id,token:JSON.stringify([scope,id]),label});
 const param=(name,pattern)=>{const values=u.searchParams.getAll(name);return values.length===1&&pattern.test(values[0])?values[0]:null;};
 let m,id;
 if(h==='jsv3.recruitics.com'&&p==='/redirect'){
  const cid=param('rx_cid',/^\d{1,20}$/),job=param('rx_jobId',/^[A-Za-z0-9_.-]{1,100}$/);
  if(cid&&job)add('recruitics:'+cid,job,'Recruitics requisition');
  const destination=param('rx_url',/^https?:\/\/.{1,4096}$/);
  if(!nested&&destination)out.push(...tokens(destination,true));
 }else if(h==='www.glassdoor.com'&&(p==='/partner/jobListing.htm'||/^\/job-listing\/[^/]+\.htm$/.test(p))&&(id=param('jobListingId',/^\d{1,30}$/)))add('glassdoor',id,'Glassdoor listing');
 else if(/^(?:[a-z0-9-]+\.)+myworkdayjobs\.com$/.test(h)&&(m=p.match(/^\/[^?#]*\/job\/(.+)$/)))add('workday:'+h,m[1],'Workday posting');
 else if(h==='jobs.lever.co'&&(m=p.match(/^\/([A-Za-z0-9_-]+)\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})(?:\/apply)?$/i)))add('lever:'+m[1],m[2],'Lever posting');
 else if(/^[a-z0-9-]+\.bamboohr\.com$/.test(h)&&(m=p.match(/^\/careers\/(\d{1,30})$/)))add('bamboohr:'+h,m[1],'BambooHR posting');
 else if(h==='jobs.buildsubmarines.com'){
  if((m=p.match(/^\/jobs\/(\d{1,30})(?:\/[^/]*)?$/)))add('buildsubmarines',m[1],'BuildSubmarines posting');
  else if(!nested&&p==='/job_activities/track'){
   const destination=param('redirect_url',/^https?:\/\/.{1,4096}$/);if(destination){let target;try{target=new URL(destination);}catch{}if(target?.hostname===h)out.push(...tokens(destination,true));}
  }
 }else if((h==='www.linkedin.com'||h==='linkedin.com')&&(m=p.match(/^\/jobs\/view\/(?:[^/]+-)?(\d{1,30})$/)))add('linkedin',m[1],'LinkedIn listing');
 else if((h==='www.indeed.com'||h==='indeed.com')&&p==='/viewjob'&&(id=param('jk',/^[a-f0-9]{16}$/)))add('indeed',id,'Indeed listing');
 return out;
}
function evidence(group){
 if(group.length<2)return {matchEvidence:'',identityConflict:false};
 const lists=group.map(item=>tokens(item.sourceUrl));
 const scopes=new Map();for(const list of lists)for(const token of list){if(!scopes.has(token.scope))scopes.set(token.scope,new Set());scopes.get(token.scope).add(token.id);}
 const identityConflict=[...scopes.values()].some(ids=>ids.size>1);
 const common=lists[0].find(token=>lists.every(list=>list.some(other=>other.token===token.token)));
 if(identityConflict)return {matchEvidence:'Conflicting posting IDs',identityConflict:true};
 if(common)return {matchEvidence:'Same '+common.label,identityConflict:false};
 if(group[0].sourceUrl&&group.every(item=>item.sourceUrl===group[0].sourceUrl))return {matchEvidence:'Same URL; vacancy unverified',identityConflict:false};
 return {matchEvidence:'Name/location match only',identityConflict:false};
}
module.exports={evidence,tokens};
