/* M-07 Settings › Writer · build line. Values from fx.oct15.writer (writer_status.build fields: pr, commit, subject, deployedAt). */
(function () {
  var fx = G.fx, esc = G.esc, W = fx.oct15.writer, C = fx.counters;
  function $(id) { return document.getElementById(id); }
  $('subtabs').innerHTML = ['GENERAL', 'SCORING', 'WRITER', 'LANES', 'MAP', 'ACCESSIBILITY'].map(function (t) { return '<span class="tab' + (t === 'WRITER' ? ' on' : '') + '">' + t + '</span>'; }).join('') + '<span class="vf">READ-ONLY · FROM WRITER_STATUS · AS OF ' + fx.asOf + '</span>';
  var same = W.buildCommit === W.pageCommit;
  var line = '<span class="bl"><a>PR #' + W.buildPr + '</a> · <a>' + W.buildCommit + '</a> · DEPLOYED ' + W.deployedAt.toUpperCase() + ' ET</span><span class="s" style="overflow:hidden;text-overflow:ellipsis;min-width:0;flex:1">· ' + W.buildRev + ' · ' + esc(W.buildSubject) + '</span>' +
    (same ? '<span class="chip ok" style="flex:none">✓ SAME COMMIT AS THIS PAGE</span>' : '<span class="chip local" style="flex:none">PAGE IS ' + W.pageCommit + '</span>');
  function kv(k, v, sel) { return '<div class="kv' + (sel ? ' sel' : '') + '"><i></i><span class="k">' + k + '</span><span class="v">' + v + '</span></div>'; }
  var wait = C.writerWaiting, fail = C.writerFailed;
  var card = '<section class="panel"><div class="panel-head"><div class="ph-title">SETTINGS › WRITER</div><div class="ph-meta">READ-ONLY · FROM WRITER_STATUS · AS OF ' + fx.asOf + '</div></div>' +
    kv('HEALTH', (fail ? '<span class="chip red">⊗ ' + fail + ' FAILED WRITE</span><span class="s">payload kept · Retry on the receipt</span>' : '<span class="chip ok">✓ OK</span><span class="s">no current faults</span>')) +
    kv('WRITER', '<span>' + W.state + '</span><span class="s">· ◷ ' + wait + ' waiting for the lock · queue trigger installed</span>') +
    kv('WRITER BUILD', line, true) +
    kv('FRONTEND', '<span class="bl"><a>' + W.pageCommit + '</a></span><span class="s">· main · Netlify</span>') +
    kv('SCORING MODEL', '<span>rev ' + fx.model.rev + '</span><span class="s">· ' + esc(fx.model.version) + ' · all 8 weights shared</span>') +
    kv('LANE QUEUE', '<span>' + C.laneQueue + '</span><span class="s">· oldest ' + C.laneQueueOldestMin + ' min · 0 held</span>') +
    kv('UNVERIFIED WRITES', '<span>none</span>') + '</section>';
  var S = [['NORMAL', '<span class="bl"><a>PR #' + W.buildPr + '</a> · <a>' + W.buildCommit + '</a> · DEPLOYED ' + W.deployedAt.toUpperCase() + ' ET</span> <span class="chip ok">✓ SAME COMMIT AS THIS PAGE</span>', 'b.pr, b.commit, b.deployedAt; green chip only when b.commit equals the page build-info commit'],
    ['DIFFERENT COMMIT', '<span class="bl"><a>PR #119</a> · <a>93e357d</a> · DEPLOYED 18 OCT 16:20 ET</span> <span class="chip local">PAGE IS ' + W.pageCommit + '</span>', 'neutral: Writer and frontend deploy separately; no colour'],
    ['NO PR IN SUBJECT', '<span class="bl">NO PR · <a>5c367c0</a> · DEPLOYED 17 OCT 23:10 ET</span>', 'b.pr null → "NO PR" + subject'],
    ['DIRTY DEPLOY', '<span class="bl"><span style="color:var(--pe-amber)">▸</span> <a>' + W.buildCommit + '+dirty</a> · DEPLOYED FROM UNCOMMITTED CHANGES</span>', 'deploy.sh appends +dirty; amber glyph + words'],
    ['NO STAMP', '<span class="bl"><span style="color:var(--pe-amber)">▸</span> DEPLOYED WITHOUT A BUILD STAMP</span>', 'commit = "source" and no PR (Code.gs default)'],
    ['TOO OLD', '<span class="bl"><span style="color:var(--pe-amber)">▸</span> PREDATES WRITER_STATUS · DEPLOY NEEDED TO REPORT ITS BUILD</span>', 'w.unsupported'],
    ['NOT ANSWERING', '<span class="bl"><span style="color:var(--pe-red)">⊗</span> WRITER NOT ANSWERING · LAST ANSWER 18:12</span>', 'w.fetchError · same item as Needs you › Failed and the header pill']];
  var states = '<section class="panel"><div class="panel-head"><div class="ph-title">WRITER BUILD LINE · EVERY STATE</div><div class="ph-meta">ONE LINE · MONO 12 PX · LINKS CYAN · NEVER A NUMBER THE WRITER DOES NOT REPORT</div></div>' +
    '<div class="th2" style="grid-template-columns:6px 180px 1fr 420px"><span></span><span style="padding-left:8px">STATE</span><span>LINE</span><span>SOURCE</span></div>' +
    S.map(function (r) { return '<div class="sv"><i></i><span class="k">' + r[0] + '</span><span>' + r[1] + '</span><span class="n">' + esc(r[2]) + '</span></div>'; }).join('') + '</section>';
  var notes = '<section class="panel"><div class="panel-head"><div class="ph-title">RULES · M-07</div><div class="ph-meta">V-05 · V-10 · V-11 · L-2</div></div><div class="nt2">' +
    '<b>1 · Position</b><br>Third row of the Writer card, after HEALTH and WRITER. p40 row grid: 6 px bar · 200 px mono label · value; rows 40 px striped #0B0B0B / #070707. The cyan bar + Raised fill marks the row this page is about (selection styling; the built page has no bar).<br><br>' +
    '<b>2 · Content (L-2)</b><br>Only writer_status.build fields: pr, commit, subject, deployedAt (deploy.sh stamps WRITER_BUILD). REV + subject in Secondary, ellipsis, full text on hover. The Apps Script version number is not reported, so it is not drawn (FOR TIM T-7).<br><br>' +
    '<b>3 · Colour</b><br>Normal and "different commit" are neutral; the comparison chip uses p40 badges (ok green / local grey). Amber ▸ only for dirty, unstamped or too old; red ⊗ only when the Writer does not answer. Words always carry the state.<br><br>' +
    '<b>4 · Data</b><br>PR #121 · e7389ed · REV-017 are foreman-cockpit main values; the deployed time is mock (fixture field fx.oct15.writer).</div></section>';
  $('st-main').innerHTML = '<div class="st-col">' + card + states + '</div><div class="st-col">' + notes + '</div>';
  $('ticker').innerHTML = '<span class="ticker-label">▸ PIPELINE EVENTS</span>' + fx.events.map(function (e, i) { return (i ? '<span class="bar">│</span>' : '') + '<span class="ev"><span class="t">' + e[0] + '</span>' + esc(e[1]) + '</span>'; }).join('') + '<span class="ticker-end"><span class="tk">PAUSE TICKER</span> · <span class="tk">HIDE</span></span>';
  PEIcons.apply(document.getElementById('app'));
}());
