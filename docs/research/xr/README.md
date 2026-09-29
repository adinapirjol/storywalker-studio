# Spatial score — room-scale audiovisual installation study

Working prototype: `/research/xr`, linked from Research Lab. The Author chose a room-scale audiovisual installation as the direction on 2026-09-28.

## Current rehearsal — 29 September 2026

Read the [NOVA report and prioritised task list](nova-report-2026-09-29.md) for the current implementation, limitations and next rehearsal. The [CTM checkpoint](../ctm-2027/checkpoint-2026-09-29.md) records the artistic research direction.

- **WORLD:** orbitable geographic atlas with source-supported positions.
- **TIME:** chronological episode architecture; approach a source window, open its evidence surface, cross into an archival chamber and return to the corridor.
- **MEMORY:** geographic ground, elapsed chronology as height, listening traces and explicit Author displacement with geographic ghosts. The time-axis view restores a shallow oblique camera angle.
- **Sound:** audition synthetic locators or six locally bundled CC0 samples. Candidate ranking uses Author-selected texture tags. Save an attachment as an Author composition decision; activation and playback are separate. Currently one selected episode sounds at a time.
- **Vault:** private scene import, deterministic listening review, independent source provenance, conservative enrichment and encrypted review persistence. An expired session opens an unlock dialog on the current page and resumes the interrupted request after successful unlock.

The small default cue scene remains fictional and uses oscillator tones. A full immersive Aurora Coast fixture and privacy-safe screenshots are queued; the default does not yet demonstrate the entire private-scene experience. This is a browser rehearsal, without headset tracking, physical speaker calibration or a measured installation room.

## First rehearsal — 30 minutes

1. Open a selected scene or load the private draft. If prompted, unlock here with a passkey or recovery passphrase; the current page stays mounted.
2. In TIME, approach one episode, select a source window, enter the bounded evidence chamber and return. Check orientation and whether the source basis is understandable.
3. Compare WORLD with MEMORY. Move an episode in MEMORY and inspect the geographic ghost and displacement separately from chronology.
4. Audition a sound using texture tags you choose. Attach or decline it; acceptance, activation and playback remain separate actions.
5. Save the review to the Vault and one research observation. A downloaded review contains selected private material; it is not a public portfolio export.

## Bringing sources into the room

**Download current scene** includes decisions, journey/source provenance, evidence links, Author displacements and sample choices. **Load selected scene** accepts validated scene/review JSON up to 10 MB, preserving saved decisions and keeping activation off. The blank demo template is separate. Full analysis reports are archival, not reloadable scene files.

The original cue format uses `version: 1`, `title`, and `cues`; each cue carries source/provenance, treatment and relative position. Journey scenes add validated geographic episodes, independent source evidence and optional enrichment/composition. Use the exported format rather than raw account exports. Validation rejects invalid fields and inconsistent references.

The existing Last.fm/Vault bridge is deterministic and local after import. An explicit delta request may contact Last.fm through the existing connector. Timeline supports geography; Calendar/Notion support independently sourced context. Film fragments remain Author-selected and are not automatically interpreted. No Spotify recordings or live sound-service integrations are used for this rehearsal.

## Deferred research

CLAP and other similarity models remain deferred. There is no ML model in this iteration and no need to introduce one before evaluating deterministic time/place/listening alignment and Author-selected sound textures. An outdoor Echoes edition and tracked XR are separate future experiments, not current integrations.

## Private draft and deterministic listening review

The private-draft action reads only `import:lastfm-history:v1` from an unlocked Vault. It does not contact any listening service. A local ignored configuration at `private-data/xr/first-scene.private.json` supplies the Author's scene, period and timezone. Its contents are never imported into public modules or build assets. The first preparation validates the scene, analyses the existing source and saves `xr:spatial-draft:v1` as an encrypted non-canonical reference, with a SHA-256 source fingerprint, import timestamp, analysis method and decisions. Loading again returns the saved draft; it does not reconstruct decisions from the source. “Save review to Vault” persists changes. Activation is never restored automatically.

