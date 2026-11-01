'use strict';
// A terminal no-mutation response has no write transaction to independently
// verify. Existing matches still require their own fresh canonical readback.
function classify(response,payload){
 const a=response,r=a?.receipt,c=r?.COUNTERS,identity=x=>JSON.stringify([x.COMPANY,x.TITLE,x.LOCATION,x.SOURCE_URL,x.GMAIL_MESSAGE_ID]);
 if(!a?.ok||a.WRITE_ACCEPTED||a.writeId||a.COMPLETION_STATUS!=='COMPLETE'||r?.REQUEST_ID!==payload?.requestId||r?.WRITE_VERIFIED!=='NOT_APPLICABLE'||!Array.isArray(r.NEW_PRIMARY_IDS)||r.NEW_PRIMARY_IDS.length||r.DISCOVERY_UNACCOUNTED!==0||c?.ENTERED_MASTER!==0||c?.DISCOVERY_UNACCOUNTED!==0||!Array.isArray(a.results)||!Array.isArray(payload.records)||a.results.length!==payload.records.length||c.CANDIDATES_SUBMITTED!==payload.records.length)throw Error('Not proven terminal zero-write accounting');
 const expected=payload.records.map(identity),outcomes=[];
 for(const x of a.results){const i=expected.indexOf(identity(x.source||{}));if(i<0||!['EXISTING_MATCH','WRITE_FAILED','NEVER_CONSIDER_EXCLUDED'].includes(x.result))throw Error('Unbound or unsupported zero-write outcome');expected.splice(i,1);if(x.result==='EXISTING_MATCH'&&!x.PRIMARY_ID)throw Error('Missing existing identity');outcomes.push({result:x.result,primaryId:x.PRIMARY_ID||null,source:x.source,reason:x.detail||'',requiresCanonicalReadback:x.result==='EXISTING_MATCH'});}
 return {requestId:payload.requestId,canonicalWrites:0,writeReceiptNotApplicable:true,originalRequestMustNotBeReplayed:true,outcomes};
}
module.exports={classify};
