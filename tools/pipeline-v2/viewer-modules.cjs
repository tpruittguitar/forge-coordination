'use strict';
// Loads the Writer/viewer shared modules (pipeline-scoring.js, pipeline-policy.js, pipeline-evidence.js) from
// foreman-cockpit, so coordinates, FLEX and the final score use the exact formula the Writer uses today.
// Source: a local foreman-cockpit checkout (FC_DIR) or the public raw files on main. Read-only.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const RAW='https://raw.githubusercontent.com/tpruittguitar/foreman-cockpit/main/';
const FILES=['pipeline-evidence.js','pipeline-policy.js','pipeline-scoring.js'];
async function load({fcDir=process.env.FC_DIR,fetch=globalThis.fetch}={}){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pv2-viewer-'));
 for(const f of FILES){
  let src;
  if(fcDir)src=fs.readFileSync(path.join(fcDir,f),'utf8');
  else{const r=await fetch(RAW+f,{signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('VIEWER_MODULE_HTTP_'+r.status+' '+f);src=await r.text();}
  fs.writeFileSync(path.join(dir,f),src);
 }
 return {Policy:require(path.join(dir,'pipeline-policy.js')),Scoring:require(path.join(dir,'pipeline-scoring.js')),source:fcDir?'LOCAL:'+fcDir:RAW};
}
/** FLEX policy from SECTION=DEGREE_FLEX keys, the same way the Writer's readFlexPolicy_ builds it. */
function flexPolicy(Policy,Scoring,rulesText){
 const defaults=Policy.normalizeFlexPolicy({}),text=String(rulesText||'');
 const sec=text.match(/(?:^|\n)SECTION=DEGREE_FLEX\s*\n([\s\S]*?)(?=\nSECTION=|$)/);
 if(!sec)return Object.assign(defaults,{_SOURCE:'CANONICAL_DEFAULTS'});
 const raw={POLICY_VERSION:(text.match(/^POLICY_VERSION=(.+)$/m)||[])[1]||''};
 sec[1].split(/\r?\n/).forEach(line=>{const m=line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);if(m&&(defaults[m[1]]!==undefined||m[1]==='FLEX_POLICY_VERSION'))raw[m[1]]=m[2];});
 if(raw.POLICY_VERSION===Policy.V4)raw.FLEX_POLICY_VERSION=Policy.V4;
 const p=Policy.normalizeFlexPolicy(raw);p._TARGET_COMPANIES=Scoring.targetCompaniesFromRules(text);p._SOURCE='CANONICAL_STRUCTURED';
 return p;
}
module.exports={load,flexPolicy,FILES,RAW};
