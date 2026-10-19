# Optional Spotify import

Spotify import is not part of the default application experience. Aurora Coast works fully offline and requires no Spotify account. The local Vault can optionally run a one-time, read-only browser consent flow.

Provider credentials, authorization codes, access tokens, and refresh tokens stay in Node-only server or CLI boundaries; they never enter the browser bundle. The Vault browser card uses an explicit provider-consent redirect and encrypts only the confirmed local selection.

## Configure a developer application

1. Create an application in the Spotify developer dashboard.
2. Add the exact local redirect URI from `.env.example` to the application settings.
3. Copy `.env.example` to `.env.local`.
4. Fill in the values locally:

```dotenv
SPOTIFY_CLIENT_ID=
SPOTIFY_CLIENT_SECRET=
SPOTIFY_REDIRECT_URI=http://127.0.0.1:3001/api/connectors/spotify/callback
```

Do not prefix these variables with `NEXT_PUBLIC_`.

Start Storywalker and open `/vault`. Unlock the local Vault first. The **Spotify · consented account import** card opens the provider consent page, recommends up to four owned non-collaborative playlists using recent-play overlap, and waits for confirmation before encrypting playlist snapshots. The Vault session is local, browser-wide, explicitly lockable, and expires after 15 minutes.

For the optional command-line authorizer instead, register a second redirect URI such as `http://127.0.0.1:43821/callback`, temporarily set `SPOTIFY_REDIRECT_URI` to that value, then run:

```bash
npm run spotify:authorize
```

Open the printed Spotify authorization URL. The local callback stores a token in `.spotify-token.local.json` with restrictive file permissions.

## Scopes

The authorization request uses:

- `playlist-read-private`
- `playlist-read-collaborative`
- `user-read-recently-played`

The importer reads playlist item metadata and addition timestamps. The account scan uses up to fifty recently played tracks only to rank the starting set; that scan is not stored. Spotify’s Web API does not provide a complete lifetime listening history through this workflow, so the tool does not claim to import one. Use the selected local Extended Streaming History export for that richer source.

## Import a playlist locally

```bash
npm run spotify:import -- --playlist YOUR_PLAYLIST_ID
```

The output is written beneath:

```text
private-data/spotify/<derived-id>.private.json
```

Both the directory and `*.private.json` files are ignored. The importer writes a versioned private snapshot and a private delta summary. The snapshot retains every playlist occurrence in raw Spotify source position, including duplicate track IDs; it also records a separate timestamp-sorted position view. It does not infer chronology, chapters, causality, or meaning from playlist order.

Rows with a missing addition timestamp or unavailable Spotify item are retained and reported as diagnostics rather than silently dropped. The command prints actual previous and current occurrence counts after a successful authenticated import. The files contain private playlist metadata and must not be moved into `examples/`.

## Build a local period delta

`npm run private:month-delta` previews source coverage for 18 September through 18 October 2026 in `Europe/Bucharest`. It uses source event timestamps and reports missing or undated sources separately. The output is a local, noncanonical staging derivative; it does not imply an encrypted Vault import. Add `--write-private` to save it under `private-data/deltas/`. The command refuses to replace an existing window unless `--replace` is also supplied.

The delta includes dated records from already minimised Google Timeline, Calendar, YouTube, Last.fm, Spotify Extended Streaming History, and the latest available snapshot of each Spotify playlist. It preserves duplicate playlist occurrences and labels playlist identity. Playlist additions are collection changes, not listening events; the delta is not a historical-removals report. Google Maps saved-place labels have no event time and are reported as undated. Google Drive search does not copy exports into the local workspace; prepare a user-selected Takeout folder with `npm run private:prepare-takeout -- /absolute/path/to/Takeout` before generating the delta.

## Last.fm recent scrobbles

The optional `lastfm:import` command calls the public `user.getRecentTracks` API with a local `LASTFM_API_KEY` and an explicitly configured `LASTFM_USERNAME` in `.env.local`. Copy both variable names from `.env.example`; enter your own values locally. It requests a bounded time window (`--from` and `--to` accept ISO dates or date-times), validates pagination and response size, excludes the current-playback row, merges new scrobbles with prior staged history, and writes only a minimized local derivative. It does not unlock or write the Vault. Missing username, invalid pagination, excess pages, or oversized responses stop the import without replacing the existing file. See the [Last.fm API method documentation](https://www.last.fm/api/show/user.getRecentTracks) for its required username, UTC range timestamps, and pagination limits.

## Delete local imported data

Delete the specific ignored file under `private-data/spotify/`. Delete `.spotify-token.local.json` to remove local authorization material. Revoking the application in Spotify account settings invalidates the authorization at the provider.

Review paths carefully before deletion; the repository never deletes private input automatically.

## Privacy boundary

- token exchange and refresh happen in Node.js;
- the browser imports none of the Spotify server modules;
- CI needs no Spotify variables;
- raw or transformed personal imports are never committed by default;
- importing personal data is optional and separate from the fictional demo.
