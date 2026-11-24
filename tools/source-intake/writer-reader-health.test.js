'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),{fetchAuthenticatedMaster}=require('./writer-reader');
const now=Date.now();
const text='1 | V2S-X1 | Acme | Director | OPEN | OPEN | P1 | R1 | Austin, TX | NOTES\nEND V2_CURRENT_POPULATION_MASTER';
function transport(status){
 return async(url)=>{
  const action=new URL(url).searchParams.get('action');
  if(action==='writer_status')return {ok:true,json:async()=>({ok:true,...status})};
  if(action==='master')return {ok:true,json:async()=>({ok:true,text,bytes:text.length,fetchedAt:new Date(now).toISOString(),modifiedTime:'2026-10-20T00:00:00Z'})};
  return {ok:true,json:async()=>({ok:true,build:'test'})};
 };
}
const opts=(status)=>({key:'fixture',clock:()=>now,transport:transport(status)});

test('level warn passes when freeze is null and errors are empty',async()=>{
 const r=await fetchAuthenticatedMaster(opts({freeze:null,level:'warn',errors:[]}));
 a.equal(r.authenticated,true);a.equal(r.rows.length,1);
});
test('level OK passes when freeze is null and errors are empty',async()=>{
 const r=await fetchAuthenticatedMaster(opts({freeze:null,level:'OK',errors:[]}));
 a.equal(r.authenticated,true);a.equal(r.rows.length,1);
});
test('freeze non-null blocks even when level is OK and errors are empty',async()=>{
 await a.rejects(()=>fetchAuthenticatedMaster(opts({freeze:'FROZEN',level:'OK',errors:[]})),/status not healthy freeze="FROZEN" level=OK errors=0/);
});
test('errors non-empty blocks even when freeze is null and level is OK',async()=>{
 await a.rejects(()=>fetchAuthenticatedMaster(opts({freeze:null,level:'OK',errors:['failure']})),/status not healthy freeze=null level=OK errors=1/);
});
