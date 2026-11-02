'use strict';
const fs=require('node:fs'),path=require('node:path'),S=require('../programmed-coordinator/store.cjs');
function paths(config){
 if(!path.isAbsolute(config.privateDirectory||'')||!path.isAbsolute(config.chromeExecutable||'')||!path.isAbsolute(config.playwrightModule||''))throw Error('LOCAL_BROWSER_ABSOLUTE_CONFIGURATION_REQUIRED');
 return{directory:path.join(config.privateDirectory,'local-chrome'),profile:path.join(config.privateDirectory,'local-chrome','profile')};
}
async function open(config,{setup=false,chromium}={}){
 const p=paths(config),marker=S.read(p.directory,'profile.json',null);
 if(!setup&&marker?.schema!=='forge.local-browser-profile.v1')throw Error('LOCAL_BROWSER_SIGN_IN_SETUP_REQUIRED');
 if(!chromium)chromium=require(config.playwrightModule).chromium;
 fs.mkdirSync(p.directory,{recursive:true});
 // Own profile only, never the user's normal Chrome data. Playwright's private
 // pipe needs no listening debugger port, copied cookies, stealth or proxy.
 const context=await chromium.launchPersistentContext(p.profile,{executablePath:config.chromeExecutable,headless:!setup,viewport:{width:1440,height:1000},timeout:30000});
 return{context,close:()=>context.close(),directory:p.directory};
}
async function setup(config){
 const browser=await open(config,{setup:true}),context=browser.context,closed=new Promise(resolve=>context.once('close',resolve));
 const page=context.pages()[0]||await context.newPage();await page.goto('https://www.linkedin.com/feed/',{waitUntil:'domcontentloaded',timeout:30000});
 console.log('Dedicated FORGE Chrome opened. Sign in to LinkedIn yourself, then close this Chrome window. No credentials are requested by the coordinator.');
 await closed;S.save(browser.directory,'profile.json',{schema:'forge.local-browser-profile.v1',configuredAt:new Date().toISOString(),signIn:'USER_MANAGED',coverageVerified:false});
 console.log('Dedicated profile saved. The next source capture will verify access.');
}
if(require.main===module){const config=JSON.parse(fs.readFileSync(process.argv[3],'utf8'));if(process.argv[2]!=='setup')throw Error('Use setup with the existing private browser configuration');setup(config).catch(e=>{console.error(/^[A-Z_]+$/.test(e.message)?e.message:'LOCAL_BROWSER_SETUP_FAILED');process.exitCode=1;});}
module.exports={paths,open,setup};
