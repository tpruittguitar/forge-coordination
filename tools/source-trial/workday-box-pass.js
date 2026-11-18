'use strict';
/* Workday box pass (Tim 2026-11-18 8:43 AM ET, card 14c6e4a). Workday's job-search endpoint answers 429 after a few
 * requests from shared GitHub runners, so Workday boards are read from the box (TRIAL_WORKDAY_ONLY=1): due Workday
 * boards only, 60 s between requests, one pass, stopped at the first 429. GitHub runs skip Workday while the last
 * box pass is under 4 h old. state/workday-box-pass.json holds the pass record. */
const fs=require('fs');
const PASS_FILE='workday-box-pass.json',GAP_MS=60000,FRESH_MS=4*3600000,BUDGET_MS=3*3600000;
function loadPass(file){try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch{return null;}}
function fresh(pass,now=Date.now()){const t=Date.parse(pass?.lastPassAt||'');return Number.isFinite(t)&&now-t>=0&&now-t<FRESH_MS;}
/* Due Workday boards: non-OK boards past retryAt first (oldest attempt first), then ranked boards not cooling. */
function workdayOrder(recoveries,ranked,health,now=Date.now()){
 const due=b=>{const h=health.boards[b.key];return !h||h.status==='OK'||Date.parse(h.retryAt||0)<=now;};
 return [...new Map([...recoveries,...ranked].filter(b=>b.kind==='workday'&&due(b)).map(b=>[b.key,b])).values()];
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
module.exports={PASS_FILE,GAP_MS,FRESH_MS,BUDGET_MS,loadPass,fresh,workdayOrder,stopsPass,mergeHealth};
