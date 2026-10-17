// Testable core of the Writer state write. Apps Script wires real services in; tests inject fakes.
// store: {read(name)->string|null, write(name,text)}; lock: {wait(ms), release()}
var mergeState_ = (typeof require!=='undefined') ? require('./stateMerge.js').mergeState_ : mergeState_;
function writeStateCore_(store, lock, name, incoming) {
  lock.wait(30000);                                   // throws on timeout -> nothing written
  try {
    var raw = store.read(name); if (raw == null || raw === '') raw = '{}';
    var cur; try { cur = JSON.parse(raw); } catch (e) { return { ok: false, error: 'STATE_UNREADABLE' }; }
    if (!cur || typeof cur !== 'object' || Array.isArray(cur)) return { ok: false, error: 'STATE_UNREADABLE' };
    store.write(name + '.prev', raw);                 // recovery copy first
    var next = JSON.stringify(mergeState_(cur, incoming || {}));
    store.write(name, next);
    var back = store.read(name);
    if (back !== next) return { ok: false, error: 'STATE_READBACK_MISMATCH' };
    return { ok: true };
  } finally { lock.release(); }
}
if (typeof module !== 'undefined') module.exports = { writeStateCore_: writeStateCore_ };
