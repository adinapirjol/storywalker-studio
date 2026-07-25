# Privacy model

Storywalker Studio treats privacy as a data-flow rule, not a decorative label.

## Data classes

| Class | Stored in Git | Default browser use | Export behavior |
| --- | --- | --- | --- |
| Aurora Coast demo | Yes | Available after explicit seed | Filtered by selected privacy level |
| Local Author workspace | No | `localStorage` after seed | Explicit download only |
| Spotify token cache | No | Never | Never |
| Personal Spotify import | No | Not loaded automatically | Never unless a future Author action adds it |

Aurora Coast is labelled **Fictional demonstration data** throughout the application and documentation.

## Privacy levels

- `public` — eligible for a public export after factual and proposal review.
- `friends-only` — excluded from a public export; eligible for a friends-only local export.
- `private` — available only in a complete local backup.

A music connection inherits no automatic permission from either side. Both the track and the LifeEvent must be allowed at the chosen export level.

## Author decisions

Source events begin pending. Temporal connections also begin pending. Confirmation makes a relationship eligible for export; rejection makes it non-canonical. Changing a time range can invalidate an earlier proposal, and the invalidated record remains in local audit history.

## What is never uploaded by default

- local workspace state;
- optional personal Spotify imports;
- the Spotify token cache;
- exported Markdown;
- Author decisions.

The application has no analytics, cloud persistence, authentication, or external model call.

## De-identification limitations

Changing names or dates alone does not reliably de-identify a personal history. Aurora Coast therefore changes route, countries, order, roles, relationships, people, timing, and factual structure; it also merges and splits emotional motifs. Even so, fictionalization is a creative and editorial judgment, not a mathematical privacy guarantee.

Future contributors should not use the committed demo as a place to “anonymize” real notes. New public fixtures should be authored as synthetic data from the start.
