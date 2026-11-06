'use strict';
// Exact saved-alert layouts only. Redirect destinations are read from the source,
// never followed or guessed. Opaque links remain source-recovery obligations.
const S=require('../programmed-coordinator/store.cjs');
const SENDERS={
 'donotreply@jobalert.indeed.com':'INDEED',
 'info@glassdoor.com':'GLASSDOOR','noreply@glassdoor.com':'GLASSDOOR',
 'jobs@my.theladders.com':'LADDERS',
 'jobs@updates.buildsubmarines.com':'BUILD_SUBMARINES'
};
function text(value){return String(value||'').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,' ').replace(/<!--[\s\S]*?-->/g,' ').replace(/<[^>]*>/g,' ').replace(/&(?:#(\d+)|#x([0-9a-f]+)|(amp|lt|gt|quot|apos|nbsp));/gi,(_,n,h,k)=>n||h?String.fromCodePoint(Math.min(0x10ffff,parseInt(n||h,h?16:10))):({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '}[k.toLowerCase()])).replace(/[\s\u200b-\u200f\ufeff]+/g,' ').trim();}
function attribute(attrs,name){const m=String(attrs).match(new RegExp('\\b'+name+'\\s*=\\s*(["\'])([\\s\\S]*?)\\1','i'));return m?text(m[2]):'';}
function anchors(html){return [...String(html).matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a\s*>/gi)].map(m=>({attrs:m[1],html:m[2],href:attribute(m[1],'href'),at:m.index,end:m.index+m[0].length}));}
const locationLike=s=>/^(?:Remote|Virtual \/ Travel|[^<>]+,\s*[A-Z]{2}(?:\s+\d{5}(?:-\d{4})?)?(?:,\s*(?:US|USA|United States))?)$/.test(s||'');
function parsedUrl(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port?u:null;}catch{return null;}}
function publicJob(provider,raw){
 let u=parsedUrl(raw);if(!u)return null;
 if(provider==='INDEED'&&/^(?:www\.)?indeed\.com$/i.test(u.hostname)){
  const id=u.searchParams.get('jk');return /^[a-f0-9]{16}$/i.test(id||'')?{url:'https://www.indeed.com/viewjob?jk='+id,jobId:id}:null;
 }
 if(provider==='GLASSDOOR'&&/^(?:www\.)?glassdoor\.com$/i.test(u.hostname)){
  const id=u.searchParams.get('jobListingId')||u.searchParams.get('jl');return /^\d+$/.test(id||'')?{url:'https://www.glassdoor.com/partner/jobListing.htm?jobListingId='+id,jobId:id}:null;
 }
 if(provider==='BUILD_SUBMARINES'&&u.hostname==='jobs.buildsubmarines.com'){
  if(u.pathname==='/job_activities/track')u=parsedUrl(u.searchParams.get('redirect_url'));
  if(!u||u.hostname!=='jobs.buildsubmarines.com')return null;
  const id=u.pathname.match(/^\/jobs\/(\d+)(?:-[a-z0-9-]+)?\/?$/i)?.[1];return id?{url:u.origin+u.pathname,jobId:id}:null;
 }
 if(provider==='LADDERS'&&/^(?:www\.)?theladders\.com$/i.test(u.hostname)){
  const id=u.pathname.match(/^\/job\/[^/]+_(\d+)\/?$/)?.[1];return id?{url:u.origin+u.pathname,jobId:id}:null;
 }
 return null;
}
function reviewedJob(raw){
 const u=parsedUrl(raw);if(!u)return null;
 for(const p of ['INDEED','GLASSDOOR','BUILD_SUBMARINES','LADDERS']){const job=publicJob(p,raw);if(job)return{...job,provider:p};}
 const linked=u.hostname==='www.linkedin.com'&&u.pathname.match(/^\/(?:comm\/)?jobs\/view\/(\d+)\/?$/);
 if(linked)return{url:'https://www.linkedin.com/jobs/view/'+linked[1]+'/',jobId:linked[1],provider:'LINKEDIN'};
 // A source-bound quote does not make an opaque personalized redirect public.
 // Allow known public posting shapes, retaining only supported identity keys.
 const ats=require('../enrich-ats-pay/lib.js').atsApi(u.href);
 const knownBoard=(/^(?:www\.)?(?:ziprecruiter\.com|jobleads\.com|postjobfree\.com|experteer\.com)$/.test(u.hostname)&&/\/(?:Job|job|jobs|career\/view)\//.test(u.pathname));
 const employer=/^(?:jobs|careers|recruiting|apply)\./i.test(u.hostname)&&(/\/(?:jobs?|positions?|opportunities|careers?)\//i.test(u.pathname)||/^\/\d+(?:\/|$)/.test(u.pathname));
 if(!ats&&!knownBoard&&!employer)return null;
 try{require('../programmed-coordinator/source.cjs').publicUrl(u.href);}catch{return null;}
 const identity=/^(?:jid|jk|jobListingId|jl|jobId|job_id|id|requisitionId|requisition_id|opportunityId|lang|locale)$/i;
 for(const [key,value]of [...u.searchParams]){
  if(/^(?:utm_|trk|tracking|ref|source|token|sig|auth|lipi|eid|guid|cb|src)/i.test(key)){u.searchParams.delete(key);continue;}
  if(!identity.test(key)||!/^[a-z0-9_-]{1,100}$/i.test(value))return null;
 }
 u.hash='';return{url:u.href,jobId:null,provider:'SAVED_ALERT_REVIEW'};
}
function provider(message){return message.fullBody===true?SENDERS[String(message.sender||'').toLowerCase()]||null:null;}
function extract(message){
 const kind=provider(message);if(!kind)return null;
 const cards=[],pending=[],seen=new Map(),conflicting=new Set(),html=message.htmlBody||(/<\/?(?:html|table|div)\b/i.test(message.body||'')?message.body:'');
 function add(c,slot){
  const identity=Object.fromEntries(['title','company','location'].map(k=>[k,text(c[k])]));
  if(Object.values(identity).some(v=>!v||v.length>600)){pending.push({slot,reason:'INCOMPLETE_ALERT_CARD_IDENTITY',sourceCardSha256:S.hash(c)});return;}
  const target=publicJob(kind,c.href),key=target?target.url:'unresolved:'+S.hash({slot,identity});
  if(seen.has(key)){
   if(S.hash(seen.get(key))!==S.hash(identity)){
    conflicting.add(key);const at=cards.findIndex(c=>c.url===target?.url);if(at>=0)cards.splice(at,1);
    pending.push({slot,reason:'CONFLICTING_ALERT_CARD_IDENTITY',sourceCardSha256:S.hash(c)});
   }
   return;
  }
  if(conflicting.has(key))return;
  seen.set(key,identity);
  cards.push({...identity,provider:kind,url:target?.url||null,jobId:target?.jobId||null,slot,
   description:text(c.description||''),sourceCardSha256:S.hash({identity,description:c.description||'',slot}),
   ...(target?{}:{sourceRecoveryReason:'EXACT_POSTING_URL_REQUIRED'})});
 }
 if(kind==='INDEED'){
  for(const [slot,block]of String(message.body||'').split(/\r?\n\s*\r?\n/).entries()){
   const lines=block.split(/\r?\n/).map(s=>s.trim()).filter(Boolean),linkIndex=lines.findIndex(s=>{const u=parsedUrl(s);return u&&/^(?:www\.)?indeed\.com$/i.test(u.hostname)&&/^\/(?:rc\/clk\/dl|pagead\/clk\/dl|viewjob)\/?$/.test(u.pathname);});
   if(linkIndex<0)continue;
   const sep=lines[1]?.lastIndexOf(' - ')??-1;
   add({title:lines[0],company:sep>=0?lines[1].slice(0,sep):'',location:sep>=0?lines[1].slice(sep+3):'',href:lines[linkIndex],description:lines.slice(2,linkIndex).filter(s=>!/^(Easily apply|Responsive employer|Just posted|\d+ days? ago)$/.test(s)).join('\n')},slot);
  }
 }else if(kind==='GLASSDOOR'){
  for(const [slot,a]of anchors(html).entries()){
   const u=parsedUrl(a.href);if(!u||!/(^|\.)glassdoor\.com$/i.test(u.hostname)||!/^\/partner\/jobListing\.htm$/.test(u.pathname))continue;
   const ps=[...a.html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p\s*>/gi)].map(m=>text(m[1])).filter(Boolean);
   const company=[...a.html.matchAll(/<span\b[^>]*>([\s\S]*?)<\/span\s*>/gi)].map(m=>text(m[1])).find(s=>s&&!/★|^\d(?:\.\d)?\s*(?:stars?|rating)?$/i.test(s));
   add({title:ps[0],company,location:locationLike(ps[1])?ps[1]:'',href:a.href,description:ps.slice(2).filter(s=>!/^(?:\d+d|See more jobs)$/.test(s)).join('\n')},slot);
  }
  // The saved job-match variant supplies its direct listing ID in the plain
  // MIME link, with employer/title/location as separate HTML paragraphs.
  // Require all three exact paragraph nodes before using the plain layout.
  const nodes=new Set([...String(html).matchAll(/<p\b[^>]*>([\s\S]*?)<\/p\s*>/gi)].map(m=>text(m[1])));
  const matchLinks=[...new Set(message.links||[])].map(link=>({link,at:String(message.body||'').indexOf(link),u:parsedUrl(link)})).filter(x=>x.at>=0&&x.u?.hostname==='www.glassdoor.com'&&x.u.pathname==='/recruiter/link/matches'&&publicJob(kind,x.link)).sort((a,b)=>a.at-b.at);
  for(const [slot,{link,at}]of matchLinks.entries()){
   const previous=matchLinks[slot-1],start=previous?previous.at+previous.link.length:0;
   const before=String(message.body).slice(start,at).split(/\r?\n/).map(text).filter(Boolean);
   const locationIndex=before.findLastIndex(locationLike);
   const company=before[locationIndex-2],title=before[locationIndex-1],location=before[locationIndex];
   if(locationIndex>=2&&[company,title,location].every(s=>nodes.has(s)))add({title,company,location,href:link},100000+slot);
   else pending.push({slot:100000+slot,reason:'INCOMPLETE_ALERT_CARD_IDENTITY',sourceCardSha256:S.hash({linkSlot:slot,source:message.sourceSha256})});
  }
 }else if(kind==='BUILD_SUBMARINES'){
  const titles=anchors(html).filter(a=>/\balert-link\b/i.test(attribute(a.attrs,'class')));
  for(const [slot,a]of titles.entries()){
   // Styling is not a card boundary. A missing identity may never be borrowed
   // from the next card, including when email CSS changes or disappears.
   const after=html.slice(a.end,Math.min(a.end+6000,titles[slot+1]?.at??html.length)).split(/<div\b[^>]*border-bottom\s*:/i)[0],info=after.match(/<strong\b[^>]*>([\s\S]*?)<\/strong\s*>\s*<\/span\s*>\s*-\s*<span\b[^>]*>([\s\S]*?)<\/span\s*>/i);
   const description=after.match(/<div\b[^>]*margin:\s*6px[^>]*>([\s\S]*?)<\/div\s*>/i)?.[1]||'';
   add({title:text(a.html),company:info?.[1],location:info?.[2],href:a.href,description},slot);
  }
 }else if(kind==='LADDERS'){
  const all=anchors(html),usedTitles=new Set();
  for(const [slot,a]of all.entries()){
   const info=a.html.match(/<span\b[^>]*id\s*=\s*["']jobs-company-container["'][^>]*>([\s\S]*?)<\/span\s*>/i);if(!info)continue;
   const fields=text(info[1]).split(/\s*\|\s*/),previous=all[slot-1],salary=previous&&/^[$£€]\s*\d/.test(text(previous.html))?text(previous.html):'',title=all[slot-(salary?2:1)];
   if(!title||!text(title.html)||/\bjobs-company-container\b/i.test(title.html)||/^(?:Remote|View (?:Details|Job)|See More Jobs)$/i.test(text(title.html))){pending.push({slot,reason:'INCOMPLETE_ALERT_CARD_IDENTITY',sourceCardSha256:S.hash(a.html)});continue;}
   usedTitles.add(title.at);
   add({title:text(title.html),company:fields[0],location:fields[1],href:title.href,description:[...fields.slice(2),salary].filter(Boolean).join(' | ')},slot);
  }
  for(const [slot,a]of all.entries())if(/\bmobileLink\b/i.test(attribute(a.attrs,'class'))&&!usedTitles.has(a.at))pending.push({slot,reason:'INCOMPLETE_ALERT_CARD_IDENTITY',sourceCardSha256:S.hash(a.html)});
 }
 return {provider:kind,template:kind+'_SAVED_ALERT_V1',cards,pending};
}
module.exports={extract,provider,publicJob,reviewedJob,text};
