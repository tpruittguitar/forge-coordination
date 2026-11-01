'use strict';
// Employer-hosted job identities, never a board listing ID or arbitrary number.
function key(value){
 let u;try{u=new URL(value);}catch{return '';}
 if(u.protocol!=='https:')return '';const host=u.hostname.toLowerCase(),p=u.pathname;let m;
 if(/(^|\.)greenhouse\.io$/.test(host)&&(m=p.match(/^\/([^/]+)\/jobs\/(\d+)/)))return 'gh:'+m[1].toLowerCase()+':'+m[2];
 if(/\.myworkdayjobs\.com$/.test(host)&&(m=p.match(/_((?:R-?\d+|JR\d+)(?:-\d+)?)\/?$/i)))return 'wd:'+host.split('.')[0]+':'+m[1].replace(/^R-/i,'R').toUpperCase();
 if(/\.myworkdaysite\.com$/.test(host)&&(m=p.match(/\/recruiting\/([^/]+)\/.*_((?:R-?\d+|JR\d+)(?:-\d+)?)\/?$/i)))return 'wd:'+m[1].toLowerCase()+':'+m[2].replace(/^R-/i,'R').toUpperCase();
 if(host==='careers.tranetechnologies.com'&&(m=p.match(/\/job\/(TRTEGLOBAL[A-Z0-9]+)/i)))return host+':'+m[1].toUpperCase();
 if(/\.eightfold\.ai$/.test(host)&&(m=p.match(/\/careers\/job\/(\d+)/)))return 'eightfold:'+host.split('.')[0]+':'+m[1];
 if(host==='jobs.ashbyhq.com'&&(m=p.match(/^\/([^/]+)\/([a-f0-9-]{36})(?:\/application)?\/?$/i)))return 'ashby:'+m[1].toLowerCase()+':'+m[2].toLowerCase();
 if(/(^|\.)amazon\.jobs$/.test(host)&&(m=p.match(/\/jobs\/(\d+)/)))return 'amazon:A'+m[1];
 if(['careers.ey.com','careers.rivian.com','careers.ctscorp.com'].includes(host)&&(m=p.match(/\/(\d{4,})(?:\/)?$/)))return host+':'+m[1];
 return '';
}
function evidence(j){
 const e=j.employerPosting;
 if(!e||e.sourceUrl!==j.url||!Number.isFinite(Date.parse(e.recordedAt||e.observedAt)))return '';
 if(e.method==='SIGNED_IN_CHROME_APPLY_DESTINATION'||e.method==='SIGNED_IN_BROWSER_APPLY_DESTINATION'&&['Edge','Chrome','TinyFish'].includes(e.browser))return key(e.url);
 // A syndication hash is not a requisition. Require the actual employer page,
 // its visible labelled requisition and a saved source-chain proof instead.
 if(e.method==='SIGNED_IN_BROWSER_EMPLOYER_REDIRECT'&&['Edge','Chrome','TinyFish'].includes(e.browser)&&e.proof){
  let u;try{u=new URL(e.url);}catch{return '';}
  const m=String(e.reqQuote||'').match(/^Req Id:\s*(R-\d+)$/i);
  if(u.protocol==='https:'&&u.hostname==='idexcorporation.jobs'&&m&&m[1].toUpperCase()===e.reqId)return 'employer:idexcorporation.jobs:'+m[1].replace('-','').toUpperCase();
 }
 return '';
}
module.exports={key,evidence};
