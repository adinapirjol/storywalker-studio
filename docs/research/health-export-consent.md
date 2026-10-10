# Health export consent and research validation

PR #2 remediation, 10 October 2026. Fictional regression fixtures only.

## Three separate decisions

1. Stage: authenticate, decrypt and validate a delivery; save encrypted pending
   evidence. No summary or threshold event is exported by staging or redelivery.
2. Accept: save reviewed evidence and an acknowledgement for the phone. Acceptance
   is neither publication nor external-export consent. Delete/refuse removes local
   copies and prevents restoration by repeated deliveries.
3. Export: enable **reviewed-batch** export for the current Vault session, review
   an accepted batch, then explicitly choose **Export this reviewed summary to
   Logfire**. The request includes its revision and `consent: true`. The server
   selects surviving accepted evidence; client-supplied measurements are not used.
   Pending, deleted, fictional and stale-revision selections are rejected.

The exported allowlist is maximum BPM, counts, Watch/phone-health source category,
opaque summary ID and app-receipt range. These are sensitive health-derived data.
No raw observations, source/device identifiers, precise locations, notes or
listening history enter the packet. The route holds the existing native transaction
through export, so a queued delete cannot invalidate a snapshot halfway through
sending. Cancellation/expiry is checked before release and aborts active transport.
A request may already have reached the external service when cancellation occurs.
**Already delivered external events cannot be recalled by Stop, Delete or expiry.**

No outbox or automatic retry is introduced. Repeated exports of the same batch are
suppressed in-process (bounded to 2,000 IDs); after restart or eviction, a newly
consented export can duplicate an earlier external record. The deterministic
summary ID supports downstream deduplication. No exactly-once claim is made.

## Separate live research lane

Twenty-second live-window summaries are removed. The remaining threshold feed is
labelled **unreviewed live research telemetry**, off by default and separately
consented. Only fresh Watch previews reach it; historical deliveries never do.
It is not reviewed evidence or an accepted memory. Its own configurable rule and
awake/rest context still apply. Receiver Stop, deletion notices and expiry clear
pending candidates. A live feed enable does not authorize reviewed-batch export,
and reviewed-batch enable does not authorize live telemetry.

## Existing settings require reconfirmation

Legacy `summary-config.json` and `threshold-config.json` files remain unchanged
when read. A bare saved `enabled: true` does not authorize either new scope.
Explicit enable requests must identify `reviewed-batch-v2` or `unreviewed-live-v2`.
New saves carry version 2 and the corresponding scope. The enabling session's
access check is also held only in process memory. Restart, lock or absolute
session expiry makes the stored preference insufficient; the Author must enable
again. This is intentional reconfirmation, not a silent reinterpretation or data
migration. No real saved settings were changed during remediation.

## M1: research data quality, not clinical alarms

Heart-rate values must be finite and satisfy **0 < BPM <= 300**. This is a broad
engineering plausibility envelope for this research pipeline, not an assertion
that every value inside it is valid or safe, and not a clinical alarm threshold.
Values outside it reject the whole incoming packet without partial staging.
The original phone queue/file remains available; validation does not delete it.

`event_start` / `event_end` are source measurement times. `received_at` is receipt
by the collecting app, not Mac arrival or external export time. HealthKit queries
stamp app receipt when results arrive; direct Watch measurements preserve the
Watch timestamp and use phone receipt. Mac validation time is separate.

For HealthKit ingestion, end must not precede start. App receipt may precede
measurement end by at most **120 seconds**, accommodating bounded cross-device
clock skew. Measurement end and app receipt must not exceed Mac validation time
by more than 120 seconds. Exactly 120 seconds is permitted; 121 is rejected.
Arbitrarily old measurements with later receipt remain valid historical evidence.
A discrepancy beyond this allowance rejects the packet instead of correcting time
or inventing a trustworthy quarantine interpretation. Source timestamp strings,
including offsets, are preserved exactly in the validated transfer.

The 120-second allowance is an explicit research policy aligned with the existing
live freshness window, not a measured guarantee about device clocks. A future
quarantine workflow would need separate review. Fictional simulation time is
independent of wall time; simulated-only packets remain confined to that lane.
The server injects its validation clock into Python; the wire payload cannot set it.
Tests inject a fixed clock and exercise both sides of the allowance.

These checks apply to new ingestion, not a migration/revalidation of existing
Vault records. Existing encrypted evidence and original timestamps are untouched.

## Private target configuration (M4)

Set `STORYWALKER_HEALTH_PROJECT_URL` in ignored server configuration (for example
`.env.local`) before starting the Next server. Use an exact URL of the form
`https://logfire-eu.pydantic.dev/<workspace>/<project>`, without query, fragment,
credentials or extra path segments. The project must exactly match the existing
ignored credential; configuration never reads a target from that credential.
The OTLP ingestion host remains fixed to the EU service. Missing or malformed
configuration disables export; it does not change any saved consent file.

The target is pinned when the server module loads. Restart after changing it, then
explicitly enable the desired lane again; restarting clears the session-bound
consent. A saved enable for a different project cannot authorize the new target.
The UI displays its project link only from the authenticated status response.
No real configuration or credentials were edited during sanitization.

Fictional Dramaturg metrics use the separate server process environment variable
`DRAMATURG_TELEMETRY_PROJECT_URL` with the same URL restrictions, alongside their
existing explicit telemetry opt-ins. Restart that service after a target change.
The private validation subprocess inherits neither telemetry target nor opt-in.

Privacy audits discover `*.recovery.private.json` directly inside ignored
`private-data/storywalker/`, extracting the same evidence markers plus provenance
for both source and build checks. They also check both existing Logfire credential
locations. Discovery rejects symlinks, malformed inputs, more than 64 recovery
files, inputs over 16 MB each or 64 MB combined, and directory listings over 1,024
entries. Exceeding a bound stops the audit rather than silently omitting inputs.
Diagnostics never print marker values. `STORYWALKER_AUDIT_BUILD_ROOT` may point to
an isolated build while markers still come from the current local workspace.

This patch reduces current-source exposure. It does not erase public Git history,
forks, cached pages or earlier PR diffs, and does not migrate private input files.
