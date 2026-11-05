const test=require('node:test'),a=require('node:assert/strict'),{read}=require('./writer-reader');
test('temporary Writer 404 is retried as a GET; persistent failure and auth refusal remain errors',async()=>{
 let n=0;const r=await read('rules',{key:'fixture',transport:async(_url,opts)=>{a.equal(opts.method,'GET');return ++n===1?{ok:false,status:404}:{ok:true,json:async()=>({ok:true})};}});a.equal(n,2);a.equal(r.data.ok,true);
 n=0;await a.rejects(read('rules',{key:'fixture',transport:async()=>{n++;return{ok:false,status:404};}}),/Writer HTTP 404/);a.equal(n,2);
 n=0;await a.rejects(read('rules',{key:'fixture',transport:async()=>{n++;return{ok:false,status:403};}}),/Writer HTTP 403/);a.equal(n,1);
});
