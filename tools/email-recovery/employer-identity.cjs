'use strict';
// Employer-hosted job identities, never a board listing ID or arbitrary number.
function key(value){
 let u;try{u=new URL(value);}catch{return '';}
 if(u.protocol!=='https:')return '';const host=u.hostname.toLowerCase(),p=u.pathname;let m;
 if(/(^|\.)greenhouse\.io$/.test(host)&&(m=p.match(/^\/([^/]+)\/jobs\/(\d+)/)))return 'gh:'+m[1].toLowerCase()+':'+m[2];
 if(/\.myworkdayjobs\.com$/.test(host)&&(m=p.match(/_(R-?\d+|JR\d+)\/?$/i)))return 'wd:'+host.split('.')[0]+':'+m[1].replace('-','').toUpperCase();
 if(host==='jobs.ashbyhq.com'&&(m=p.match(/^\/([^/]+)\/([a-f0-9-]{36})(?:\/application)?\/?$/i)))return 'ashby:'+m[1].toLowerCase()+':'+m[2].toLowerCase();
 if(/(^|\.)amazon\.jobs$/.test(host)&&(m=p.match(/\/jobs\/(\d+)/)))return 'amazon:A'+m[1];
 if(['careers.ey.com','careers.rivian.com','careers.ctscorp.com'].includes(host)&&(m=p.match(/\/(\d{4,})(?:\/)?$/)))return host+':'+m[1];
 return '';
}
function evidence(j){const e=j.employerPosting;return e&&e.sourceUrl===j.url&&Number.isFinite(Date.parse(e.recordedAt||e.observedAt))&&e.method==='SIGNED_IN_CHROME_APPLY_DESTINATION'?key(e.url):'';}
module.exports={key,evidence};
