'use strict';
// Recover omitted facts from exact saved identities. No network, guessed fields or canonical mutation.
const S=require('../programmed-coordinator/store.cjs'),Source=require('../programmed-coordinator/source.cjs'),U=require('../pipeline-observability/upstream-flow');
const identity=c=>[Source.employer(c.company),Source.norm(c.title),Source.location(c.location)].join('|');
function index(root,up,mail,reports){
 const cards=new Map();
 function add(raw,proof){const card={company:raw.company||raw.COMPANY,title:raw.title||raw.TITLE,location:raw.location||raw.LOCATION,url:raw.url||raw.source_url||raw.sourceUrl||raw.SOURCE_URL};if(!['company','title','location','url'].every(k=>typeof card[k]==='string'&&card[k].trim()))return;const key=U.key(card.url);if(!key)return;if(!cards.has(key))cards.set(key,[]);cards.get(key).push({card,proof,sourceSha256:S.hash(raw)});}
 for(const e of Object.values(up.entries))add(e,'state/UPSTREAM_LEDGER.json#'+e.key);
 for(const j of Object.values(mail.jobs))add(j,'state/EMAIL_RECOVERY_QUEUE.json#'+j.key);
 for(const [n,r]of reports.entries())for(const c of [...r.new_roles||[],...r.existing_roles||[],...r.protected_roles||[]])add(c,['state/source-trial-report.json','state/board-discovery-report.json'][n]);
 const refs=new Set(Object.values(up.entries).flatMap(e=>e.sources||[]));
 for(const ref of refs){if(!/^EMAIL_CANDIDATE_LEDGER_[A-Za-z0-9_-]+\.json$/.test(ref))continue;const ledger=S.read(root,'receipts/'+ref,null);for(const c of ledger?.new_candidates||[])add(c,'receipts/'+ref);}
 return cards;
}
function recover(card,aliases,cards){
 if(['company','title','location','url'].every(k=>card[k]))return{card,recovery:null};
 const found=aliases.flatMap(k=>cards.get(k)||[]);if(!found.length)return{card,recovery:null};
 const compatible=found.filter(({card:c})=>['company','title','location'].every(k=>!card[k]||(k==='location'?Source.location(card[k])===Source.location(c[k]):k==='company'?Source.employer(card[k])===Source.employer(c[k]):Source.norm(card[k])===Source.norm(c[k]))));
 if(!compatible.length||new Set(compatible.map(x=>identity(x.card))).size!==1)return{card,recovery:null,conflict:'CONFLICTING_SAVED_IDENTITY'};
 const fields=['company','title','location','url'].filter(k=>!card[k]),result={...card};for(const k of fields)result[k]=compatible[0].card[k];
 return{card:result,recovery:{kind:'EXACT_SAVED_SOURCE',fields,proofs:compatible.map(({proof,sourceSha256})=>({proof,sourceSha256})),postingFetched:false}};
}
module.exports={index,recover};
