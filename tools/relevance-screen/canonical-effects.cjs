'use strict';
function appendArchiveHits(hits,archive,ids,after){if(archive?.authenticated!==true||archive.source!=='WRITER'||!Number.isFinite(Date.parse(archive.writerReadAt))||Date.parse(archive.writerReadAt)<Date.parse(after)||!Array.isArray(archive.rows))throw Error('Archive read must be authenticated and later than COMPLETE');for(const id of ids){const rows=archive.rows.filter(r=>r.PRIMARY_ID===id);if(rows.length===1)hits.push({primaryId:id,found:true,matches:1,line:rows[0].RAW_ROW,store:'ARCHIVE'});}return hits;}
function exactHit(hits,id){return hits.find(h=>h.primaryId===id&&h.found&&h.matches===1)||null;}
module.exports={appendArchiveHits,exactHit};
