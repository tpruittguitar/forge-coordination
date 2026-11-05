const test=require('node:test'),assert=require('node:assert/strict'),{fromFlow}=require('./discovery-rate');
const now=Date.parse('2026-11-05T22:00:00Z');
function flow(){return {schema:'forge.upstream-flow.v1',at:new Date(now-60000).toISOString(),reconciled:true,total:10,accounted:10,counts:{WAITING:8,PRESENT:2},rates:{discovery:{count:273,perHour:273/36,windowHours:36,unit:'candidate identities',partial:true}}};}
test('legacy activity caller uses the all-source discovery numerator, including waiting candidates',()=>{const f=flow(),r=fromFlow(f,now);assert.equal(r.count,273);assert.equal(r.perHour,273/36);assert.equal(r.sourceAt,f.at);assert.equal(r.available,true);assert.equal(r.partial,true);});
test('stale, future, unreconciled, legacy admitted-only and inconsistent rates are unavailable, never zero',()=>{
 for(const change of [f=>{f.at=new Date(now-31*60000).toISOString()},f=>{f.at=new Date(now+1).toISOString()},f=>{f.reconciled=false},f=>{f.counts.WAITING=9},f=>{delete f.rates.discovery.unit},f=>{f.rates.discovery.perHour=1},f=>{f.rates.discovery.count=-1}]){const f=flow();change(f);assert.throws(()=>fromFlow(f,now),/unavailable/);}
});
