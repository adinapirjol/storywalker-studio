# Study 04 — Sleep, Energy & Mood Observatory

## Current product direction — 15 October 2026

The landing page is now an automatic observatory, not a diary workflow. It loads
the invented sleep fixture immediately, shows coverage and a descriptive period
comparison, plus explicitly invented energy/mood/context signals, exploratory
paired correlations and automatically generated evidence/uncertainty notes. Real
energy/mood remains unknown without an appropriate connected source. Diary
entry and clinician-report sections are removed from this page; their underlying
modules are retained for now. Storage/import rehearsals are behind an explicit
testing-tools button and make no request on page load. Real private connections
and forecasting remain disabled. The intended later flow is automatic loading
from an explicitly connected, approved private source, never silent use of the
entire Vault. Exploratory Pearson correlations require 14 pairs and nonzero variance. A note
is surfaced at absolute r >= 0.5; this is a demonstration threshold, not a clinical
rule or significance test. Sleep shifts use 1 hour / 3 consecutive usable windows.
Notes are recomputed in memory, not persisted as personal research conclusions.
No causal, episode-detection or forecasting model is implemented.

The implementation notes below describe the earlier vertical slice
and remain historical where they refer to the old diary/report interface.

Implemented 13 October 2026. Personal research and clinician conversation support;
no diagnosis, episode classification, causal inference or medication advice.
All committed examples are invented. Route: `/research/health`.

## Implementation plan and delivered boundary

1. Inspect current research, observation, Vault and native HealthKit boundaries.
2. Parse only selected Apple sleep records locally; preview sources and coverage.
3. Keep wearable estimates, personal reports and descriptive calculations separate.
4. Provide a reviewed reference, timeline, comparison and explicit report selection.
5. Verify interval failures, cancellation and exclusion from public data surfaces.

Personal observations remain **temporary and memory-only**, not durable Vault storage. A separate [encrypted rehearsal](storage-rehearsal.md) now persists only a fixed, server-generated synthetic fixture; the API accepts no personal payloads. “Save
in this tab” updates React state. Reload/close/delete drops it; JavaScript and OS
memory are not guaranteed securely erased. No localStorage, IndexedDB, server
personal upload, analytics, model calls or automatic export. Explicit rehearsal controls use a session-protected local endpoint to save/load/delete only invented fixture data. Hide conceals the workspace;
switching tabs conceals it automatically. It cannot prevent OS/browser screenshots,
extensions, screen recording or crash/swap persistence. Print CSS suppresses this
view. Use only synthetic data in screenshots and public case studies.

Current source inspection: `private-vault.ts` encrypts each payload using
AES-256-GCM (random 12-byte IV); SQLite row metadata are not all encrypted.
`vault-route-access.ts` guards opening, writes and results with active sessions;
`vault-session.ts` owns process-local keys. These observations are not an
independent security certification. Shared Vault captures can feed Atlas/retrieval.
A separate older `health:stage:` heart-rate path exists in the Vault and is
excluded from general retrieval/Atlas reads; it is not this sleep/diary store.
No independently reviewed durable Study 04 store or cloud provider was verified. Therefore Study 04
neither opens nor modifies the personal Vault, and adds no cloud persistence.
The private future-cloud planning note remains deferred.

The research lab's source/evidence/interpretation separation and accessible native
controls are reused conceptually. HEALTH has a separate model because the existing
research-session schema is for artistic experiments and generic captures, not
health data. No journey, music, location or productivity records are connected.
Adding a journey connection later requires explicit per-record selection and a
separately reviewed boundary. No automatic retrieval is implemented.

Native source inspection found heart-rate authorization in `HealthCollector.swift`
and `WatchApp.swift`, not sleep authorization/querying. Browser HealthKit access
and live Watch sleep sync are **not implemented**. No native build or pairing was
changed.

## Synthetic workflow and deferred real import

