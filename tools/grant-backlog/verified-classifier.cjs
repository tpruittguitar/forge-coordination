'use strict';
// Load only the already-reviewed local Writer build. Never reads host config.
const cp=require('node:child_process'),path=require('node:path');
const fail=c=>{throw Error(c);};
const loaded=new Map();
function load({root,writerStatus},injection={}){
 const git=injection.git||(args=>cp.execFileSync('git',args,{cwd:root,encoding:'utf8',timeout:10000,maxBuffer:1000000,stdio:['ignore','pipe','pipe']}).trim());
 try{
  if(typeof root!=='string'||!path.isAbsolute(root))fail('ABSOLUTE_WRITER_SOURCE_REQUIRED');
  const commit=writerStatus?.build?.commit;
  if(!/^[a-f0-9]{40}$/.test(commit||''))fail('EXACT_WRITER_BUILD_REQUIRED');
  if(!['https://github.com/tpruittguitar/foreman-cockpit.git','https://github.com/tpruittguitar/foreman-cockpit','git@github.com:tpruittguitar/foreman-cockpit.git'].includes(git(['remote','get-url','origin'])))fail('WRITER_SOURCE_REMOTE_MISMATCH');
  if(git(['rev-parse','HEAD'])!==commit||git(['status','--porcelain']))fail('CLEAN_DEPLOYED_WRITER_SOURCE_REQUIRED');
  if(!injection.loadModule&&loaded.has(root)&&loaded.get(root)!==commit)fail('WRITER_CLASSIFIER_RESTART_REQUIRED');
  const source=(injection.loadModule||require)(path.join(root,'apps-script/Code.gs'));
  if(typeof source.classifyNeverConsider!=='function')fail('SUPPORTED_WRITER_CLASSIFIER_REQUIRED');
  if(!injection.loadModule)loaded.set(root,commit);
  return Object.freeze({commit,classifyNeverConsider:source.classifyNeverConsider});
 }catch(e){if(/^[A-Z][A-Z0-9_]+$/.test(e.message))throw e;fail('WRITER_CLASSIFIER_LOAD_FAILED');}
}
module.exports={load};
