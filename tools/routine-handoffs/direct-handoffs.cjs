'use strict';
const fs=require('node:fs'),path=require('node:path'),S=require('../programmed-coordinator/store.cjs');
const folder='1DhaxVZSTRNQfJlWSMilmBomx__VUjmO7';
const validName=name=>/^forge-helper-[A-Za-z0-9_-]+\.json$/.test(name||'');
function prepare(privateDir){
 const directory=path.join(privateDir,'direct-handoffs'),state=S.read(directory,'capture-state.json',{files:{}});
 return{directory,folder,files:state.files||{}};
}
// This function runs unchanged in the supported connector host. It reads only
// immutable named artifacts in the existing private coordination folder.
async function host(tools,cfg){
 const unwrap=r=>{if(r.isError)throw Error('DRIVE_CONNECTOR_FAILED');return r.structuredContent||JSON.parse(r.content.find(c=>c.type==='text').text);};
 const save=async(file,value)=>{const r=await tools.apply_patch('*** Begin Patch\n*** Add File: '+file+'\n+'+JSON.stringify(value,null,2).split('\n').join('\n+')+'\n*** End Patch');if(r?.isError)throw Error('PRIVATE_HANDOFF_CAPTURE_FAILED');};
 const report={schema:'forge.direct-handoff-capture.v1',at:new Date().toISOString(),pages:0,captured:0,unchanged:0,failures:[],enumerationComplete:false,noProcessingCap:true};
 const seen=new Set(),files={...cfg.files};let token;
 try{do{
  if(token&&seen.has(token))throw Error('DRIVE_PAGE_TOKEN_CYCLE');if(token)seen.add(token);
  const page=unwrap(await tools.mcp__codex_apps__google_drive_search({item_type:'document',special_filter_query_str:"'"+cfg.folder+"' in parents and trashed = false and name contains 'forge-helper-'",topn:100,best_effort_fetch:false,...token?{page_token:token}:{}}));
  if(!Array.isArray(page.results))throw Error('DRIVE_PAGE_REQUIRED');report.pages++;
  for(const file of page.results){
   if(!/^forge-helper-[A-Za-z0-9_-]+\.json$/.test(file.title||''))continue;
   if(!/^[A-Za-z0-9_-]+$/.test(file.id||''))throw Error('DRIVE_FILE_ID_REQUIRED');
   try{
    const metadata=async()=>unwrap(await tools.mcp__codex_apps__google_drive_get_file_metadata({fileId:file.id,fields:'id,name,mimeType,size,parents,modifiedTime,webViewLink'}));
    const before=await metadata();
    if(before.id!==file.id||!before.parent_ids?.includes(cfg.folder)||before.mime_type!=='text/plain'||!/^forge-helper-[A-Za-z0-9_-]+\.json$/.test(before.title||'')||!Number.isFinite(Date.parse(before.modified_time))||!Number.isSafeInteger(Number(before.size))||Number(before.size)<1||Number(before.size)>2000000)throw Error('DIRECT_HANDOFF_METADATA_REQUIRED');
    const version=JSON.stringify([before.title,before.modified_time,before.size]);
    if(files[file.id]===version){report.unchanged++;continue;}
    if(typeof before.url!=='string'||!before.url.startsWith('https://drive.google.com/file/d/'+file.id+'/'))throw Error('DIRECT_HANDOFF_URL_REQUIRED');
    const body=unwrap(await tools.mcp__codex_apps__google_drive_fetch({url:before.url})),after=await metadata();
    if(body.id!==file.id||typeof body.content!=='string'||before.id!==after.id||before.title!==after.title||before.modified_time!==after.modified_time||before.size!==after.size||!after.parent_ids?.includes(cfg.folder))throw Error('DIRECT_HANDOFF_CHANGED_DURING_READ');
    // Byte count and complete envelope/routing are checked by the consumer.
    await save(cfg.directory+'/incoming/'+file.id+'-'+Date.now()+'.json',{schema:'forge.direct-handoff-packet.v1',metadata:before,text:body.content,capturedAt:new Date().toISOString()});
    files[file.id]=version;report.captured++;
   }catch(e){report.failures.push({id:file.id,reason:/^[A-Z_]+$/.test(e.message||'')?e.message:'DIRECT_HANDOFF_CAPTURE_REQUIRED'});}
  }
  token=page.next_page_token||null;
 }while(token);report.enumerationComplete=true;
 }catch{report.failures.push({reason:'DIRECT_HANDOFF_ENUMERATION_REQUIRED'});}
 await save(cfg.directory+'/capture-state.json',{files});await save(cfg.directory+'/capture-report.json',report);return report;
}
function consume(privateDir){
 const cfg=prepare(privateDir),state=S.read(cfg.directory,'consumed.json',{packets:{},files:{}}),result={captured:0,pending:[],noProcessingCap:true};
 const capture=S.read(cfg.directory,'capture-report.json',null);
 result.sourceCapture=capture?{at:capture.at,pages:capture.pages,enumerationComplete:capture.enumerationComplete,failures:capture.failures.length}:null;
 if(!capture)result.pending.push({sourceHash:S.hash('drive-capture'),reason:'DIRECT_HANDOFF_CAPTURE_NOT_YET_RUN'});
 for(const failure of capture?.failures||[])result.pending.push({sourceHash:S.hash(failure.id||'drive-enumeration'),reason:failure.reason});
 for(const filename of S.files(path.join(cfg.directory,'incoming'))){const packetKey=S.hash(fs.readFileSync(filename));if(state.packets[packetKey])continue;
  try{const p=JSON.parse(fs.readFileSync(filename,'utf8')),m=p.metadata;
   if(p.schema!=='forge.direct-handoff-packet.v1'||!m||!validName(m.title)||!m.parent_ids?.includes(folder)||m.mime_type!=='text/plain'||typeof p.text!=='string'||Buffer.byteLength(p.text)!==Number(m.size)||Buffer.byteLength(p.text)>2000000)throw Error('COMPLETE_DIRECT_HANDOFF_REQUIRED');
   const batch=JSON.parse(p.text);if(!/^forge\.(?:intake|enrichment|relevance|claude|outcome)-helper-batch\.v1$/.test(batch.schema||'')||m.title!=='forge-helper-'+batch.runId+'.json')throw Error('DIRECT_HANDOFF_ENVELOPE_REQUIRED');
   const sha=S.hash(p.text);if(state.files[m.id]&&state.files[m.id]!==sha)throw Error('IMMUTABLE_DRIVE_HANDOFF_CHANGED');
   S.immutable(privateDir,'helper-inbox/forge-helper-drive-'+sha+'.json',batch);
   state.files[m.id]=sha;state.packets[packetKey]=sha;result.captured++;
  }catch(e){result.pending.push({sourceHash:packetKey,reason:/^[A-Z_]+$/.test(e.message)?e.message:'DIRECT_HANDOFF_VALIDATION_REQUIRED'});}
 }
 S.save(cfg.directory,'consumed.json',state);return result;
}
module.exports={prepare,host,consume,folder};
