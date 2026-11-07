'use strict';
// A review aid over one complete snapshot, never proof of a duplicate vacancy.
const crypto=require('node:crypto'),{evidence}=require('./match-evidence.cjs');
const fields=['company','title','location'];
const normalize=value=>String(value??'').normalize('NFC').trim().replace(/\s+/gu,' ').toLowerCase();
const missing=value=>!value||/^(?:unknown|n\/?a|none|null|not (?:provided|specified|available)|unspecified|tbd|[-–—])$/u.test(value);
const compare=(a,b)=>a<b?-1:a>b?1:0;
function firstSeen(item){const value=Date.parse(item.firstSeen);return Number.isFinite(value)?value:Infinity;}
function annotate(items){
 const groups=new Map(),metadata=new Map();
 for(const item of items){
  const values=fields.map(field=>normalize(item[field])),absent=fields.filter((_,i)=>missing(values[i]));
  if(absent.length){metadata.set(item.key,{occurrence:null,occurrences:null,repeatWarning:'Not counted: missing '+absent.join(', '),repeatSignature:null,matchEvidence:'Not counted'});continue;}
  const key=JSON.stringify(values);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(item);
 }
 for(const group of groups.values()){
  // Number once, before search/sort/paging. Missing dates follow known dates.
  group.sort((a,b)=>compare(firstSeen(a),firstSeen(b))||compare(String(a.key),String(b.key)));
  const warnings=[],match=evidence(group);
  if(match.identityConflict)warnings.push("Distinct posting IDs; do not assume duplicates");
  if(group.length>1){
   if(new Set(group.map(item=>item.sourceUrl||'')).size>1)warnings.push('Different source URLs; compare posting IDs/routes');
   else warnings.push('Different source identities; verify same vacancy');
   if(group.some(item=>!item.sourceUrl))warnings.push('Source URL missing');
   if(group.some(item=>['IDENTITY_HOLD','MISSING_PREVIOUSLY_PRESENT'].includes(item.status)))warnings.push('Identity/history hold');
   if(new Set(group.map(item=>item.status)).size>1)warnings.push('Different statuses');
  }
  // Used only to reject stale repeat reviews; never persisted to the live ledger.
  const signature=crypto.createHash('sha256').update(JSON.stringify(group.map(item=>[item.key,item.company,item.title,item.location,item.sourceUrl,item.status,item.firstSeen]))).digest('hex');
  group.forEach((item,i)=>metadata.set(item.key,{occurrence:i+1,occurrences:group.length,repeatWarning:warnings.join('; '),repeatSignature:signature,matchEvidence:match.matchEvidence}));
 }
 return items.map(item=>({...item,...metadata.get(item.key)}));
}
module.exports={annotate};
