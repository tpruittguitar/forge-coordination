'use strict';
const Prepared = require('./prepared.cjs'), Recovery = require('./recovery');
const Posting = require('./posting-cache'), Pay = require('./pay-values'), Source = require('./source-blanks.cjs');

const writerKeys = new Set('SALARY_BASE_LOW SALARY_BASE_HIGH SALARY_MIDPOINT SALARY_SCORE_POINT SALARY_BASIS SALARY_CONF SALARY_ASOF SALARY_SOURCE SALARY_NOTE SALARY_MODEL_VERSION SALARY_CONTEXT_KEY'.split(' '));
const priorPay = [...writerKeys, 'PAY_POSTED', 'SALARY_BASE_POSTED', 'SALARY_BASE_EST'];
const emptyPay = row => !!row && priorPay.every(k => String(row.p[k]??'').trim()==='');
const unresolved = e => !!(e?.pay || e?.payFacts || e?.structuredBaseSalary || e?.payAmbiguous ||
  e?.payNeedsRefresh || ['PAY_FOUND', 'PAY_UNRESOLVED'].includes(e?.payStatus));
// Fail closed on numeric compensation not supported by the stock parser.
const amountCue = /[$€£¥]\s*\d|\b(?:USD|CAD|AUD|NZD|EUR|GBP|JPY|CHF)\s*\d|\b(?:salary|wage|pay|compensation)(?:\s+range)?\s*[:=]?\s*(?:from\s+|up to\s+)?\d|\b\d+(?:[.,]\d+)?k?\s*(?:per\s+|\/\s*)(?:hour|year|hr|yr)\b/i;

async function plan({row, capture, old, fields, enabled, estimateFor, modelFields, salarySource, today, now = Date.now()}) {
  if (!enabled || Prepared.protectedRow(row) || !emptyPay(row) || Object.keys(fields).some(k => writerKeys.has(k)) ||
      !capture || capture.fullPosting !== true || unresolved(capture) || unresolved(old) ||
      !Recovery.urls(row).some(url => Posting.route(url) && Posting.route(url) === Posting.route(capture.url))) return {};
  const e = Prepared.noPaySource(row, {evidence: {postingEvidence: capture, postingEvidenceSha256: Prepared.fingerprint(capture)}}, now);
  if (!e || amountCue.test(e.text)) return {};
  const est = await estimateFor(row, {noBoard: true, ignoreSiteEstimate: true});
  const band = est && !est.siteEstimate && Pay.values(est.low, est.high);
  const source = band && salarySource(est);
  if (!source || source === 'UNKNOWN' || !/^(HIGH|MED|LOW)$/.test(est.conf)) return {};
  return {...modelFields(row), SALARY_BASE_LOW: band.low, SALARY_BASE_HIGH: band.high, SALARY_MIDPOINT: band.mid,
    SALARY_SCORE_POINT: band.scorePoint, SALARY_BASIS: 'FORGE-ESTIMATE', SALARY_CONF: est.conf,
    SALARY_ASOF: today, SALARY_SOURCE: source,
    SALARY_NOTE: 'FORGE-ESTIMATE; this exact posting was read and stated no pay; ' + est.basis + '; ' + est.bls.note};
}

function liveFields(row, fields) {
  if (fields.SALARY_BASIS !== 'FORGE-ESTIMATE') return Source.select(row.p, fields);
  const ordinary = Source.select(row.p, Object.fromEntries(Object.entries(fields).filter(([k]) => !writerKeys.has(k))));
  if (!emptyPay(row)) return ordinary;
  return {...ordinary, ...Object.fromEntries(Object.entries(fields).filter(([k]) => writerKeys.has(k)))};
}

module.exports = {plan, liveFields};