The source importer did not retain requested dates or pagination metadata, so this analysis cannot certify full-period coverage. It reports actual earliest/latest scrobbles, empty dates as unknown, and possible truncation of the current day. Calendar dates are inclusive in the configured timezone. Repeated exact timestamp/artist/track/album tuples are deduplicated; entity grouping is exact text without alias inference.

Method `fixed-week-counts-v1`:
- Seven-day bins anchored at the requested start. Consecutive bins with the same top artist form a provisional dominant-artist interval only when each has at least 10 scrobbles and a top share of 30%. Mixed or missing-data bins remain explicitly labelled.
- Bursts: daily count at or above the greater of 10 and the 90th percentile of nonzero daily counts.
- Concentration: at least 10 daily plays and an artist share of at least 60%.
- Transitions: adjacent bins each have at least 10 plays and artist-distribution total variation distance at least 0.5.
- Observed absence: artists with at least 5 plays whose final appearance is at least 14 days before the last day with any observed records. This does not establish a cessation of listening.
- Candidates: top three artists recurring in at least three bins; top two tracks and albums with at least two plays. Count descending, exact text key tie-break. No manually chosen representative or emotional interpretation.

Source facts, Author-authored labels and later interpretation have separate fields. Relative positions, radius, colour and synthetic-tone frequency are proposals. The initial Author place/culture nodes are silent; musical candidates use synthetic markers, not recordings. Accept, Reconsider and Refuse never establish canon. Any cue edit resets that cue to pending and turns draft activation off. Activation requires a separate action and at least one accepted cue. Imported files and Vault scenes remain local; downloaded reviews include the selected evidence and should be kept private.

### Delta updates

A later explicit delta request may reuse the existing Last.fm connector. The username is used for the request only. The interval starts one second before the latest completed delta boundary (or latest stored scrobble) and ends at the earlier of now and the configured period end. Every reported page must succeed before any database write. The merge retains earlier records, removes exact overlap tuples, and ignores out-of-window rows. The source stores completed delta intervals and pagination counts; this does not retroactively certify the earlier import.

The merged source and new pending draft are written together, alongside encrypted snapshots of the previous source and draft. No previous review is promoted into a selection for newly ranked candidates. Repeated reads can advance today's coverage without adding scrobbles. This is a one-time user-triggered update, not a background polling integration. Atlas's cached view is not rebuilt by this operation; the XR report reads the merged source directly.

### Saving and moving in a reviewed scene

Use **Download current scene** to export the displayed scene with all Accept/Reconsider/Refuse decisions, positions, provenance and treatments. **Load selected scene** restores that file while keeping activation off. The blank demo template is a separately labelled download. The full analysis report is an archive, not an importable scene file. The download uses a local attachment response; a retained file link and copyable JSON remain available if a browser blocks saving. The export endpoint returns only supplied scene data and does not read or persist Vault records.

**Move here** moves the listener, not the node. It brings the map into view, displays coordinates and distance, and explains inactive, silent, unaccepted or over-budget states. Node placement is changed under Reposition / revise treatment. Moving does not activate a draft or enable audio automatically.

### Journey episode evidence

`lib/journey-episode.ts` defines `JourneyEpisode`. Optional `journeyEpisodes` on
an XR scene round-trip through the existing scene/review import and export.
Older scenes and their cue decisions are unchanged. This is a model and join
foundation; it does not fetch Notion pages or generate physical routes.

Each episode has `notionEvidence[]` with `pageId`, `title`, `date` (calendar day),
`locationLabel` (null when absent), `sourceDatabase`, and optional
`contentSummary`. Use actual source page identifiers; a descriptive extraction
slug is not a verified page ID. Private page contents belong in private scene
files or encrypted Vault records, never bundled fixtures.

`attachNotionEvidence` uses the episode's explicit time zone and half-open
[start, end) interval. A page date overlaps the whole local day, not an invented
midnight timestamp. One candidate attaches; none yields `UNMAPPED`; multiple
candidates yield `HUMAN_REVIEW`. Changed content on an already attached page also
requires review. Repeating an unchanged attachment is idempotent.

