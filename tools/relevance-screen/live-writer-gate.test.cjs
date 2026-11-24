'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),{assertLiveWriterGate}=require('./live-writer-gate.cjs');

test('level warn passes when freeze is null and errors are empty',()=>{
 a.doesNotThrow(()=>assertLiveWriterGate({freeze:null,level:'warn',errors:[]}));
});
test('level OK passes when freeze is null and errors are empty',()=>{
 a.doesNotThrow(()=>assertLiveWriterGate({freeze:null,level:'OK',errors:[]}));
});
test('freeze non-null blocks even when level is OK and errors are empty',()=>{
 a.throws(()=>assertLiveWriterGate({freeze:'FROZEN',level:'OK',errors:[]}),/Live Writer gate or existing request freeze="FROZEN" level=OK errors=0/);
});
test('errors non-empty blocks even when freeze is null and level is OK',()=>{
 a.throws(()=>assertLiveWriterGate({freeze:null,level:'OK',errors:['failure']}),/Live Writer gate or existing request freeze=null level=OK errors=1/);
});
