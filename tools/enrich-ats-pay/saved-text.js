'use strict';
const fs=require('node:fs'),path=require('node:path');
const Evidence=require('../source-trial/evidence-store'),Recovery=require('./recovery');
const Cache=require('./posting-cache'),CacheStore=require('./employer-cache-store'),Text=require('./text-identity');

function create(root){
 const read=file=>{try{return JSON.parse(fs.readFileSync(path.join(root,'state',file),'utf8'));}catch{return {};}};
 const ledger=read('enrich-ats-pay.json'),store=Evidence.index(root);
 const nextById=new Map((read('enrich-ats-pay-recovery.json').rows||[]).map(r=>[r.id,r.next]));
 const cache=Cache.create({cache:CacheStore.read(path.join(root,'state/enrich-ats-pay-employer.json'))});
 return (item,{identityFallback=true}={})=>{
  const row={...item,PRIMARY_ID:item.primaryId||item.id,COMPANY:item.company,TITLE:item.title,LOCATION:item.location,
   p:{SOURCE_URL:(item.sourceUrls||[]).join(' ')}};
  const urls=[...new Set([...Recovery.urls(row),...Text.recoveryUrls(nextById.get(row.PRIMARY_ID))])],prior=Recovery.cached(ledger,row);
  if(prior?.text)return prior;
  const exact=cache.find(row,urls);
  if(exact?.text)return exact;
  for(const url of urls){
   const saved=store.forIntake({...row,SOURCE_URL:url},{fullOnly:true});
   if(saved)return {...saved.doc,at:saved.ref.observedAt,proof:saved.ref.path};
  }
  if(!identityFallback)return null;
  // An assigned item may omit its initiating aggregator URL. Exact identity
  // and full employer text are still required for this ChatGPT-only lookup.
  const employer=store.employerText(row);
  return employer?{...employer.doc,at:employer.ref.observedAt,proof:employer.ref.path}:cache.employerText(row);
 };
}

if(require.main===module){
 const ids=process.argv.slice(2),root=path.resolve(__dirname,'../..');
 const work=require('../helper-routing/enrichment.cjs').load();
 const partition=require('../helper-routing/worker-partition.cjs').load(root);
 const assigned=new Map(work.items.filter(i=>i.status==='ASSIGNED'&&i.owner==='ChatGPT'&&i.taskKey==='FORGE_CHATGPT_ENRICHMENT_RESEARCH'&&!partition.hermes.has(i.primaryId)).map(i=>[i.primaryId,i]));
 if(!ids.length||ids.some(id=>!assigned.has(id))){console.error('Provide only ASSIGNED ChatGPT enrichment IDs.');process.exitCode=1;}
 else{
  const lookup=create(root);
  console.log(JSON.stringify(ids.length===1?lookup(assigned.get(ids[0])):Object.fromEntries(ids.map(id=>[id,lookup(assigned.get(id))]))));
 }
}
module.exports={create};
