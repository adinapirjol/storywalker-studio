# Hypothesis Hyperloop v0.1

Local review surface: `/nova` (also linked from `/director`).
Architecture and integration boundaries: [architecture.md](architecture.md).

## Use with authorized real evidence

1. Open `/nova` and choose **Open my evidence**. Unlock when prompted.
2. Pick up to eight saved notes/listening sources, shown by recognizable title.
3. Choose **Explore selected evidence**. Selection consent and local analysis
   commit together. This permits future revisions of selected records, not
   unrelated records, calendar events or external AI.
4. Review one connection at a time. Evidence and uncertainty are expandable.
5. **Keep**, **Edit** or **Reject** it. Edit can also change the relationship and
   supporting records. Rejection asks for a reason. These are participant decisions, never
   automatically supplied as acceptance-test answers.
6. Expand the map, history or evidence gaps when useful. Pause prevents analysis/decisions; disable
   revokes selected sources. Neither silently erases decision history.
7. Optional research counters are off by default, inspectable and deletable.
   Erasing all derived data also erases rejection boundaries and disables Nova.

## Implemented boundary

- Supported sources: existing `capture:*` Author captures, minimised Last.fm
  history, non-Nova live Author research responses and selected Spotify playlist snapshots.
  Spotify playback history is excluded. Exact source IDs are selected, never wildcarded.
- Adapter reads event timestamps, never import/save times. Unknown timestamps,
  absent locations, unverified artist identities and missing provenance remain
  visible. A capture excerpt is bounded to 500 characters and labeled as such.
- Each import is limited to 50,000 rows for parsing, then 160 recent unique
  observations for review. Larger imports fail visibly rather than silently
  producing invented evidence. Eight selected sources bound graph work.
- Same-day cues compare UTC calendar days for timestamped records and stated days
  for date-only captures; unresolved timezones remain a caveat. Recurrent artist
  or track labels require different observed days. A recurring label yields one
  cue rather than all pair combinations. No calibrated likelihoods or psychology.
- Each analysis adds at most 12 proposals, with 24 pending and 1,000 historical
  proposals maximum. A three-second interval limits repeat analysis. Local analysis
  invokes no external model. The separate consent-controlled model path is described
  below. No daemon, scheduled worker, camera or gesture capture is invoked.
- Sources normalize on each authorized request. Stable evidence keys and revision
  fingerprints deduplicate proposals and reconcile changed/deleted/revoked sources.
  This is bounded on-demand reconciliation, not a persistent background index.
  GET reflects invalidation without writing; the next mutation persists it.
- One encrypted `nova-loop` record contains source references, proposal/decision
  history and optional counters. It is excluded from generic Vault retrieval and
  Atlas inputs. Sources stay unchanged. Revisions reject stale browser commands;
  existing Vault locks and atomic writes reject stale filesystem snapshots.
- Inspect/approve/modify/reject use a shared semantic action boundary, with native
  keyboard/mouse/touch controls. Graph movement and recomposition action contracts
  reserve a future adapter boundary; interactive node dragging is not implemented.

## Rejection policy

| Reason | Effect |
| --- | --- |
| Does not fit | Suppress the semantic cue; consider at most one different pair and relationship in its neighborhood. |
| Incorrect evidence | Quarantine the referenced evidence revisions, including other active connections using them; no immediate alternative. |
| Insufficient evidence | Suppress that pair/version until actual evidence changes; no immediate alternative. |
| Not now | Suppress that evidence pair across relationship types; no immediate alternative. |
| Never again | Block the source-container pair, including future revisions and other queued/confirmed connections; no alternative. This broad scope is explicit in the UI. |
| Other | Preserve optional explanation; suppress the cue and consider at most one different alternative. Free text does not become an automated psychological interpretation. |

A rejection may return no alternative. It never recurses. Superseded/rejected
proposals and decisions remain historical. Source revocation removes active
contribution but retains past Author decisions until explicit derived-data erasure.
Re-enabling sources does not remove rejection boundaries.

## Research scope

Opt-in encrypted counters cover generated proposals, decisions, reasons,
alternatives, prevented duplicates, boundary blocks and elapsed wall time to
decision. Modification lineage and corrections live in decision history.
No automatic task-completion/gap-resolution metric or calibrated quality score.
Stopping counters preserves existing counts; deleting counters opts out and erases
them. The client clears private view state when hidden and checks session status
at 15-second intervals; it stores no private data in browser persistence.

