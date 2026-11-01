const test=require('node:test'),assert=require('node:assert/strict'),R=require('./writer-reader');
test('stored evidence reads require one exact canonical identity and remain read-only',async()=>{
 let calls=0;const transport=async(url,options)=>{calls++;const u=new URL(url);assert.equal(u.searchParams.get('action'),'evidence');assert.equal(u.searchParams.get('primaryId'),'V2I-ABC');assert.equal(options.method,'GET');return {ok:true,json:async()=>({ok:true,fields:{}})};};
 await R.read('evidence',{key:'fixture',primaryId:'V2I-ABC',transport});assert.equal(calls,1);
 await assert.rejects(R.read('evidence',{key:'fixture',primaryId:'arbitrary',transport}),/exact canonical/);
 await assert.rejects(R.read('intake',{key:'fixture',transport}),/unsupported/);assert.equal(calls,1);
});
test('an archived-only evidence miss does not falsely blame credentials',async()=>{
 await assert.rejects(R.read('evidence',{key:'fixture',primaryId:'V2I-ABC',transport:async()=>({ok:true,json:async()=>({ok:false,error:'identity not unique: 0 live rows match V2I-ABC'})})}),/archive.*not credentials/);
});
