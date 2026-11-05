# Discovery backlog audit

Read-only production snapshots: upstream and drain 2026-11-05 22:42 UTC; independent canonical master/archive 22:45 UTC. No canonical writes or bulk closures.

The headline 5,423 was unresolved captured candidate identities: 4,033 WAITING, 1,163 HELD and 227 IDENTITY_HOLD. It is discovery inventory, not 5,423 validated jobs ready for intake. 1,636 lacked a location; 800 lacked a known capture date. Same employer/title/location clusters contained 412 extra source identities; these are possible duplicates/reposts, not proven duplicate jobs. None were deleted based on names alone.

117 open drain records had source keys replaced by canonical PID groups; every original alias was still present in a PRESENT group. Of these, 55 were still marked READY_FOR_CONTROLLED_INTAKE because historical positive reviews could reactivate them after the missing-group check. A dry run of the repair accounts for 69 unfenced records and retains 48 original-Writer reconciliation tasks. None remain incorrectly intake-ready. Presence never proves completion of an uncertain original request.

The upstream identity index also treated every URL in every payload field as a posting identity. A salary-comparison link and a review reference created two demonstrably false ambiguity cases. Index explicit own-job identity fields instead; genuine shared posting identities still hold for reconciliation. REQ-based LinkedIn IDs are read from either canonical parser field. A same-snapshot backtest changes pending groups from 5,422 to 5,420 while also exposing genuine ambiguity; this is not an arbitrary reduction of inventory.

Permanent behavior: retain each source identity and its history; account for key changes through canonical aliases; never let old positive source reviews bypass missing inventory or original Writer fences; separate screening/holds from intake-ready work in the UI. Capture dates are displayed when known and explicitly unknown otherwise. No age-based deletion, title-only merge, protected-job reopening or uncertain Writer replay.
