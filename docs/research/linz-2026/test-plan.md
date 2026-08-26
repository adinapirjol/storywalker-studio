# Test plan and demo fallback

- Validate public adapters and selected source fields.
- Match temporal/spatial relationships deterministically, including offsets/timezone handling.
- Mark uncertain Google locations rather than triggering precision claims.
- Exercise street-name normalisation, historical rename candidates, failed and ambiguous joins.
- Assert raw private folders/fields are absent from public fixtures and production output; verify City GUIDs against the recorded release before travel.
- Assert Refuse persists; only explicit Accept/Revise produces authored state.
- Assert simulated location works without GPS; live location requires consent and reset clears session.
- Assert safe manifest has generalised labels and no coordinates/private content.

Run `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`, then `npm run audit:build-private` to inspect client output for raw export field names and Spotify share URL tokens. If the official data extract or internet fails, use the deterministic fixture, identify it as synthetic, and do not claim hackathon data integration is complete.
