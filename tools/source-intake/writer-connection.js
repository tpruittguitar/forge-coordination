'use strict';
// Runtime input only. Never discover credentials in a public cockpit checkout.
const fs=require('node:fs'),path=require('node:path');
// Read the existing reader identity without evaluating it or duplicating its ID.
function endpointFromSource(source){
 source=source.replace(/\/\*[\s\S]*?\*\//g,'').replace(/^\s*\/\/.*$/gm,'');
 const matches=[...source.matchAll(/^const ENDPOINT='(https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec)';$/gm)];
 if(matches.length!==1||[...source.matchAll(/\b(?:const|let|var)\s+ENDPOINT\s*=/g)].length!==1)throw Error('Canonical Writer endpoint could not be resolved');
 return matches[0][1];
}
function canonicalEndpoint(){
 try{return endpointFromSource(fs.readFileSync(path.join(__dirname,'writer-reader.js'),'utf8'));}
 catch{throw Error('Canonical Writer endpoint could not be resolved');}
}
function connection({env=process.env,requireUrl=false}={}){
 let privateConfig={};
 if(env.FORGE_CONNECTION_FILE && (!env.FORGE_WRITER_KEY || (requireUrl&&!env.FORGE_WRITER_URL))){
  try{
   let source=fs.readFileSync(env.FORGE_CONNECTION_FILE,'utf8').trim();
   // Skip only complete leading comments, never comments inside JSON or suffixes.
   while(source.startsWith('//')||source.startsWith('/*')){
    const block=source.startsWith('/*'),end=block?source.indexOf('*/',2):source.indexOf('\n',2);
    if(end<0)throw Error();
    source=source.slice(end+(block?2:1)).trimStart();
   }
   const wrapper=source.match(/^var\s+PipelineConnection\s*=\s*([\s\S]*);$/);
   // Data only: JSON, optionally inside the historical generated var wrapper.
   // Never evaluate JavaScript, getters, promises, or any other executable input.
   const json=wrapper?wrapper[1]:source,data=JSON.parse(json);
   const tokens=json.match(/"(?:\\.|[^"\\])*"|[^\s]/g)||[];
   const keys=tokens.filter((token,i)=>tokens[i+1]===':').map(token=>JSON.parse(token));
   if(new Set(keys).size!==keys.length||keys.some(key=>!['key','url'].includes(key)))throw Error();
   if(!data||Array.isArray(data)||typeof data!=='object'||Object.values(data).some(value=>typeof value!=='string'))throw Error();
   privateConfig={key:typeof data.key==='string'?data.key:'',url:typeof data.url==='string'?data.url:''};
  }
  catch{throw Error('Writer private connection could not be loaded');}
 }
 const key=env.FORGE_WRITER_KEY||privateConfig.key;
 if(typeof key!=='string'||!key.trim())throw Error('Writer credential required: FORGE_WRITER_KEY or explicit private FORGE_CONNECTION_FILE');
 const url=env.FORGE_WRITER_URL||privateConfig.url;
 if(requireUrl){
  let parsed;try{parsed=new URL(url);}catch{throw Error('Writer endpoint required: FORGE_WRITER_URL or explicit private FORGE_CONNECTION_FILE');}
  if(parsed.protocol!=='https:'||parsed.hostname!=='script.google.com'||parsed.port||parsed.username||parsed.password||parsed.search||parsed.hash||!/^\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(parsed.pathname))throw Error('Writer endpoint must be an HTTPS Apps Script execution URL without credentials, query, or fragment');
  if(url!==canonicalEndpoint())throw Error('Writer endpoint must match the canonical reader deployment');
 }
 return {key,...(requireUrl?{url}: {})};
}
module.exports={connection,canonicalEndpoint,endpointFromSource};
