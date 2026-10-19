# Private automatic updates

Open `/vault/sync` locally. Preferences default off and are encrypted. The Author
selects existing Spotify sources, Last.fm staging and saved Watch resumption.
Automatic local imports support up to 20 previously imported Spotify playlists.
Saving choices exports the selected Spotify lookup identifiers to the owner-only,
ignored `private-data/spotify/selected.private.json`. The daily music collector
refreshes only these identities, rechecking selection before each request. An empty
or invalid manifest stops Spotify collection. Deselecting a playlist stops future
collection; earlier encrypted evidence remains. No credentials or Vault keys are
exported. A missing local snapshot is reported as unavailable until collection succeeds.
Both passphrase and passkey unlock run the same guarded import coordinator. While
a Storywalker page is visible, a minute check imports later staged updates without
unlocking or extending the session. No account request runs inside that check.

Watch resumption only uses an existing, non-revoked HealthKit pairing. It preserves
acceptance settings and export state. An address mismatch is a recoverable failure,
not permission to create a pairing. Stop pauses the current receiver; turn off
automatic resumption to prevent starting it at the next unlock.

For a network move, BODY offers **Update saved pairing for this address**. This
explicit repair retains the pairing identity, token, queue ownership and acceptance
settings, saves an encrypted prior configuration, and replaces the address-bound
TLS certificate. Download the updated pairing and import it on the iPhone before
starting automatic delivery again. It never resets collected evidence or enables
external export. Automatic unlock alone does not perform this repair.

## Calendar selection and collection

The private review catalog is `private-data/calendar/candidates.private.json`.
Title keyword rules suggest travel, learning and cultural plans; recurring,
cancelled and declined entries are separate. Suggestions do not select events.
The Author can accept a reviewed group or choose individual rows.

Saving choices also exports only selected event lookup identities to the ignored,
owner-only `private-data/calendar/selected.private.json`. This permits a scheduled
collector to refresh those exact events while the Vault is locked, without a saved
Vault key. Saving first empties that manifest so a failed export stops collection.
The manifest and staging are private local plaintext, not encrypted ingestion.

The scheduled collector uses the existing Google Calendar connector's single-event
fetch with the manifest's calendarId and eventId. It must not search for or enroll
new events. Keep only the fields in `calendarEventSchema`; discard descriptions,
attendees, attachments, links and locations. Preserve all-day/floating start and
end strings without inventing timezones. Explicit cancellation is a status update;
an unavailable event is a gap, never evidence of cancellation or attendance.

Pass `{events: [...], unavailable: [selected keys...]}` as JSON on stdin to
`node --import tsx scripts/calendar-stage.ts`. The script rejects out-of-scope or
older updates, locks collection, backs up the catalog, preserves unselected review
rows and writes a count-only receipt. Do not remove a pre-existing lock to force a
run. Before each fetch recheck that its identity remains selected; the script
checks the manifest again before replacing staging. A failed fetch preserves the
last known event. No event is created, edited or deleted in Google Calendar.

Encrypted selected events use source `google-calendar-selected`, evidence
`planned-activity`, and attendance `unknown`. Removing a selection stops future
refresh; it does not erase existing evidence. Earlier changed records are retained
as encrypted backups excluded from Atlas and retrieval. No canonical journey,
health interpretation or research source choice is changed by collection.

## Verification boundary

Synthetic tests verify merge/deduplication, encryption, preservation, scope,
disabled defaults and safe stage reads. A listening socket is not evidence of a
phone delivery. A scheduled task is not proof of a completed scheduled run.
Independent security review remains required before merging these changes.
