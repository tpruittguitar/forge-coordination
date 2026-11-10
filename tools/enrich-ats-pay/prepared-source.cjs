'use strict';
// Public no-pay posting evidence only. No prepared fields, canonical provenance,
// comparison inputs, request payloads or private master text belong in this schema.
const fs=require('node:fs'),Store=require('../programmed-coordinator/store.cjs'),Prepared=require('./prepared.cjs'),Pay=require('./pay-values'),Recovery=require('./recovery');
const SCHEMA='forge.pay-posting-source.v1',PREFIX='enrich-ats-pay-source-';
const keys=(value,expected)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join(',')===expected.split(' ').sort().join(',');
function parse(row,record,now=Date.now()){
 if(!keys(record,'schema primaryId rowSha256 parserVersion source')||record.schema!==SCHEMA||record.primaryId!==row.PRIMARY_ID||record.rowSha256!==Store.hash(row)||record.parserVersion!==Pay.VERSION)return null;
 const s=record.source;
 if(!keys(s,'url text observedAt identity validThrough')||!keys(s.identity,'company title location')||!(s.validThrough===null||typeof s.validThrough==='string'))return null;
 const raw={identity:JSON.stringify([s.identity.company,s.identity.title,s.identity.location]),url:s.url,text:s.text,at:s.observedAt,sourceIdentity:s.identity,identityVerified:true,fullPosting:true,factsVersion:record.parserVersion,basis:'EMPLOYER_POSTED',pay:null,payAmbiguous:false,postingFacts:s.validThrough===null?null:{validThrough:s.validThrough}};
 return Prepared.noPaySource(row,{evidence:{postingEvidence:raw,postingEvidenceSha256:Store.hash(raw)}},now);
}
function save(dir,{row,postingEvidence},now=Date.now()){
 if(Prepared.protectedRow(row))throw Error('Protected source row');
 const checked=Prepared.noPaySource(row,{evidence:{postingEvidence,postingEvidenceSha256:Store.hash(postingEvidence)}},now);
 if(!checked)throw Error('Complete current exact no-pay source required');
 // Explicit allowlist: never copy/spread the preparation envelope or cache entry.
 const record={schema:SCHEMA,primaryId:row.PRIMARY_ID,rowSha256:Store.hash(row),parserVersion:Pay.VERSION,source:{url:checked.url,text:checked.text,observedAt:checked.at,identity:{company:row.COMPANY,title:row.TITLE,location:row.LOCATION},validThrough:checked.postingFacts?.validThrough??null}};
 if(!parse(row,record,now))throw Error('Invalid source-only artifact');
 const file=PREFIX+Store.hash(record)+'.json';Store.immutable(dir,file,record);return file;
}
function load(dir,{rows,blocked,needsSalary,now=Date.now()}){
 const byId=new Map(rows.map(r=>[r.PRIMARY_ID,r])),out=new Map();
 for(const file of fs.existsSync(dir)?fs.readdirSync(dir).filter(f=>f.startsWith(PREFIX)&&f.endsWith('.json')).sort():[]){
  let record;try{record=Store.read(dir,file);}catch{continue;}
  const row=byId.get(record?.primaryId);
  if(!row||Prepared.protectedRow(row)||blocked.has(row.PRIMARY_ID)||!needsSalary(row)||file!==PREFIX+Store.hash(record)+'.json')continue;
  const source=parse(row,record,now);if(!source)continue;
  const previous=out.get(row.PRIMARY_ID);out.set(row.PRIMARY_ID,Recovery.combine(previous,source));
 }
 return out;
}
module.exports={SCHEMA,PREFIX,parse,save,load};
