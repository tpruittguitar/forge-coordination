'use strict';
// Invocation-local lookup only. These indexes never decide source validity,
// canonical presence or whether a Writer fence applies.
const Identity=require('../source-trial/job-identity');
function firstByKey(items){
 const byKey=new Map();
 for(const item of items)if(!byKey.has(item.key))byKey.set(item.key,item);
 return byKey;
}
function groupByKey(items,key){
 const byKey=new Map();
 for(const item of items){const k=key(item);if(!byKey.has(k))byKey.set(k,[]);byKey.get(k).push(item);}
 return byKey;
}
function fenceLookup(fences){
 const values=[...fences.values()],idx=Identity.index(values.map(f=>f.record||{})),order=new Map(idx.records.map((r,i)=>[r,i]));
 return card=>{
  const c=Identity.fields(card||{}),possible=new Set(),add=items=>{for(const item of items||[])possible.add(item);};
  // These cover every true branch of fenceApplies: shared URL/primary ID,
  // company-scoped requisition/ATS identity, or equal company and title.
  // Do not use canonical match: its conflict/location rules are stricter.
  for(const url of c.urls)add(idx.byUrl.get(url));
  if(c.primaryId)add(idx.byPid.get(c.primaryId));
  if(c.company){
   for(const req of c.reqs){add(idx.byReq.get(c.company+'|'+req));add(idx.byAtsId.get(c.company+'|'+req));}
   for(const [scope,ids]of c.ats)for(const id of ids){add(idx.byAts.get(c.company+'|'+scope+'|'+id));add(idx.byReq.get(c.company+'|'+id));}
   if(c.title)add(idx.byCompanyTitle.get(c.company+'|'+c.title));
  }
  // Array.find used Map insertion order, including aliases and duplicates.
  for(const item of [...possible].sort((a,b)=>order.get(a)-order.get(b))){const fence=values[order.get(item)];if(Identity.fenceApplies(card,fence.record))return fence;}
  return undefined;
 };
}
module.exports={firstByKey,groupByKey,fenceLookup};
