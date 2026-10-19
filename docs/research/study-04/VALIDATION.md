# Study 04 validation — 13 October 2026

## Verified

- Full JavaScript suite: **419 tests, 91 files passed**.
- Study-specific suite: **12 tests passed**, including XML and compressed ZIP,
  cancellation, malformed XML/ZIP, duplicate archive members, external entities,
  exact duplicates, separate sources, overlapping stages, midnight, DST/offset
  changes, noon splits, contradictory awake/asleep records, naps, missing nights,
  minimum baseline/trend coverage, sustained-change gaps, selected report fields
  and date exclusion, ignored exports, and deployment-manifest privacy regression.
- Lint passed. TypeScript passed in the final production build.
- Production Turbopack build passed using
  `STORYWALKER_REVIEW_BUILD=1 node node_modules/next/dist/bin/next build`.
- Public-repository privacy audit passed (490 visible files at check time).
- Production artifact privacy audit passed: **116 public client/prerender files**
  and **44 deployment trace manifests**; no private input references.
- Dependency installation audit: no known vulnerabilities reported by npm.
- Browser verification, entirely fictional: preview → explicit source selection →
  session save → timeline → retrospective diary → reference review → comparison →
  selected clinician report preview. Reference: 8 h median, 14/14 reviewed windows;
  comparison: 6 h median, 12/14 reviewed windows. Missing nights stay unknown.
- Production browser verification: changing report dates removed the download
  button until another preview; Hide removed the timeline from visible/accessible
  content. A synthetic-only screenshot is `synthetic-preview.jpg`.
- Loopback production preview started at `http://127.0.0.1:3002/research/health`.
  This URL requires that local process to remain running. Normal development
  instructions remain in README.md.

## Privacy issue found and repaired

Existing dynamic Vault filesystem access caused **590 private-data references**
in server deployment manifests before exclusion. Added global output tracing
exclusions and an audit that fails on private references without printing their
paths or contents. The verified final manifests have zero private references.
The existing two Turbopack dynamic-filesystem warnings remain; exclusions and the
artifact audit are the enforcement, not absence of compiler warnings.

Ignored private scratch TypeScript had previously entered the compiler. Excluded
`private-data` and `tmp` from normal typecheck/build inclusion. A concurrent dev
restart left a malformed generated route type file; regenerated route types were
used to repair that disposable artifact before the successful production build.
No private scratch sources or personal Vault/device state were changed.

## Limits of this evidence

No personal Health export was imported, no real diary was entered, and no native
Watch/device acceptance was performed. Browser file selection for a real export,
large device exports near the size limits, mobile screen readers and manual
bout correction remain unverified/unimplemented as described in README.md.
XML/ZIP parsing was tested with synthetic File objects; synthetic preview and
report interactions were exercised in the browser. The report download control
was verified but no real clinician report was exported or sent.

The prebuild Are.na refresh could not verify its external channels; its fallback
was reported, and the final direct Next build used the available snapshot. This
is unrelated to HEALTH, which makes no external requests for data processing.

No independent security review was obtained. This is required before merge for
private-data handling, consent/export and security-control changes. Nothing was
committed, pushed, merged or deployed externally. Existing unrelated research,
Vault route and CTM edits were preserved.

## Changed files belonging to this task

- `app/research/health/page.tsx`
- `components/health/observatory.tsx`
- `components/health/import-panel.tsx`
- `components/health/diary.tsx`
- `components/health/study.css`
- `lib/health/model.ts`
- `lib/health/apple-import.ts`
- `lib/health/analysis.ts`
- `lib/health/fixture.ts`
- `lib/health/report.ts`
- `lib/health/health.test.ts`
- `components/vault/private-vault.tsx` (link to HEALTH only)
- `docs/research/study-04/README.md`
- `docs/research/study-04/VALIDATION.md`
- `docs/research/study-04/synthetic-preview.jpg`
- `.gitignore`
- `next.config.ts`
- `tsconfig.json`
- `scripts/audit-build-private.mjs`
- `package.json` and `package-lock.json` (`saxes` / `fflate`)
