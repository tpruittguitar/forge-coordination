/* M-01 Needs you (desktop). Items: needs-you.json (repo NEEDS_TIM snapshot 17:47 + live checks); job counts from the scenario fixture. */
(function () {
  var fx = G.fx, esc = G.esc, C = fx.counters, NY = G.getJSON('needs-you.json');
  function $(id) { return document.getElementById(id); }
  var closed = fx.rows.filter(function (r) { return r.liveness !== 'OPEN' && r.bucket !== 'APPLIED'; }).length;
  // live job items recomputed from the fixture (L-2): an item with count 0 is not shown
  var live = { 'live:jobs-decide': [C.needsDecision, C.needsDecision + ' jobs waiting for your decision'], 'live:jobs-ready': [0, ''], 'live:jobs-decline': [C.declineCandidates, C.declineCandidates + ' AI decline recommendations waiting for your OK'], 'live:jobs-dead-active': [closed, closed + ' closed posting' + (closed === 1 ? '' : 's') + ' still filed as active'] };
  var items = NY.items.filter(function (i) { return !live[i.id] || live[i.id][0] > 0; }).map(function (i) { return live[i.id] ? Object.assign({}, i, { title: live[i.id][1] }) : i; });
  var cnt = { BLOCKING: 0, ACTION: 0, WATCH: 0 }; items.forEach(function (i) { cnt[i.level]++; });
  var sec = {}; items.forEach(function (i) { sec[i.section] = (sec[i.section] || 0) + 1; });
  document.getElementById('bell-n').textContent = cnt.BLOCKING + cnt.ACTION;
  $('subtabs').innerHTML = [['ALL', items.length, 1], ['DECIDE', sec.DECIDE || 0], ['JOBS', sec.JOBS || 0], ['FAILED', sec.FAILED || 0], ['UPKEEP', sec.UPKEEP || 0]].map(function (t) { return '<span class="tab' + (t[2] ? ' on' : '') + '">' + t[0] + '<b>' + t[1] + '</b></span>'; }).join('') +
    '<span class="vf">SORTED: BLOCKING → ACT ON → WATCH, OLDEST FIRST · AS OF ' + NY.asOf + '</span>';
  var quiet = NY.lanes.filter(function (l) { return l.quiet; });
  var kp = [['⊘ BLOCKING', cnt.BLOCKING, cnt.BLOCKING ? 'var(--pe-red)' : '', 'nothing is blocking'], ['▸ TO ACT ON', cnt.ACTION, 'var(--pe-amber)', 'bell badge = blocking + act on'], ['○ TO WATCH', cnt.WATCH, '', 'not counted in the badge'],
    ['LANES', NY.lanes.length, '', '▸ ' + quiet.length + ' quiet · ' + NY.unfinished + ' run unfinished'], ['REPO LIST', '43 min', '', 'changed 43 min ago · rebuilt every 30 min'], ['LIVE WRITER', '12 s', '', 'checked 12 s ago · idle']];
  $('kpis').innerHTML = kp.map(function (k) { return '<div class="kpi"><div class="k-label">' + k[0] + '</div><div class="k-val"' + (k[2] ? ' style="color:' + k[2] + '"' : '') + '>' + k[1] + '</div><div class="k-cap">' + k[3] + '</div></div>'; }).join('');
  $('strip').innerHTML = '<span class="strip-label">HOW TO ANSWER</span><span>Press an option or <b>Copy answer</b>, paste it into your Claude chat, and Claude records the ruling.</span><span class="sep">·</span><span class="muted" style="color:var(--pe-text-secondary)">Nothing on this page writes anything by itself.</span>' +
    '<span class="right">' + (NY.items.length - items.length + 4) + ' ITEMS HIDDEN AS ALREADY DONE · <span class="tk" style="color:var(--pe-text-primary);text-decoration:underline;text-underline-offset:3px">⟳ REFRESH</span></span>';
  var GL = { BLOCKING: '⊘', ACTION: '▸', WATCH: '○' };
  function card(i) {
    var lv = i.level.toLowerCase();
    if (i.level === 'WATCH' && /PR #/.test(i.title)) return '<div class="card compact"><span class="lv">○ WATCH</span><span class="t">' + esc(i.title) + '</span><span class="lnk">Source ↗</span><span class="m">' + esc(i.meta) + '</span></div>';
    var f = [];
    if (i.go || i.live) f.push('<span class="nbtn">OPEN →</span>');
    if (i.sourceUrl) f.push('<span class="lnk">Source ↗</span>');
    if (!i.live && (i.section === 'DECIDE' || i.section === 'JOBS')) f.push('<span class="nbtn">COPY ANSWER</span>');
    return '<div class="card ' + lv + '"><div class="h"><span class="lv">' + GL[i.level] + ' ' + i.level + '</span><span class="t">' + esc(i.title) + '</span></div>' +
      (i.detail ? '<div class="d">' + esc(i.detail) + '</div>' : '') + (i.action ? '<div class="d"><b>What to do:</b> ' + esc(i.action) + '</div>' : '') +
      (i.options ? '<div class="ops">' + i.options.map(function (o) { return '<span class="nbtn opt">' + esc(o) + '</span>'; }).join('') + '</div>' : '') +
      '<div class="f">' + f.join('') + '<span class="m">' + esc(i.meta) + '</span></div></div>';
  }
  var cols = NY.sections.map(function (sc) {
    var L = items.filter(function (i) { return i.section === sc[0]; });
    return '<section class="panel ny-col"><div class="panel-head"><div class="ph-title">' + esc(sc[1]).toUpperCase() + '</div><div class="ph-meta">' + L.length + '</div></div><div class="body">' +
      (L.length ? L.map(card).join('') : '<div class="d">✓ nothing waiting</div>') + '</div><div class="foot">SCROLLS INSIDE THE COLUMN · ▾ ' + L.length + ' ITEMS</div></section>';
  }).join('');
  var lanes = '<section class="panel lane"><div class="panel-head"><div class="ph-title">LANE HEARTBEAT · ' + NY.lanes.length + ' LANES · NEWEST RECEIPT PER LANE</div><div class="ph-meta"><span style="color:var(--pe-amber)">▸</span> ' + quiet.length + ' QUIET (' + quiet.map(function (l) { return l.lane; }).join(', ') + ') · QUIET = EVERY AI ON THE LANE PAST 2× ITS USUAL GAP</div></div>' +
    '<table class="grid"><colgroup><col style="width:6px"><col style="width:208px"><col style="width:300px"><col style="width:180px"><col style="width:260px"><col style="width:150px"><col style="width:130px"><col></colgroup>' +
    '<thead><tr><th></th><th>LANE</th><th>AI (NEWEST FIRST)</th><th>LAST RECEIPT</th><th>STATUS</th><th class="r">USUAL GAP</th><th class="r">RUNS 7 D</th><th>HEALTH</th></tr></thead><tbody>' +
    NY.lanes.map(function (l) {
      return '<tr><td class="bar"><i></i></td><td style="font-family:var(--pe-font-label);letter-spacing:.06em;font-size:12px">' + esc(l.lane) + '</td><td class="t-sec">' + esc(l.ais) + '</td><td class="t-sec">' + esc(l.last) + '</td><td style="font-family:var(--pe-font-label);font-size:12px;letter-spacing:.04em;color:var(--pe-text-secondary)">' + esc(l.status) + '</td>' +
        '<td class="t-num">' + (l.gap == null ? '—' : l.gap + ' h') + '</td><td class="t-num">' + l.runs + '</td><td>' + (l.quiet ? '<span style="color:var(--pe-amber)">▸</span> quiet · over 2× usual gap' : '<span style="color:var(--pe-green)">✓</span> <span class="t-sec">reporting</span>') + '</td></tr>';
    }).join('') + '</tbody></table></section>';
  $('ny-main').innerHTML = '<div class="ny-cols">' + cols + '</div>' + lanes;
  $('ticker').innerHTML = '<span class="ticker-label">▸ PIPELINE EVENTS</span>' + fx.events.map(function (e, i) { return (i ? '<span class="bar">│</span>' : '') + '<span class="ev"><span class="t">' + e[0] + '</span>' + esc(e[1]) + '</span>'; }).join('') + '<span class="ticker-end"><span class="tk">PAUSE TICKER</span> · <span class="tk">HIDE</span></span>';
  PEIcons.apply(document.getElementById('app'));
}());
