# Listening evidence audit

13 October 2026. Source contracts inspected, without reading personal raw histories or unlocking the Vault. Availability below means supported by the repository, not proof that a particular private record is imported or currently retained.

| Source and implementation | Recorded observation | Limits and selection context |
|---|---|---|
| Extended Streaming History; `lib/evidence/private-ingest.ts`, `minimiseSpotifyHistory` | Normalized end timestamp, duration, supplied track URI/name/artist/album, optional skipped/offline flags; importer provenance | Missing duration becomes zero; timezone may lack original offset. Current minimiser omits `reason_start`/`reason_end` and shuffle fields. Unknown selection context must remain unknown. Repetition cannot identify autoplay or intention. |
| Playlist snapshot; `lib/music/spotify-server.ts`, `docs/spotify-import.md` | Snapshot/import time, each occurrence, source order and available addition timestamps; duplicates retained | Addition time is not play time. Missing/unavailable items remain diagnostics. Neither presence nor playlist title proves emotional importance. |
| Spotify API recent-play scan; `lib/music/spotify-selection.ts` | Up to fifty recent items/context identifiers help rank candidate playlists | Scan is not persisted by this flow and is not lifetime history. Playlist context can support a platform container, not deliberate choice. Recommendation ranking is system behaviour, not Author meaning. |
| Last.fm; `lib/music/lastfm-server.ts`, `minimiseLastFmHistory` | Timestamped scrobbles, track and artist; duplicate matching rows and now-playing entries removed | Coverage depends on scrobbling and selected window. Does not independently verify attention, live attendance, motive or source service. |
| Author recollection; private Author review and research notebook | A dated Author statement, separately attributable from platform records | Retrospective meaning is legitimate but is not machine-recorded playback. Preserve uncertainty and revisions. |

## Six separate layers

1. Recorded observation with source identifier, source kind and time semantics.
2. Selection context with supporting evidence, or explicitly unknown.
3. Machine-proposed interpretation with origin/model/version when actually generated; this study instead uses a labelled Codex-written fixed stimulus.
4. Author-confirmed meaning with review timestamp and exact wording.
5. Author revision/refusal retained as another reading, not deletion of source facts.
6. Unresolved uncertainty including absent platform evidence and unmatched performances.

The fixture supplies no real listening event. It deliberately contrasts an invented encounter account with an invented playlist occurrence. No diagnosis, mood or trauma is inferred from playback, repetition, or BODY measurements. Rights to metadata never establish rights to the recording. Public capture uses generated oscillator tones only.

For any private comparison, inspect exact source/record IDs locally after Author selection, confirm the recording identity independently, and keep that ledger ignored. No private encounter record, cover identity, platform match or current encrypted import is asserted by this audit.