A page contributes a sourced contextual label and, when supplied, its summary.
It does not replace the Author's episode label. `context` also supports explicit
creative/project milestones, each linked to an evidence node; milestone types
are not inferred automatically. Temporal overlap is a contextual association,
not proof of presence or causality.

The provenance graph keeps independent Timeline, Author, Calendar, Notion, and
Last.fm nodes with source IDs and support edges. `worldPosition` requires a
projection identifier and geography evidence links. Only Timeline coordinates
or an Author statement with explicit `confirmedGeography` can support those
links. A Notion Location field, Calendar plan, or listening record cannot.
Even corroborated Notion labels retain contextual status: cite the independent
Timeline or Author node for the physical position. `memoryPosition` is separate.
Source certainty remains visible; validation does not authenticate a source or
turn Timeline records into canonical facts.

### Geographic rehearsal: WORLD and MEMORY

The private `ground-xr-journey` action reads existing encrypted Timeline and
Last.fm records. It validates the current accepted review against the saved
source statements, archives that review encrypted, and saves an inactive
geographic revision. It does not fetch new source data. Last.fm delta refresh is
blocked on this grounded revision to avoid overwriting its Author decisions.

The current requested interval is 15 May through 28 September 2026 in
Europe/Bucharest. Timeline use stops at the end of 26 August. Each valid visit
becomes a timestamped JourneyEpisode; missing timestamps/coordinates and route
centroids do not create episodes. Visits are not silently merged into inferred
cities or overnight stays. Actual coverage is reported, including early gaps.
Optional explicit Author stops are supported by the builder with separate
Author provenance; an itinerary import/revision UI is not yet implemented.

WORLD uses a local equirectangular projection: `east = R × cos(originLat) ×
(longitude − originLon)` and `north = R × (latitude − originLat)`, with radians
and R=6,371,008.8 metres. Longitudes unwrap at the largest empty arc. The origin
is the midpoint of the geographic extent. One scale factor fits the larger
projected extent into 36 of the room's 40 units, leaving a two-unit margin.
X is east; Z is negative north. The source hashes, origin and metres-per-unit
are stored with the scene. This preserves relative projected relationships;
it is an approximate regional map, not a distance-preserving global projection.
There is no chronology axis, jitter, or artificial separation of repeated places.
Chronological arrows connect ordered visits, not measured travel routes.

Scrobbles join by absolute timestamp into half-open visit intervals. Multiple
matches are ambiguous and receive no assignment; zero matches remain unassigned.
Profiles compare exact artist/track/album counts with the full available period,
including plays outside geographic coverage. The exported rules define dominance,
recurrence, bursts, first observations, observed absences, and concentration
thresholds. Empty windows mean unavailable observations, never emotional states
or proof of silence. Selected-cue matches use source grouping keys, never their
old positions. Amber fields represent accepted selection matches; profiles also
retain all other observed music. Selection counts can overlap across categories.

MEMORY initially equals WORLD. A committed move stores its timestamp, Author,
previous position, new position, geographic baseline, displacement vector and
magnitude, with `None inferred` for interpretation. WORLD never moves. Reverting
to WORLD position appends a decision rather than deleting the history. Switching
modes and moving episodes do not reset accepted cue decisions. Moves disable
activation and require Save review to Vault or a scene download for persistence.
The save validator protects geography, profiles, provenance and earlier moves.

The nine original cues remain in the review/export as independently accepted
fragments. Their old coordinates are retained only for compatibility and are
ignored in a geographic scene. Bristol's authored closing role stays intact;
no Bristol visit or cultural viewing date is fabricated. Undated Author fragments
remain in the selection panel until explicit placement evidence is supplied.

This iteration renders a visual geographic room and fullscreen map. The earlier
arbitrary audio emitters are inactive for geographic scenes; no ML, Spotify audio,
recordings or inferred autobiographical semantics are introduced. Scene import
and download support up to 10 MB to accommodate episode profiles and provenance.

### Three stop identifiers

