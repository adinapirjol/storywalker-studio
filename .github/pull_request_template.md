## Change

Describe the problem and resulting behavior.

## Validation

List checks run, results and any unverified behavior. Keep physical-device
acceptance separate from fictional or automated tests.

## Independent security review

Follow [the project review policy](../docs/code-review-guidelines.md#independent-security-review-before-merge).
External review is recommended for every PR and required for security-sensitive
changes. Complete these fields before merge; pending review is valid while the PR
is under development.

- Security-sensitive scope (or rationale for no required review):
- Independent reviewer and review link/sanitized report:
- Reviewed commit SHA and any final recheck:
- Findings, fixes/regression tests, and explicit Author acceptance of any remaining findings:
- Reviewer limitations and remaining manual checks:

## Merge checks

- [ ] Required independent review is complete and applies to the proposed head; otherwise explain why review is not required and why it was skipped.
- [ ] Findings are resolved or explicitly accepted by the Author with follow-up recorded.
- [ ] Required CI checks pass on the proposed head and privacy checks are complete.
- [ ] The Author has authorized merging.
