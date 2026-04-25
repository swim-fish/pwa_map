# ADR 0002 — Map engine: MapLibre GL JS 3.x

**Status**: Accepted
**Date**: 2026-04-24
**Feature**: `001-coord-map-pwa`

## Context

SC-007 requires ≥ 10 Hz coordinate readout during continuous pan on
mid-range 2024 mobile. Research R2 shortlisted MapLibre, Leaflet,
OpenLayers, Mapbox, and Google Maps.

## Decision

Use **MapLibre GL JS 3.x** as the map engine. MIT-licensed fork of
Mapbox GL JS v1.13. Code-split into its own async chunk via
`rollupOptions.output.manualChunks.maplibre` so the entry bundle stays
tiny.

## Consequences

- GPU (WebGL) rendering — the 10 Hz pan budget is comfortable.
- Raster (OSM day-1) + vector (future) tiles from the same engine.
- Adds ~200 KB gzipped to the async chunk. Entry chunk remains under
  the 200 KB initial-load budget (see ADR 0005 + the bundle-size check
  script).

## Alternatives considered

- **Leaflet 1.9** — DOM-tiled; smaller but pan-redraw is jerkier on
  mid-range Android per reference §10.
- **OpenLayers 9** — ~200 KB alone; no room for the rest.
- **Mapbox GL JS** — requires an access token + SaaS telemetry;
  commercial trap for a Taiwan-open-data product.
- **Google Maps JS** — ToS forbids third-party tile sources and requires
  a key; referer-enforced on tiles.
