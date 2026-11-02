'use strict';
const fs=require('node:fs'),path=require('node:path'),S=require('../programmed-coordinator/store.cjs');
function prepare(cfg){
 const directory=path.join(cfg.privateDirectory,'gmail-connector'),cursor=S.read(cfg.repositoryDirectory,'state/APPLICATION_TRACKER_CURSOR.json',{});
 const incomplete=S.files(path.join(directory,'jobs')).map(f=>JSON.parse(fs.readFileSync(f,'utf8'))).find(j=>!fs.existsSync(path.join(directory,'inventories',j.id+'.json')));
 const through=new Date(Math.floor(Date.now()/1000)*1000).toISOString(),since=Date.parse(cursor.fullyReadThrough||cursor.enumeratedThrough);
 if(!Number.isFinite(since))throw Error('EXISTING_MAIL_CURSOR_REQUIRED');
 const request=incomplete||{schema:'forge.gmail-collection-job.v1',through,query:'in:anywhere after:'+Math.floor((since-48*3600000)/1000)+' before:'+Math.floor(Date.parse(through)/1000),pendingIds:cursor.pendingMessageIds||[]};
 if(!request.id){request.id=S.hash(request);S.immutable(directory,'jobs/'+request.id+'.json',request);}
 const pages=S.files(path.join(directory,'pages',request.id)).map(f=>JSON.parse(fs.readFileSync(f,'utf8'))).sort((a,b)=>a.page-b.page);
 validatePages(pages);
 const inbox=path.join(cfg.privateDirectory,'mail-inbox'),cached=new Set(),M=require('./mail.cjs');
 for(const file of S.files(inbox)){try{const c=JSON.parse(fs.readFileSync(file,'utf8'));if(c.schema!=='forge.gmail-source-capture.v1'||c.transport!=='SUPPORTED_GMAIL_CONNECTOR'||c.request?.format!=='full'||!Array.isArray(c.request.ids)||!Array.isArray(c.responses)||c.responses.length!==c.request.ids.length||new Set(c.responses.map(m=>m.id)).size!==c.request.ids.length)continue;for(const raw of c.responses)if(c.request.ids.includes(raw.id)&&M.normalize(raw).fullBody)cached.add(raw.id);}catch{}}
 return{directory,inbox,request,pages,cachedIds:[...cached]};
}
function validatePages(pages){for(let i=0;i<pages.length;i++){const p=pages[i];if(p.page!==i||p.requestToken!==(i?pages[i-1].nextPageToken:null)||i&& !p.requestToken||!Array.isArray(p.messageIds)||p.messageIds.some(id=>!/^[a-f0-9]+$/i.test(id)))throw Error('GMAIL_PAGE_CHAIN_REQUIRED');}}
// Runs only in the supported connector host. It never receives Writer credentials.
async function host(tools,cfg){
 const unwrap=r=>r.structuredContent||JSON.parse(r.content.find(c=>c.type==='text').text);
 const save=async(file,value)=>{const r=await tools.apply_patch('*** Begin Patch\n*** Add File: '+file+'\n+'+JSON.stringify(value,null,2).split('\n').join('\n+')+'\n*** End Patch');if(r?.isError)throw Error('MAIL_PRIVATE_CAPTURE_FAILED');};
 const pages=[...cfg.pages],seen=new Set(pages.map(p=>p.requestToken).filter(Boolean));let token=pages.at(-1)?.nextPageToken,page=pages.length;
 if(!pages.length||token){do{
  if(token&&seen.has(token))throw Error('REPEATED_GMAIL_PAGE_TOKEN');if(token)seen.add(token);
  const result=unwrap(await tools.mcp__codex_apps__gmail_search_email_ids({query:cfg.request.query,max_results:100,...token?{next_page_token:token}:{}}));
  if(!Array.isArray(result.message_ids)||result.message_ids.some(id=>!/^[a-f0-9]+$/i.test(id)))throw Error('GMAIL_ENUMERATION_REQUIRED');
  const record={page:page++,requestToken:token||null,messageIds:result.message_ids,nextPageToken:result.next_page_token||null};
  await save(cfg.directory+'/pages/'+cfg.request.id+'/'+String(record.page).padStart(8,'0')+'.json',record);pages.push(record);token=record.nextPageToken;
 }while(token);}
 const ids=[...new Set([...cfg.request.pendingIds,...pages.flatMap(p=>p.messageIds)])],failures=[];let read=0;
 async function batch(wanted){if(!wanted.length)return;let responses;
  try{responses=unwrap(await tools.mcp__codex_apps__gmail_batch_read_email({message_ids:wanted})).responses;if(!Array.isArray(responses)||responses.length!==wanted.length||new Set(responses.map(m=>m.id)).size!==wanted.length||responses.some(m=>!wanted.includes(m.id)))throw Error('EXACT_FULL_GMAIL_RESPONSES_REQUIRED');}
  catch{if(wanted.length>1){const middle=Math.ceil(wanted.length/2);await batch(wanted.slice(0,middle));await batch(wanted.slice(middle));}else failures.push(wanted[0]);return;}
  await save(cfg.inbox+'/'+cfg.request.id+'-'+wanted[0]+'-'+Date.now()+'.json',{schema:'forge.gmail-source-capture.v1',transport:'SUPPORTED_GMAIL_CONNECTOR',capturedAt:new Date().toISOString(),request:{format:'full',ids:wanted},responses});read+=responses.length;
 }
 const cached=new Set(cfg.cachedIds||[]),wanted=ids.filter(id=>!cached.has(id));
 for(let offset=0;offset<wanted.length;offset+=100)await batch(wanted.slice(offset,offset+100));
 await save(cfg.directory+'/inventories/'+cfg.request.id+'.json',{schema:'forge.gmail-inventory.v1',id:cfg.request.id,query:cfg.request.query,through:cfg.request.through,enumerationComplete:true,pages:pages.length,messageIds:ids,readFailures:failures});
 return{enumerated:ids.length,read,reused:ids.length-wanted.length,pending:failures.length,pages:pages.length,noProcessingCap:true};
}
function ingest(root,privateDir){
 const cursor=S.read(root,'state/APPLICATION_TRACKER_CURSOR.json',null);if(!cursor)return;
 cursor.connectorInventories=cursor.connectorInventories||[];
 for(const file of S.files(path.join(privateDir,'gmail-connector/inventories'))){const item=JSON.parse(fs.readFileSync(file,'utf8'));
  if(item.schema!=='forge.gmail-inventory.v1'||item.enumerationComplete!==true||!Number.isFinite(Date.parse(item.through))||Date.parse(item.through)>Date.now()||!Array.isArray(item.messageIds)||!/^[a-f0-9]{64}$/.test(item.id))throw Error('COMPLETE_MAIL_INVENTORY_REQUIRED');
  if(cursor.connectorInventories.includes(item.id))continue;
  const directory=path.join(privateDir,'gmail-connector'),job=S.read(directory,'jobs/'+item.id+'.json',{}),{id,...request}=job,pages=S.files(path.join(directory,'pages',item.id)).map(f=>JSON.parse(fs.readFileSync(f,'utf8'))).sort((a,b)=>a.page-b.page);validatePages(pages);
  if(id!==item.id||S.hash(request)!==item.id||item.query!==job.query||item.through!==job.through||pages.length!==item.pages||!pages.length||pages.at(-1).nextPageToken)throw Error('GMAIL_INVENTORY_REQUEST_BINDING_REQUIRED');
  const expected=[...new Set([...(job.pendingIds||[]),...pages.flatMap(p=>p.messageIds)])];if(S.hash(expected)!==S.hash(item.messageIds))throw Error('GMAIL_INVENTORY_ID_BINDING_REQUIRED');
  const processed=new Set(cursor.processedMessageIds||[]);cursor.pendingMessageIds=[...new Set([...(cursor.pendingMessageIds||[]),...item.messageIds.filter(id=>!processed.has(id))])];
  if(!cursor.enumeratedThrough||Date.parse(item.through)>Date.parse(cursor.enumeratedThrough))cursor.enumeratedThrough=item.through;
  // Preserve unrelated historical and delegated source obligations.
  cursor.connectorInventories.push(item.id);
 }
 S.save(root,'state/APPLICATION_TRACKER_CURSOR.json',cursor);
}
module.exports={prepare,host,ingest,validatePages};
