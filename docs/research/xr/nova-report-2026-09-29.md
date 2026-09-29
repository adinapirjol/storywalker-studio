# NOVA report — XR preparation, 29 September 2026

**Status: a working browser installation prototype, ready for a bounded rehearsal.** The accumulated increment brings geographic evidence, chronological episode spaces, Author recomposition and sound selection into one local workflow. It is not yet a finished installation or a full public demonstration of the private scene.

This report is safe for the public repository: no private source records, account names, exact locations, personal screenshots or composition notes are included. It records software and method, not a new verification of every private Vault record.

## What we planned

Develop a room-scale audiovisual artwork from selected personal traces while retaining the distinction between evidence, interpretation and authorship. Establish deterministic time × place × listening alignment before introducing models. Give the Author meaningful Accept, Reconsider, Refuse and reposition actions. Geography establishes a baseline; it must not dictate the whole artwork. Sound is authored material, not recovered emotion.

## What is implemented

| Area | Current behaviour | Boundary |
| --- | --- | --- |
| Journey and provenance | Timestamped geographic source windows; Timeline, Author, Calendar, Notion and listening evidence remain independently attributable. Chronological episode containers gather source windows for presentation. | Contextual location text does not become physical geography. Grouping is a deterministic presentation proposal, not a claim about a lived chapter. |
| Listening | Deterministic eras, recurring entities, bursts, concentration, transitions and observed absences; timestamp joins retain ambiguous and unassigned observations. | Counts do not establish emotion, intent, causality or continuous presence. |
| WORLD | Orbitable geographic atlas with a documented uniform projection and geographic baseline. | Generalised map data is orientation, not visit evidence or street accuracy. |
| TIME | Chronological volumes and source-window entrances; proximity reveals inventory, selection brings a plane forward, entering opens an archival chamber, leaving restores the corridor. | This is an archival composition, not a reconstruction of a physical place. Empty windows stay sparse. |
| MEMORY | Geographic ground plus elapsed-time height, listening traces, visible geographic ghosts and explicit Author displacement. Shallow time-axis camera preset. | Display chronology and authored movement remain separate from recorded geography. |
| Enrichment | Candidate report with matching basis; explicit/strong temporal associations can attach, ambiguous candidates require review. | Semantic similarity is not an automatic attachment rule. |
| Sound | Six local Kenney CC0 samples, synthetic locator audition, deterministic ranking by Author-selected texture tags, provenance and append-only choice history in scene reviews. | One selected episode at a time; no multi-emitter installation mix. No Spotify audio or ML. |
| Research studies | Refusal, Linz and Echo can save encrypted research snapshots; explicit source-window associations feed XR enrichment. Linz continues independently of the hackathon. | Saving is explicit. Earlier unsaved browser responses are not retroactively recovered; fictional demonstrations do not become personal events. |
| Private access | PRF-capable passkeys or recovery passphrase; encrypted Vault, fixed 15-minute sessions. | A browser capability report does not prove a specific authenticator supports encryption. |
| Review/export | Decisions, source provenance, positions and sound choices travel with the selected scene review; activation remains separate and is not silently restored. | A private scene download is not a sanitised public portfolio artefact. |

The TIME interaction repair distinguishes dragging from clicking, tests the visible plane, blocks background selections while evidence is open, limits detailed previews to the focused nearby episode and bounds wheel movement. These changes address the reported view breakdown without replacing the chronological architecture.

## This increment: unlock without losing your place

Protected Vault requests now receive a specific locked-session response before any write. The client opens an on-page dialog, keeps the rehearsal/forms mounted, and retries the interrupted request once after confirming a successful unlock. Concurrent requests share the prompt. Cancelling or navigating away cancels the pending request; unsaved state is not written to browser storage. Network errors are never automatically retried because a write may already have succeeded.

The dialog offers existing passkeys and a recovery-passphrase form. Direct full-page Vault access can carry an allowlisted return destination and return there after either unlock method. This does not extend session life or retain credentials between unlocks. Refreshing or closing a tab can still discard unsaved work; inline unlock protects continuity, not crash recovery.

## Where we are

The strongest artistic result is the TIME passage: the Author approved its spatial direction. WORLD and MEMORY now provide distinct geographic and recomposition views. The data model is substantially more mature than the public onboarding/demo experience. The remaining priority is making one complete encounter understandable and repeatable, then documenting what happens when someone uses it.

There is still no headset tracking, controller interaction, room-boundary calibration, spatial speaker routing or visitor study. Browser walking/orbiting and fullscreen projection are rehearsal mechanisms. Feature completion and the Author's formative feedback are not audience research findings.

