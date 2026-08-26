# Privacy model

Storywalker Studio treats privacy as a data-flow rule, not a decorative label.

## Data classes

| Class | Stored in Git | Default browser use | Export behavior |
| --- | --- | --- | --- |
| Aurora Coast demo | Yes | Available after explicit seed | Filtered by selected privacy level |
| Local Author workspace | No | `localStorage` after seed | Explicit download only |
| Spotify token cache | No | Never | Never |
| Personal Spotify import | No | Not loaded automatically | Never unless a future Author action adds it |
| Research Lab fixtures and templates | Yes, fictional only | Available without seed | Never merged into journey export by default |
| Local selected experiment audio | No | Object URL in current browser session | Never |
| Live location | No | Current position only while opted in | Never |
| Linz raw Spotify/Timeline/private-memory inputs | No | Never | Never |
| Linz minimised trace derivative | No | Local adapter only after Author selection | Never by default |
| Encrypted Vault / private scenarios / editorial candidates | No | Local Vault only during an active browser-wide local session | No automatic export or promotion |

Aurora Coast is labelled **Fictional demonstration data** throughout the application and documentation.

## Privacy levels

- `public` — eligible for a public export after factual and proposal review.
- `friends-only` — excluded from a public export; eligible for a friends-only local export.
- `private` — available only in a complete local backup.

A music connection inherits no automatic permission from either side. Both the track and the LifeEvent must be allowed at the chosen export level.

## Author decisions

Source events begin pending. Temporal connections also begin pending. Confirmation makes a relationship eligible for export; rejection makes it non-canonical. Changing a time range can invalidate an earlier proposal, and the invalidated record remains in local audit history.

## What is never uploaded by default

- local workspace state;
- optional personal Spotify imports;
- the Spotify token cache;
- exported Markdown;
- Author decisions.

The application has no analytics, cloud persistence, or hosted authentication. A separately configured Director model can be called only after the Author selects source records and explicitly consents; its proposal is non-canonical, unsaved by default, and is not sent when no local model key is configured.

## Vault, Atlas, and Scenario Studio

The Vault passphrase is never stored in the browser. Unlocking creates a 15-minute, absolute local browser session: the browser receives an opaque HTTP-only, same-site cookie while the key is held only in the local server process. The session does not slide, can be explicitly locked, and is invalidated by a server restart.

Atlas is a private derived view of retained source data. Its evidence lanes and place readings are retrieval aids: overlap is not causality, a saved place is not evidence of a visit or commitment, and a Timeline window is not autobiographical truth.

Scenario Studio stores Author-written pathways, conditions, connections, and local record IDs. It is private and revisable; it does not rank paths, infer a preference, create a Journey or Episode, or publish material. Removing an evidence lane affects only its stable lane ID and preserves every other selected lane.

## Personal notebook and public voice

The personal notebook and Public Voice Studio are separate surfaces over the same local encrypted Vault. A public candidate contains text supplied by the Author, an intended export format, and opaque private evidence-record IDs. It does not copy private evidence content into an export and it is never published by Storywalker.

Spotify connection is scoped to read-only playlist and recent-listening access. The product may recommend up to four non-collaborative playlists owned by the connected account, but the person must confirm the final selection before import. A public clone has no embedded provider credential or hosted token store. Google Maps Timeline and ChatGPT history are treated as local exports until an independently reviewed connector can offer the same minimisation, revocation, deletion, and consent guarantees.

## Private recovery bundle

The recovery importer accepts a local ledger and companion review files only through explicit absolute paths. It performs no network request, geocoding, analytics, or model call. A dry run reports hashes, validation errors and warnings, candidate/Journey totals, merge outcomes, sensitivity totals, unresolved material, and the proposed ignored output path; it does not mutate the repository.

`--write-private` creates one ignored local staging document under `private-data/storywalker/`. The document contains real material only there, with mode `0600`. Re-import is stable by Moment ID. Existing Author decisions remain intact, and a source change becomes a private conflict containing both versions rather than a silent overwrite. Deleting that one local staging file removes the derivative; it never needs to be staged, committed, or pushed.

Claim evidence status is independent of editorial proposals: `author-stated`, `source-recorded`, `assistant-proposed`, `inferred`, `unknown`, and `contradicted` remain visible at claim and provenance level. Accepting evidence does not accept a proposal. Refusing interpretation keeps facts. Excluding a Moment leaves a private audit decision. Unresolved material blocks canonisation and recovery export; no private recovery Journey, Thread, or Episode becomes canonical automatically.

`npm run audit` rejects ignored-private paths, private bundle-named files, known raw-input paths, credentials, and Spotify share parameters in committable paths. If a local recovery staging document exists, the audit also derives private IDs, titles, Author statements, and source headings from that ignored file and fails if any appear in public files. `npm run audit:build-private` scans browser output to ensure raw-private markers and ignored Vault paths are absent.

## Research experiments

Research Lab commits only fictional Aurora Coast experiment material, CTM call facts, and blank templates. Personal research entries, local audio, real coordinates, personal playlist imports, and personal Author decisions belong in ignored `private-data/` files.

Local audio uses a browser object URL only after a user selects a file. The object URL is revoked on replacement and page cleanup; audio bytes are never uploaded or written to `localStorage`.

Live location is optional and gated by an explicit acknowledgement and button. The browser keeps no coordinate history, does not persist coordinates, and clears its `watchPosition` watcher on pause, exit, and unmount. If reported GPS accuracy is wider than half of a zone radius, the experiment shows uncertainty rather than a claimed precise trigger.

## Linz private-import boundary

Raw Spotify exports go under `private-spotify-raw/`; raw Google Timeline exports go under `private-google-timeline-raw/`; curated memories and derivatives have their own ignored directories. `npm run private:import -- spotify|timeline --input /absolute/path/to/export.json --dry-run` inspects a small selected file first. Without `--dry-run`, it writes mode `0600` minimised derivatives only under ignored `private-data/minimised/`.

The Spotify minimiser removes IP address, username, user agent, device and unnecessary location fields. The Timeline minimiser reports the encountered schema, separates visits and routes, retains reported accuracy where available, labels visits as platform-inferred, and leaves `authorCorrected` false until the Author changes it. No importer creates autobiographical truth or sends raw data to an AI service.

## De-identification limitations

Changing names or dates alone does not reliably de-identify a personal history. Aurora Coast therefore changes route, countries, order, roles, relationships, people, timing, and factual structure; it also merges and splits emotional motifs. Even so, fictionalization is a creative and editorial judgment, not a mathematical privacy guarantee.

Future contributors should not use the committed demo as a place to “anonymize” real notes. New public fixtures should be authored as synthetic data from the start.
