'use strict';
// Steps 01-05: discovery lanes hand every result to the intake gate through the 5-field contract.
// In this card the lanes' existing outputs feed adapters; the old lanes themselves are untouched (cutover is card 4).
const C=require('./contract.cjs'),St=require('./status.cjs'),G=require('./gate.cjs');
const STEP_OF={JOBSPY:'01',HIRINGCAFE:'02',BOARD:'03',EMAIL:'04',WEB:'05'};
function runDiscovery({store,lanes,ctx={}}){
 const startedAt=new Date().toISOString(),recs=[];
 for(const lane of C.LANES){
  const id=STEP_OF[lane],items=lanes[lane]||[],counts=St.blank(),reasons={},records=[];
  for(const r of items){
   counts.in++;
   try{const {record,problems}=C.handoff(r,{lane,foundAt:startedAt});records.push(record);counts.pass++;const k=problems.length?'HANDED_OVER_MISSING:'+problems.join('+'):'HANDED_OVER_5_FIELDS';reasons[k]=(reasons[k]||0)+1;}
   catch(e){counts.fail++;const k='ERROR: '+String(e.message).slice(0,80);reasons[k]=(reasons[k]||0)+1;}
  }
  const added=G.intake(store,records);
  if(added.known)reasons.ALREADY_IN_GATE=added.known;
  const rec=St.build(id,{counts,reasons,queue:{waiting:0,retrying:0,parked:0},startedAt,finishedAt:new Date().toISOString(),previous:store.status(id),dryRun:ctx.dryRun!==false,notes:ctx.notes&&ctx.notes[id]||[]});
  store.putStatus(rec);recs.push(rec);
 }
 return recs;
}
module.exports={STEP_OF,runDiscovery};
