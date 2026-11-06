'use strict';
// Work presentation only. Rotation never changes a case binding, retry clock,
// protection, source obligation or canonical state.
const classes=['MAIL','WRITER','INTERVIEW','SOURCE','IDENTITY','HISTORICAL','OTHER'];
const kind=item=>classes.includes(item.kind)?item.kind:'OTHER';
function order(items,cursor={}){
 const groups=new Map(classes.map(k=>[k,[]]));
 const time=value=>Number.isFinite(Date.parse(value))?Date.parse(value):0;
 for(const item of items)groups.get(kind(item)).push(item);
 const served=item=>Math.max(time(item.review?.reviewedAt),time(item.lastAttempt?.observedAt));
 for(const group of groups.values())group.sort((a,b)=>served(a)-served(b)||time(a.firstSeen)-time(b.firstSeen)||String(a.exceptionId).localeCompare(String(b.exceptionId)));
 const index=classes.indexOf(cursor.lastServedKind||cursor.lastReviewedKind),rotation=index<0?classes:classes.slice(index+1).concat(classes.slice(0,index+1)),result=[];
 while(result.length<items.length)for(const k of rotation){const group=groups.get(k);if(group.length)result.push(group.shift());}
 return result;
}
function reviewed(work,item,record){
 const prior=work.dispatch||{};
 if(!Number.isFinite(Date.parse(prior.observedAt||prior.reviewedAt))||Date.parse(record.reviewedAt)>=Date.parse(prior.observedAt||prior.reviewedAt))work.dispatch={lastServedKind:kind(item),lastReviewedKind:kind(item),exceptionId:item.exceptionId,sourceVersion:item.binding.sourceVersion,observedAt:record.reviewedAt,reviewedAt:record.reviewedAt,basis:'ACCEPTED_IMMUTABLE_REVIEW',artifactSizeOnly:true};
}
module.exports={classes,kind,order,reviewed};
