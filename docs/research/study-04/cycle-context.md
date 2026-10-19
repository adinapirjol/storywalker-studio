# Optional cycle context

The private HEALTH research journal accepts one optional dated calendar self-report:

- `date`: valid calendar date, YYYY-MM-DD.
- `day`: integer 1–366.
- `expectedLength`: optional integer 1–366. Unknown is omitted, never defaulted to 28.
- `included`: explicit boolean; the new form defaults to false.

The numeric bounds are input limits, not clinical reference ranges. Calendar values do not establish ovulation, hormone levels, phase, symptoms or causation. No automatic progression, correlation, prediction or hormonal interpretation is implemented.

The form appears in private HEALTH research. Save applies the checkbox and values together. Excluded values remain in the encrypted journal but are omitted from live analysis notes and new analysis snapshots. Included values add one clearly labelled note only when the reported date is within the displayed range. Sleep data, calculations and other findings stay unchanged. Prior snapshots retain their original context and are explicitly described as historical. Removing the current field does not erase historical snapshots. The existing delete-notes action clears history, hypothesis and cycle context together and pauses research; separate backups remain separate.

Storage reuses the encrypted `native:study04:journal` reference record, excluded from generic Vault retrieval. The authenticated same-origin route validates the strict schema before storage; direct storage calls validate again. Old journals without the optional property remain readable. Synthetic-mode journals reject personal cycle context. No automatic conversion of generic captures occurs.

Verification: journal and route tests exercise exclusion, date matching, invalid inputs, authorization, encryption, reopening, idempotence and unchanged sleep findings. Browser inspection confirms the form renders with inclusion unchecked. Independent external security review is required before merge under the repository review policy; no review or merge is claimed.
