'use strict';
// Self-contained browser functions. The results UI contract is grounded in the
// saved Chrome accessibility captures: job-card buttons contain title/company/
// location paragraphs and a nested Dismiss control; results pagination is the
// Page N list with its adjacent labelled Next, distinct from carousel Next.
async function readResults({expectedUrl}){
 const norm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,''),label=e=>e.getAttribute('aria-label')||e.innerText||'',buttons=()=>[...document.querySelectorAll('main button, main [role="button"]')].filter(e=>e.getBoundingClientRect().width>0);
 const query=value=>{const u=new URL(value);u.pathname=u.pathname.replace('/comm/','/');for(const k of ['start','currentJobId'])u.searchParams.delete(k);u.searchParams.sort();return u.href;};
 if(location.hostname!=='www.linkedin.com'||query(location.href)!==query(expectedUrl))throw Error('CHANGED_SOURCE_FILTERS');
 if(/\/(?:login|checkpoint|authwall)(?:\/|$)/.test(location.pathname))throw Error('SOURCE_ACCESS_BLOCKED');
 const cards=()=>buttons().filter(e=>e.querySelectorAll('p').length>=3&&[...e.querySelectorAll('button,[role="button"]')].some(b=>/^Dismiss .+ job$/i.test(label(b).trim())));
 const wait=async predicate=>{const until=Date.now()+10000;while(Date.now()<until){if(predicate())return;await new Promise(r=>setTimeout(r,50));}throw Error('RESULTS_NOT_READY');};
 await wait(()=>cards().length||/No results found|Try shortening or rephrasing your search\./i.test(document.querySelector('main')?.innerText||''));
 const initial=cards().map(e=>[...e.querySelectorAll('p')].map(p=>p.innerText.trim())),jobs=[],seen=new Set();
 for(let n=0;n<initial.length;n++){
  const current=cards(),headers=current.map(e=>[...e.querySelectorAll('p')].slice(0,3).map(p=>p.innerText.trim()));
  if(JSON.stringify(headers)!==JSON.stringify(initial.map(x=>x.slice(0,3))))throw Error('RESULTS_CHANGED_DURING_CAPTURE');
  const title=initial[n][0].split('\n')[0].replace(/ \(Verified job\)$/,'').trim();
  const selected=()=>new URL(location.href).searchParams.get('currentJobId'),heading=()=>[...document.querySelectorAll('main h1,main h2,main [role="heading"]')].some(e=>norm(e.innerText)===norm(title));
  let before=selected();current[n].click(); // Select the observed card; never its nested Dismiss/Apply.
  try{await wait(()=>/^\d+$/.test(selected()||'')&&selected()!==before&&heading());}
  catch(e){
   // The first card can already be selected. Select a different observed card
   // and come back, requiring a real URL transition for the target. This also
   // prevents identical titles from binding the previous card's stale URL.
   if(n!==0||initial.length<2)throw Error('AMBIGUOUS_RESULT_CARD');
   before=selected();cards()[1].click();await wait(()=>selected()!==before&&/^\d+$/.test(selected()||''));
   before=selected();cards()[0].click();await wait(()=>selected()!==before&&/^\d+$/.test(selected()||'')&&heading());
  }
  const jobId=new URL(location.href).searchParams.get('currentJobId');if(seen.has(jobId))throw Error('AMBIGUOUS_RESULT_CARD');seen.add(jobId);
  jobs.push({jobId,paragraphs:initial[n]});
 }
 const pageButtons=buttons().filter(b=>/^Page \d+$/.test(label(b).trim())),candidates=new Set();let controls=false;
 for(const b of pageButtons){let node=b.parentElement;for(let n=0;node&&n<5;n++,node=node.parentElement){const all=[...node.querySelectorAll('button,[role="button"]')],next=all.filter(e=>label(e).trim()==='Next');if(next.length===1){controls=true;candidates.add(next[0]);break;}}}
 if(candidates.size>1)throw Error('AMBIGUOUS_RESULTS_NEXT');
 const next=[...candidates][0],empty=jobs.length===0&&/No results found|Try shortening or rephrasing your search\./i.test(document.querySelector('main')?.innerText||'');
 if(!empty&&!controls)throw Error('RESULTS_CONTROLS_NOT_READY');
 const available=!!next&&!next.disabled&&next.getAttribute('aria-disabled')!=='true',proof=JSON.stringify({query:query(location.href),start:new URL(location.href).searchParams.get('start')||'0',cards:initial.map(x=>x.slice(0,3)),pages:pageButtons.map(label)});
 return{schema:'forge.result-page-observation.v1',browser:'Chrome',complete:true,url:location.href,at:new Date().toISOString(),jobs,next:{available,kind:available?'RESULTS_NEXT':null,proof},emptyConfirmed:empty,endConfirmed:!available};
}
async function clickResultsNext({expectedUrl,controlProof}){
 const label=e=>e.getAttribute('aria-label')||e.innerText||'',buttons=()=>[...document.querySelectorAll('main button,main [role="button"]')].filter(e=>e.getBoundingClientRect().width>0);
 const query=value=>{const u=new URL(value);u.pathname=u.pathname.replace('/comm/','/');for(const k of ['start','currentJobId'])u.searchParams.delete(k);u.searchParams.sort();return u.href;};
 const start=value=>Number(new URL(value).searchParams.get('start')||0);
 if(location.hostname!=='www.linkedin.com'||query(location.href)!==query(expectedUrl)||start(location.href)!==start(expectedUrl))throw Error('CHANGED_SOURCE_FILTERS');
 const cards=buttons().filter(e=>e.querySelectorAll('p').length>=3&&[...e.querySelectorAll('button,[role="button"]')].some(b=>/^Dismiss .+ job$/i.test(label(b).trim()))).map(e=>[...e.querySelectorAll('p')].slice(0,3).map(p=>p.innerText.trim()));
 const pageButtons=buttons().filter(b=>/^Page \d+$/.test(label(b).trim())),candidates=new Set();
 for(const b of pageButtons){let node=b.parentElement;for(let n=0;node&&n<5;n++,node=node.parentElement){const next=[...node.querySelectorAll('button,[role="button"]')].filter(e=>label(e).trim()==='Next');if(next.length===1){candidates.add(next[0]);break;}}}
 const proof=JSON.stringify({query:query(location.href),start:new URL(location.href).searchParams.get('start')||'0',cards,pages:pageButtons.map(label)});
 if(proof!==controlProof||candidates.size!==1)throw Error('PAGINATION_CONTROL_CHANGED');
 const next=[...candidates][0];if(next.disabled||next.getAttribute('aria-disabled')==='true')throw Error('RESULTS_NEXT_UNAVAILABLE');
 next.click();
 const until=Date.now()+10000;while(Date.now()<until){if(query(location.href)!==query(expectedUrl))throw Error('CHANGED_SOURCE_FILTERS');if(start(location.href)>start(expectedUrl))return{url:location.href,at:new Date().toISOString()};await new Promise(r=>setTimeout(r,50));}
 throw Error('NEXT_DID_NOT_ADVANCE_SAME_RESULTS');
}
const tools={
 forge_read_results_v1:{name:'forge_read_results_v1',description:'Capture complete visible job-result cards and their actual selected job URLs; read-only selection, no applications or dismissals.',inputSchema:{type:'object',properties:{expectedUrl:{type:'string'}},required:['expectedUrl']},annotations:{readOnlyHint:true},code:readResults.toString()},
 forge_click_results_next_v1:{name:'forge_click_results_next_v1',description:'Advance only the observed results Page N pagination Next after its capture proof matches; no carousel or guessed cursor.',inputSchema:{type:'object',properties:{expectedUrl:{type:'string'},controlProof:{type:'string'}},required:['expectedUrl','controlProof']},annotations:{readOnlyHint:true},code:clickResultsNext.toString()}
};
module.exports={readResults,clickResultsNext,tools};
