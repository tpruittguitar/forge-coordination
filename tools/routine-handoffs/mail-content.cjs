'use strict';
// Pure and self-contained: the supported connector host executes this same
// function, so capture accounting and downstream MIME normalization agree.
function content(message){
 function htmlText(s){return String(s).replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,' ').replace(/<[^>]*>/g,' ').replace(/&(?:#(\d+)|#x([0-9a-f]+)|(amp|lt|gt|quot|apos|nbsp));/gi,(_,n,h,k)=>n||h?String.fromCodePoint(Math.min(0x10ffff,parseInt(n||h,h?16:10))):({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '}[k.toLowerCase()])).replace(/\s+/g,' ').trim();}
 let missing=message.truncated===true;
 function parts(p){if(p.truncated===true||p.body?.truncated===true)missing=true;if(['text/plain','text/html'].includes(p.mime_type)){if(typeof p.body?.content!=='string'){missing=true;return[];}return[{mime:p.mime_type,text:p.body.content}];}return(p.parts||[]).flatMap(parts);}
 const items=parts(message.payload||{}),plain=items.filter(x=>x.mime==='text/plain'),body=(plain.length?plain:items).map(x=>x.mime==='text/html'?htmlText(x.text):x.text).join('\n');
 return{content:items,body,fullBody:!missing&&items.length>0&&body.trim().length>0};
}
module.exports=content;
