# Dataset and licence register

| World | Source / stable ID | Version or retrieval | Licence / conditions | Prototype state |
| --- | --- | --- | --- | --- |
| Festival programme | Ars Electronica Festival 2026 programme records; use event URL/ID as stable ID | Retrieved for the 2026 programme; save exact dataset release at hackathon | Record terms supplied with the official dataset; do not assume a licence from webpage text | Public records in deterministic fixture; replace with official download
| City spatial context | City of Linz `Parkscheinautomaten_20240207` shapefile release; GUIDs `cdc4…2fcf`, `171f…179b38`, `016d…31613f` | 2024-02-07 path: `data.linz.gv.at/katalog/geodata/parkscheinautomaten/2024/` | CC BY 4.0; attribution: “Datenquelle: Stadt Linz - https://data.linz.gv.at” | Three public fragments in demo; source coordinates are intentionally excluded
| Street-name history | Optional City street-name history dataset | Pending exact release/metadata check | Record before use | Narrative-only enrichment; never creates geometry
| Spotify extended history | Author export | Local selected subset only | Spotify account data; no redistribution of audio | Ignored, minimised locally
| Google Timeline | Author export | Local selected subset only | Google account data; no redistribution | Ignored, minimised locally
| Authored memory | Three selected low-stakes records | Author-controlled | Private | Ignored, never fabricated

### Join protocol for street names

Preserve original and normalised name. Join only to a unique geolocated venue/address record. Record `matched`, `ambiguous` or `unmatched`; retain failed joins in the ledger. Test historical renaming and normalisation. Do not manufacture coordinates.

The selected City dataset is spatial and therefore safer for triggering. Street history is not used as a geofence source.
