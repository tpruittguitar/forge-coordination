'use strict';
const {LEADER_RE}=require('../source-trial/lib');
// One source/request failure is not a queue-wide failure.
function select(plan,size,validate,include=()=>true){
 const selected=[],held=[];
 for(const item of plan.items){
  if(!include(item)||item.status!=='READY')continue;
  if(selected.length>=size)break;
  try{
   validate(item);
   if(!LEADER_RE.test(item.record?.TITLE||'')){item.status='OUT_OF_SCOPE';item.reason='OUT_OF_SCOPE:NOT_LEADERSHIP_LEVEL';continue;}
   selected.push(item);
  }catch{item.status='HELD_CARD_REVIEW';item.reason='SOURCE_OR_RESERVATION_RECONCILIATION_REQUIRED';item.owner='FORGE_APPLICATION_WRITER_GOFER';held.push(item.key);}
 }
 return {selected,held};
}
module.exports={select};
