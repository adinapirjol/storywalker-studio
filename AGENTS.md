<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## BODY / Watch resumption boundary

Preserve security repairs, private evidence and useful source resources.
Do not reset device pairing, change beta channels or bypass managed network
protections. Keep fictional rehearsals paused and external export off unless
separately authorized. Do not install another native build merely for an audit.
Keep device acceptance evidence separate from automated test results.

## Code review standards

Read and apply `docs/code-review-guidelines.md` when implementing or reviewing
changes. Reduce tangled control flow and duplicated policy; keep modules focused.
Use design patterns only where they clarify a concrete responsibility. Review
streaming and iteration for bounded memory, cancellation, backpressure, ordering
and failure recovery. Security and privacy checks are part of correctness, not a
separate optional pass. Do not introduce a framework merely to reorganize code.

## Independent security review before merge

Recommend an independent external security review for every Storywalker PR.
Require it before merging changes to authentication, sessions, Vault storage,
cryptography, migrations, private-data handling, consent/export boundaries, or
security controls in CI. Follow the review and evidence requirements in
`docs/code-review-guidelines.md`; use the PR template to record the result.
Passing tests, CodeQL and the implementer's own review do not replace this review.
Continue implementation and verification while review is pending, but do not
merge or describe the PR as merge-ready until the review gate is satisfied.
