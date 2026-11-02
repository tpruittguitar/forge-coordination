'use strict';
const S=require('../programmed-coordinator/store.cjs');
function htmlText(s){return String(s).replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,' ').replace(/<[^>]*>/g,' ').replace(/&(?:#(\d+)|#x([0-9a-f]+)|(amp|lt|gt|quot|apos|nbsp));/gi,(_,n,h,k)=>n||h?String.fromCodePoint(Math.min(0x10ffff,parseInt(n||h,h?16:10))):({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '}[k.toLowerCase()])).replace(/\s+/g,' ').trim();}
function normalize(message){
 const headers=Object.fromEntries((message.payload?.headers||[]).map(h=>[h.name.toLowerCase(),h.value]));let missing=message.truncated===true;
 function parts(p){if(p.truncated===true||p.body?.truncated===true)missing=true;if(['text/plain','text/html'].includes(p.mime_type)){if(typeof p.body?.content!=='string'){missing=true;return[];}return[{mime:p.mime_type,text:p.body.content}];}return(p.parts||[]).flatMap(parts);}
 const content=parts(message.payload||{}),plain=content.filter(x=>x.mime==='text/plain'),body=(plain.length?plain:content).map(x=>x.mime==='text/html'?htmlText(x.text):x.text).join('\n'),sender=(headers.from?.match(/<([^>]+)>/)?.[1]||headers.from||'').trim().toLowerCase();
 const immutable={id:message.id,thread_id:message.thread_id,internal_date:message.internal_date,payload:message.payload};
 return{id:message.id,threadId:message.thread_id,at:new Date(Number(message.internal_date)).toISOString(),subject:headers.subject||'',sender,body,links:[...new Set(content.flatMap(p=>[...p.text.matchAll(/https:\/\/[^\s<>"']+/g)].map(m=>m[0].replace(/&amp;/g,'&'))))],isSent:(message.label_ids||[]).includes('SENT'),fullBody:!missing&&content.length>0&&body.trim().length>0,sourceSha256:S.hash(require('./reports.cjs').canonical(immutable)),captureSha256:S.hash(message),hasUnsubscribe:!!headers['list-unsubscribe']};
}
function classify(m){
 if(!m.fullBody)return{owner:'CODE',classification:'FULL_MESSAGE_REQUIRED',status:'PENDING'};
 const s=m.sender,subject=m.subject,body=m.body;
 if(m.isSent||/^(?:re|fw|fwd)\s*:/i.test(subject)&&/application|interview|recruit|candidate/i.test(subject))return{owner:'AI',classification:'REPLY_OR_SENT_CONTEXT_REQUIRES_INTERPRETATION',status:'EXCEPTION'};
 if(s==='noreply@x.ai'&&/Automation|FORGE_GROK_/i.test(body))return{owner:'CODE',classification:'AUTOMATION_NOTICE',status:'VERIFIED_NOT_RECRUITING',reportCollectionRequired:true,coverageComplete:false};
 if(s==='notifications@github.com'&&/workflow run|left a comment|Repository:/i.test(body))return{owner:'CODE',classification:'DEVELOPMENT_NOTIFICATION',status:'VERIFIED_NOT_RECRUITING'};
 if(/^(?:noreply-accounts@google\.com|no-reply@accounts\.google\.com|noreply@supabase\.com)$/.test(s)&&/Account data|security alert|OAuth Application Approval/i.test(subject))return{owner:'CODE',classification:'ACCOUNT_NOTIFICATION',status:'VERIFIED_NOT_RECRUITING'};
 const alert=(/^(?:jobalerts-noreply|jobs-noreply)@linkedin\.com$/.test(s)&&/Your job alert|Recommendations based on your activity/i.test(body))||(s==='donotreply@jobalert.indeed.com'&&/Indeed Job Alert/i.test(body))||(s==='noreply@glassdoor.com'&&/jobs|job alert/i.test(subject)&&/jobs|Job Alert/i.test(body))||(['ametekinc-jobnotification@noreply.jobs2web.com','noreply@oracle.com'].includes(s)&&/new jobs posted|latest .+ jobs/i.test(subject));
 if(alert)return{owner:'CODE',classification:'JOB_ALERT',status:'HANDED_TO_DISCOVERY',discoveryPending:true};
 const standard=require('../programmed-coordinator/outcome.cjs').classify({body,fullBody:true});if(standard.owner==='CODE')return{...standard,classification:standard.type,status:'MATCH_REQUIRED'};
 if(/application|interview|recruit|resume|candidacy|hiring|job opportunity|availability|offer letter/i.test(subject+' '+body))return{owner:'AI',classification:'RECRUITING_OR_AMBIGUOUS',status:'EXCEPTION'};
 if((m.hasUnsubscribe||/welcome|thanks for signing up/i.test(subject))&&/(?:@|\.)(ahrefs\.com|context\.dev|team\.semrush\.com|slides\.com|mail\.notion\.so|krea\.ai|email\.openai\.com)$/.test(s))return{owner:'CODE',classification:'PRODUCT_NOTIFICATION',status:'VERIFIED_NOT_RECRUITING'};
 return{owner:'AI',classification:'UNRESOLVED_CORRESPONDENCE',status:'EXCEPTION'};
}
module.exports={normalize,classify,htmlText};
