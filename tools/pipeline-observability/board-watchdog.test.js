const {test}=require('node:test'),a=require('node:assert/strict'),{recover}=require('./discovery-watchdog');
const now=Date.parse('2026-10-31T07:00Z'),old={summary:{at:'2026-10-31T00:00Z'}},recent={summary:{at:'2026-10-31T06:00Z'}};
test('missed board pass restarts independently while recent source discovery stays idle',()=>{const calls=[],exec=(_,args)=>{if(args[0]==='api')return JSON.stringify({workflow_runs:[]});calls.push(args);return '';};a.deepEqual(recover(exec,f=>f.includes('board-')?old:recent,now),['board-discovery.yml']);a.deepEqual(calls,[['workflow','run','board-discovery.yml','--ref','main']]);});
test('running or recently attempted main board pass is never duplicated',()=>{for(const run of [{head_branch:'main',event:'schedule',status:'in_progress',created_at:'2026-10-31T04:00Z'},{head_branch:'main',event:'workflow_dispatch',status:'completed',created_at:'2026-10-31T06:30Z'}]){const exec=(_,args)=>{if(args[0]!=='api')throw Error('must not dispatch');return JSON.stringify({workflow_runs:args[1].includes('board-discovery')?[run]:[]});};a.deepEqual(recover(exec,f=>f.includes('board-')?old:recent,now),[]);}});
test('a non-OK board past its retryAt restarts board discovery inside the 5 h cadence unless a run started in the last 90 minutes',()=>{
 const health=retryAt=>({schema:'forge.board-health.v1',boards:{'dover:acme':{key:'dover:acme',status:'TEMPORARY_FAILURE',retryAt,companies:['Acme']}}});
 const run=(retryAt,runs=[])=>{const calls=[],exec=(_,args)=>{if(args[0]==='api')return JSON.stringify({workflow_runs:args[1].includes('board-discovery')?runs:[]});calls.push(args[2]);return '';};recover(exec,f=>f==='state/board-health.json'?health(retryAt):recent,now);return calls;};
 a.deepEqual(run('2026-10-31T06:59Z'),['board-discovery.yml']);
 a.deepEqual(run('2026-10-31T07:30Z'),[]);
 a.deepEqual(run('2026-10-31T06:59Z',[{head_branch:'main',event:'schedule',status:'completed',created_at:'2026-10-31T05:45Z'}]),[]);
 a.deepEqual(run('2026-10-31T06:59Z',[{head_branch:'main',event:'schedule',status:'completed',created_at:'2026-10-31T05:20Z'}]),['board-discovery.yml']);
 const exec=(_,args)=>{if(args[0]==='api')return JSON.stringify({workflow_runs:[]});throw Error('must not dispatch');};
 a.deepEqual(recover(exec,f=>f==='state/board-health.json'?{boards:{x:{status:'OK',retryAt:null},y:{status:'TEMPORARY_FAILURE',paused:true,retryAt:'2026-10-31T06:00Z'}}}:recent,now),[]);
});
