#!/usr/bin/env node
'use strict';
// Pipeline v2 runner (card cs-bb7d087b). Dry run only: nothing is sent to the Writer; reads are fine.
// node tools/pipeline-v2/run.cjs --store DIR --lanes lanes.json --master master.json --rules rules.txt \
//   --scoring model.json [--fc-dir foreman-cockpit] [--engine all|discovery|gate|13..19] [--network off] [--report DIR]
const fs=require('node:fs'),path=require('node:path');
const S=require('./store.cjs'),D=require('./discovery.cjs'),G=require('./gate.cjs'),{runEngine}=require('./engine.cjs');
const Scope=require('./gate/10-scope.cjs'),M=require('./gate/master.cjs'),V=require('./viewer-modules.cjs'),AI=require('./ai.cjs'),R=require('./report.cjs');
const ENGINES=['13','14','15','16','17','18','19'].map(id=>require('./engines/'+fs.readdirSync(path.join(__dirname,'engines')).find(f=>f.startsWith(id+'-'))));
function args(argv){const a={};for(let i=0;i<argv.length;i++){if(argv[i].startsWith('--')){const k=argv[i].slice(2);a[k]=argv[i+1]&&!argv[i+1].startsWith('--')?argv[++i]:'true';}}return a;}
async function context(a){
 const ctx={dryRun:true,network:a.network!=='off',notes:{}};
 if(a.master){const m=S.readJson(a.master,[]);const rows=Array.isArray(m)?m:(m.jobs||m.rows||[]);const arch=a.archive?S.readJson(a.archive,[]):[];ctx.master=M.load(rows,{archiveRows:arch});
  if(!arch.length)ctx.notes['08']=ctx.notes['09']=['terminal archive not read in this run; master snapshot only ('+rows.length+' rows)'];}
 const rules=a.rules?fs.readFileSync(a.rules,'utf8'):'';
 ctx.ncRules=Scope.parseRules(rules);
 ctx.viewer=await V.load({fcDir:a['fc-dir']});
 ctx.flexPolicy=V.flexPolicy(ctx.viewer.Policy,ctx.viewer.Scoring,rules);
 if(a.scoring)ctx.scoringModel=S.readJson(a.scoring,null);
 ctx.ai=AI.creditPool({card:'cs-bb7d087b',enabled:a.ai==='credit'});
 if(a['ai-reason'])ctx.aiReason=a['ai-reason'];
 if(a['blocked-identities'])ctx.blockedIdentities=new Set(S.readJson(a['blocked-identities'],[]));
 return ctx;
}
async function main(a){
 if(a.writer&&a.writer!=='dry-run')throw Error('Writer is dry run only on card cs-bb7d087b');
 const storePath=path.resolve(a.store||'pipeline-v2-store');
 const store=S.open(storePath),ctx=await context(a),which=a.engine||'all',out=[];
 if(which==='all'||which==='discovery'){if(!a.lanes)throw Error('--lanes required');out.push(...D.runDiscovery({store,lanes:S.readJson(a.lanes,{}),ctx}));}
 if(which==='all'||which==='gate')out.push(...await G.runGate({store,ctx}));
 for(const e of ENGINES)if(which==='all'||which===e.id)out.push(await runEngine(e.id,{store,select:e.select,work:e.work,ctx}));
 for(const r of out)console.log(r.step,r.name.padEnd(22),r.lastRun.result.padEnd(10),'in',r.counts.in,'pass',r.counts.pass,'skip',r.counts.skip,'drop',r.counts.drop,'hold',r.counts.hold,'blocked',r.counts.blocked,'wait',r.counts.wait,'fail',r.counts.fail);
 if(a.report)R.write({store,dir:path.resolve(a.report),meta:{lanes:a.lanes,master:a.master,rules:a.rules,scoring:a.scoring,viewer:ctx.viewer.source,ai:ctx.aiReason||(ctx.ai.available?'credit':ctx.ai.reason)}});
 ES.write(ES.build({statusDir:path.join(storePath,'status')}));
}
if(require.main===module)main(args(process.argv.slice(2))).catch(e=>{console.error('pipeline-v2:',e.message);process.exit(1);});
module.exports={main,args,ENGINES};
