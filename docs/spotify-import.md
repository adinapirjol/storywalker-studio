# Optional Spotify import

Spotify import is not part of the default application experience. Aurora Coast works fully offline and requires no Spotify account.

The importer is a Node.js CLI boundary. Credentials, authorization codes, access tokens, and refresh tokens never enter the browser application.

## Configure a developer application

1. Create an application in the Spotify developer dashboard.
2. Add the exact local redirect URI from `.env.example` to the application settings.
3. Copy `.env.example` to `.env.local`.
4. Fill in the values locally:

```dotenv
SPOTIFY_CLIENT_ID=
SPOTIFY_CLIENT_SECRET=
SPOTIFY_REDIRECT_URI=http://127.0.0.1:43821/callback
```

Do not prefix these variables with `NEXT_PUBLIC_`.

Load the local file into your shell using a method appropriate to your environment, then run:

```bash
npm run spotify:authorize
```

Open the printed Spotify authorization URL. The local callback stores a token in `.spotify-token.local.json` with restrictive file permissions.

## Scopes

The authorization request uses:

- `playlist-read-private`
- `playlist-read-collaborative`

The importer reads playlist item metadata and addition timestamps. Spotify’s Web API does not provide a complete lifetime listening history through this workflow, so the tool does not claim to import one.

## Import a playlist locally

```bash
npm run spotify:import -- --playlist YOUR_PLAYLIST_ID
```

The output is written beneath:

```text
private-data/spotify/<derived-id>.private.json
```

Both the directory and `*.private.json` files are ignored. The file contains private playlist metadata and must not be moved into `examples/`.

## Delete local imported data

Delete the specific ignored file under `private-data/spotify/`. Delete `.spotify-token.local.json` to remove local authorization material. Revoking the application in Spotify account settings invalidates the authorization at the provider.

Review paths carefully before deletion; the repository never deletes private input automatically.

## Privacy boundary

- token exchange and refresh happen in Node.js;
- the browser imports none of the Spotify server modules;
- CI needs no Spotify variables;
- raw or transformed personal imports are never committed by default;
- importing personal data is optional and separate from the fictional demo.
