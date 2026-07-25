# Public release checklist

Run this checklist before every public release.

## Source and provenance

- [ ] New fixtures were authored as fictional data, not lightly anonymized personal exports.
- [ ] No file was copied from a private export, build directory, token cache, or screenshot directory.
- [ ] All reusable source has clear provenance and can be published.
- [ ] The repository has no inherited Git objects or private commit history.

## Data and credentials

- [ ] No `.env` file or token cache is tracked.
- [ ] No `*.private.json` file or `private-data/` path is tracked.
- [ ] No absolute user path, personal email, real account identifier, or raw provider export is present.
- [ ] Screenshots show only Aurora Coast fictional data.
- [ ] Spotify credentials remain in Node-only modules and never use a `NEXT_PUBLIC_` variable.

## Product behavior

- [ ] Preview makes no persistent write.
- [ ] Seed is explicit.
- [ ] LifeEvents begin pending.
- [ ] Identical input produces identical proposal IDs and ordering.
- [ ] Author confirmation, rejection, date revision, and invalidation work.
- [ ] Public export omits private records and non-confirmed proposals.

## Quality gates

```bash
npm ci
npm run demo:aurora-coast
npm test
npm run typecheck
npm run lint
npm run build
npm run audit:public
```

- [ ] Application starts without personal files or provider credentials.
- [ ] README commands match the package scripts.
- [ ] Screenshot links and documentation links resolve.
- [ ] Final `git diff --cached` and `git ls-files` have been manually reviewed.

The audit script is intentionally focused. It reduces common release mistakes but cannot prove that prose or imagery is safe. Human editorial review remains required.
