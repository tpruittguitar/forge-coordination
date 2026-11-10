'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {utcStamp,grokRequestIds}=require('./direct-request-id.cjs');
const {validate}=require('./direct-writer.cjs');
test('Grok request ids are true UTC to the second and unique within that second',()=>{
 const morning=new Date('2026-11-10T15:56:13.000Z'),afternoon=new Date('2026-11-10T20:56:13.000Z');
 assert.equal(utcStamp(morning),'20261110T155613Z');
 assert.equal(utcStamp(afternoon),'20261110T205613Z');
 assert.notEqual(utcStamp(afternoon),'20261110T155613Z');
 const first=grokRequestIds(morning,1),second=grokRequestIds(new Date(morning.getTime()+1000),1),batch=grokRequestIds(morning,2);
 assert.equal(first.requestId,'FORGE-GROK-SHARED-20261110T155613Z-B001');
 assert.equal(first.childRequestId,first.requestId+'-R001');
 assert.notEqual(first.requestId,second.requestId);
 assert.notEqual(first.requestId,batch.requestId);
 const payload={action:'batch',requestId:first.requestId,requests:[{action:'ruling',ruling:{requestId:first.childRequestId,primaryId:'V2I-EXAMPLE',kind:'ENRICH',actor:'GROK',fields:{DEGREE_TEXT:'Bachelor degree or equivalent experience.',DEGREE_EVIDENCE_URL:'https://employer.example/jobs/123'}}}]};
 assert.equal(validate(payload).status,'SYNTAX_VALID');
 assert.throws(()=>grokRequestIds('not-a-time'),/UTC_REQUEST_TIME_REQUIRED/);
 assert.throws(()=>grokRequestIds(morning,0),/GROK_BATCH_REQUIRED/);
});
