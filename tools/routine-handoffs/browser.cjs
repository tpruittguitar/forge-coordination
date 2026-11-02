'use strict';
const path=require('node:path');
function endpoint(value){const u=new URL(value);if(!['http:','ws:'].includes(u.protocol)||!['127.0.0.1','localhost','[::1]'].includes(u.hostname)||u.username||u.password||u.search||u.hash)throw Error('LOCAL_BROWSER_ENDPOINT_REQUIRED');return u.href;}
function sourceUrl(value){const u=new URL(value);if(u.protocol!=='https:'||!['grok.com','claude.ai','www.linkedin.com','www.glassdoor.com'].includes(u.hostname)||u.username||u.password)throw Error('UNAPPROVED_BROWSER_SOURCE');return u.href;}
async function connect(config,{chromium}={}){
 if(config?.connectorDirectory)return require('./connector-queue.cjs').connect(config);
 if(!config?.endpoint)throw Error('SUPPORTED_BROWSER_ROUTE_UNAVAILABLE');
 if(!chromium){if(!config.playwrightModule||!path.isAbsolute(config.playwrightModule))throw Error('EXISTING_PLAYWRIGHT_MODULE_REQUIRED');chromium=require(config.playwrightModule).chromium;}
 // Attach only to a separately configured existing browser. Never enable a
 // debugger, restart Chrome, copy profiles/cookies, or perform a login.
 const browser=await chromium.connectOverCDP(endpoint(config.endpoint),{timeout:10000}),context=browser.contexts()[0];
 if(!context){await browser.close();throw Error('EXISTING_BROWSER_CONTEXT_REQUIRED');}
 const owned=new Set();
 async function page(url){const p=await context.newPage();owned.add(p);try{await p.goto(sourceUrl(url),{waitUntil:'domcontentloaded',timeout:30000});return p;}catch(e){await p.close().catch(()=>{});owned.delete(p);throw e;}}
 async function invoke(p,name,input){
  if(!/^[A-Za-z][A-Za-z0-9_.-]{2,100}$/.test(name||''))throw Error('CONFIGURED_WEBMCP_TOOL_REQUIRED');
  const definitions=require('./page-tools.cjs'),definition=definitions.tools[name];
  const registryAvailable=await p.evaluate(()=>!!globalThis.__PLUNO_WEBMCP_TOOLS__);
  if(!registryAvailable){if(name==='forge_read_results_v1')return p.evaluate(definitions.readResults,input);if(name==='forge_click_results_next_v1')return p.evaluate(definitions.clickResultsNext,input);throw Error('WEBMCP_REGISTRY_UNAVAILABLE');}
  return p.evaluate(async({name,input,definition})=>{
   const registry=globalThis.__PLUNO_WEBMCP_TOOLS__;
   if(!registry)throw Error('WEBMCP_REGISTRY_UNAVAILABLE');
   const tools=await registry.getTools();if(!tools.some(t=>t.name===name)){if(!definition)throw Error('WEBMCP_TOOL_UNAVAILABLE');await registry.addTool(definition);}
   const tool=await registry.getTool(name);if(!tool?.inputSchema)throw Error('WEBMCP_TOOL_SCHEMA_UNAVAILABLE');
   return tool.execute(input);
  },{name,input,definition});
 }
 return{
  async feed(feed){
   if(!feed.automationId||!feed.taskKey||!['Grok','Claude'].includes(feed.provider))throw Error('EXACT_HELPER_FEED_REQUIRED');
   const p=await page(feed.url);
   return{...feed,list:({cursor})=>invoke(p,feed.listTool,{automationId:feed.automationId,cursor}),read:report=>invoke(p,feed.readTool,{automationId:feed.automationId,reportId:report.id}),close:async()=>{owned.delete(p);await p.close();}};
  },
  pagination:{async open({url}){const p=await page(url),read=config.resultsReadTool||'forge_read_results_v1',next=config.resultsNextTool||'forge_click_results_next_v1';return{observe:()=>invoke(p,read,{expectedUrl:url}),next:async input=>{const after=await invoke(p,next,input);return after?.schema==='forge.result-page-observation.v1'?after:invoke(p,read,{expectedUrl:after.url});},close:async()=>{owned.delete(p);await p.close();}};}},
  async close(){for(const p of owned)await p.close().catch(()=>{});owned.clear();await browser.close();} // Disconnect attached client; no context was created.
 };
}
module.exports={connect,endpoint,sourceUrl};
