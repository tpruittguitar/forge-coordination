# Saved job-alert capture

The existing mail pipeline calls `alert-recovery.cjs` on full saved messages before processing their mail disposition. `alert-formats.cjs` adds deterministic layouts observed in the private source captures:

- Indeed plain-text cards: exact title, `Company - Location`, and the card's job link. A saved `jk` becomes the canonical Indeed view-job URL.
- Glassdoor HTML listing cards: company span and separate title/location paragraphs bound to the listing anchor. The job-match variant requires exact HTML paragraph identities and the saved plain MIME listing-ID link.
- BuildSubmarines HTML cards: title anchor, company/location pair, and an explicit same-provider `redirect_url`. The code does not follow personalized tracking links.
- Ladders HTML cards: title, optional separate salary anchor, and the `jobs-company-container` company/location fields. Opaque redirect links remain unknown posting URLs.

Capture is not canonical intake. Exact provider identifiers are retained only when present in the saved source; card pay remains unverified source text and is never promoted to employer base pay. Saved snippets remain card evidence, not complete job descriptions. Existing dispositions and pagination/historical gaps stay intact.

The existing private AI-review repair route uses the same capture contract. Each proposed card must still quote its exact original full source and bind every identity field and original URL. One malformed card cannot discard valid siblings. Only recognized public posting shapes receive public URLs; opaque personalized redirects stay private and create source-recovery obligations. Review hashes and source hashes are retained, while full quotes, private addresses and redirect tokens are never copied into the public ledger.

Opaque-link cards retain their known identity under a source-bound `alert-card:` key, with a null posting URL and job ID. Their discovery review binds the exact source/card and declares the missing `SOURCE_URL`. The normal upstream inventory and intake-drain sync route these items to the existing `FORGE_INTAKE_SOURCE_RECOVERY` task; there is no new schedule or manual relay. Original uncertain Writer fences and actual identity conflicts take precedence.

Incomplete or conflicting cards remain source-accounting obligations while unrelated exact cards are captured. A card's company/location scan stops before the next title even when CSS is missing; neighboring cards cannot supply missing identity fields. Unsupported layouts retain `ALERT_FORMAT_RESEARCH_REQUIRED`; malformed visible cards retain `ALERT_CARD_SOURCE_RESEARCH_REQUIRED`. No message or source window is complete merely because its visible cards were captured. A source is only dispositioned by the established independent intake outcomes.

Regression fixtures reproduce the observed markup structure using public/synthetic job facts without personal addresses, recipient details or tracking tokens. Read-only shadow extraction against saved messages checks occurrence/provider-identity counts; those figures are neither new jobs nor canonical effects.
