'use strict';
// Self-contained browser functions. The results UI contract is grounded in the
// saved Chrome accessibility captures: job-card buttons contain title/company/
// location paragraphs and a nested Dismiss control; results pagination is the
// Page N list with its adjacent labelled Next, distinct from carousel Next.
async function readResults({expectedUrl}){
 const norm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,''),label=e=>e.getAttribute('aria-label')||e.innerText||'',buttons=()=>[...document.querySelectorAll('main button, main [role="button"]')].filter(e=>e.getBoundingClientRect().width>0);
 const query=value=>{const u=new URL(value);u.pathname=u.pathname.replace('/comm/','/');for(const k of [...u.searchParams.keys()])if(['start','currentJobId'].includes(k)||/token|sig|trk|lipi|eid|origin|referral|tracking|refid|^eBP$/i.test(k))u.searchParams.delete(k);u.searchParams.sort();return u.href;};
 if(/\/(?:login|checkpoint|authwall)(?:\/|$)/.test(location.pathname)||/Attention Required|Just a moment|Verify you are human/i.test(document.title))throw Error('SOURCE_ACCESS_BLOCKED');
 if(location.hostname!=='www.linkedin.com'||query(location.href)!==query(expectedUrl))throw Error('CHANGED_SOURCE_FILTERS');
 const cards=()=>buttons().filter(e=>e.querySelectorAll('p').length>=3&&[...e.querySelectorAll('button,[role="button"]')].some(b=>/^Dismiss .+ job$/i.test(label(b).trim())));
 const wait=async predicate=>{const until=Date.now()+10000;while(Date.now()<until){if(predicate())return;await new Promise(r=>setTimeout(r,50));}throw Error('RESULTS_NOT_READY');};
 const selected=()=>new URL(location.href).searchParams.get('currentJobId');
 const postingTitle=title=>[...document.querySelectorAll('main a[href*="/jobs/view/"]')].some(e=>new URL(e.href).pathname.match(/\/jobs\/view\/(\d+)/)?.[1]===selected()&&norm(e.innerText)===norm(title));
 const heading=title=>postingTitle(title)||[...document.querySelectorAll('main h1,main h2,main [role="heading"]')].some(e=>norm(e.innerText)===norm(title));
 const cardTitle=card=>card.querySelector('p')?.innerText.split('\n')[0].replace(/ \(Verified job\)$/,'').trim();
 const visibleId=card=>card.getAttribute('componentkey')?.match(/^job-card-component-ref-(\d+)$/)?.[1];
 const identity=paragraphs=>[paragraphs[0]?.split('\n')[0].replace(/ \(Verified job\)$/,'').trim(),...paragraphs.slice(1,3).map(s=>s.replace(/\s+/g,' ').trim())];
 // The server-rendered list can be replaced during hydration. Wait for a real
 // selected posting or matching detail heading before snapshotting cards.
 await wait(()=>cards().length&&cards().every(visibleId)||cards().some(c=>heading(cardTitle(c)))||/No results found|Try shortening or rephrasing your search\./i.test(document.querySelector('main')?.innerText||''));
 let initial=cards().map(e=>[...e.querySelectorAll('p')].map(p=>p.innerText.trim()));const jobs=[],seen=new Set();
 if(cards().length&&cards().every(visibleId)){
  // Current LinkedIn cards expose their actual job ID on the visible card's
  // componentkey. Read it directly instead of selecting every card (which
  // changes Viewed badges and can replace the rendered list mid-capture).
  let last='',stableSince=Date.now();await wait(()=>{const signature=JSON.stringify(cards().map(c=>[visibleId(c),identity([...c.querySelectorAll('p')].map(p=>p.innerText.trim()))]));if(signature!==last){last=signature;stableSince=Date.now();}return Date.now()-stableSince>=400;});
  const current=cards();initial=current.map(e=>[...e.querySelectorAll('p')].map(p=>p.innerText.trim()));
  for(let n=0;n<current.length;n++){const jobId=visibleId(current[n]);if(!jobId||seen.has(jobId)||initial[n].length<3)throw Error('AMBIGUOUS_RESULT_CARD');
   const links=[...current[n].querySelectorAll('a[href*="/jobs/view/"]')].map(a=>new URL(a.href).pathname.match(/\/jobs\/view\/(\d+)/)?.[1]).filter(Boolean);if(links.some(id=>id!==jobId))throw Error('CONFLICTING_RESULT_CARD_ID');
   seen.add(jobId);jobs.push({jobId,paragraphs:initial[n]});}
 }else for(let n=0;n<initial.length;n++){
  const current=cards(),headers=current.map(e=>[...e.querySelectorAll('p')].slice(0,3).map(p=>p.innerText.trim()));
  if(JSON.stringify(headers.map(identity))!==JSON.stringify(initial.map(identity)))throw Error('RESULTS_CHANGED_DURING_CAPTURE');
  const title=initial[n][0].split('\n')[0].replace(/ \(Verified job\)$/,'').trim();
  let before=selected();current[n].click(); // Select the observed card; never its nested Dismiss/Apply.
  try{await wait(()=>/^\d+$/.test(selected()||'')&&selected()!==before&&heading(title));}
  catch(e){
   // The first card can already be selected. Select a different observed card
   // and come back, requiring a real URL transition for the target. This also
   // prevents identical titles from binding the previous card's stale URL.
   if(n!==0||initial.length<2)throw Error('AMBIGUOUS_RESULT_CARD');
   before=selected();cards()[1].click();await wait(()=>selected()!==before&&/^\d+$/.test(selected()||''));
   before=selected();cards()[0].click();await wait(()=>selected()!==before&&/^\d+$/.test(selected()||'')&&heading(title));
  }
  const jobId=new URL(location.href).searchParams.get('currentJobId');if(seen.has(jobId))throw Error('AMBIGUOUS_RESULT_CARD');seen.add(jobId);
  jobs.push({jobId,paragraphs:initial[n]});
 }
 await wait(()=>buttons().some(b=>/^Page \d+$/.test(label(b).trim()))||jobs.length===0&&/No results found|Try shortening or rephrasing your search\./i.test(document.querySelector('main')?.innerText||''));
 const pageButtons=buttons().filter(b=>/^Page \d+$/.test(label(b).trim())),candidates=new Set();let controls=false;
 const lists=[...document.querySelectorAll('main [data-testid="pagination-controls-list"]')].filter(e=>e.getBoundingClientRect().width>0);
 if(lists.length>1)throw Error('AMBIGUOUS_RESULTS_NEXT');
 if(lists.length===1){
  const list=lists[0],root=list.parentElement,all=[...root.querySelectorAll('button,[role="button"]')],next=all.filter(e=>label(e).trim()==='Next'),pages=pageButtons.filter(e=>list.contains(e)),current=pages.filter(e=>['true','page'].includes(e.getAttribute('aria-current')));
  if(next.length===1){controls=true;candidates.add(next[0]);}
  // The live final-page control omits Next. Require the observed pagination
  // list, one current marker on its final item and no trailing ellipsis/item.
  // Missing Next by itself (or a carousel outside this list) proves nothing.
  else if(next.length===0&&pages.length===pageButtons.length&&current.length===1&&current[0]===pages.at(-1)&&list.lastElementChild?.contains(current[0])&&pages.every(e=>Number(label(e).trim().slice(5))<=Number(label(current[0]).trim().slice(5)))&&(label(current[0]).trim()==='Page 1'||all.some(e=>label(e).trim()==='Previous'&&!e.disabled&&e.getAttribute('aria-disabled')!=='true')))controls=true;
 }else for(const b of pageButtons){let node=b.parentElement;for(let n=0;node&&n<5;n++,node=node.parentElement){const all=[...node.querySelectorAll('button,[role="button"]')],next=all.filter(e=>label(e).trim()==='Next');if(next.length===1){controls=true;candidates.add(next[0]);break;}}}
 if(candidates.size>1)throw Error('AMBIGUOUS_RESULTS_NEXT');
 const next=[...candidates][0],empty=jobs.length===0&&/No results found|Try shortening or rephrasing your search\./i.test(document.querySelector('main')?.innerText||'');
 if(!empty&&!controls)throw Error('RESULTS_CONTROLS_NOT_READY');
 const available=!!next&&!next.disabled&&next.getAttribute('aria-disabled')!=='true',proof=JSON.stringify({query:query(location.href),start:new URL(location.href).searchParams.get('start')||'0',cards:initial.map(identity),pages:pageButtons.map(label)});
 return{schema:'forge.result-page-observation.v1',browser:'Chrome',complete:true,url:location.href,at:new Date().toISOString(),jobs,next:{available,kind:available?'RESULTS_NEXT':null,proof},emptyConfirmed:empty,endConfirmed:!available};
}
async function clickResultsNext({expectedUrl,controlProof}){
 const label=e=>e.getAttribute('aria-label')||e.innerText||'',buttons=()=>[...document.querySelectorAll('main button,main [role="button"]')].filter(e=>e.getBoundingClientRect().width>0);
 const query=value=>{const u=new URL(value);u.pathname=u.pathname.replace('/comm/','/');for(const k of [...u.searchParams.keys()])if(['start','currentJobId'].includes(k)||/token|sig|trk|lipi|eid|origin|referral|tracking|refid|^eBP$/i.test(k))u.searchParams.delete(k);u.searchParams.sort();return u.href;};
 const start=value=>Number(new URL(value).searchParams.get('start')||0);
 if(location.hostname!=='www.linkedin.com'||query(location.href)!==query(expectedUrl)||start(location.href)!==start(expectedUrl))throw Error('CHANGED_SOURCE_FILTERS');
 const cards=buttons().filter(e=>e.querySelectorAll('p').length>=3&&[...e.querySelectorAll('button,[role="button"]')].some(b=>/^Dismiss .+ job$/i.test(label(b).trim()))).map(e=>[...e.querySelectorAll('p')].slice(0,3).map((p,n)=>n?p.innerText.replace(/\s+/g,' ').trim():p.innerText.split('\n')[0].replace(/ \(Verified job\)$/,'').trim()));
 const pageButtons=buttons().filter(b=>/^Page \d+$/.test(label(b).trim())),candidates=new Set();
 const lists=[...document.querySelectorAll('main [data-testid="pagination-controls-list"]')].filter(e=>e.getBoundingClientRect().width>0);
 if(lists.length>1)throw Error('AMBIGUOUS_RESULTS_NEXT');
 if(lists.length===1){for(const e of lists[0].parentElement.querySelectorAll('button,[role="button"]'))if(label(e).trim()==='Next')candidates.add(e);}
 else for(const b of pageButtons){let node=b.parentElement;for(let n=0;node&&n<5;n++,node=node.parentElement){const next=[...node.querySelectorAll('button,[role="button"]')].filter(e=>label(e).trim()==='Next');if(next.length===1){candidates.add(next[0]);break;}}}
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