The selector and each episode card display three independent identifiers:
PLACE (stable source-row ID, recorded label if any, coordinates and certainty),
TIME (source interval, duration and explicit display timezone), and CONTEXT
(top observed artist/track plus Calendar entries). These are derived display
markers, not new geographic or autobiographical assertions.

`enrich-xr-context` reads the existing encrypted Calendar source, attaches its
minimised entries with source row IDs and a snapshot fingerprint, adds independent
Calendar provenance nodes/edges, archives the previous review, and saves the
revision encrypted. Existing WORLD/MEMORY positions, movement history and cue
acceptance stay intact. Exact offset timestamps use half-open overlap; all-day
entries respect exclusive end dates. Floating or declared-zone text that the
importer has not converted to an absolute instant is labelled same-day context,
never exact overlap. Calendar locations never populate physical coordinates.

### Interactive 3D journey view

The geographic floor now has a perspective camera. Drag to orbit, scroll to zoom,
Shift-drag (or choose Pan) to move the view, and use Focus episode to inspect a
selected stop within dense overlaps. Top view restores north-up orientation;
Reset view restores the initial camera. Keyboard arrows orbit, +/− zoom, and Home
resets. Camera changes are session-only and never change source coordinates or
accepted selections. Rendering uses local perspective projection, with no new
network service or model.

In MEMORY, choose Move episode and drag a stop on the floor. Release records one
Author displacement through the existing decision history; Escape or a cancelled
pointer gesture discards the preview. Positions stay inside the 40×40 room.
Repeated visits are not spread out: select one in the chronological dropdown and
use Focus episode to move that specific visit. Save review to Vault persists moves.
WORLD remains locked. This adds spatial navigation, not inferred altitude: all
geographic episodes remain on the X/Z floor.

### Geographic reference and time exploration

The WORLD floor overlays bundled Natural Earth country polygons (1:110 million)
and populated-place labels (1:50 million). Public geometry is loaded from
`/maps/natural-earth.json`; no private coordinates, bounds or place queries are
sent to a map provider. Labels are geographic reference only and never rename an
episode or become provenance for a visit. MEMORY retains the fixed WORLD basemap.

Geometry uses the saved local-equirectangular origin, Earth radius 6371008.8 m,
uniform metres-per-room-unit scale and north-negative-Z axis. Longitude differences
are wrapped around the saved origin. Rings are clipped to the 40×40 room and to
the camera near plane; labels are culled for overlap. These are generalised
boundaries, not streets, territorial adjudication, or a historical 2026 map.

The date slider spans the scene's full requested period. At each cursor instant,
stops with start <= cursor are revealed; gold marks intervals satisfying
start <= cursor < end for Timeline evidence or a conservative Author stay interior.
Approximate boundaries and transit envelopes never claim continuous presence.
Overlapping intervals remain visible, and gaps explicitly
say location unknown. Dashed segments connect successive observations only, never
asserting a travelled path. Playback is opt-in, advances one day per 800 ms, and
stops at the period end. The dropdown remains available for individual visits;
listening fields summarise entire episode windows, not partial-time playback.
Camera/filter changes are session-only; source data, acceptance and Author moves
are not rewritten. Missing itinerary remains unknown until separately sourced.

Source provenance, source URLs, retrieval date and SHA-256 fingerprints are bundled
in the map asset. See `public/maps/README.md` for the public-data transformation.

### Globe view

WORLD now defaults to a globe. The previous Room view remains available, and
MEMORY uses Room so existing Author displacements keep their original meaning.
The globe uses each episode's Timeline coordinates or explicitly confirmed Author
coordinates referenced by `worldPosition.evidenceIds`; it never uses Calendar,
Notion labels, arbitrary music positions, or displaced MEMORY positions.

The renderer builds a local Natural Earth texture and maps it onto a tessellated
unit sphere in WebGL. Its orthographic camera rotates around the Earth; depth
occlusion and front-hemisphere tests hide back-side geography, labels, stops, and
route segments. No 40×40 clipping is applied. Drag rotates, scrolling zooms from
1× (the whole sphere) to 24×, and Whole globe, Europe and Focus episode provide
named views. Keyboard arrows rotate, +/− zoom, and Home resets. Coordinates remain
unchanged and camera state is not saved as an Author placement decision.

