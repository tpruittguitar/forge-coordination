'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
function policy(){try{return JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../control/CHATGPT_OWNER_CUTOVER.json')));}catch{return {retired:[]};}}
function retirement(taskKey,assignmentId){return (policy().retired||[]).find(r=>r.taskKey===taskKey&&r.assignmentId===assignmentId)||null;}
function assertHistorical(batch){const p=policy();if(!(p.retired||[]).some(r=>r.taskKey===batch.taskKey&&r.assignmentId===batch.assignmentId))return false;const sha=crypto.createHash('sha256').update(JSON.stringify(batch)).digest('hex');if(!(p.acceptedHistoricalBatches||[]).some(r=>r.taskKey===batch.taskKey&&r.runId===batch.runId&&r.sha256===sha))throw Error('RETIRED_GROK_ROUTE: current owner is ChatGPT; historical evidence must match the preserved exact batch');return true;}
module.exports={policy,retirement,assertHistorical};
