'use strict';
// Execution evidence is distinct from write evidence. Read-only tracker runs
// have primary-message dispositions and canonical row hashes, not write receipts.
function trackerProof(t,p){
 if(p.runId!==t.runId||!Number.isSafeInteger(t.masterSubmitted)||t.masterSubmitted<0||t.masterSubmitted!==t.masterVerified)return false;
 if(t.masterSubmitted>0)return Array.isArray(p.rows)&&p.rows.length===t.masterVerified&&p.rows.every(r=>r.found&&r.matches===1&&r.exactReadback===true)&&Array.isArray(p.receiptChecks)&&p.receiptChecks.length===t.masterVerified&&p.receiptChecks.every(r=>r.source==='GITHUB'&&r.status==='COMPLETE'&&r.durableResult==='COMPLETE');
 const count=t.newCurrentMessagesRead+t.historicalContextMessagesRead;
 const messages=p.messageStates,rows=p.canonicalRows,events=p.eventsAdded;
 if(p.noMasterMutations!==true||t.mailMutations!==0||t.calendarMutations!==0||p.at!==t.at||!Number.isFinite(Date.parse(p.at)))return false;
 if(!Number.isSafeInteger(count)||count<0||p.sourceMessagesRead!==count||t.classified!==count||!Array.isArray(messages)||messages.length!==count||new Set(messages.map(x=>x.messageId)).size!==count||messages.some(x=>!/^[a-f0-9]{16}$/.test(x.messageId||'')||x.evidenceVerified!==true||!x.classification||!x.status))return false;
 if(!Number.isSafeInteger(t.canonicalRowsRead)||t.canonicalRowsRead<1||!Array.isArray(rows)||!rows.length||new Set(rows.map(x=>x.primaryId)).size!==rows.length||rows.some(x=>!/^V2[A-Z]-[A-Za-z0-9_-]+$/.test(x.primaryId||'')||!/^[a-f0-9]{64}$/.test(x.sha256||'')||!x.bucket))return false;
 if(p.manualNotesRead!==t.privateNotesRead||p.manualStatusesIndexed!==t.manualStatusesIndexed||!Array.isArray(events)||events.length!==t.eventsRecorded)return false;
 const ids=new Set(rows.map(x=>x.primaryId)),mail=new Set(messages.map(x=>x.messageId));
 return events.every(e=>e.evidenceVerified===true&&ids.has(e.primaryId)&&(e.sourceType!=='EMAIL'||mail.has(e.gmailMessageId)));
}
module.exports={trackerProof};
