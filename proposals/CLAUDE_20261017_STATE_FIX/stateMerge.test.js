const test=require('node:test'),assert=require('node:assert');const {mergeState_}=require('./stateMerge.js');
const ev=(id,status,attempts=1,eventIds=[])=>({id,kind:'event',status,attempts,eventIds});
const server={seen:{a:100,b:200},rulings:{j1:{decision:'PURSUE',ts:'2026-10-17T07:00:00Z'}},
  incidents:{v:1,incidents:{i1:ev('i1','ACKNOWLEDGED_UNRESOLVED',2,['e1']),i2:ev('i2','RECOVERED',1)}}};
test('stale legacy full blob cannot delete, regress, or touch rulings',()=>{
  const stale={seen:{a:50},rulings:{},incidents:{v:1,incidents:{i1:ev('i1','ACTIVE',1,['e1'])}}};
  const m=mergeState_(server,stale);
  assert.deepEqual(m.rulings,server.rulings);
  assert.equal(m.seen.a,100);assert.equal(m.seen.b,200);
  assert.equal(m.incidents.incidents.i1.status,'ACKNOWLEDGED_UNRESOLVED');
  assert.ok(m.incidents.incidents.i2);});
test('new seen marks and new incidents are added',()=>{
  const m=mergeState_(server,{seen:{c:300,a:150},incidents:{v:1,incidents:{i3:ev('i3','ACTIVE')}}});
  assert.equal(m.seen.a,150);assert.equal(m.seen.c,300);assert.equal(m.incidents.incidents.i3.status,'ACTIVE');});
test('ACTIVE moves forward and keeps event history',()=>{
  const cur={incidents:{v:1,incidents:{i9:ev('i9','ACTIVE',1,['e1'])}}};
  const m=mergeState_(cur,{incidents:{v:1,incidents:{i9:ev('i9','ACKNOWLEDGED_UNRESOLVED',3,['e2'])}}});
  assert.equal(m.incidents.incidents.i9.status,'ACKNOWLEDGED_UNRESOLVED');assert.deepEqual(m.incidents.incidents.i9.eventIds,['e1','e2']);assert.equal(m.incidents.incidents.i9.attempts,3);});
test('acknowledged obligation is kept when another device posts RECOVERED (client parity)',()=>{
  const m=mergeState_(server,{incidents:{v:1,incidents:{i1:ev('i1','RECOVERED',1)}}});
  assert.equal(m.incidents.incidents.i1.status,'ACKNOWLEDGED_UNRESOLVED');});
test('unknown status never outranks a known one',()=>{
  const m=mergeState_(server,{incidents:{v:1,incidents:{i1:ev('i1','WEIRD')}}});
  assert.equal(m.incidents.incidents.i1.status,'ACKNOWLEDGED_UNRESOLVED');});
test('non-event incidents and incoming rulings are ignored',()=>{
  const m=mergeState_(server,{rulings:{j1:{decision:'DECLINE'}},incidents:{v:1,incidents:{c1:{id:'c1',kind:'condition',status:'ACTIVE'}}}});
  assert.equal(m.rulings.j1.decision,'PURSUE');assert.ok(!m.incidents.incidents.c1);});
test('legacy server file without incidents wrapper',()=>{
  const m=mergeState_({seen:{},rulings:{}},{seen:{x:1}});assert.equal(m.seen.x,1);assert.deepEqual(m.incidents.incidents,{});});
// Synthetic shape fixtures (no real employers, ids, or pay): legacy and malformed server files.
test('shape: legacy ACKNOWLEDGED row, mixed kinds, null and empty inputs',()=>{
  const legacy={seen:{'JOB-A':1},rulings:{'JOB-A':{decision:'HOLD'}},incidents:{v:1,incidents:{
    e1:{id:'e1',kind:'event',status:'ACKNOWLEDGED',attempts:1},c1:{id:'c1',kind:'condition',status:'ACTIVE'}}}};
  const m=mergeState_(legacy,{seen:{'JOB-B':2},incidents:{v:1,incidents:{e1:{id:'e1',kind:'event',status:'ACTIVE',attempts:5}}}});
  assert.equal(m.incidents.incidents.e1.status,'ACKNOWLEDGED');
  assert.ok(m.incidents.incidents.c1,'existing server rows of any kind are preserved');
  assert.deepEqual(Object.keys(m.seen).sort(),['JOB-A','JOB-B']);
  assert.deepEqual(mergeState_(null,null),{seen:{},rulings:{},incidents:{v:1,incidents:{}}});
  assert.deepEqual(mergeState_({},{}).incidents.incidents,{});});
test('shape: incidents posted without v wrapper are ignored safely',()=>{
  const m=mergeState_({seen:{},rulings:{}},{incidents:{e9:{id:'e9',kind:'event',status:'ACTIVE'}}});
  assert.deepEqual(m.incidents.incidents,{});});
test('edge: duplicate event ids are deduplicated on a forward move',()=>{
  const m=mergeState_({incidents:{v:1,incidents:{e1:{id:'e1',kind:'event',status:'ACTIVE',attempts:1,eventIds:['x','y']}}}},
                      {incidents:{v:1,incidents:{e1:{id:'e1',kind:'event',status:'ACKNOWLEDGED_UNRESOLVED',attempts:1,eventIds:['y','z','z']}}}});
  assert.deepEqual(m.incidents.incidents.e1.eventIds,['x','y','z']);});
test('edge: malformed incoming entries (null, string, array) are ignored; malformed server entry is replaced only by a valid event',()=>{
  const m=mergeState_({incidents:{v:1,incidents:{e2:null}}},{incidents:{v:1,incidents:{a:null,b:'oops',c:[1],e2:{id:'e2',kind:'event',status:'ACTIVE'}}}});
  assert.deepEqual(Object.keys(m.incidents.incidents).sort(),['e2']);assert.equal(m.incidents.incidents.e2.status,'ACTIVE');});
test('edge: conflicting acknowledgement metadata keeps the server copy whole',()=>{
  const cur={incidents:{v:1,incidents:{e3:{id:'e3',kind:'event',status:'ACKNOWLEDGED_UNRESOLVED',ackBy:'TIM',acknowledgedAt:'T1',attempts:2}}}};
  const m=mergeState_(cur,{incidents:{v:1,incidents:{e3:{id:'e3',kind:'event',status:'ACKNOWLEDGED_UNRESOLVED',ackBy:'OTHER',acknowledgedAt:'T0',attempts:1}}}});
  assert.equal(m.incidents.incidents.e3.ackBy,'TIM');assert.equal(m.incidents.incidents.e3.acknowledgedAt,'T1');});
