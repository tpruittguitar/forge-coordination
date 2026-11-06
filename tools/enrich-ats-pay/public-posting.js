'use strict';
// Only a complete, uniquely matching JobPosting description is evidence. Page chrome,
// email previews and search snippets must never imply that a degree was not stated.
function parse(html,row){
 // Exact identity and completeness are prerequisites for every extracted field,
 // even when salary is absent. A rejected site cannot fall back to a regex.
 try {
  const Source=require('../programmed-coordinator/source.cjs'),facts=Source.inspect(html,{company:row.COMPANY,title:row.TITLE,location:row.LOCATION});
  return {text:facts.description,pay:facts.pay,identityVerified:true,sourceIdentity:{company:row.COMPANY,title:row.TITLE,location:row.LOCATION},postingFacts:facts.postingFacts};
 }catch{return null;}
}
function publicUrl(raw){try{const u=new URL(String(raw||'').split(/\s/)[0]);return u.protocol==='https:'&&!u.username&&!u.password&&!/^(localhost|127\.|10\.|192\.168\.|169\.254\.|\[)/i.test(u.hostname)?u.href:null;}catch{return null;}}
function retryDue(ledger,id,needs,now=Date.now()){
 const last=Math.max(Date.parse(ledger.submitted[id])||0,Date.parse(ledger.tried[id])||0);if(!last)return true;
 // A successful partial write or new missing field must not suppress the next task.
 const prior=ledger.needs&&ledger.needs[id];if(prior&&prior!==needs)return true;
 return now-last>=6*3600000;
}
module.exports={parse,publicUrl,retryDue};