The separate Are.na reader is included as an existing shared Vault/research dependency. Its latest build reports unavailable channels; the implementation must show that state rather than manufacture source content. Authenticated content verification remains separate from XR readiness.

## Imminent pain points

1. **Atlas freshness:** XR source updates and Atlas's derived view are not one synchronised workflow. A populated Vault can therefore appear older or less complete in Atlas. This is a derived-view integration gap, not proof that source records are missing.
2. **Public reproducibility:** the small cue demo does not demonstrate the full private immersive architecture. A fresh visitor cannot yet reproduce the strongest scene from the README alone.
3. **Save visibility:** research snapshots, scene reviews and sound choices require explicit persistence. A visible response is not necessarily saved; this distinction needs to remain obvious at the point of action.
4. **Dense evidence:** many windows can still challenge readability, selection and orientation. Test small screens, trackpads, keyboard navigation and a projector before adding more geometry.
5. **Sound scope:** the starter palette is narrow and playback is focused on one episode. It establishes authored selection and provenance, not a rich room-scale sound field.
6. **Location reliability:** a desktop/indoor browser can still fail to acquire a position. Echo simulation is a valid test mode, not a fabricated location fix.
7. **Deployment expectations:** this is a local private studio. Publishing the code does not publish the Vault or turn its local authentication into a hosted multi-user service.

## Prioritised task list

### Next increment — explicitly requested

- [ ] **Refresh `/atlas` from current Vault evidence.** Reconcile retained sources with the derived Atlas view; show source import time separately from derivation time, coverage and gaps. Include current journey/research evidence where supported. Verify an explicit refresh is idempotent and does not turn plans or contextual labels into visits. Keep source records and review decisions intact.
- [ ] **Build a full fictional Aurora Coast XR preview.** Use only invented JourneyEpisodes, source windows, listening observations, cultural fragments and Author decisions. Exercise WORLD / TIME / MEMORY, an evidence chamber, ambiguous/empty evidence, refusal, displacement and sound choice without unlocking a private Vault. Make the fixture deterministic and clearly labelled fictional.
- [ ] **Capture README screenshots from that fictional preview.** Include TIME and MEMORY at the approved oblique angle; inspect every visible label and asset for personal information. Add a direct preview path and a short reproducible walkthrough. Do not sanitise the real scene by merely renaming its labels.

### Then — rehearse the artwork

- [ ] Run a 30-minute session: approach → select → enter → leave → refuse → recompose → audition → save → reload. Record observable problems and the Author's words separately.
- [ ] Verify the inline recovery flow with the enrolled phone passkey during a real expired session. Automated checks cover this increment; a new phone ceremony was not requested for release verification.
- [ ] Make saved/unsaved state consistently visible across research and XR, including what will be lost on refresh.
- [ ] Evaluate proximity-driven multi-episode audio only after the single-episode sequence works reliably. Retain explicit playback, quiet defaults, licence provenance and refusal behaviour.
- [ ] Produce a short privacy-safe video and a concise installation score: participant actions, projection, headphones/speakers, space and access requirements. Use rehearsal observations to revise the CTM argument and portfolio case study.

### Deferred

CLAP/model training, semantic autobiographical inference, Spotify audio, additional live connectors and tracked-headset support remain outside this increment. Revisit them only when a concrete rehearsal finding justifies the added system complexity. CTM deadlines and submission requirements require a separate current check before submission; this report does not re-verify them.

## Verification and publication boundary

For this increment, 184 automated tests pass across 45 files, including locked-session rejection before mutation, one-time request resumption, cancellation, concurrent prompts and return-path validation. Type checks, lint and the production build pass. The first full test attempt encountered the machine's system Git/Xcode licence issue; rerunning with the available Git runtime passed without changing the test expectation.

The browser check verified that a protected request opens the dialog on the XR page and cancellation returns to that page without completing the request. The local development server was restarted after build verification; server restart ends prior unlock sessions. Phone enrollment was previously confirmed by the Author; the new dialog's phone ceremony is not claimed as manually verified here.

The build reports Are.na content unavailable independently. The public repository and production-bundle privacy audits passed, as did the existing fictional Aurora Coast demonstration check. The private scene's current record counts and attachments are not re-audited by this software release.

Related: [rehearsal guide](README.md), [CTM checkpoint](../ctm-2027/checkpoint-2026-09-29.md), [passkey design](../../vault-passkeys.md).
