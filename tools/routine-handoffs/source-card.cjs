'use strict';
const S=require('../programmed-coordinator/store.cjs'),Source=require('../programmed-coordinator/source.cjs'),keyOf=require('../pipeline-observability/upstream-flow').key;
// Restore omitted handoff fields from exact original email-ledger candidates.
// The immutable source and assignment are retained; this is not a posting fetch.
function recover(root,key,card){
 if(!card||['company','title','location','url'].every(k=>typeof card[k]==='string'&&card[k].trim()))return card;
 if(!/^indeed:[a-f0-9]{16}$/.test(key))return card;
 const upstream=S.read(root,'state/UPSTREAM_LEDGER.json',{entries:{}}).entries[key];if(!upstream)return card;
 const found=[];
 for(const name of upstream.sources||[]){if(!/^EMAIL_CANDIDATE_LEDGER_[A-Za-z0-9_-]+\.json$/.test(name))continue;
  const file='receipts/'+name,ledger=S.read(root,file,null);if(!ledger||!Array.isArray(ledger.new_candidates))continue;
  for(const item of ledger.new_candidates){const raw=item.url||item.source_url;if(typeof raw!=='string'||keyOf(raw)!==key||!['company','title','location'].every(k=>typeof item[k]==='string'&&item[k].trim()))continue;
   const u=new URL(raw);if(u.protocol!=='https:'||u.username||u.password||u.port||u.hostname!=='www.indeed.com'||u.searchParams.getAll('jk').length!==1||u.searchParams.get('jk')!==key.slice(7)||!['/rc/clk/dl','/viewjob'].includes(u.pathname))continue;
   found.push({company:item.company,title:item.title,location:item.location,url:'https://www.indeed.com/viewjob?jk='+u.searchParams.get('jk'),proof:file,sourceSha256:S.hash(item)});
  }
 }
 if(!found.length)return card;
 const identity=x=>[Source.employer(x.company),Source.norm(x.title),Source.location(x.location)].join('|');
 if(new Set(found.map(identity)).size!==1)throw Error('CONFLICTING_ORIGINAL_SOURCE_CARDS');
 const exact=found[0];for(const field of ['company','title','location'])if(card[field]&&Source.norm(card[field])!==Source.norm(exact[field]))throw Error('CONFLICTING_ASSIGNMENT_SOURCE_CARD');
 if(card.url&&keyOf(card.url)!==key)throw Error('CONFLICTING_ASSIGNMENT_SOURCE_URL');
 const fields=['company','title','location','url'].filter(k=>!card[k]);return{...card,...Object.fromEntries(fields.map(k=>[k,exact[k]])),sourceRecovery:{kind:'ORIGINAL_EMAIL_LEDGER',fields,proofs:found.map(x=>({path:x.proof,sourceSha256:x.sourceSha256})),postingFetched:false}};
}
module.exports={recover};
