'use strict';
const {normalizeCell}=require('../source-intake/writer-cell');

// A compact index no longer contains item IDs. Require the saved RESULT, all
// child aliases, and an exact current readback of the submitted fields instead.
async function verify(batch, {index, read, parse}) {
  const aliases=batch.map(q=>q.ruling.requestId);
  if(!aliases.length||!aliases.every(id=>index.requests?.[id]?.s==='COMPLETE'))return false;
  const result=await read('request_result',{requestId:aliases[0]});
  if(result.requestId!==aliases[0]||result.status!=='COMPLETE'||result.durable!==true||!result.found)return false;
  const rb=await read('row_readback',{requestId:aliases[0],ids:batch.map(q=>q.ruling.primaryId).join(',')});
  if(!rb.ok||rb.master?.endMarkerPresent!==true)return false;
  return batch.every(q=>{
    const hits=(rb.rows||[]).filter(x=>x.primaryId===q.ruling.primaryId);
    if(hits.length!==1||!hits[0].found||hits[0].matches!==1)return false;
    const row=parse(hits[0].line);
    // SALARY_NOTE is routed to the evidence sidecar; it is not a master cell.
    return row?.PRIMARY_ID===q.ruling.primaryId&&Object.entries(q.ruling.fields||{}).filter(([k])=>k!=='SALARY_NOTE').every(([k,v])=>normalizeCell(row.p[k])===normalizeCell(v));
  });
}
module.exports={verify};
