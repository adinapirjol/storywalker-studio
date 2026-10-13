# GitHub quality gates

The default branch requires a pull request, resolved review conversations, and
the GitHub Actions `quality` check against an up-to-date base branch. All four
`Analyze (<language>)` CodeQL jobs are also required. Each reports either a real
analysis or an explicit not-applicable result from the change selector; a failed
selector fails the required jobs. The aggregate CodeQL check alone is insufficient. There are
no ruleset bypass actors. No independent approving reviewer is required for this
single-maintainer repository; this does not remove the PR or check requirements.
Deletion and force pushes to the default branch are blocked.

Only squash merges are enabled. GitHub automatically deletes merged feature
branches. Local branches still need local cleanup.

## Coverage

For code changes and full runs, the required `quality` job enforces a minimum of 50% line coverage separately for
JavaScript/TypeScript and Python. A failing test or coverage threshold fails the
job. The initial CI baselines are 53.06% and 89.50%, respectively (Python 3.13).
The local Python runtime measured 88.51%; coverage line counts can vary by runtime.

- `npm run test:coverage` measures application code in `app`, `components`, and
  `lib`, including untested files. Tests, declarations, and generated type-only
  contracts are excluded. V8 coverage uses two workers to bound memory use.
- Python uses `pytest-cov --cov=dramaturg --cov-fail-under=50`. Run from
  `research/rehearsal-dramaturg` with `COVERAGE_FILE=../../coverage/.coverage` and
  `--cov-report=xml:../../coverage/python.xml` to keep output ignored.
- CI retains Cobertura reports for both languages and the JavaScript JSON summary
  in a `coverage-<commit>` artifact for 14 days. These contain source paths and
  coverage counts, not fixture contents. Tests use fictional local inputs.
- JavaScript reports have their own subdirectory so Vitest cleanup cannot remove
  the Python report. No coverage output is committed.

GitHub's native Code Quality service is unavailable for this repository. Its
native coverage and Code Quality rules are therefore replaced by this executable
CI gate. There is no native coverage dashboard or coverage-drop comparison, and
Swift coverage is not measured by this job. Do not claim those checks are present.

## Security analysis

The CodeQL workflow scans GitHub Actions, JavaScript/TypeScript, Python, and
Swift using the default query suite. PRs select affected languages as described
below; main pushes, weekly schedules and manual runs analyze all four languages.
The branch rules require CodeQL results and
block errors and high-or-higher security findings. CodeQL is separate from code
coverage and from the `quality` job's privacy audits.

Swift uses an explicit simulator scheme build with signing disabled, followed by
the fictional package tests. A build failure fails the job. Default setup's
autobuild returned a green result despite a failed iPhone target build and only
17 of 23 Swift files scanned, so a green badge alone was insufficient. The scheme
build resolves the local CollectorCore package and includes the embedded Watch
app; no app is installed or device data accessed. Default setup is disabled to
avoid conflicting uploads from two configurations.

Before changing the rules or query configuration, verify each analysis and its
source-file coverage. Do not bypass a failed scan to merge.

The `quality` job also runs the fictional demo, typecheck, lint, production build,
public-repository audit, and generated-browser-bundle privacy audit. Repository
administrators should keep the required check name synchronized with the workflow.


## Change selection

Required workflow/check names stay in place. Neither workflow uses top-level path
filters: [GitHub documents](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks)
that filtering out a required workflow can leave its checks pending. Unaffected
CodeQL lanes instead finish a small Ubuntu job that explicitly reports no analysis
was performed. Swift uses a macOS runner only when selected. No empty SARIF report,
cached scan or old result is presented as a fresh analysis.

`scripts/ci-scope.mjs` compares the full PR head against its merge base using the
PR event's base/head SHAs and full Git history. Both sides of renames/deletions
count. A docs commit on top of code changes does not erase the code's requirements.
Unknown paths, unavailable history, malformed events and empty/uncertain diffs
select all checks. Workflow and selector changes also select all lanes.

| Changes anywhere in the PR | Required work |
| --- | --- |
| Only root README/AGENTS, PR template or Markdown under docs | Selector tests, repository privacy audit and Actions CodeQL |
| Web/Vault JS or TS, CSS or Node dependency/config files | Full quality job and JS/TS CodeQL; Actions CodeQL remains on |
| Python source or Dramaturg project dependencies | Full quality job and Python CodeQL; Actions remains on |
| Native project source, package, Xcode configuration or assets | Full quality job and Swift CodeQL including simulator build/package tests; Actions remains on |
| Cross-language schemas, native/context/health/BODY bridge code, workflow/selector changes or unclassified files | All checks |
| Main pushes, manual runs and scheduled CodeQL runs | All checks for that workflow |

Selections accumulate for mixed PRs, including tooling in another language inside
a project. The full quality job retains both JS and Python tests/coverage because
JS integration tests use the Python validator. Coverage thresholds are not lowered.
Only the narrow documentation-only path omits installs, coverage, builds and the
built-output audit; the source privacy audit still runs. Docs images, examples and
unknown file types are conservatively treated as requiring full checks.

The CodeQL tool/alert ruleset and all required status contexts remain unchanged.
Before merging this CI change, independently review the selector and workflow
failure behavior, then validate a docs-only PR, web-only PR, shared-contract PR,
selector failure and full scan against GitHub's live ruleset. In particular verify
that the separate code-scanning rule accepts correctly marked unaffected lanes;
do not remove that rule to make a test pass. Local classifier/workflow tests alone
cannot establish GitHub-hosted merge behavior. This change itself selects all lanes.
