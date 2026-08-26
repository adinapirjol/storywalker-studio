# Orientation infrastructure release

This release adds a local-first path for moving from private evidence to orientation without treating either as autobiography or publication.

## Included

- **Vault** — an encrypted local SQLite store for explicit, consented imports and private captures. The browser retains no passphrase. A process-local encryption key is referenced by an opaque, HTTP-only, same-site browser cookie that expires after 15 minutes or an explicit lock.
- **Atlas Now** — a private derived view of import changes, source-layer overlaps, and bounded time/place readings. It uses explainable keyword and time cues; it does not infer causality, a visit, a route, a feeling, or a single narrative.
- **Scenario Studio** — a private, revisable constellation of possible pathways and explicit connections. Every Atlas lane has a stable ID and can be linked or removed independently. No pathway is ranked, predicted, or promoted.

## Deliberate boundaries

- Local Vault contents, source imports, passphrases, and generated encrypted files are ignored by Git and excluded from browser-build checks.
- Scenario Studio references evidence by local record ID. It does not duplicate source content into a public document.
- Editorial drafts and captures remain pending evidence. None becomes an Episode, Journey, public draft, or canonical claim without a separate Author action.
- Aurora Coast remains the only committed narrative demo and is wholly fictional.

## Verification

Run the full release check from a clean install:

```bash
npm ci
npm run demo:aurora-coast
npm test
npm run typecheck
npm run lint
npm run build
npm run audit:public
npm run audit:build-private
```

The public audit is a backstop, not proof of de-identification. Review every staged file before publishing.
