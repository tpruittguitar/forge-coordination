'use strict';
// Recover omitted facts from exact saved identities. No network, guessed fields or canonical mutation.
const S=require('../programmed-coordinator/store.cjs'),Source=require('../programmed-coordinator/source.cjs'),U=require('../pipeline-observability/upstream-flow');
const Identity=require('../source-trial/job-identity');
function identityMetadata(raw,url){const fields=Identity.carry(raw);for(const key of ['url','sourceUrl','source_url','postingUrl'])if(fields[key]&&U.key(fields[key])===U.key(url))delete fields[key];return fields;}
const identity=c=>[Source.employer(c.company),Source.norm(c.title),Source.location(c.location)].join('|');
function index(root,up,mail,reports){
 const cards=new Map();
 function add(raw,proof){const card={...identityMetadata(raw,raw.url||raw.source_url||raw.sourceUrl||raw.SOURCE_URL),company:raw.company||raw.COMPANY,title:raw.title||raw.TITLE,location:raw.location||raw.LOCATION,url:raw.url||raw.source_url||raw.sourceUrl||raw.SOURCE_URL,...require('../source-trial/posted-pay').carry({...raw,url:raw.url||raw.source_url||raw.sourceUrl||raw.SOURCE_URL})};if(!['company','title','location','url'].every(k=>typeof card[k]==='string'&&card[k].trim()))return;const key=U.key(card.url);if(!key)return;if(!cards.has(key))cards.set(key,[]);cards.get(key).push({card,proof,sourceSha256:S.hash(raw)});}
 for(const e of Object.values(up.entries))add(e,'state/UPSTREAM_LEDGER.json#'+e.key);
 for(const j of Object.values(mail.jobs))add(j,'state/EMAIL_RECOVERY_QUEUE.json#'+j.key);
 for(const [n,r]of reports.entries())for(const c of [...r.new_roles||[],...r.existing_roles||[],...r.protected_roles||[],...r.identity_held_roles||[]])add(c,['state/source-trial-report.json','state/board-discovery-report.json'][n]);
 const refs=new Set(Object.values(up.entries).flatMap(e=>e.sources||[]));
 for(const ref of refs){if(!/^EMAIL_CANDIDATE_LEDGER_[A-Za-z0-9_-]+\.json$/.test(ref))continue;const ledger=S.read(root,'receipts/'+ref,null);for(const c of ledger?.new_candidates||[])add(c,'receipts/'+ref);}
 return cards;
}
function recover(card,aliases,cards){
 card={...identityMetadata(card,card.url),...card};
 const found=aliases.flatMap(k=>cards.get(k)||[]);if(!found.length)return{card,recovery:null};
 const compatible=found.filter(({card:c})=>['company','title','location'].every(k=>!card[k]||(k==='location'?Source.location(card[k])===Source.location(c[k]):k==='company'?Source.employer(card[k])===Source.employer(c[k]):Source.norm(card[k])===Source.norm(c[k]))));
 if(!compatible.length||new Set(compatible.map(x=>identity(x.card))).size!==1)return{card,recovery:null,conflict:'CONFLICTING_SAVED_IDENTITY'};
 if(!card.postedPay){const pays=compatible.filter(x=>x.card.postedPay&&x.card.url===card.url);if(pays.length&&new Set(pays.map(x=>JSON.stringify(x.card.postedPay))).size===1)card={...card,...require('../source-trial/posted-pay').carry(pays[0].card)};}
 const fields=['company','title','location','url'].filter(k=>!card[k]),result={...card};for(const k of fields)result[k]=compatible[0].card[k];
 // Restore omitted identity/scope evidence even when the four display fields are complete.
 // Do not pick one of contradictory saved values, or let an alias hide broader scope.
 const carried=[identityMetadata(card,card.url),...compatible.map(x=>identityMetadata(x.card,card.url))],conflicts=[];
 for(const key of new Set(carried.flatMap(x=>Object.keys(x)))){
  if(['company','title','location','url'].includes(key))continue;
  const values=carried.map(x=>x[key]).filter(v=>v!==undefined&&v!==null&&v!=='');
  const unique=[...new Map(values.map(v=>[JSON.stringify(v),v])).values()];
  if(unique.length>1){conflicts.push(key);continue;}
  if(unique.length&&!(result[key]!==undefined&&result[key]!==null&&result[key]!=='')){result[key]=unique[0];fields.push(key);}
 }
 if([card,...compatible.map(x=>x.card)].some(x=>Identity.fields(x).scopeUncertain)&&!Identity.fields(result).scopeUncertain)conflicts.push('WORKSITE_SCOPE_ALIAS');
 const recovery=fields.length?{kind:'EXACT_SAVED_SOURCE',fields,proofs:compatible.map(({proof,sourceSha256})=>({proof,sourceSha256})),postingFetched:false}:null;
 return{card:result,recovery,...(conflicts.length?{conflict:'CONFLICTING_SAVED_IDENTITY_METADATA',conflictFields:conflicts}: {})};
}
module.exports={index,recover,identityMetadata};
