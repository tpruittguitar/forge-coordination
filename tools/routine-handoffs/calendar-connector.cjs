'use strict';
async function host(tools,cfg){
 const unwrap=r=>r.structuredContent||JSON.parse(r.content.find(x=>x.type==='text').text),events=[],seen=new Set();let token=null,pages=0;
 const start=new Date(Date.now()-7*86400000).toISOString(),end=new Date(Date.now()+30*86400000).toISOString();
 do{if(token&&seen.has(token))throw Error('CALENDAR_PAGE_CHAIN_REQUIRED');if(token)seen.add(token);
  const p=unwrap(await tools.mcp__codex_apps__google_calendar_search({calendar_id:'primary',time_min:start,time_max:end,max_results:100,...token?{next_page_token:token}:{}}));if(!Array.isArray(p.events))throw Error('CALENDAR_ENUMERATION_REQUIRED');events.push(...p.events);token=p.next_page_token||null;pages++;
 }while(token);
 const candidates=events.filter(e=>/interview|recruiter|screen|panel|hiring manager/i.test(e.summary||'')),details=[];
 for(const e of candidates){const full=unwrap(await tools.mcp__codex_apps__google_calendar_read_event({calendar_id:'primary',event_id:e.id}));details.push(full);}
 const capture={schema:'forge.calendar-source-capture.v1',transport:'SUPPORTED_CALENDAR_CONNECTOR',capturedAt:new Date().toISOString(),calendarId:'primary',start,end,pages,enumerationComplete:true,events,details};
 const file=cfg.directory+'/'+Date.now()+'.json';const r=await tools.apply_patch('*** Begin Patch\n*** Add File: '+file+'\n+'+JSON.stringify(capture,null,2).split('\n').join('\n+')+'\n*** End Patch');if(r?.isError)throw Error('CALENDAR_PRIVATE_CAPTURE_REQUIRED');
 return{enumerated:events.length,candidates:details.length,pages,complete:true};
}
module.exports={host};
