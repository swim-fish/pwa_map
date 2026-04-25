# ADR 0020 — Map source catalogue + HTTPS upgrade

**Status**: Accepted (landed 2026-04-26)
**Date**: 2026-04-25
**Feature**: `003-i18n-and-map-layers`

## Context

Feature 003 promotes the previously-hardcoded OSM raster source to a
first-class catalogue and exposes a layer picker. The catalogue must
satisfy three constraints simultaneously:

1. **Cross-tool naming parity** with the Flutter project's
   `atak_flutter_map/lib/features/mbtiles/domain/models/online_source.dart`
   (operators move between the two tools and recognise IDs).
2. **PWA delivery realities** — the PWA is served over HTTPS, so any
   `http://` tile URL would trigger mixed-content blocking.
3. **Spec scope** — only `nlsc-emap5`, four Google base layers, one
   Google overlay, plus the existing `osm-standard` are in scope for
   v1; the Flutter source's broader catalogue (other NLSC layers,
   Sinica, MBTiles) is intentionally excluded.

## Decision

Centralise the catalogue in `src/map/sources.ts` exporting a frozen
`MAP_SOURCES: readonly MapLayerOption[]` of seven entries. Mirror the
Flutter IDs and labels verbatim, with two PWA-specific divergences:

- **HTTPS upgrade** — every Google URL uses `https://mt1.google.com`
  instead of the Flutter source's `http://`.
- **`hl=zh-TW` policy** — the four Google layers that support
  localised labels (`google-hybrid`, `google-terrain`,
  `google-roadmap`, `google-road-overlay`) embed `hl=zh-TW` in the
  URL template; pure `google-satellite` does NOT (no labels). This
  is FIXED on the template and intentionally decoupled from the UI
  locale — see ADR-0022 / FR-013.

## Consequences

- One source of truth for the picker, style-builder, attribution
  bar, and SW cache rules.
- Type-system enforcement (`BasemapId` union) prevents stringly-typed
  errors.
- A future MBTiles layer extension (per the Flutter source) plugs
  in by adding entries to `MAP_SOURCES` — no architectural change.
- Manual divergence from the Flutter `http://` Google URLs requires
  a comment in the catalogue noting the upgrade rationale.

## Alternatives considered

- **Fetch the catalogue from a server** — rejected: introduces a
  runtime dependency for effectively-static reference data.
- **Match the full Flutter catalogue** — rejected: out of scope per
  spec; would muddy the picker UX.
- **Keep `osmTileSource` as the only source and add layer-specific
  sources next to it** — rejected: scatters URL templates across
  files and breaks the picker abstraction.

## Implementation outcome

Landed in `src/map/sources.ts` as `MAP_SOURCES` (frozen
`readonly MapLayerOption[]`) with seven entries verbatim per the
contract. Twelve unit invariants in `tests/unit/map/sources.spec.ts`
lock down: HTTPS-only, exactly-one overlay, six-basemap order,
`hl=zh-TW` policy per source. Picker reads via `basemaps()` /
`overlays()` helpers; style builder reads via `findSource(id)`;
service-worker cache rules in `vite.config.ts` cover the same origins.

## References

- Research: `specs/003-i18n-and-map-layers/research.md` §D1
- Contract: `specs/003-i18n-and-map-layers/contracts/map-sources.md`
