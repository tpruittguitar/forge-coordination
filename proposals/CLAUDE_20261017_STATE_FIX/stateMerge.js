// Proposed Writer-side state merge (ES5, Apps Script compatible). Pure function: no clocks, no I/O.
// rulings: ignored (master sheet + receipts are the authority).
// seen: union by job id, keep max value.
// incidents (kind 'event' only): union by id, never delete; forward-only status per id,
//   mirroring PipelineIncidents.merge(): ACTIVE yields to non-ACTIVE; equal status -> higher attempts.
var STATUS_RANK = { ACTIVE: 0, ACKNOWLEDGED: 1, ACKNOWLEDGED_UNRESOLVED: 1, RECOVERED: 2 };
function rank_(s) { return STATUS_RANK.hasOwnProperty(s) ? STATUS_RANK[s] : 0; }
function mergeState_(cur, inc) {
  cur = cur || {}; inc = inc || {};
  var out = { seen: {}, rulings: cur.rulings || {}, incidents: { v: 1, incidents: {} } };
  var cs = cur.seen || {}, is = inc.seen || {};
  Object.keys(cs).forEach(function (k) { out.seen[k] = cs[k]; });
  Object.keys(is).forEach(function (k) { var v = Number(is[k]) || 0; if (!(k in out.seen) || v > out.seen[k]) out.seen[k] = v; });
  var ci = (cur.incidents && cur.incidents.incidents) || {}, ii = (inc.incidents && inc.incidents.incidents) || {};
  Object.keys(ci).forEach(function (k) { out.incidents.incidents[k] = ci[k]; });
  Object.keys(ii).forEach(function (k) {
    var r = ii[k], l = out.incidents.incidents[k];
    if (!r || r.kind !== 'event') return;
    if (!l) { out.incidents.incidents[k] = r; return; }
    var pick = l;
    // Parity with client PipelineIncidents.merge(): only ACTIVE yields to a later state.
    // Deliberate guard: an unknown status never replaces a known one.
    if (l.status === 'ACTIVE' && r.status !== 'ACTIVE' && STATUS_RANK.hasOwnProperty(r.status)) pick = r;
    else if (r.status === l.status && (r.attempts || 0) > (l.attempts || 0)) pick = r;
    if (pick !== l) {
      var ids = (l.eventIds || []).concat(r.eventIds || []).filter(function (x, n, a) { return a.indexOf(x) === n; });
      out.incidents.incidents[k] = Object.assign({}, pick, { eventIds: ids, attempts: Math.max(l.attempts || 0, r.attempts || 0) });
    }
  });
  return out;
}
// Proposed Code.gs replacement:
// function writeState_(state){ var lock=LockService.getScriptLock(); lock.waitLock(30000);
//   try { var f=findOrCreate_(STATE_FILE_NAME,'text','{}'); var raw=f.getBlob().getDataAsString()||'{}', cur;
//     try{cur=JSON.parse(raw)}catch(e){ return {ok:false,error:'STATE_UNREADABLE'}; } // never merge onto a corrupt file
//     findOrCreate_(STATE_FILE_NAME+'.prev','text','{}').setContent(raw);              // recovery copy before every write
//     f.setContent(JSON.stringify(mergeState_(cur,state)));
//     var back=JSON.parse(f.getBlob().getDataAsString());                              // readback
//     return {ok:true, seen:Object.keys(back.seen||{}).length};
//   } finally { lock.releaseLock(); } }
// doPost: if (req.action==='state') return out_(writeState_(req.state||{}));
if (typeof module !== 'undefined') module.exports = { mergeState_: mergeState_ };
