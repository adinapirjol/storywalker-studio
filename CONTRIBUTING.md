# Contributing

Thanks for helping make uncertain personal archives more legible without inventing certainty.

1. Fork the repository and create a focused branch.
2. Keep fixtures synthetic. Never submit personal exports, tokens, real account IDs, or lightly anonymized private notes.
3. Preserve deterministic behavior and explicit Author decisions.
4. Run:

```bash
npm test
npm run typecheck
npm run lint
npm run build
npm run audit:public
```

Pull requests should explain the user-facing change, privacy impact, and any schema or deterministic-output change. Visual changes should include a public-safe screenshot.
