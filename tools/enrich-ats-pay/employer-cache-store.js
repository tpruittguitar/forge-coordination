'use strict';
// Lossless publication format. Repeated posting bodies are interned, but every
// original observation key, timestamp and field survives. No evidence is evicted
// to meet GitHub's blob limit. Superseded content-addressed parts are retained.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),zlib=require('node:zlib');
const SCHEMA='forge.pay-employer-cache.v1',PART_BYTES=4*1024*1024,MAX_FILE_BYTES=8*1024*1024;
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const partsDir=file=>file.replace(/\.json$/,'')+'.parts';
function pack(cache){
 const {postingEvidence,...rest}=cache,bodies=[],observations=[],seen=new Map();
 if(Object.hasOwn(cache,'postingEvidence')&&(!postingEvidence||typeof postingEvidence!=='object'||Array.isArray(postingEvidence)))throw Error('Invalid posting evidence map');
 for(const [key,e] of Object.entries(postingEvidence||{})){
  if(!e||typeof e!=='object'||Array.isArray(e))throw Error('Invalid posting observation: '+key);
  const {at,...body}=e,encoded=JSON.stringify(body);let index=seen.get(encoded);
  if(index===undefined){index=bodies.length;seen.set(encoded,index);bodies.push(body);}
  observations.push(Object.hasOwn(e,'at')?[key,index,at]:[key,index]);
 }
 return {cache:rest,hasPostingEvidence:Object.hasOwn(cache,'postingEvidence'),bodies,observations};
}
function unpack(packed){
 if(!packed?.cache||!Array.isArray(packed.bodies)||!Array.isArray(packed.observations))throw Error('Invalid packed employer cache');
 const cache=packed.cache,evidence={};
 for(const entry of packed.observations){
  const [key,index,at]=entry;
  if(typeof key!=='string'||Object.hasOwn(evidence,key)||!Number.isInteger(index)||!packed.bodies[index]||![2,3].includes(entry.length))throw Error('Invalid packed observation');
  const body=structuredClone(packed.bodies[index]);if(entry.length===3)body.at=at;
  Object.defineProperty(evidence,key,{value:body,enumerable:true,writable:true,configurable:true});
 }
 if(packed.hasPostingEvidence)cache.postingEvidence=evidence;
 return cache;
}
function read(file){
 if(!fs.existsSync(file))return {employers:{}};
 const root=JSON.parse(fs.readFileSync(file,'utf8'));if(root.schema!==SCHEMA)return root;
 if(!Array.isArray(root.parts)||!Number.isSafeInteger(root.bytes)||root.bytes<0||!/^([a-f0-9]{64})$/.test(root.sha256))throw Error('Invalid employer cache manifest');
 const chunks=[];let bytes=0;
 for(const part of root.parts){
  if(!/^[a-f0-9]{64}\.json\.gz$/.test(part.file)||!Number.isSafeInteger(part.bytes)||part.bytes<1||part.bytes>PART_BYTES)throw Error('Invalid employer cache part reference');
  const target=path.join(partsDir(file),part.file),stat=fs.lstatSync(target);
  if(!stat.isFile()||stat.isSymbolicLink()||stat.size>MAX_FILE_BYTES)throw Error('Invalid employer cache part file');
  const compressed=fs.readFileSync(target);
  if(hash(compressed)+'.json.gz'!==part.file)throw Error('Employer cache part checksum mismatch');
  const chunk=zlib.gunzipSync(compressed,{maxOutputLength:PART_BYTES});
  if(chunk.length!==part.bytes)throw Error('Employer cache part length mismatch');
  chunks.push(chunk);bytes+=chunk.length;if(bytes>root.bytes)throw Error('Employer cache total length mismatch');
 }
 const data=Buffer.concat(chunks);
 if(bytes!==root.bytes||hash(data)!==root.sha256)throw Error('Employer cache snapshot checksum mismatch');
 return unpack(JSON.parse(data.toString('utf8')));
}
function write(file,cache){
 const packed=pack(cache),data=Buffer.from(JSON.stringify(packed)),parts=[],dir=partsDir(file);
 fs.mkdirSync(dir,{recursive:true});
 for(let offset=0;offset<data.length;offset+=PART_BYTES){
  const chunk=data.subarray(offset,offset+PART_BYTES),compressed=zlib.gzipSync(chunk),name=hash(compressed)+'.json.gz',target=path.join(dir,name);
  if(compressed.length>MAX_FILE_BYTES)throw Error('Employer cache part exceeds publication bound');
  if(fs.existsSync(target)){if(!fs.readFileSync(target).equals(compressed))throw Error('Immutable employer cache part conflict');}
  else {
   // A partial write must never poison the final immutable name. Interrupted
   // temporary files are safe to replace on retry; published parts are not.
   const temp=target+'.'+process.pid+'.tmp';fs.writeFileSync(temp,compressed);
   if(!fs.readFileSync(temp).equals(compressed))throw Error('Employer cache part readback failed');
   if(fs.existsSync(target)){if(!fs.readFileSync(target).equals(compressed))throw Error('Immutable employer cache part conflict');fs.unlinkSync(temp);}
   else fs.renameSync(temp,target);
  }
  parts.push({file:name,bytes:chunk.length});
 }
 const manifest={schema:SCHEMA,bytes:data.length,sha256:hash(data),observations:packed.observations.length,bodies:packed.bodies.length,parts};
 const encoded=JSON.stringify(manifest,null,2)+'\n';
 if(Buffer.byteLength(encoded)>MAX_FILE_BYTES)throw Error('Employer cache manifest exceeds publication bound');
 // Check all parts before replacing the legacy cache or prior manifest. A failed
 // write leaves the prior root and its immutable parts usable.
 const temp=file+'.'+process.pid+'.tmp';fs.writeFileSync(temp,encoded);
 // The temporary manifest lives beside the root but references its final parts.
 const restored=Buffer.concat(parts.map(p=>zlib.gunzipSync(fs.readFileSync(path.join(dir,p.file)))));
 if(hash(restored)!==manifest.sha256)throw Error('Employer cache readback failed');
 fs.renameSync(temp,file);
 return {observations:manifest.observations,bodies:manifest.bodies,parts:parts.length,bytes:data.length};
}
module.exports={read,write,pack,unpack,partsDir,SCHEMA,PART_BYTES,MAX_FILE_BYTES};
