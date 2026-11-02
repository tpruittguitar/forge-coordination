'use strict';
const fs=require('node:fs'),path=require('node:path'),S=require('../programmed-coordinator/store.cjs'),P=require('./pagination.cjs'),{query}=require('../email-recovery/import-capture.cjs');
function identity(r){return r.type==='RESULTS_PAGE'?S.hash({type:r.type,sourceId:r.sourceId,query:query(r.url),position:P.position(r.url)}):S.hash({type:r.type,provider:r.provider,taskKey:r.taskKey,automationId:r.automationId,after:r.after});}
function enqueue(directory,request){require('./browser.cjs').sourceUrl(request.url);
 const related=S.files(path.join(directory,'jobs')).map(f=>JSON.parse(fs.readFileSync(f,'utf8'))).filter(j=>identity(j.request)===identity(request));
 const active=related.find(j=>!fs.existsSync(path.join(directory,'results',j.id+'.json'))&&!fs.existsSync(path.join(directory,'failures',j.id+'.json')));if(active)return active.id;
 const failed=related.map(j=>({job:j,failure:S.read(directory,'failures/'+j.id+'.json',null)})).filter(x=>x.failure).sort((a,b)=>Date.parse(b.failure.at)-Date.parse(a.failure.at))[0];
 if(failed){if(Date.now()-Date.parse(failed.failure.at)<15*60000)return failed.job.id;request={...request,retryOf:failed.job.id,retryWindow:Math.floor(Date.now()/(15*60000))};}
 const id=S.hash(request),file='jobs/'+id+'.json';if(!fs.existsSync(path.join(directory,file)))S.immutable(directory,file,{schema:'forge.connector-job.v1',id,request,createdAt:new Date().toISOString(),status:'PENDING'});return id;
}
function packets(directory,type){return S.files(path.join(directory,'results')).map(f=>S.read(directory,path.relative(directory,f))).filter(p=>p.schema==='forge.connector-result.v1'&&p.request?.type===type&&p.status==='COMPLETE');}
function feedPackets(directory,feed){return packets(directory,'NATIVE_REPORTS').filter(p=>p.request.taskKey===feed.taskKey&&p.request.provider===feed.provider&&p.request.automationId===feed.automationId).sort((a,b)=>String(a.completedAt).localeCompare(String(b.completedAt)));}
async function connect(config){
 const directory=config.connectorDirectory;if(!directory||!path.isAbsolute(directory))throw Error('PRIVATE_CONNECTOR_DIRECTORY_REQUIRED');
 return{async feed(feed){return{...feed,async list({cursor}){const all=feedPackets(directory,feed),reports=[];for(const packet of all)for(const r of packet.data.reports||[])if(r.fullReportComplete===true&&typeof r.text==='string'&&!reports.some(p=>p.id===r.id))reports.push({id:r.id,text:r.text});enqueue(directory,{type:'NATIVE_REPORTS',provider:feed.provider,taskKey:feed.taskKey,automationId:feed.automationId,url:feed.url,after:all.at(-1)?.completedAt||null});if(!all.length)throw Error('NATIVE_REPORT_CAPTURE_PENDING');return{reports,exhausted:true,resumeCursor:all.at(-1).jobId};},async read(report){return{complete:true,text:report.text};},close:async()=>{}};},
 pagination:{async open({sourceId,url}){
  const candidates=packets(directory,'RESULTS_PAGE').filter(p=>p.request.sourceId===sourceId&&Date.now()-Date.parse(p.completedAt)<15*60000),observations=candidates.flatMap(p=>[p.data.before,p.data.after].filter(Boolean));
  const observed=observations.filter(p=>query(p.url)===query(url)&&P.position(p.url)===P.position(url)).at(-1);
  if(!observed)enqueue(directory,{type:'RESULTS_PAGE',sourceId,url,refreshWindow:Math.floor(Date.now()/(15*60000))});
  return{async observe(){if(!observed)throw Error('RESULT_PAGE_CAPTURE_PENDING');return observed;},async next({expectedUrl,controlProof}){const packet=candidates.find(p=>p.data.clickedControl==='RESULTS_NEXT'&&p.data.before&&query(p.data.before.url)===query(expectedUrl)&&P.position(p.data.before.url)===P.position(expectedUrl)&&p.data.before.next?.proof===controlProof&&p.data.after);if(!packet)throw Error('RESULTS_NEXT_CAPTURE_PENDING');return packet.data.after;},close:async()=>{}};
 }},close:async()=>{}};
}
function accept(directory,job,result,providerRunId){
 if(job.id!==S.hash(job.request)||!/^[a-f0-9-]{36}$/i.test(providerRunId||''))throw Error('CONNECTOR_JOB_RUN_BINDING_REQUIRED');
 if(result?.complete!==true)throw Error(result?.reason||'CONNECTOR_SOURCE_INCOMPLETE');
 if(job.request.type==='RESULTS_PAGE'){
  if(result.schema!=='forge.browser-pagination-capture.v1'||result.sourceId!==job.request.sourceId||P.position(result.before?.url)!==P.position(job.request.url))throw Error('CONNECTOR_SOURCE_BINDING_CONFLICT');
  const source={url:job.request.url};P.observation(result.before,source);if(result.before.next.available&&!result.before.next.proof)throw Error('CONNECTOR_CONTROL_PROOF_REQUIRED');
  const at=Date.parse(result.before.at);if(at<Date.parse(job.createdAt)-60000||at>Date.now()+60000)throw Error('CONNECTOR_OBSERVATION_TIME_CONFLICT');
  if(result.after){P.observation(result.after,source);if(result.clickedControl!=='RESULTS_NEXT'||!result.before.next.available||P.position(result.after.url)<=P.position(result.before.url)||Date.parse(result.after.at)<at)throw Error('CONNECTOR_NEXT_NOT_PROVEN');}
 }else if(job.request.type==='NATIVE_REPORTS'){
  if(result.schema!=='forge.native-report-capture.v1'||result.taskKey!==job.request.taskKey||result.provider!==job.request.provider||result.automationId!==job.request.automationId||!Array.isArray(result.reports)||result.reports.some(r=>!/^[A-Za-z0-9_-]+$/.test(r.id||'')||r.fullReportComplete!==true||typeof r.text!=='string'||!r.text.trim()||!r.url||new URL(r.url).hostname!==(result.provider==='Grok'?'grok.com':'claude.ai')))throw Error('CONNECTOR_REPORT_BINDING_CONFLICT');
 }else throw Error('UNSUPPORTED_CONNECTOR_RESULT');
 const packet={schema:'forge.connector-result.v1',jobId:job.id,request:job.request,status:'COMPLETE',completedAt:new Date().toISOString(),providerRunId,data:result};S.immutable(directory,'results/'+job.id+'.json',packet);return packet;
}
module.exports={connect,enqueue,accept,packets,identity};
