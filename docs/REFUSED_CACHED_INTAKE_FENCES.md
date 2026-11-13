# Refused request cache projection

A proved pre-write refusal releases the original plan, queue and consumption
entries. An older intake-drain cache can still retain the original fence; later
preparation previously copied that cache back into the plan, which then retained
its own fence indefinitely.

Preparation now filters refused request IDs from drain-cache and prior-plan
fences only when an immutable structured NOT_ACCEPTED receipt binds to the same
request's checkpoint and acceptance, payload/response hashes, record count and
known retryable BEFORE_MUTATION refusal. The current key must occur in the bound
checkpoint. The original request remains non-replayable. Missing, malformed,
legacy, differently bound or unknown evidence remains fenced. Mixed fences keep
all independent request IDs. Empty or structurally unknown fences are retained.

This does not release active queue/consumption submissions, write to the master,
change screening, or claim canonical completion. A later normal preparation can
make the proved-refused work eligible for fresh screening and a new request.