Chronological connections are short great-circle arcs for visual orientation,
not measured travel paths; exactly antipodal endpoints have no arbitrary arc.
Existing time filtering, accepted music fields and evidence gaps are preserved.
Bristol's country is visible in the public basemap; no undated Bristol visit is
created. WebGL failure displays an unavailable message and leaves Room accessible.

### Author itinerary supplements and Notion context

An Author reconstruction can add ordered stay and transit episodes with independent
provenance. `reconstructedTiming` distinguishes possible date envelopes from
conservative `listeningWindows`. Day-level bounds are not exact arrival or departure
times. A scrobble needs one potential episode and an eligible listening window to
receive a unique assignment; overlapping envelopes and uncertain boundary days stay
ambiguous. Transit episodes have no eligible stay windows. An unresolved return leg
remains approximate and requires primary-evidence review.

`geographicReference` records a separate public coordinate source and its precision
(city, municipality or airport reference). These points locate named places without
claiming an exact personal position. Municipality and neighbouring city episodes
remain distinct. Expanding the geographic bounds requires recomputing the uniform
room projection; archive the prior scene and explicitly handle any existing MEMORY
displacements before doing so. Cue acceptance is independent of this operation.

`notionContext.records` retains page identity, Date-property basis, database, source
URL, retrieval/edit timestamps, fingerprint and summary authorship. Unique date
matches enrich `JourneyEpisode.notionEvidence`; multiple candidates remain in a
visible review queue, with controls to inspect each candidate. A Notion Location
field never supplies physical coordinates. Calendar, Notion, Timeline, Author and
Last.fm evidence remain independent in the provenance graph and scene export.

### Episode-space rehearsal: WORLD / TIME / MEMORY

The default experiential surface is now TIME, a walkable perspective room of
translucent episode portals. WORLD now has its own orbitable geographic atlas. MEMORY lifts geographic episode
positions along elapsed time; TIME retains its walkable chronological passage. The source desk
and selection desk are collapsed by default; focus/proximity exposes references,
and TIME source planes open evidence inside the room. WASD walks, arrows turn, dragging looks,
scrolling approaches, and equivalent buttons support pointer/touch use. Fullscreen
has a fixed-position fallback and Escape exits. No headset or sensor access occurs.

`episodeSpaces` creates presentation containers without replacing JourneyEpisodes:
consecutive Timeline records within 25 km of the FIRST stop, with at most 36 hours
between neighbouring records. Author stays/transits remain individual containers.
These are grouping proposals, not inferred trips or continuous stays. Source members
remain independently inspectable with their original IDs, provenance and profiles.
WORLD container positions are arithmetic means of contained projected positions;
raw positions remain untouched and the calibration map can show them independently.
TIME uses ordinal sequence along a widening spiral, not duration or physical distance.
The presentation does not assert that adjacent containers are semantically similar.

MEMORY can display either WORLD or TIME plus the saved geographic displacement.
Moving a container applies a rigid, bounded offset to all its members and appends an
Author decision per member, including `representationBase` and `spaceId`. Existing
WORLD positions, source evidence and previous moves are immutable. A dashed WORLD
ghost remains visible; a solid amber thread shows the actual stored WORLD-to-MEMORY
displacement. A faint dotted registration line in TIME is only a presentation offset,
not an Author decision. Save review / download round-trips these decisions.

Portal width and height are aesthetic constants; TIME depth follows the bounded duration rule below. Filament counts encode accepted musical
selection matches: one per 25 matches, capped at 48; artist/track/album matches can
overlap. Duration summaries union recorded intervals rather than filling gaps.
Date-only Author envelopes are labelled as such. Neither visual quantity claims
emotion, autobiographical importance or semantic similarity. Accepted Author
fragments can be placed or unplaced through append-only composition decisions;
this never alters work identity, viewing context or factual evidence.

