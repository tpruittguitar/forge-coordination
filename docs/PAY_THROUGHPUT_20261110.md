# Pay throughput audit and retained-evidence wake-up

## Observed production outcome

The 2026-11-10 07:53:05Z pay report recorded 61 missing-field source reads,
60 failed public fallback reads, 115 rows waiting for posting evidence, 521
backoff skips, and zero salary estimates, salary submissions or independently
verified salary changes. Its 67 active salary reviews found no stronger evidence.
Physical reads, cache saves and reviews are not completed salary work.

A read-only canonical master retrieved at 08:08:36Z contained 5,163 rows and
771 feasibility-eligible rows. Against the retained repository ledger, 560 of
those rows were still in backoff. An audit combining identity-validated ledger,
shared posting-cache and discovery evidence found **zero** newly useful retained
observations that currently qualify for the wake-up below. This repair must not
be represented as an already achieved production salary increase.

## Repair

Previously the missing-field loop checked source-retry backoff before loading
retained posting evidence. A successful posting read from another worker could
therefore remain unusable until an earlier failed-read backoff expired.

The loop now checks validated retained evidence after existing protected/pending
and helper fences, before source backoff. A useful observation newer than the
last source attempt wakes the row. Unchanged, stale, future, unrelated and
ambiguous salary evidence does not wake it. Degree and salary observation dates
are considered independently. All normal identity checks, salary estimation
rules, Writer validation and independent verification remain in force.

An in-memory identity index keeps these checks from scanning every unrelated
posting-cache observation for each skipped row. Saves update the index and
pruning remains authoritative. No schedule, source-request cap or Writer fence
is changed.

## Outcome accounting

- Researched: production report and one read-only canonical snapshot audited;
  no new public salary source was captured in this repair.
- Prepared: regression proves one synthetic exact posted salary can be planned
  during backoff with zero repeated source reads. This is a test, not a live row.
- Submitted: zero production salary submissions by this repair.
- Independently verified: zero production salary changes by this repair.

To prove production completion, the published repair must first be integrated
through the supported owner process, then a normal run must capture useful new
posting evidence and show matching Writer result, receipt index and readback.
Do not replay pending requests or treat the draft PR as deployment.
