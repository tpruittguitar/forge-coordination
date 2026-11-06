# Exact-title exclusion reviews

Tim's November 6 instruction permits exclusion when the captured title itself clearly breaks an active Never Consider rule, without another per-item confirmation. This path handles only NC-005 finance/accounting and NC-006 property management. It does not introduce sales, HR, supply-chain, or geography rules.

The existing bulk review producer can use `reference/EXCLUSION_TITLE_RULES.json` when no existing employer/role evidence binding matches. It still requires explicit unique assigned keys and run attribution. Existing reviews and work must be reconciled by their owner, never overwritten.

TITLE_RULE reviews copy the complete captured company, title and URL. The independent verifier matches the exact current card and source version, recomputes the title rule, and requires the exact active canonical definition hash. It does not fetch a job page: the recorded verification basis is the captured title, not verified job responsibilities. Ambiguous, mixed-function and technical/client-serving titles remain in research. NC-005 uses a complete title grammar, not a prefix blacklist.

The existing observer remains the only disposition path. Canonical matches, Writer fences, representation conflicts, protected rows and history retain their existing protections. No canonical record is written or deleted. A review, proposal or merged implementation is not an excluded record; count reductions only after independently observed disposition.
