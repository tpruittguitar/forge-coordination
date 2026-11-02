'use strict';
const S=require('./store.cjs');
async function rows({requestId,ids,key,W,reader=require('../source-intake/writer-reader').read}) {
 const startedAt=new Date().toISOString(),rows=[];
 for(let n=0;n<ids.length;n+=25) {
  const group=ids.slice(n,n+25),result=await reader('row_readback',{key,requestId,primaryIds:group});
  if(result.data.master?.endMarkerPresent!==true||!Array.isArray(result.data.rows))throw Error('INCOMPLETE_READBACK');
  for(const id of group) {
   const hits=result.data.rows.filter(h=>h.primaryId===id);
   if(hits.length!==1||!hits[0].found||hits[0].matches!==1)throw Error('EXACT_READBACK_ID_REQUIRED');
   const hit=hits[0],row=W.parseRows(hit.line)[0];
   if(!row||row.PRIMARY_ID!==id||hit.lineSha256&&hit.lineSha256!==S.hash(hit.line))throw Error('READBACK_ID_OR_HASH_BINDING');
   row.line=hit.line;
   if(row.p.EVIDENCE_REF) {
    const evidence=await reader('evidence',{key,primaryId:id});
    if(evidence.data.active!==true||evidence.data.primaryId!==id||evidence.data.evidenceRef!==row.p.EVIDENCE_REF||!evidence.data.fields)throw Error('COMPANION_EVIDENCE_BINDING');
    // Bind the companion chain to the same exact canonical row after the
    // evidence read, rather than combining two independently changing versions.
    const later=await reader('row_readback',{key,requestId,primaryIds:[id]});
    const check=later.data.rows?.filter(h=>h.primaryId===id);
    if(later.data.master?.endMarkerPresent!==true||check?.length!==1||check[0].matches!==1||check[0].line!==hit.line)throw Error('ROW_CHANGED_DURING_EVIDENCE_READ');
    Object.assign(row.p,evidence.data.fields);
    row.evidenceProof={reference:evidence.data.evidenceRef,sha256:S.hash(evidence.data.fields)};
   }
   rows.push(row);
  }
 }
 return{startedAt,rows};
}
module.exports={rows};
