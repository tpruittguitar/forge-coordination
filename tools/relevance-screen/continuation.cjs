'use strict';
// One source/request failure is not a queue-wide failure.
function select(plan,size,validate){
 const selected=[],held=[];
 for(const item of plan.items){
  if(item.status!=='READY')continue;
  if(selected.length>=size)break;
  try{validate(item);selected.push(item);}catch{item.status='HELD_CARD_REVIEW';item.reason='SOURCE_OR_RESERVATION_RECONCILIATION_REQUIRED';item.owner='FORGE_APPLICATION_WRITER_GOFER';held.push(item.key);}
 }
 return {selected,held};
}
module.exports={select};
