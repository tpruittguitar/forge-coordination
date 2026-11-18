'use strict';
/* Read this-run queue signals from existing lane summaries. No new ledgers. */
const fs = require('node:fs'), path = require('node:path');

function parseStamp(value) {
  if (value == null || value === '') return NaN;
  const s = String(value).trim();
  const iso = Date.parse(s);
  if (Number.isFinite(iso)) return iso;
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(\d{0,3})Z?$/.exec(s);
  if (!m) return NaN;
  return Date.parse(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}.${(m[7] || '0').padEnd(3, '0')}Z`);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

// FACT: state/UPSTREAM_FLOW.json summary field `waiting` (pending identities:
// WAITING + HELD + IDENTITY_HOLD + MISSING_PREVIOUSLY_PRESENT). counts.WAITING
// is the WAITING-status subset only.
function waitingFromFlow(root) {
  const file = path.join(root, 'state/UPSTREAM_FLOW.json');
  if (!fs.existsSync(file)) return { present: false, waiting: 0 };
  const j = readJson(file);
  if (j?.schema !== 'forge.upstream-flow.v1' || !Number.isFinite(j.waiting)) {
    throw Error('UPSTREAM_FLOW.json missing schema forge.upstream-flow.v1 or numeric waiting');
  }
  return { present: true, waiting: j.waiting, waitingStatus: Number.isFinite(j.counts?.WAITING) ? j.counts.WAITING : null };
}

function receiptStamp(name, rec) {
  const fromName = /^FORGE-AUTO-(\d{8}T\d{6,9}Z)\.json$/.exec(name);
  if (fromName) return parseStamp(fromName[1]);
  return parseStamp(rec?.sourceRunId && String(rec.sourceRunId).replace(/^FORGE-AUTO-/, ''));
}

// FACT: this-run auto-intake receipts expose reconciliation.insertedIds
// (and beforeCount/afterCount) after finalize. Ignore earlier receipts.
function wroteRowsFromReceipts(root, sinceMs) {
  if (!Number.isFinite(sinceMs)) return 0;
  const dir = path.join(root, 'receipts/auto-intake');
  if (!fs.existsSync(dir)) return 0;
  const ids = new Set();
  let delta = 0;
  for (const name of fs.readdirSync(dir)) {
    if (!/^FORGE-AUTO-.+\.json$/.test(name) || name.endsWith('.candidates.json')) continue;
    const file = path.join(dir, name);
    let rec;
    try { rec = readJson(file); } catch { continue; }
    const at = receiptStamp(name, rec);
    if (Number.isFinite(sinceMs) && Number.isFinite(at) && at < sinceMs) continue;
    const inserted = rec.reconciliation?.insertedIds;
    if (Array.isArray(inserted)) {
      for (const id of inserted) if (id) ids.add(id);
      continue;
    }
    const before = rec.reconciliation?.beforeCount, after = rec.reconciliation?.afterCount;
    if (Number.isFinite(before) && Number.isFinite(after) && after > before) delta += after - before;
  }
  return ids.size + delta;
}

// FACT: state/enrich-ats-pay-report.json fields not_attempted and
// research_budget_exhausted are written by the same enrich run. Ignore a
// leftover report from a previous run (report.at earlier than this run).
function enrichFromReport(root, sinceMs) {
  const file = path.join(root, 'state/enrich-ats-pay-report.json');
  if (!fs.existsSync(file)) return { fromThisRun: false };
  const j = readJson(file);
  const at = parseStamp(j.at) || parseStamp(String(j.run || '').replace(/^FORGE-ENRICH_ATS-ATSBOT-/, ''));
  if (!Number.isFinite(sinceMs) || !Number.isFinite(at) || at < sinceMs) return { fromThisRun: false, at };
  if (!Number.isFinite(j.not_attempted) || typeof j.research_budget_exhausted !== 'boolean') {
    throw Error('enrich-ats-pay-report.json missing numeric not_attempted or boolean research_budget_exhausted');
  }
  return { fromThisRun: true, at, notAttempted: j.not_attempted, researchBudgetExhausted: j.research_budget_exhausted };
}

function collect(lane, root, sinceMs) {
  if (lane === 'source-intake-auto') {
    const flow = waitingFromFlow(root);
    return { lane, waiting: flow.waiting, wroteRows: wroteRowsFromReceipts(root, sinceMs), flowPresent: flow.present };
  }
  if (lane === 'enrich-ats-pay') {
    const report = enrichFromReport(root, sinceMs);
    if (!report.fromThisRun) return { lane, fromThisRun: false };
    return { lane, fromThisRun: true, notAttempted: report.notAttempted, researchBudgetExhausted: report.researchBudgetExhausted };
  }
  throw Error('unknown lane: ' + lane);
}

module.exports = { parseStamp, waitingFromFlow, wroteRowsFromReceipts, enrichFromReport, collect };
