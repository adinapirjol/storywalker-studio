# GitHub quality gates

The default branch requires a pull request, resolved review conversations, and
the GitHub Actions `quality` check against an up-to-date base branch. There are
no ruleset bypass actors. No independent approving reviewer is required for this
single-maintainer repository; this does not remove the PR or check requirements.
Deletion and force pushes to the default branch are blocked.

Only squash merges are enabled. GitHub automatically deletes merged feature
branches. Local branches still need local cleanup.

## Coverage

The required `quality` job enforces a minimum of 50% line coverage separately for
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
Swift using the default query suite on PRs, pushes to main, and a weekly schedule.
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
