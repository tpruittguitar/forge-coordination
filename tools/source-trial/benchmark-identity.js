'use strict';
// Read-only CPU/local-I/O benchmark. This never contacts the Writer or changes ledgers.
const fs=require('node:fs'),{performance}=require('node:perf_hooks');
const I=require('./job-identity'),R=require('../source-intake/writer-reader');
const summary=values=>{const sorted=[...values].sort((a,b)=>a-b);return {samples:sorted.length,minMs:+sorted[0].toFixed(3),medianMs:+sorted[Math.floor(sorted.length/2)].toFixed(3),maxMs:+sorted.at(-1).toFixed(3)};};
function benchmark({readMaster,readArchive,candidates,iterations=5,naiveLimit=100}){
 const timings={readParse:[],index:[],matches:[],batch:[]};let rows,index,masterRows,archiveRows;
 for(let run=0;run<iterations+1;run++){
  const start=performance.now(),master=R.parseMaster(readMaster()),archive=R.parseArchive(readArchive()),parsed=performance.now();
  rows=master.concat(archive);index=I.index(rows);const indexed=performance.now();for(const candidate of candidates)I.match(index,candidate);const end=performance.now();
  masterRows=master.length;archiveRows=archive.length;if(!run)continue;
  timings.readParse.push(parsed-start);timings.index.push(indexed-parsed);timings.matches.push(end-indexed);timings.batch.push(end-start);
 }
 const subset=candidates.slice(0,Math.max(0,naiveLimit)),naiveStart=performance.now();
 for(const candidate of subset){const repeated=I.index(R.parseMaster(readMaster()).concat(R.parseArchive(readArchive())));I.match(repeated,candidate);}
 const naiveMs=performance.now()-naiveStart;
 return {kind:'LOCAL_CACHED_IO_NOT_NETWORK_LATENCY',masterRows,archiveRows,candidates:candidates.length,
  oncePerBatch:{masterReads:1,archiveReads:1,indexBuilds:1,readParse:summary(timings.readParse),index:summary(timings.index),matches:summary(timings.matches),total:summary(timings.batch)},
  repeatedPerCandidate:{candidates:subset.length,masterReads:subset.length,archiveReads:subset.length,indexBuilds:subset.length,totalMs:+naiveMs.toFixed(3),perCandidateMs:subset.length?+(naiveMs/subset.length).toFixed(3):0},
  notes:['One warm-up batch is excluded.','Files may be in the OS cache; remote transport latency is not measured.','No canonical presence results are persisted or used as authorization.']};
}
if(require.main===module){
 const [master,archive,ledger,limit]=process.argv.slice(2);if(!master||!archive||!ledger)throw Error('Usage: node benchmark-identity.js MASTER_FILE ARCHIVE_FILE LEDGER_JSON [NAIVE_LIMIT]');
 const data=JSON.parse(fs.readFileSync(ledger,'utf8')),candidates=Array.isArray(data)?data:Object.values(data.entries||{}).filter(e=>['WAITING','HELD','IDENTITY_HOLD','MISSING_PREVIOUSLY_PRESENT'].includes(e.status));
 process.stdout.write(JSON.stringify(benchmark({readMaster:()=>fs.readFileSync(master,'utf8'),readArchive:()=>fs.readFileSync(archive,'utf8'),candidates,naiveLimit:limit==null?100:Number(limit)}),null,2)+'\n');
}
module.exports={benchmark};