Synthetic locator sound requires both mapping activation and a separate explicit
sound action. Only accepted, non-silent selections observed in a space can sound;
HRTF direction and gain follow the walker and distance. The combined gain is
normalised, and blur, hidden document, regime change or leaving the component
stops audio. These are oscillator cues, not recordings, Spotify audio or an analysis
of acoustic content. No ML or new live service is used.


### TIME evidence surfaces and chambers

TIME preserves the episode-space anchors and ordering. At a distance only episode
architecture and sparse labels appear. Within reach, up to four source-window
planes at a time expose an inventory and supported text previews; earlier/later
window controls cover the remaining windows. Selecting the actual plane draws it
toward the walker and expands it into a perspective evidence surface. Surrounding
chronology remains visible at reduced opacity. Crossing that plane enters a bounded
archive chamber containing the same attached artefacts; crossing the return doorway
restores the exact corridor camera. Enter and Return controls provide alternatives.
Escape closes the archive before leaving immersive mode. These are archival
compositions, never reconstructions of places. Empty windows remain sparse.

Window depth is `min(2.4, 0.3 + log2(1 + durationHours) * 0.25)` room units;
approximate envelopes have a constant 0.45 depth instead of a false measured duration.
Chronology determines order, window count determines segmentation, and existing
bounded listening quantities determine restrained filaments. None encodes emotion,
importance or semantic similarity. Reduced-motion settings skip the surface tween.

The local Vault enrichment action scans supported Calendar, Notion, media/EXIF and
other evidence records, retaining source IDs, fingerprints, time precision and
matching basis. Explicit source links and unique, fully contained timestamp matches
may attach automatically. Date-only, floating-time, overlapping and uncertain-boundary
matches remain candidates in the collapsed enrichment report. Import/edit timestamps
are never event timestamps; semantic similarity is not used. The Author can accept,
refuse or reconsider candidates through append-only decisions. Save review persists
those decisions. Refresh archives the preceding review encrypted and leaves activation
off. JourneyEpisode records, listening profiles, accepted selections and geographic
and memory positions are unchanged by enrichment.

Timeline and Last.fm material comes from existing window evidence. Author-selected
fragments require explicit placement and retain their independent authorship. Raster
previews are used only when already embedded in supported local evidence; the view
makes no remote media requests and invents no missing images. The current scene
export includes the enrichment report and its review history. Synthetic sound stops
while entering the archive; no recordings or new integrations are introduced.


### Geographic atlas and research-study continuation

WORLD renders local Natural Earth country outlines through the existing uniform
geographic projection, with a padded extent of 34 room units. Orbit and zoom change
only the view. Episode plates remain geographically grounded. Plate layers count
source windows (cap six); gold filaments count accepted selection matches (one per
25, cap 24). Dashed connectors express chronological order, never travelled routes.

MEMORY uses stored memoryPosition in the geographic plane and a separate display
height: 2–14 units, proportional to elapsed time from the first episode start to the
last episode end. Height is not terrain or an Author displacement. Dashed vertical
threads register this time display; solid amber ground threads show actual stored
WORLD-to-MEMORY displacement. Fixed-height inverse projection lets the Author drag
in the geographic plane, keeping earlier geographic baselines and decision history.
TIME and its source-window architecture are unchanged. Atlas evidence controls keep
source inspection and explicit Author-fragment placement available. Sound rehearsal
remains available in TIME.

Refusal, Linz and Echo now offer explicit encrypted research snapshots. Each save
creates a separate research-session capture with bounded action history and Author
reflection. Existing Vault keyword retrieval can find these records. The recording
time is separate from historical event time. Research snapshots enter XR enrichment
only through an explicit source-window association selected by the Author; even then
they remain research/composition artefacts, never visit evidence or canon.

Echo defaults to simulation. Live mode uses temporary test zones around its first
fix, rather than comparing a real position with fictional coordinates near zero.
A 12-second coarse location request has a visible fallback; late callbacks are ignored
after cancellation, and hidden-page, reset, mode and consent changes stop location.
Snapshots exclude raw coordinates, relative distances and audio. Refusals inhibit
re-entry triggers until the session is reset. A browser location provider may still
fail; simulation remains usable without permissions.
