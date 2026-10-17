// Usage: node parity.js /path/to/foreman-cockpit/pipeline-incidents.js
const path=process.argv[2]||process.env.PIPELINE_INCIDENTS;if(!path){console.error('pass path to pipeline-incidents.js');process.exit(2)}
const PI=require(require('path').resolve(path));const {mergeState_}=require('./stateMerge.js');
const S=['ACTIVE','ACKNOWLEDGED','ACKNOWLEDGED_UNRESOLVED','RECOVERED'];const diffs={};
for(const ls of S)for(const rs of S)for(const la of [1,2])for(const ra of [1,2]){
 const l={id:'x',kind:'event',status:ls,attempts:la,eventIds:['a']},r={id:'x',kind:'event',status:rs,attempts:ra,eventIds:['b']};
 const c=PI.merge({incidents:{x:l}},{incidents:{x:r}}).store.incidents.x;
 const s=mergeState_({incidents:{v:1,incidents:{x:l}}},{incidents:{v:1,incidents:{x:r}}}).incidents.incidents.x;
 if(c.status!==s.status||c.attempts!==s.attempts)diffs[`${ls}(${la}) + ${rs}(${ra})`]=`client=${c.status}/${c.attempts} server=${s.status}/${s.attempts}`}
console.log(Object.keys(diffs).length+' of 64 cases differ');for(const k in diffs)console.log(k,'->',diffs[k]);process.exit(Object.keys(diffs).length?1:0);
