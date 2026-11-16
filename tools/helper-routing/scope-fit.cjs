'use strict';
// Builds the measured experience-fit evidence fields (SCOPE_FIT_RAW, FIT_*)
// for one canonical job from real posting evidence, using the published
// SCORING_MODEL.md anchor table (foreman-cockpit). The AI chooses an anchor and
// a value inside it and supplies exact quotes; this code refuses anything it
// cannot ground. It never invents, defaults or estimates a score: a refusal
// returns {ok:false, reason} and the field stays unset.
const crypto = require('node:crypto');
const ResumeMatch = require('../source-trial/resume-match.js');

// SCORING_MODEL.md "Experience fit anchors (SCOPE_FIT_RAW)".
const ANCHORS = {
  EXACT_JOB: [95, 100],              // same function, level, plant-floor scope and industry type
  SAME_FUNCTION_LEVEL: [85, 94],     // industry/product differs, experience transfers directly
  STRONG_OVERLAP: [70, 84],          // most duties overlap; one material gap
  PARTIAL_OVERLAP: [50, 69],         // several duties outside his record
  ADJACENT: [30, 49],                // title matches, work content mostly does not
  DIFFERENT_FUNCTION: [0, 29],
};
const HIDDEN_CLIENT_CAP = 84;        // "cap the rating at 84 until the client and scope are known"
const CONF = new Set(['HIGH', 'MED', 'LOW']);
const MIN_POSTING_CHARS = 400;       // a snippet/alert card cannot ground a fit rating

const fail = reason => ({ ok: false, reason });
const day = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(s + 'T00:00:00Z'));
const norm = s => String(s).replace(/\s+/g, ' ').trim();

function build(input, { profile } = {}) {
  const i = input || {};
  if (!/^V2[A-Z]-[A-Za-z0-9_-]+$/.test(i.primaryId || '')) return fail('EXACT_PRIMARY_ID_REQUIRED');
  if (i.existingScopeFitRaw !== undefined && i.existingScopeFitRaw !== null && String(i.existingScopeFitRaw).trim() !== '')
    return fail('SCOPE_FIT_RAW_ALREADY_PRESENT');
  const text = typeof i.postingText === 'string' ? i.postingText : '';
  if (i.fullPosting !== true || norm(text).length < MIN_POSTING_CHARS) return fail('FULL_POSTING_TEXT_REQUIRED');
  if (!/^https:\/\/\S+$/.test(i.sourceUrl || '')) return fail('SOURCE_URL_REQUIRED');
  if (!day(i.observedAt)) return fail('OBSERVED_DATE_REQUIRED');
  const band = ANCHORS[i.anchor];
  if (!band) return fail('KNOWN_ANCHOR_REQUIRED');
  if (!Number.isInteger(i.score) || i.score < band[0] || i.score > band[1]) return fail('SCORE_OUTSIDE_ANCHOR_BAND');
  if (!CONF.has(i.confidence)) return fail('FIT_CONF_REQUIRED');
  const basis = norm(i.basis || '');
  if (basis.length < 10 || basis.length > 300) return fail('ONE_LINE_BASIS_REQUIRED');
  const quotes = (Array.isArray(i.quotes) ? i.quotes : []).map(norm).filter(Boolean);
  if (!quotes.length) return fail('POSTING_QUOTE_REQUIRED');
  const flat = norm(text);
  if (quotes.some(q => q.length < 12 || !flat.includes(q))) return fail('QUOTE_NOT_IN_POSTING');
  if (!/^[A-Za-z0-9_-]{3,130}$/.test(i.runId || '')) return fail('RUN_ID_REQUIRED');

  // Observed overlap with the grounded resume profile. A rating that claims
  // strong overlap (>=70) with zero observed resume competencies is not grounded.
  const overlap = ResumeMatch.match({ title: i.title || '', description: text }, profile || ResumeMatch.load());
  const competencies = overlap.matches.map(m => m.competencyId);
  if (i.score >= ANCHORS.STRONG_OVERLAP[0] && !competencies.length) return fail('NO_OBSERVED_RESUME_OVERLAP_FOR_HIGH_ANCHOR');

  let score = i.score, confidence = i.confidence, capNote = '';
  if (i.hiddenClient === true) {
    if (score > HIDDEN_CLIENT_CAP) { score = HIDDEN_CLIENT_CAP; capNote = ' (capped at 84: hidden client)'; }
    if (confidence === 'HIGH') confidence = 'MED';
  }
  const fields = {
    SCOPE_FIT_RAW: String(score),
    FIT_CONF: confidence,
    FIT_ASOF: i.observedAt,
    FIT_BASIS: (`${i.anchor} ${band[0]}-${band[1]}: ${basis}${capNote}`).slice(0, 400),
    FIT_EVIDENCE: quotes.join(' | ').slice(0, 600),
    ANALYSIS_BY: 'CLAUDE_' + i.runId,
  };
  return {
    ok: true,
    fields,
    evidence: {
      sourceUrl: i.sourceUrl,
      sourceSha256: crypto.createHash('sha256').update(text, 'utf8').digest('hex'),
      resumeTextSha256: overlap.resumeTextSha256,
      observedCompetencies: competencies,
      scoringModel: 'foreman-cockpit SCORING_MODEL.md experience fit anchors',
    },
  };
}

module.exports = { build, ANCHORS, HIDDEN_CLIENT_CAP, MIN_POSTING_CHARS };

if (require.main === module) {
  // node tools/helper-routing/scope-fit.cjs <input.json>  -> prints {ok,fields|reason}
  const fs = require('node:fs');
  const file = process.argv[2];
  if (!file) { console.error('usage: scope-fit.cjs <input.json>'); process.exit(2); }
  const out = build(JSON.parse(fs.readFileSync(file, 'utf8')));
  process.stdout.write(JSON.stringify(out) + '\n');
  process.exitCode = out.ok ? 0 : 1;
}