## Known limits and acceptance

Semantic, spatial, listening-distribution similarity, contradiction detection,
entity resolution, calendar row authorization, JourneyEpisode normalization and
cross-project imports are not implemented in this slice. Existing XR/audio and
research flows remain separate. Generic optional tasks explain gaps without
creating fabricated quest completions or XP.

Real acceptance is required before calling v0.1 complete: unlock, select actual
sources, inspect the available proposals, make participant decisions and verify
reload/history. If fewer than three meaningful cues exist, accept the actual
count. No fictional public Nova/Aurora demonstration is supplied before that
validation; automated regression fixtures are entirely fictional and isolated.

Independent security review of the final diff is required before merging. No
private source records should be supplied to a reviewer. The working tree already
contained unrelated changes before this task; review Nova's added modules plus
its small Vault/retrieval/Director integration edits separately.
# Author observations and CTM readings

Nova-linked response snapshots are stored as encrypted records with a dedicated
header identity. The Author can reopen them from the connection that created
them, but they are excluded from Nova's general source picker and generic Vault
retrieval. This conservative boundary prevents older snapshots that copied a
model proposal into their metadata from being reintroduced as Author evidence.
The Author's own note remains available in the original connection view; it is
not separately indexed by Atlas, search, Director or the generic retrieval index.
Older snapshots remain encrypted and preserved in place; the application does
not rewrite or delete them during unlock.

**Current model-assisted flow:** Save an observation, preview the exact outbound
selection, then explicitly consent to one model request. The generic local prompt
is optional and off by default. See [model interpretation](model-interpretation.md)
for configuration, safeguards and the current live-provider validation blocker.

The optional local **Save & create local prompt** flow saves and verifies the Author snapshot, then
requests one local reflection proposal without another chat instruction. Only
the observation is required; a separate CTM reading is optional. The optional
local prompt control explicitly grants this saved response access when checked.
Pausing or disabling the loop leaves saving available but stops
proposal generation. Loading saved readings never triggers inference.

`local-reflection-v1` quotes the optional reading (otherwise the observation) and
proposes comparing a composition based on it with the original suggestion. This
is a deterministic creative exercise, not semantic understanding or an LLM.
It does not reproduce the richer conversation-assisted interpretation by itself.
No external model receives the response. There is at most one proposal per saved
response; retries retain previous rejections. A new response creates a new
snapshot and preserves the chain. Explicit source boundaries apply through the
whole chain. Source and queue limits still apply.

Saving and reconsidering are separate guarded operations. If reconsideration
fails, the observation stays saved; “Create local reflection prompt” is an
explicit retry, not an automatic loop. The returned proposal stays pending for
Keep / Edit / Reject.

Saved live readings can now ground a **conversation-assisted proposal**. Load a
connection's saved readings, open “Advanced: save a direction composed in conversation,”
and supply the proposed direction and an experiment. Explicit submission grants
that specific snapshot access within the eight-source selection limit. The new
proposal stays unapproved and links to the original. An archived original can
remain historical context: only the live Author reading supplies the new
proposal's evidence. Removing or changing that reading invalidates the proposal.
Identical submissions do not duplicate it or undo decisions. This feature does
not claim autonomous semantic inference or call an external model.

Last.fm supplies the listening trace. Spotify playback history is excluded from
this loop (its Vault record is preserved); existing selected playlist snapshots
are available as undated playlist context. Their metadata does not establish
listening, encounter, memory or meaning. Author accounts supply those
interpretations. Unsupported sources are grouped by format and count, rather
than presented as repeated untitled records.

Each connection offers **My observation · CTM editorial reading**. Saving creates
one encrypted, Author-stated research snapshot through the existing Vault
research-session API (`study: refusal`, `mode: live`). It preserves the proposal,
source IDs and revisions, verbatim observation, and separate editorial reading.
Proposal wording stays in the Nova record; the snapshot keeps a reference and
does not copy the proposed interpretation into Author-stated text. Nova editorial
snapshots stay available to this loop but are excluded from generic Vault retrieval
to prevent feedback into other interpreters. This records a present response; it
does not change the hypothesis verdict or verify listening, attendance, or artist
intent. Saved readings can be reloaded beside the connection. The client rereads
the saved record before reporting it verified. Retries reuse the snapshot
identifier; changed wording creates a new snapshot. No private reading is
included in this documentation or test fixtures.
