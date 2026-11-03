'use strict';
/* Applies the applied-duplicate report through the Writer (Tim 2026-11-03: "solve it and forget it", no ask-Tim queue).
   - CLOSE_CANDIDATE (same posting): Writer ruling kind DUPLICATE with dupOf = the row Tim already decided, plus evidence fields.
   - Every other match: ENRICH ruling that stamps PRIOR_APPLICATION (the label Tim sees) and its evidence; the job stays active.
   Safety: rows are re-read from the Writer first and skipped unless still active, unprotected and identical in company/title;
   a label already present is not re-sent. Each ruling's requestId is derived from its content, so a retry or a lost reply can
   only ever return ALREADY_APPLIED, never a second write. Batches of 25, with the Writer's write fence honored. */
const crypto = require('crypto');
const ACTIVE = new Set(['SCOUT_INTAKE', 'DISCOVERY_LEAD', 'MANUAL_RESEARCH', 'BLOCKED', 'READY_TO_PURSUE', 'TIM_DECISION_REQUIRED']);
const h = s => crypto.createHash('sha256').update(s).digest('hex').slice(0, 12);
const sleep = ms => new Promise(r => setTimeout(r, ms));

function plan(items, today) {
  return items.map(i => {
    const m = i.matches[0];
    if (i.outcome === 'CLOSE_CANDIDATE') {
      const fields = { DUP_RULE: i.rule, DUP_EVIDENCE: i.evidence, DUP_PRIOR_LABEL: i.label, DUP_DETECTED_BY: 'APPLIED-DUPLICATES-BOT', DUP_DETECTED_AT: today };
      return { item: i, ruling: { requestId: `DUPBOT-${i.id}-D${h(m.id + i.rule)}`, primaryId: i.id, kind: 'DUPLICATE', dupOf: m.id, actor: 'DUPBOT', fields } };
    }
    const fields = { PRIOR_APPLICATION: i.label, PRIOR_APPLICATION_ROW: m.id, PRIOR_APPLICATION_RULE: i.rule, PRIOR_APPLICATION_EVIDENCE: i.evidence, PRIOR_APPLICATION_ASOF: today };
    return { item: i, ruling: { requestId: `DUPBOT-${i.id}-L${h(m.id + i.label)}`, primaryId: i.id, kind: 'ENRICH', actor: 'DUPBOT', fields } };
  });
}

/* Keep a planned ruling only if the live row is still the job the report saw and still needs this write. */
function stillApplies(p, line, parseLine) {
  const r = line && parseLine(line); if (!r) return 'ROW_NOT_FOUND';
  if (!ACTIVE.has(r.status)) return 'NO_LONGER_ACTIVE';
  if (r.company !== p.item.company || r.title !== p.item.title) return 'ROW_CHANGED';
  if (/^YES/i.test(r.kv.ANTI_RESURRECTION || '') || r.kv.DO_NOT_REWORK) return 'PROTECTED';
  if (p.ruling.kind === 'ENRICH' && r.kv.PRIOR_APPLICATION === p.ruling.fields.PRIOR_APPLICATION) return 'ALREADY_LABELED';
  return null;
}

async function apply(items, { url, key, parseLine, fetchJson, wait = sleep, today = new Date().toISOString().slice(0, 10), fenceRetries = 3, batchGapMs = 130000 }) {
  const planned = plan(items, today), stats = { planned: planned.length, closed: 0, labeled: 0, already: 0, skipped: {}, failed: 0, deferred: 0, errors: [] };
  const live = [];
  for (let i = 0; i < planned.length; i += 25) {   // Writer row_readback accepts at most 25 IDs per request
    const chunk = planned.slice(i, i + 25);
    const rb = await fetchJson(`${url}?action=row_readback&key=${encodeURIComponent(key)}&ids=${chunk.map(p => p.ruling.primaryId).join(',')}`);
    if (!rb || !rb.ok) throw Error('row_readback failed: ' + (rb && rb.error || 'no reply'));
    const lines = {}; (rb.rows || []).forEach(x => { if (x.found && x.matches === 1) lines[x.primaryId] = x.line; });
    for (const p of chunk) { const why = stillApplies(p, lines[p.ruling.primaryId], parseLine); if (why) stats.skipped[why] = (stats.skipped[why] || 0) + 1; else live.push(p); }
  }
  for (let b = 0; b < live.length; b += 25) {
    const batch = live.slice(b, b + 25), requests = batch.map(p => ({ action: 'ruling', ruling: p.ruling }));
    const requestId = `DUPBOT-B${h(requests.map(r => r.ruling.requestId).join(','))}`;
    let res = null;
    for (let attempt = 0; ; attempt++) {
      try { res = await fetchJson(url, { method: 'POST', headers: { 'content-type': 'text/plain' }, body: JSON.stringify({ action: 'batch', key, requestId, requests }) }); }
      catch (e) { res = { mode: 'REPLY_LOST', error: String(e.message).slice(0, 160) }; }
      if (res && res.mode === 'WRITE_FENCE' && !res.frozen && attempt < fenceRetries) { await wait(Math.min(Math.max(+res.retryAfterMs || 30000, 30000), 150000)); continue; }
      break;
    }
    if (!res || res.mode === 'WRITE_FENCE' || res.mode === 'REPLY_LOST') {
      // Nothing proven written: the next scheduled run re-plans; content-derived requestIds make a repeat ALREADY_APPLIED.
      stats.deferred += batch.length; stats.errors.push(String(res && (res.error || res.mode) || 'NO_REPLY').slice(0, 160)); break;
    }
    const committed = res.mode === 'BATCH_RULING_SINGLE_COMMIT' || !!res.writeId;
    (res.results || []).forEach((it, n) => {
      const p = batch[n]; if (!p) return;
      if (it.ok && it.mode === 'ALREADY_APPLIED') stats.already++;
      else if (it.ok && committed) stats[p.ruling.kind === 'DUPLICATE' ? 'closed' : 'labeled']++;
      else if (it.ok) stats.deferred++;
      else { stats.failed++; stats.errors.push(`${p.ruling.primaryId}: ${String(it.error || it.mode || 'failed').slice(0, 120)}`); }
    });
    if (b + 25 < live.length) await wait(batchGapMs);
  }
  return stats;
}

module.exports = { plan, stillApplies, apply };
