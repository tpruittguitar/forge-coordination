# Proposal — One opportunity, multiple posting and application channels

**Status:** PROPOSED / unapproved implementation. **Origin:** Tim, 2026-10-24.

## Tim's ruling and intent
When an employer career posting and an aggregator/recruiter posting lead through genuinely different application paths, a strong opportunity should not be excluded solely because its titles, employer and location overlap. Tim accepts submitting through both paths and linking the application histories later if a recruiter reply or interview proves they are the same underlying opportunity. This is an explicit preference, not permission for uncontrolled duplicate records or misleading application claims.

## Data model
- **Opportunity:** canonical underlying employer role, stable opportunity ID; can remain POSSIBLE_MATCH until evidence develops.
- **Posting / channel:** one per distinct source and application endpoint, with original URL, source timestamp, title, employer and requisition evidence.
- **Application attempt:** each independently documented submission tied to its posting/channel, with confirmation, date, state and receipt.
- **Relationship:** SAME_OPPORTUNITY_DIFFERENT_CHANNEL, POSSIBLE_SAME_OPPORTUNITY or CONFIRMED_SAME_APPLICATION; link rather than destructively merge histories.

## Intake rule
A similar employer/title/location across two different application channels is **not automatically a hard duplicate** and must not halt unrelated intake. Preserve distinct posting and channel evidence. Do not auto-apply twice to an identical ATS requisition merely because two aggregators link to it. Do not misclassify a posting as an application without submission evidence.

## Protected-state safeguards
Keep REJECTED_BY_EMPLOYER, DECLINED_BY_TIM, APPLIED and other terminal/protected history intact. Different requisition or channel requires independent evidence; never resurrect a rejected entry or bypass employer-specific reapplication restrictions. Uncertain cases remain visibly unresolved and route to review, without blocking unrelated candidates.

## Durability consequences
An intake record becomes individually durable through Writer receipt-index COMPLETE, matching canonical ID and exact-row readback. Cross-channel matching and entire-batch reconciliation should be separate nonblocking follow-up for ordinary records, but true UNKNOWN Writer outcomes must never be replayed blindly.

## Proposed delivery phases
1. Audit and document existing dedup/identity gates; model channel and application-attempt persistence without replacing the canonical master.
2. Implement nonblocking possible-match linkage and channel-specific receipts; verify protected-state behavior.
3. UI: one opportunity with expandable channels/applications, evidence and later interview-based linkage.
4. Regression tests: two distinct channels both retained; same endpoint deduped; no invented application state; protected rejection never overwritten; unknown Writer receipt never resent.

**Governance:** This proposal does not authorize changes to code, automatic application submission, scoring, Writer, policy or scheduling. Tim approves scope and named builder before implementation.
