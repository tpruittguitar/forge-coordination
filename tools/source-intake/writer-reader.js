'use strict';
/* Authorized read-only transport; never submit and never log the Writer key. */
const ENDPOINT='https://script.google.com/macros/s/AKfycbwShspSkto70NeFWjgTuyIf-W3EDgUmKmoWevE-jZq95pm6SAulrJYHX1HmiPg8tx3i/exec';
async function read(action,{key=process.env.FORGE_WRITER_KEY,transport=globalThis.fetch,clock=()=>Date.now(),requestId='',primaryIds=[]}={}){
 if(!key)throw Error('BLOCKED: credential required');
 if(!['ping','master','writer_status','archive','request_result','receipt_index','row_readback','rules'].includes(action))throw Error('BLOCKED: unsupported Writer action');
 const started=clock(),url=new URL(ENDPOINT);url.searchParams.set('action',action);url.searchParams.set('key',key);if(['request_result','receipt_index','row_readback'].includes(action)){if(!/^[A-Za-z0-9_-]{3,160}$/.test(requestId))throw Error('BLOCKED: valid receipt request ID required');url.searchParams.set('requestId',requestId);if(action==='row_readback'){if(!Array.isArray(primaryIds)||!primaryIds.length||primaryIds.length>25||primaryIds.some(x=>!/^V2[A-Z]-[A-Za-z0-9_-]+$/.test(x)))throw Error('BLOCKED: exact canonical readback IDs required');url.searchParams.set('ids',primaryIds.join(','))}}
 let resp,ended;
 for(let attempt=0;attempt<2;attempt++){
  const attemptStart=clock();
  try{resp=await transport(url.toString(),{method:'GET',redirect:'follow',signal:AbortSignal.timeout(30000),headers:{'Cache-Control':'no-store'}})}
  catch(e){if(attempt===1)throw Error('BLOCKED: Writer '+action+' transport '+(e&&e.name||'Error'));continue}
  ended=clock();
  if(ended<attemptStart||ended-attemptStart>30000)throw Error('BLOCKED: Writer '+action+' attempt timed out');
  if(resp.ok)break;
  if(attempt===0&&resp.status>=500&&resp.status<=599)continue;
  throw Error('BLOCKED: Writer HTTP '+resp.status);
 }
 let data;try{data=await resp.json()}catch{throw Error('BLOCKED: Writer JSON invalid')}
 if(!data||data.ok!==true)throw Error('BLOCKED: Writer read not authorized');
 const completed=clock();if(completed<started||completed-started>65000)throw Error('BLOCKED: Writer read total time invalid');
 return {data,startedAt:new Date(started).toISOString(),completedAt:new Date(completed).toISOString()};
}
function parseArchive(text){
 if(typeof text!=='string')throw Error('BLOCKED: archive text unavailable');
 const lines=[],at=new Map();
 for(const line of text.split(/\r?\n/)){
  if(/^\d+ \| V2[A-Z]-/.test(line)){
   const cells=line.split(' | '),id=cells[1]+'#'+cells[0];
   if(cells.length<10)throw Error('BLOCKED: malformed terminal archive row');
   if(at.has(id))lines[at.get(id)]=null;
   at.set(id,lines.length);
   lines.push({PRIMARY_ID:cells[1],COMPANY:cells[2],TITLE:cells[3],BUCKET:cells[4],DISPOSITION:cells[5],REQ_ID:cells[7],LOCATION:cells[8],ARCHIVED_TERMINAL:true,RAW_ROW:line,ANTI_RESURRECTION:(line.match(/(?:^|[; |])ANTI_RESURRECTION\s*[=:]\s*([^;| ]+)/i)||[])[1]||'',DO_NOT_REWORK:(line.match(/(?:^|[; |])DO_NOT_REWORK\s*[=:]\s*([^;| ]+)/i)||[])[1]||''});
  }else{
   const m=line.match(/^RESTORED\|([^|]+)\|(\d+)\|/);
   if(m){const id=m[1]+'#'+m[2];if(at.has(id)){lines[at.get(id)]=null;at.delete(id)}}
  }
 }
 return lines.filter(Boolean);
}
function parseMaster(text){
 if(typeof text!=='string'||!text.trim())throw Error('BLOCKED: no master text');
 const rows=text.split(/\r?\n/).filter(l=>/^\d+\s*\|\s*V2[A-Z]-/.test(l)).map(l=>{
 const c=l.trim().split(/\s+\|\s+/);if(c.length<10)throw Error('BLOCKED: short master row');
 return {PRIMARY_ID:c[1],COMPANY:c[2],TITLE:c[3],BUCKET:c[4],DISPOSITION:c[5],REQ_ID:c[7],LOCATION:c[8]};
 });
 if(!rows.length||!/^END V2_CURRENT_POPULATION_MASTER(?:\s|$)/m.test(text))throw Error('BLOCKED: master completeness marker missing');
 if(new Set(rows.map(x=>x.PRIMARY_ID)).size!==rows.length)throw Error('BLOCKED: duplicated master identities');
 return rows;
}
async function fetchAuthenticatedMaster(options={}){
 const ping=await read('ping',options),status=await read('writer_status',options),master=await read('master',options);
 if(!Object.hasOwn(status.data,'freeze')||status.data.freeze!=null||String(status.data.level||'').toUpperCase()!=='OK'||!Array.isArray(status.data.errors)||status.data.errors.length)throw Error('BLOCKED: Writer status not healthy');
 const rows=parseMaster(master.data.text);
 const expected=master.data.rowCount??master.data.count;
 if(Number.isInteger(expected)&&expected!==rows.length)throw Error('BLOCKED: Writer master count mismatch');
 // Writer labels UTF-16 JS string length as bytes; compare characters, not UTF-8 octets.
 if(master.data.bytes!=null && (!Number.isSafeInteger(master.data.bytes)||master.data.bytes<0||master.data.text.length!==master.data.bytes))throw Error('BLOCKED: Writer master byte count mismatch');
 const fetched=Date.parse(master.data.fetchedAt||'');
 const now=options.clock?options.clock():Date.now();
 if(!Number.isFinite(fetched)||now-fetched>15*60000||fetched>now+120000)throw Error('BLOCKED: Writer master fetchedAt stale or invalid');
 const modified=master.data.modifiedTime?Date.parse(master.data.modifiedTime):null;
 if(modified!==null&&(!Number.isFinite(modified)||modified>fetched+120000))throw Error('BLOCKED: Writer master modifiedTime invalid or after fetch');
 return {source:'WRITER',authenticated:true,rows,writerModifiedTime:master.data.modifiedTime||null,writerFetchedAt:master.data.fetchedAt,writerReadAt:master.completedAt,writerBuild:ping.data.build||null};
}
async function fetchAuthenticatedArchive(options={}){
 const r=await read('archive',options);
 if(r.data.degraded===true)throw Error('BLOCKED: Writer archive degraded');
 if(r.data.archiveId&&!r.data.text)throw Error('BLOCKED: Writer archive empty despite archiveId');
 if(!r.data.archiveId&&r.data.mode&&r.data.mode!=='NOT_MIGRATED')throw Error('BLOCKED: missing Writer archive ID');
 if(r.data.archiveId&&!/^V2_TERMINAL_ARCHIVE\b/m.test(r.data.text))throw Error('BLOCKED: terminal archive header missing');const parsed=parseArchive(r.data.text);if(r.data.archiveId&&!parsed.length&&!/RESTORED\|/.test(r.data.text))throw Error('BLOCKED: archive integrity unverified');return {source:'WRITER',authenticated:true,rows:parsed,writerReadAt:r.completedAt,archiveId:r.data.archiveId||null};
}
async function auditLiveWriter(preview,options={}){
 const {auditAuthenticated}=require('./admission');
 return auditAuthenticated(preview,{fetchMaster:()=>fetchAuthenticatedMaster(options),fetchArchive:()=>fetchAuthenticatedArchive(options)});
}
module.exports={read,parseMaster,parseArchive,fetchAuthenticatedMaster,fetchAuthenticatedArchive,auditLiveWriter};
