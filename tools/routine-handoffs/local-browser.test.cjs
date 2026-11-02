'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),L=require('./local-browser.cjs'),S=require('../programmed-coordinator/store.cjs');
test('local browser requires manual setup and uses only its own persistent profile without an exposed debugger',async t=>{
 const privateDirectory=fs.mkdtempSync(path.join(os.tmpdir(),'forge-local-browser-'));t.after(()=>fs.rmSync(privateDirectory,{recursive:true,force:true}));const config={privateDirectory,chromeExecutable:path.join(privateDirectory,'chrome'),playwrightModule:path.join(privateDirectory,'playwright')};let launched;
 const chromium={launchPersistentContext:async(profile,options)=>{launched={profile,options};return{close:async()=>{}};}};
 await a.rejects(L.open(config,{chromium}),/SIGN_IN_SETUP_REQUIRED/);a.equal(launched,undefined);await L.open(config,{setup:true,chromium});a.equal(launched.profile,path.join(privateDirectory,'local-chrome','profile'));a.equal(launched.options.headless,false);a.equal(launched.options.args,undefined);
 S.save(path.join(privateDirectory,'local-chrome'),'profile.json',{schema:'forge.local-browser-profile.v1'});await L.open(config,{chromium});a.equal(launched.options.headless,true);a.throws(()=>L.paths({...config,privateDirectory:'relative'}),/ABSOLUTE/);
});