1. Start the local app with `npm run dev`; open
   `http://127.0.0.1:3000/research/health` (use the terminal's actual port).
2. First try **Preview synthetic fixture**. Select Synthetic Watch, retain its
   dates/UTC offset, then **Save selected sleep in this tab**. This is explicitly
   fictional and disconnected from BODY rehearsals and external transport.
3. Real file imports are disabled pending durable private HEALTH storage,
   verified deletion and independent security review. Use invented diary entries.
   Do not put real exports or personal health notes into this temporary workspace.
4. The XML/ZIP adapter remains available for synthetic automated tests. Its
   limits are 256 MiB and 100,000 sleep records. No live Watch sync is enabled.
5. Inspect source/device counts, invalid and duplicate counts, date range and
   unknown windows. Explicitly choose ONE source/device for the whole import.
   Select date range and fixed UTC offset. Only sleep records intersecting that
   range are retained on save. Saving a replacement clears diary/drafts/report
   selection; preview and download a wanted report before replacing.
6. Select a reference period you judge reasonably stable. Check recording coverage
   in the timeline; review individual windows or explicitly acknowledge the whole
   reference. Select a comparison period. Neither short sleep nor productivity
   selects a reference automatically.
7. Add optional diary entries. Use retrospective for earlier dates and record
   recall certainty. Multiple entries remain separate, with entry timestamps and
   offsets; delete an individual entry to correct it. No ratings are imputed.
8. Select report dates and fields; preview; then explicitly download. Changing
   any included information invalidates the old preview. The plain-text download
   is **unencrypted**, and no clinician is contacted. Keep it in a private folder.
9. Delete all study data/drafts, reload or close when finished. Local input files
   and downloaded reports are not deleted by clearing the browser workspace.

## Analytical contract

- Original start/end/creation strings, offsets, source name/version, device and
  XML record ordinal survive import. Unrelated attributes/records and metadata
  entries are discarded. Invalid/missing-offset records are counted and omitted;
  their dates cannot be inferred. No period without records becomes zero sleep.
- Exact duplicate identity is source + device + raw interval + normalized kind.
  The first occurrence supplies provenance; duplicates are counted. Different
  source/device candidates stay separate in preview. No fallback source fills gaps.
- All asleep/Core/Deep/REM intervals are unioned. They do not add twice when a
  generic asleep interval covers stages. In-bed and awake are separate categories;
  in-bed is never counted as asleep. Conflicting awake/asleep intervals flag the
  window; no source is silently chosen as truth. Stage percentages are not computed.
- Windows are noon-to-noon at an explicitly chosen **fixed offset**, ending on the
  displayed date: exactly 24 elapsed hours, not civil days or a recovered IANA
  timezone. Raw offsets cannot establish a travel itinerary. DST, different
  offsets and clipped noon-spanning records flag uncertainty and exclude the
  window from baseline/trend/change calculations. Raw timestamps remain visible.
- A sleep bout joins asleep intervals separated by ≤90 minutes but counts only
  recorded asleep minutes. The largest-duration bout is the main-sleep candidate;
  other bouts are nap candidates. This heuristic is unsuitable for some split
  sleep/shift-work patterns; review before using a reference. Nap absence means
  zero **recorded** nap duration, never proof there was no nap. Total recorded
  sleep/24h includes all asleep intervals, including nap candidates.
- Reviewed, unflagged windows with some recorded main sleep are “valid” for this
  analysis. Coverage review is the Author's judgment, not sensor validation.
  Baseline and comparison each need ≥7 valid windows and ≥50% recording coverage.
  These are conservative analytical choices, **not DSM criteria**. Very short
  recordings are not removed just because they are short. Median and median
  absolute deviation (MAD) describe the selected sample, not healthy norms.
- Trailing 7-window median needs ≥4 valid windows; paired n is displayed. Change
  markers need an adjustable hour difference in one direction across an adjustable
  number of consecutive reviewed windows. Unknown/flagged/unreviewed windows
  interrupt the sequence. No episode or risk score is calculated.
- Diary ratings (0–4) are explicitly personal, not validated clinical scales.
  Unknown/skipped differ from 0. A contemporaneous entry must be for the browser's
  current local date. Earlier dates are retrospective. The timeline aligns diary
  date with the ending-window label; this is descriptive, not temporal causation.
- Correlations are deliberately omitted in v1. Repeated entries and missingness
  need a prespecified pairing rule before correlation is defensible. The report
  shows recording and diary-date coverage, not an invented bipolar probability.

## Research register

Initial source review dated 13 October 2026; retrieval limits are recorded below. The sources inform distinctions and
limitations; none defines this app's thresholds. Dates marked unavailable are not
inferred from search crawl dates. Older primary work is identified as older work.

| Source / publication date | Population / evidence scope | Supported use and limitations |
| --- | --- | --- |
| [APA: What Are Bipolar Disorders?](https://www.psychiatry.org/patients-families/bipolar-disorders/what-are-bipolar-disorders) — public page, publication/update date not established | Official public explanation of bipolar I and II; not a cohort | Reduced need for sleep means a change in experienced need, not merely fewer recorded hours. Hypomania/mania require a broader clinical picture. Public APA guidance was accessible; the full licensed DSM-5-TR diagnostic text was not independently accessed or reproduced. The tool is not a DSM assessment. |
| [NIMH: Bipolar Disorder](https://www.nimh.nih.gov/health/publications/bipolar-disorder) — official living publication, page date not established | General clinical information spanning bipolar presentations; no study sample | Depressive symptoms may include difficulty sleeping or sleeping too much. Diagnosis needs course, severity and broader symptoms; one night's sensor estimate is insufficient. This does not assign subtype-specific probabilities. |
| [NICE CG185](https://www.nice.org.uk/guidance/cg185/resources/bipolar-disorder-assessment-and-management-35109814379461) — 24 September 2014; updated 2 September 2025 | UK guideline for adults, children and young people with bipolar disorder | Clinical assessment considers history, changes in mood/activity, functioning, context and differential explanations. Not a wearable classifier. Medication recommendations are outside this module's scope. |
| [Harvey et al., Sleep-related functioning](https://pubmed.ncbi.nlm.nih.gov/15625201/) — January 2005; [primary full-text source](https://psychiatryonline.org/doi/pdf/10.1176/appi.ajp.162.1.50) | **Bipolar I**: 20 euthymic participants; 20 primary-insomnia participants; 20 good sleepers; eight-day diary/actigraphy | Sleep disturbances were observed between episodes. Small clinical sample, short observation, medication/comorbidity influences; cannot generalize to bipolar II or use a group proportion as an individual rule. |
| [Steinan et al., Sleep problems in bipolar disorders](https://pmc.ncbi.nlm.nih.gov/articles/PMC5063196/) — online 2015; May 2016 issue | **Mixed I/II** Norwegian clinical sample, 563 adults: 373 I, 190 II | Insomnia and hypersomnia profiles differed by subtype and mood state; hypersomnia also occurred during euthymia. **II evidence:** insomnia was more common in the II subgroup; this is an association, not a type-II sleep signature. Cross-sectional, no objective sleep measures, most receiving medication; treatment/age confounding limits interpretation. |
| [Simon et al., Accuracy of recall for mania symptoms](https://pubmed.ncbi.nlm.nih.gov/17884178/) — online 19 September 2007; April 2008 issue | **Mixed I/II**: 392 outpatients in a care-management trial; no subtype-specific recall estimate established | Three-month timeline recall compared with telephone assessments missed some symptoms (reported sensitivity 63%). Interview-assisted recall is not identical to a daily app diary. Recall certainty is therefore retained, not retrospectively treated as contemporaneous truth. |
| [Apple, Estimating Sleep Stages](https://www.apple.com/health/pdf/Estimating_Sleep_Stages_from_Apple_Watch_Oct_2025.pdf) — October 2025 | Manufacturer sleep-stage validation, not a bipolar diagnostic study; current sample details were not independently settled in the reconciliation | Sleep/wake and stage classifications are estimates; imperfect wake detection matters. Validation setting, algorithm version and population constrain transfer to an individual's nights. Full current PDF retrieval exceeded the retrieval size limit. Earlier indexed sample/method details remain provisional; no detailed accuracy or subgroup claim is adopted here. |
| [Apple HealthKit sleep categories](https://developer.apple.com/documentation/healthkit/hkcategoryvaluesleepanalysis?changes=_7_1&language=objc) — living API documentation, date not stated | Software contract, not clinical evidence | In-bed samples can overlap detailed sleep samples; categories include generic asleep, Core, Deep, REM and awake. This supports interval union and separating in-bed time. HealthKit authorization is native; importing a file does not establish native permissions. |

Reduced duration can reflect opportunity, insomnia, disruption or recording gaps;
reduced need includes reported experience and the wider clinical context. Likewise,
insomnia (difficulty sleeping) and hypersomnia (excess sleep/sleepiness, depending
on study definition) are not interchangeable with a device duration threshold.
Reports of restedness, wanted sleep and sleepiness remain separate measurements.

**Design inference, not a newly established research result:** the cited studies
and clinical sources provide no validated mapping from sleep-stage percentages,
heart rate or HRV to an individual bipolar diagnosis. These physiological signals
are nonspecific, influenced by measurement and context, and lack the clinical
history and differential assessment required. They cannot establish a diagnosis
in this tool. Heart rate/HRV are consequently not imported in v1.

## Known limits and review gate

No persistent user-authored diary/archive, personal encrypted health restore, correlations, native sleep
sync, journey linking, IANA timezone reconstruction, manual bout editing or PDF
export. Raw provenance display is capped at the first 100 selected records (all
selected records remain in memory). The study accepts at most 1,000 diary entries
and refuses additional entries rather than silently dropping older ones.

This private-data/consent change **requires independent security review before
merge**, per `docs/code-review-guidelines.md`. Tests and implementer review do not
satisfy that gate. No commit, push, merge or external reviewer contact is included.


## Synthetic recovery follow-up — 14 October 2026

[Recovery and deletion walkthrough](storage-recovery.md) documents independent
snapshot recovery, explicit key migration, interrupted-operation verification and
what remains in backups/exports. [Tracing verification](storage-tracing.md) explains
the two Vault build warnings. Real imports and forecasting remain disabled; the
32-week research experiment is an uncommitted proposal.

## Watch sleep connection — 2026-10-15

The live-path implementation now has separate iPhone sleep controls and automatically saved, encrypted Vault research history. See [connection, phone walkthrough and privacy boundaries](watch-connection.md). Earlier synthetic-only descriptions refer to that rehearsal path: XML/ZIP import remains disabled, but the explicitly enabled native Watch sleep path is separate. Device permission, installation, physical delivery and independent security review are not established by automated checks. No forecasting or experiment commitment is added.
