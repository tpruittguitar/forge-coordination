'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),{benchmark}=require('./benchmark-identity');
test('batch benchmark reads one master/archive per batch, not per candidate',()=>{
 let masterReads=0,archiveReads=0;const text='1 | V2I-ONE | Acme | Plant Manager | NEW | OPEN | - | UNKNOWN | Austin, TX | SOURCE_URL=https://example.test/1\nEND V2_CURRENT_POPULATION_MASTER';
 const candidates=Array.from({length:20},()=>({company:'Acme',title:'Plant Manager',location:'Austin, TX',url:'https://example.test/1'}));
 const result=benchmark({readMaster:()=>{masterReads++;return text;},readArchive:()=>{archiveReads++;return 'V2_TERMINAL_ARCHIVE\n';},candidates,iterations:2,naiveLimit:3});
 a.equal(result.candidates,20);a.equal(result.oncePerBatch.masterReads,1);a.equal(result.oncePerBatch.indexBuilds,1);a.equal(result.repeatedPerCandidate.masterReads,3);a.equal(masterReads,6);a.equal(archiveReads,6);a.equal(result.kind,'LOCAL_CACHED_IO_NOT_NETWORK_LATENCY');
});
