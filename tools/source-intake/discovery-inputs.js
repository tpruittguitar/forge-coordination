'use strict';
// Reuse recorded public discovery facts, including metadata-only cards. This
// reads local source artifacts only; neither posting age nor text length proves
// liveness or determines whether an otherwise identified lead can reach intake.
const fs=require('node:fs'),path=require('node:path');
const E=require('../source-trial/evidence-store'),Source=require('../programmed-coordinator/source.cjs'),U=require('../pipeline-observability/upstream-flow');
const {normalizeCompany}=require('./record-normalize'),PostedPay=require('../source-trial/posted-pay');
const identity=c=>E.identity({...c,company:normalizeCompany(c.company||c.COMPANY).company});
function source(c){
 const names=[c.source,c.captureKind,c.discoveryReview?.source],provider=names.find(x=>typeof x==='string'&&x.trim()&&!/^(?:SAVED_DISCOVERY|INTAKE_DRAIN|UNKNOWN|RECOVERY_CARRY_FORWARD)$/.test(x)&&!/^state\/|^receipts\//.test(x));
 if(provider)return provider;
 // Older saved cards lost the provider label. Keep the recorded URL's actual
 // host as provenance rather than guessing a provider or forcing a refetch.
 try{return 'URL:'+new URL(Source.publicUrl(c.url||c.sourceUrl||c.SOURCE_URL)).hostname;}catch{return null;}
}
function index(root){
 const byUrl=new Map(),store=E.index(root);
 const read=file=>{try{const raw=fs.readFileSync(path.join(root,file),'utf8');return {value:JSON.parse(raw),proof:{path:file,sha256:E.hash(raw)}};}catch{return null;}};
 function add(raw,proof,observedAt){
  if(!raw||typeof raw!=='object')return;const provider=source(raw),url=raw.url||raw.sourceUrl||raw.SOURCE_URL,review=raw.discoveryReview;
  const card={company:raw.company||raw.COMPANY,title:raw.title||raw.TITLE,location:raw.location||raw.LOCATION,url,source:provider,description:Source.text(raw.description||''),contentBasis:raw.contentBasis||review?.contentBasis||(raw.description?'CAPTURED_ROLE_CONTENT':'TITLE_ONLY')};
  const validThrough=raw.postingFacts?.validThrough??raw.validThrough;if(validThrough!=null)card.validThrough=validThrough;
  const key=U.key(url);if(!provider||!key||identity(card).some(x=>!x)||!/^https:\/\//.test(url||''))return;
  if(review?.sourceUrl&&U.key(review.sourceUrl)!==key)return;
  const bound=review?.preliminaryScreen?.atsGate?.sourceIdentity;
  if(bound&&JSON.stringify(identity(bound))!==JSON.stringify(identity(card)))return;
  if(card.description&&review?.sourceSha256&&E.hash(card.description)!==review.sourceSha256)return;
  if(/captcha|sign in to view|verify you are human|access denied|enable javascript/i.test(card.description)){card.description='';card.contentBasis='SOURCE_TEXT_UNAVAILABLE';}
  card.fullPosting=E.postingComplete({...card,fullPosting:raw.fullPosting,discoveryReview:review});
  const at=review?.observedAt||raw.observedAt||observedAt||null;
  const pay=PostedPay.capture({...raw,url},{observedAt:at});if(pay)card.postedPay=pay;
  if(!byUrl.has(key))byUrl.set(key,[]);byUrl.get(key).push({card,proof,observedAt:at,identity:identity(card)});
 }
 for(const file of ['state/source-trial-report.json','state/board-discovery-report.json']){
  const got=read(file);if(!got)continue;
  for(const list of ['new_roles','existing_roles','protected_roles','identity_held_roles'])for(const raw of Array.isArray(got.value?.[list])?got.value[list]:[])add(raw,got.proof,got.value.summary?.at);
 }
 const catchup=read('receipts/auto-intake/catch-up/state.json');
 for(const item of Object.values(catchup?.value?.roles||{}))add(item.role,catchup.proof,item.firstSeen||item.observedAt);
 const upstream=read('state/UPSTREAM_LEDGER.json');
 for(const item of Object.values(upstream?.value?.entries||{}))add(item,upstream.proof,item.firstSeen);
 return {find(card,{now=Date.now()}={}){
  const key=U.key(card.url||card.SOURCE_URL||card.sourceUrl),ids=identity(card);
  if(!key||ids.some(x=>!x))return null;
  const matches=(byUrl.get(key)||[]).filter(x=>x.identity.every((v,n)=>v===ids[n]));
  if(!matches.length)return null;
  const saved=store.forIntake(card,{now,maxAgeMs:Infinity});
  if(saved){const doc=saved.doc,base=matches.find(x=>E.hash(x.card.description)===doc.textSha256)||matches[0],provider=doc.source||matches.find(x=>E.hash(x.card.description)===doc.textSha256)?.card.source||'URL:'+new URL(doc.url).hostname;
   matches.push({card:{...base.card,company:doc.company,title:doc.title,location:doc.location,url:doc.url,postedPay:doc.postedPay||base.card.postedPay,source:provider,...(doc.validThrough!=null?{validThrough:doc.validThrough}:{}),description:doc.text,contentBasis:doc.contentBasis||'CAPTURED_ROLE_CONTENT',fullPosting:saved.fullPosting??doc.fullPosting},proof:{path:saved.ref.path,sha256:saved.ref.reportSha256||saved.ref.sha256},observedAt:saved.ref.observedAt,identity:ids});
  }
  matches.sort((a,b)=>Number(!!b.card.description)-Number(!!a.card.description)||Date.parse(b.observedAt||0)-Date.parse(a.observedAt||0));
  const Captured=require('./captured-discovery');
  for(const match of matches){const envelope=Captured.capture(match.card,{proof:match.proof,observedAt:match.observedAt,now});if(envelope&&(!envelope.observedAt||Date.parse(envelope.observedAt)<=now+120000))return envelope;}
  return null;
 }};
}
module.exports={index,source,identity};
