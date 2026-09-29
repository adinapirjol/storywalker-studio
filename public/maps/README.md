# Natural Earth geographic reference

Source: https://github.com/nvkelso/natural-earth-vector/tree/master/geojson

- `ne_110m_admin_0_countries.geojson`: 177 country features; retain `NAME_EN`,
  `LABEL_X`, `LABEL_Y`, and all Polygon/MultiPolygon rings.
- `ne_50m_populated_places_simple.geojson`: 1,251 cities; retain `name`,
  `scalerank` and Point coordinates.

Downloaded 2026-09-29. The exact raw-source SHA-256 hashes and source URLs are
inside `natural-earth.json`. Converted to compact JSON without coordinate
rounding or region filtering. This asset contains only public reference data,
not the Author's journey or Vault content.

All Natural Earth versions are public domain:
https://www.naturalearthdata.com/about/terms-of-use/

Made with Natural Earth. Generalised contemporary cartographic reference;
boundaries/labels are not evidence of presence and do not identify the Author's
stops. Data can contain disputed or outdated boundaries and names.
