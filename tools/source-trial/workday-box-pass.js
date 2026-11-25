'use strict';
/* Workday box pass (Tim 2026-11-18 8:43 AM ET, card 14c6e4a). Workday's job-search endpoint answers 429 after a few
 * requests from shared GitHub runners, so Workday boards are read from the box (TRIAL_WORKDAY_ONLY=1): due Workday
 * boards only, 60 s between requests, one pass, stopped at the first 429. GitHub runs never probe Workday (cs-c49f2bf8);
 * a missing or stale box pass is reported as workday_box_pass_stale instead of probed. state/workday-box-pass.json holds the pass record. */
const fs=require('fs');
const PASS_FILE='workday-box-pass.json',GAP_MS=60000,FRESH_MS=4*3600000,BUDGET_MS=3*3600000;
function loadPass(file){try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch{return null;}}
function fresh(pass,now=Date.now()){const t=Date.parse(pass?.lastPassAt||'');return Number.isFinite(t)&&now-t>=0&&now-t<FRESH_MS;}
function boxPassStale(pass,now=Date.now()){return !fresh(pass,now);}
/* GitHub never probes Workday. The box pass owns those reads (cs-c49f2bf8). */
function githubSkipWorkday(){return true;}
/* Due Workday boards: non-OK boards past retryAt first (oldest attempt first), then ranked boards not cooling.
 * After a 429, nextDue is the next key in that due list so the following pass starts there instead of at the reshuffled oldest. */
function workdayOrder(recoveries,ranked,health,now=Date.now(),pass=null){
 const due=b=>{const h=health.boards[b.key];return !h||h.status==='OK'||Date.parse(h.retryAt||0)<=now;};
 return startFrom([...new Map([...recoveries,...ranked].filter(b=>b.kind==='workday'&&due(b)).map(b=>[b.key,b])).values()],pass);
}
function cursorAfterStop(dueBoards,stoppedKey){
 const dueOrder=(dueBoards||[]).map(b=>b.key);
 if(!dueOrder.length)return {nextDue:null,dueOrder:null};
 const i=dueOrder.indexOf(stoppedKey);
 const nextDue=dueOrder[i<0||i+1>=dueOrder.length?0:i+1];
 return {nextDue,dueOrder};
}
function clearCursor(){return {nextDue:null,dueOrder:null};}
function startFrom(dueBoards,pass){
 if(!pass||!pass.nextDue||!(dueBoards||[]).length)return dueBoards;
 const byKey=new Map(dueBoards.map(b=>[b.key,b])),walk=(pass.dueOrder&&pass.dueOrder.length)?pass.dueOrder:dueBoards.map(b=>b.key);
 let i=walk.indexOf(pass.nextDue);if(i<0)i=0;
 const out=[],seen=new Set();
 for(let n=0;n<walk.length;n++){const k=walk[(i+n)%walk.length],b=byKey.get(k);if(b&&!seen.has(k)){seen.add(k);out.push(b);}}
 for(const b of dueBoards)if(!seen.has(b.key))out.push(b);
 return out.length?out:dueBoards;
}
function startWorkdayFrom(order,pass){
 const wd=(order||[]).filter(b=>b.kind==='workday'),rest=(order||[]).filter(b=>b.kind!=='workday');
 return [...startFrom(wd,pass),...rest];
}
function stopsPass(board,result){return board.kind==='workday'&&result.httpStatus===429;}
/* Merge two board-health states: per board, the newer lastAttemptAt wins; a repaired board drops its old key. */
function mergeHealth(theirs,ours){
 const out={...theirs,boards:{...theirs.boards}};
 for(const [k,h] of Object.entries(ours.boards||{})){const t=out.boards[k];if(!t||Date.parse(h.lastAttemptAt||0)>Date.parse(t.lastAttemptAt||0)){out.boards[k]=h;if(h.repairedFrom&&h.repairedFrom!==k)delete out.boards[h.repairedFrom];}}
 out.at=[theirs.at,ours.at].filter(Boolean).sort().pop()||null;return out;
}
if(require.main===module){
 const [cmd,theirsFile,oursFile,outFile]=process.argv.slice(2);
 if(cmd!=='merge'||!outFile){console.error('usage: workday-box-pass.js merge <theirs.json> <ours.json> <out.json>');process.exit(2);}
 const merged=mergeHealth(JSON.parse(fs.readFileSync(theirsFile,'utf8')),JSON.parse(fs.readFileSync(oursFile,'utf8')));
 fs.writeFileSync(outFile,JSON.stringify(merged,null,1)+'\n');
}
module.exports={PASS_FILE,GAP_MS,FRESH_MS,BUDGET_MS,loadPass,fresh,boxPassStale,githubSkipWorkday,workdayOrder,cursorAfterStop,clearCursor,startFrom,startWorkdayFrom,stopsPass,mergeHealth};
