# ADR 0003 — Day-1 tile source: OSM Standard

**Status**: Accepted
**Date**: 2026-04-24

## Context

Need a PWA-friendly, no-key, attribution-only tile source covering
Taiwan + outlying islands. Reference document §10 shortlisted OSM,
NLSC WMTS, Stadia, Esri, OpenTopoMap, Mapbox, Google.

## Decision

Use **OSM Standard** (`https://{a,b,c}.tile.openstreetmap.org/{z}/{x}/{y}.png`)
as the default tile source. Attribution string `© OpenStreetMap
contributors` is rendered in `AttributionBar.svelte`. Tile source config
lives at `src/map/tileSource.ts` so swapping sources is a one-file change.

## Consequences

- Zero account / tile-proxy setup.
- CORS `ok`; no referer lock.
- Service-worker caches tiles via Workbox `StaleWhileRevalidate`
  (cache `osm-tiles`, 7-day max age, 4096 entries).

## Alternatives considered

- **NLSC WMTS** — government open, Taiwan-specific. CORS
  "unknown-not-tested" in reference §10; revisit in a future ADR once
  CORS is verified end-to-end.
- **Stadia Maps** — commercial-agreement required.
- **Esri World Imagery** — noisy under coordinate crosshair overlays.
- **Mapbox / Google** — keyed / referer-locked.
