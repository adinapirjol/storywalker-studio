# Listening Again validation

13 October 2026. Local implementation evidence, not Author research findings or release approval.

## Scope

Changed the existing refusal study, editorial state model, research notebook save identity, Vault research-save branch, research overview and CTM notebook documents. No new application framework, connector, device installation or data import. Existing WORLD/TIME/MEMORY/BODY architecture remains the foundation.

The public fixture has separate encounter and playlist evidence, unknown selection context, a fixed Codex-written stimulus and four editorial states. History retains dated wording and disagreement. The existing Vault record writer now receives stable per-snapshot IDs: repeated delivery returns the original saved timestamp; different content under that ID is rejected. New readings use new IDs. IDs live in the page session, so this is retry safety within that session, not cross-browser content deduplication. Saved snapshots can be loaded for comparison but do not automatically restore the interactive scene.

## Verification

- Focused study, notebook, ingestion, private-review and access tests: 26 passed across six files.
- Full suite: 407 passed across 90 files with `npm test -- --maxWorkers=1 --testTimeout=20000`. The first concurrent run had one Vault-recovery timeout and a subsequent assertion failure; the rerun passed without changing recovery code. No claim that the default-timeout run passed.
- Added isolated Vault check verifies unchanged accepted factual evidence, encrypted persistence, duplicate delivery after reopen, collision refusal, distinct revised snapshots and reread. It uses temporary fictional storage, never the personal Vault. Passed after the full-suite run.
- Lint passed; diff whitespace check passed.
- Final public repository audit passed (478 visible files); client/prerender privacy audit passed (109 artifacts). The final implementation files match the isolated build inputs byte for byte.
- Browser on local `/research/refusal`: Enter operated Accept, Revise, Refuse and Leave unresolved; source details exposed the absent play and unknown context; earlier readings remained. Play/Pause/Resume/Stop and keyboard volume adjustment were exercised. Decision changes left audio stopped. This verifies controls/status, not perceived comfort or stereo localisation.
- Reduced-motion preference is supported by the existing global stylesheet. The added diagram is static; no motion is necessary to understand states. Screen-reader usability and a full access evaluation remain untested.
- Personal notebook and institutional templates are ignored; file permissions set to 600. No real record selected and no real Vault unlocked.

The default workspace type check encounters pre-existing ignored scratch scripts with stale imports. Public source was copied to a temporary directory, excluding private data and scratch files, with local dependencies. Type checking passed there. The default Turbopack production build succeeded there; the alternative Webpack attempt failed in existing server `createRequire` resolution. Build uses the retained public snapshot and does not run connector refresh.

Turbopack reports existing dynamic-filesystem tracing warnings in the Vault module. Client/prerender audit does not certify server deployment packaging; no deployment is authorised. Independent security review of the snapshot-persistence change remains required before merge. No review result or reviewed SHA is invented for uncommitted work.

## Not completed or claimed

No recorded demonstration video, actual Author reflection, later-date revisit, participant recruitment, community outcomes, clinical efficacy, private performance/Spotify match, CNDR event logistics or eligibility determination. No publication, submission, contact, staging, commit, push or deployment.

Unrelated CI/workflow and quality-document changes appeared in the shared checkout during this task; they are outside this study and were left untouched.
