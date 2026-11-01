'use strict';
const L=require('./lib');
// Only a complete, uniquely matching JobPosting description is evidence. Page chrome,
// email previews and search snippets must never imply that a degree was not stated.
function parse(html,row){
 const jobs=[];
 function visit(x){if(Array.isArray(x))return x.forEach(visit);if(!x||typeof x!=='object')return;
  if([].concat(x['@type']||[]).includes('JobPosting'))jobs.push(x);
  if(x['@graph'])visit(x['@graph']);}
 for(const m of String(html).matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi))try{visit(JSON.parse(m[1]));}catch{}
 const norm=s=>String(s||'').toLowerCase().replace(/&amp;/g,'and').replace(/[^a-z0-9]+/g,' ').trim();
 const co=s=>norm(s).replace(/\b(incorporated|corporation|corp|inc|llc|ltd)\b/g,'').replace(/\s+/g,' ').trim();
 const hit=jobs.filter(j=>norm(j.title)===norm(row.TITLE)&&co(j.hiringOrganization&&j.hiringOrganization.name)===co(row.COMPANY));
 if(hit.length!==1)return null;
 const text=String(hit[0].description||'').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/<[^>]+>/g,'\n').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').trim();
 if(text.length<300||/verify you are human|sign in to view|captcha/i.test(text))return null;
 const posted=require('./source-search').parsePage(html,{co:row.COMPANY,title:row.TITLE,location:row.LOCATION});
 return {text,pay:posted?.pay||L.payFromText(text)};
}
function publicUrl(raw){try{const u=new URL(String(raw||'').split(/\s/)[0]);return u.protocol==='https:'&&!u.username&&!u.password&&!/^(localhost|127\.|10\.|192\.168\.|169\.254\.|\[)/i.test(u.hostname)?u.href:null;}catch{return null;}}
function retryDue(ledger,id,needs,now=Date.now()){
 const last=Math.max(Date.parse(ledger.submitted[id])||0,Date.parse(ledger.tried[id])||0);if(!last)return true;
 // A successful partial write or new missing field must not suppress the next task.
 const prior=ledger.needs&&ledger.needs[id];if(prior&&prior!==needs)return true;
 return now-last>=6*3600000;
}
module.exports={parse,publicUrl,retryDue};
