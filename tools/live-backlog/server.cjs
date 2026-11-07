#!/usr/bin/env node
'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {GitStore}=require('./git-store.cjs');
function createServer(store){const session=crypto.randomBytes(32).toString('hex');let busy=false,origin;
 const server=http.createServer(async(req,res)=>{
  const send=(code,body,type='application/json')=>{res.writeHead(code,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"});res.end(type==='application/json'?JSON.stringify(body):body);};
  let ownsLock=false;origin='http://127.0.0.1:'+server.address().port;
  if(req.headers.host!==new URL(origin).host)return send(403,{error:'INVALID_HOST'});
  if(req.method==='GET'&&req.url==='/')return send(200,fs.readFileSync(path.join(__dirname,'worksheet.html'),'utf8').replaceAll('__SESSION_TOKEN__',session),'text/html; charset=utf-8');
  if(req.headers['x-worksheet-session']!==session)return send(403,{error:'SESSION_REQUIRED'});
  try{
   const url=new URL(req.url,origin);
   if(req.method==='GET'&&url.pathname==='/api/snapshot'){const {revision,source}=store.snapshot();return send(200,{revision,at:source.index.at,updatedAt:source.index.worksheetUpdatedAt||source.index.at,count:source.items.length,items:source.items.map(({key,company,title,location,sourceUrl,status,reason,firstSeen})=>({key,company,title,location,sourceUrl,status,reason,firstSeen}))});}
   if(req.method==='GET'&&url.pathname==='/api/receipt')return send(200,store.receipt(url.searchParams.get('requestId')));
   if(req.method!=='POST'||!['/api/delete','/api/restore'].includes(url.pathname))return send(404,{error:'NOT_FOUND'});
   if(req.headers.origin!==origin||req.headers['content-type']!=='application/json')return send(403,{error:'SAME_ORIGIN_JSON_REQUIRED'});
   if(busy)return send(409,{error:'ANOTHER_EDIT_IS_IN_PROGRESS'});busy=true;ownsLock=true;
   let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>1024*1024)throw Error('REQUEST_TOO_LARGE');}
   const input=JSON.parse(raw),result=store.apply(input,url.pathname==='/api/delete'?'delete':'restore');return send(200,result);
  }catch(e){return send(/CHECK_RECEIPT/.test(e.message)?503:409,{ok:false,error:String(e.message||e).split('\n')[0].slice(0,180)});}finally{if(ownsLock)busy=false;}
 });return server;
}
if(require.main===module){const root=path.resolve(__dirname,'../..');let store;try{store=new GitStore({root});}catch(e){console.error('Run inside the Forge repository with existing git access. '+e.message);process.exit(1);}
 const server=createServer(store);server.listen(0,'127.0.0.1',()=>console.log('Live backlog worksheet: http://127.0.0.1:'+server.address().port+'\nReads main on every refresh. Deletes commit directly to main only when you select and confirm rows. No Writer calls. Ctrl+C stops.'));
}
module.exports={createServer};
