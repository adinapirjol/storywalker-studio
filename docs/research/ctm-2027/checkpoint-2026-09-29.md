# Research checkpoint — 29 September 2026

**Working study: Spatial Rehearsal — A passage made of intervals.**

Storywalker has moved from a proposal about negotiating interpretations toward a browser-based audiovisual installation prototype. The research question is now spatial as well as editorial: **how can an Author move through, refuse and recompose an archive while the distinction between recorded evidence and authored memory remains perceptible?** This is a working research direction, not a submitted CTM proposal or a claim of participant-study results. This checkpoint describes the local working prototype; publishing this notebook entry does not publish the accompanying application changes.

## What changed in the artistic proposition

The geographic basemap was insufficient as the main experience: it made the work read as a map application. The current prototype separates three regimes while preserving the same underlying evidence:

- **WORLD** provides geographic calibration through an orbitable, compressed atlas. Geographic positions and source provenance remain inspectable.
- **TIME** is a chronological passage of episode architecture. Individual source windows belong inside episode containers, rather than all appearing as equivalent GPS markers. Approach reveals an inventory; selecting a window draws an evidence surface toward the viewer; crossing it enters a bounded archival chamber. Returning restores the corridor viewpoint. The chamber is an archival composition, never a reconstruction of the recorded place.
- **MEMORY** combines geographic ground with elapsed chronology as height, listening traces and explicit Author displacement. Geographic ghosts and displacement remain visible. A shallow oblique starting view keeps the time axis legible; a dedicated reset returns to that view.

The Author approved the visual direction of the TIME passage. This is formative design feedback from the Author, not evidence that the installation has passed a broader audience evaluation.

## Evidence and agency

The implementation keeps source facts, contextual associations and composition decisions separate. Timeline-derived geography, Author-provided itinerary, listening observations, Calendar and Notion can support an episode independently. Contextual Notion location labels do not silently become physical geography. Listening is joined by timestamp; it does not supply an inferred emotional interpretation.

Vault enrichment distinguishes explicit source links and strong temporal matches from ambiguous candidates. Ambiguous material remains reviewable and withheld until an Author decision. Empty windows remain sparse. Acceptance of a fragment and its geographic placement remain independent. Declining an interpretation must preserve the evidence and the decision history.

The intended dimensional grammar is accountable: chronology orders TIME; supported interval duration can influence depth; source-window count segments an episode; listening quantities support bounded visual traces. Frame colours and fixed heights are presentation choices, not measures of importance or emotion. The MEMORY height axis is elapsed chronology, not terrain elevation.

## Continuation of the earlier studies

**Refusal:** the study exposes an editorial ledger and can save a research snapshot to the encrypted Vault. A response visible in the browser is not automatically durable: the Save research snapshot action creates the persistent record. A fictional study response remains research evidence, not a personal event or canonical journey fact.

**Linz:** the prototype continues as a reusable public-context and negotiation study after the hackathon plan. Public festival/city material, synthetic private-trace fixtures and Author negotiation remain distinct. A saved research snapshot may be explicitly associated with a source window for XR enrichment; the original demo does not become autobiographical evidence merely because it has a place label.

**Echo Lab:** research snapshots can be retained in the Vault. Live location is still opt-in; fictional zones anchor around an available fix. A browser timeout does not establish a location or a visit. Simulation remains available and clearly distinguished. The research snapshot does not retain live coordinates. Refusal suppresses re-entry triggers.

These are prototype mechanisms. Their presence does not establish that every earlier, unsaved browser response was recovered or that every snapshot has been attached to an XR episode.

## Sound as authored composition

WORLD/MEMORY now expose a sound studio again. It offers a synthetic locator preview and a local starter palette of six samples from **Kenney, Sci-Fi Sounds 1.0**, distributed under **CC0**. Original licence text, source filenames, source page, original and derivative fingerprints, and conversion notes accompany the palette. The WAV derivatives are mono, 22,050 Hz PCM for browser playback.

Candidates are ranked deterministically by overlap with **Author-selected texture tags**. Tags are Editor descriptions of the sound palette; they are not derived from an artist, an emotional diagnosis or an autobiographical interpretation. The Author auditions and attaches a sound, optionally retaining their own composition note. Append-only decisions permit later removal without erasing the earlier choice. Source provenance travels with the scene review/export. Saving the review is required to persist choices in the Vault.

Audition is separate from scene activation. An attached loop requires the scene to be activated and an explicit playback action. This iteration plays one selected episode at a time, with stereo positioning relative to the atlas view; it is not yet a multi-emitter immersive sound field. No Spotify recording, CLAP model, live sound-service integration or private listening-history upload is involved.

Sources: [Kenney sample collection and CC0 declaration](https://kenney.nl/assets/sci-fi-sounds), [CC0 terms](https://creativecommons.org/publicdomain/zero/1.0/). This is a small audition palette, not an automatic music-resemblance engine.

## Interaction repair and validation

The TIME click regression exposed a mismatch between progressive disclosure and hit testing. The repair limits detailed window previews to the focused nearby episode, uses the visible plane for selection, distinguishes two-dimensional drags from clicks, prevents clicks through an open evidence surface, and prevents camera scrolling from also scrolling the page. Portrait inventories replace compressed landscape text on narrow entrances.

Verification for this checkpoint:

- 179 automated tests passed, including sound provenance/export, decision-history preservation, candidate ranking, local sample fingerprints, drag thresholds and archive hit testing.
- Production build, type checks, repository lint and public/private build audits passed. The build reported unavailable Are.na channels separately; this does not affect the local XR sound palette.
- Browser checks exercised TIME window selection, background click isolation, chamber entry and return; the sound studio ranked a selected tag and successfully started a local sample preview. The preview ended without attaching a sample or activating the private scene.

Private records, exact coordinates, listening histories, screenshots of private evidence and actual Author composition notes are excluded from this public checkpoint. The live scene remains a private draft; the checkpoint documents the method and software, not its private contents.

## Next rehearsal questions

1. Can an unfamiliar viewer distinguish source evidence, contextual association and authored composition without leaving the world to read a panel?
2. Does entering and leaving an evidence chamber preserve orientation and the experience of chronological continuity?
3. Can the viewer correctly read a MEMORY displacement against its geographic ghost and the independent time axis?
4. Does refusing a fragment produce an understandable consequence while retaining an inspectable record of the decision?
5. Do selected sounds work as authored material rather than suggesting that the installation has recovered the sound or feeling of a past event?

Run a short, documented rehearsal around one episode: approach, open, enter, leave, refuse one association, then choose or decline a sound. Record observable navigation problems and the Author's own wording separately from the Editor's interpretation. The next CTM draft should argue from those observations, rather than treating feature completion as a research finding.

The [August tracker](tracker.md) remains a dated planning record. Today's checkpoint does not re-verify the call, deadline or submission requirements and does not record a submission.
