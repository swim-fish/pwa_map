# Phase 1 Data Model: Locale Switcher + Map Layer Selector

**Feature**: `003-i18n-and-map-layers` | **Date**: 2026-04-25
**Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md)

This document inventories every entity introduced or extended by
feature 003 and shows how they relate. New types live in
`src/map/sources.ts` (catalogue) or `src/types/map.ts` (shared
shapes). Pre-existing types from feature 001 / 002 are reused
verbatim.

---

## 1. MapLayerOption (catalogue entry)

A single tile source in the catalogue. Frozen at module load — never
mutated at runtime.

```ts
// src/map/sources.ts
export type MapGroup = 'nlsc' | 'google' | 'other';

export interface MapLayerOption {
  readonly id: string;             // stable id; matches the Flutter source where applicable
  readonly labelKey: string;       // i18n key, e.g. 'map.layers.googleHybrid'
  readonly group: MapGroup;
  readonly urlTemplate: string;    // {x}/{y}/{z} placeholders preserved
  readonly tileSize: 256;
  readonly minZoom: number;
  readonly maxZoom: number;
  readonly attributionKey: string; // i18n key, e.g. 'map.attribution.nlsc'
  readonly isOverlay: boolean;     // true → only selectable as the overlay slot
}

export type BasemapId =
  | 'osm-standard'
  | 'nlsc-emap5'
  | 'google-hybrid'
  | 'google-satellite'
  | 'google-terrain'
  | 'google-roadmap';

export type OverlayId = 'google-road-overlay';

export const MAP_SOURCES: readonly MapLayerOption[] = [
  /* 7 entries — see contracts/map-sources.md §2 for the verbatim list */
];

export const DEFAULT_BASEMAP: BasemapId = 'osm-standard';
```

**Validation rules**:

- Every `id` MUST be unique.
- Every `urlTemplate` MUST start with `https://`.
- Every Google template that supports labels (`google-hybrid`,
  `google-terrain`, `google-roadmap`, `google-road-overlay`) MUST
  contain `hl=zh-TW`. `google-satellite` MUST NOT contain `hl=`.
- Exactly one entry MUST have `isOverlay === true`
  (`google-road-overlay`).
- Exactly six entries MUST have `isOverlay === false`.

**State transitions**: none (immutable reference data).

---

## 2. LayerSelection (operator's runtime + persisted choice)

The operator's currently-active map state.

```ts
// src/types/map.ts
export interface LayerSelection {
  readonly basemap: BasemapId;
  readonly overlay: boolean; // true → google-road-overlay layered on top
}
```

**Defaults**: `{ basemap: 'osm-standard', overlay: false }`.

**Persistence**: serialised into `pwa_map:prefs` as additive fields
`mapLayer: BasemapId | undefined` and `overlay: boolean | undefined`
(see §4 below).

**Lifecycle**:

- `setBasemap(id)` — atomic: validate against catalogue, swap style
  via `MapController`, persist.
- `toggleOverlay(on?)` — atomic: validate, swap style, persist.
- `revertToPrevious()` — used by the failure-toast path; restores
  `LayerSelection` from a snapshot taken before a failed swap.

**Invariants**:

- `basemap` is always a valid `BasemapId` from the catalogue.
- `overlay` is always boolean; if `true` the overlay layer is
  rendered on top of the basemap.

---

## 3. LocaleSelection (operator's UI language)

```ts
// existing in src/types/coord.ts
export type Locale = 'zh' | 'en' | 'ja';
```

Already represented in `pwa_map:prefs` from feature 001. Feature 003
exposes the picker UI only — no schema change.

**Defaults**: navigator-derived (existing logic in
`src/storage/preferences.ts :: seedLocaleFromNavigator`).

**Persistence**: `pwa_map:prefs.locale`.

**Lifecycle**:

- `setLocale(locale)` — atomic: update `i18n` writable store,
  persist to `pwa_map:prefs`.

---

## 4. FormatPreferences (extended schema)

Extension of feature 001's preferences shape. **Additive only — no
version bump.**

```ts
// src/storage/preferences.ts
export interface FormatPreferences {
  readonly version: 1;
  readonly visible: readonly CoordinateKind[];
  readonly mgrsPrecision: MGRSPrecision;
  readonly taipowerPrecision: TaipowerPrecision;
  readonly locale: Locale;
  // NEW (optional — defaults applied on absence):
  readonly mapLayer?: BasemapId;
  readonly overlay?: boolean;
}
```

**Validation rules** (extending `validatePreferences`):

- If `mapLayer` is present, it MUST equal one of the six known
  basemap ids; otherwise the entire blob is rejected (returns
  defaults per the existing pattern).
- If `overlay` is present, it MUST be `boolean`; otherwise the
  entire blob is rejected.
- Absence of either field is valid (use defaults).

**Defaults helper**:

```ts
export function defaultPreferences(): FormatPreferences {
  return {
    version: 1,
    visible: ['wgs84-dd', 'wgs84-dms', 'twd97-tm2', 'mgrs'],
    mgrsPrecision: 5,
    taipowerPrecision: 9,
    locale: seedLocaleFromNavigator(),
    mapLayer: 'osm-standard',
    overlay: false,
  };
}
```

(The defaults helper now sets concrete values for the new fields so
that downstream consumers can read them as non-undefined; the
optional declaration on the interface preserves backward-compat for
any caller still passing pre-003 prefs.)

---

## 5. MapStyle (transient build artefact)

Output of `buildStyle(basemap, overlay) → MapLibre StyleSpecification`.

```ts
// src/map/styleBuilder.ts
import type { StyleSpecification } from 'maplibre-gl';

export function buildStyle(
  basemap: MapLayerOption,
  overlay: MapLayerOption | null,
): StyleSpecification;
```

**Shape** (style JSON v8):

```json
{
  "version": 8,
  "sources": {
    "<basemap.id>": {
      "type": "raster",
      "tiles": ["<https url with {x}{y}{z}>"],
      "tileSize": 256,
      "attribution": "",
      "minzoom": 0,
      "maxzoom": <basemap.maxZoom>
    },
    "<overlay.id (if any)>": { ... }
  },
  "layers": [
    { "id": "<basemap.id>-layer", "type": "raster", "source": "<basemap.id>" },
    { "id": "<overlay.id>-layer", "type": "raster", "source": "<overlay.id>" }
  ]
}
```

**Lifecycle**: rebuilt on every `(basemap, overlay)` change. Never
persisted.

---

## 6. TileFailureSnapshot (transient)

```ts
// src/map/MapController.ts
interface TileFailureSnapshot {
  readonly previous: LayerSelection;
  readonly attemptedBasemap: BasemapId;
  readonly errorCount: number;
  readonly windowStartedAt: number;
}
```

**Lifecycle**:

- Created when the operator picks a new basemap; resets on each
  successful tile load.
- Garbage-collected after 5 s.
- If `errorCount` ≥ 3 OR a CORS / network error fires within the
  5 s window, `MapController` reverts to `snapshot.previous`,
  emits a `tilefail` event with the basemap id, and the UI
  displays a localised toast.

**MapView error-forwarding rule** (refinement landed in
`/speckit.implement` 2026-04-26 — see ADR 0022 Implementation
outcome): `src/components/MapView.svelte` subscribes to MapLibre's
`error` event but **only forwards events that look like real fetch
failures** to `MapController.recordTileError`. The rule:

- Forward iff `e.error?.status` is `0` or `≥ 400`
  (HTTP-level failure), OR `status` is `undefined` AND the error
  message matches `/fetch|network|abort/i` (transport-level
  failure).
- Decode errors, render errors, and style-validation errors are
  **NOT** forwarded — the tiles arrived but couldn't be rendered,
  which means the origin is reachable; reverting the basemap would
  be a false positive.
- `recordTileError` is called with `{ fatal: true }` on any HTTP
  failure (status 0 / ≥ 400) so a single fatal error reverts
  immediately, and with `{ fatal: false }` on transport-level
  failures so the 3-error debounce applies.

This rule prevents the chromium-stub-PNG false positive observed
during US1.AS4 E2E (where 1×1 stub PNGs decode as "wrong tile size"
and would otherwise trigger ≥ 3 decode errors → false revert).

---

## 7. Relationships

```text
Catalogue (immutable)
   │
   │ chosen by id
   ▼
LayerSelection (runtime + persisted)
   │
   │ resolves to MapLayerOption(s) via id lookup
   ▼
buildStyle(basemap, overlay) ──▶ MapLibre StyleSpecification
                                      │
                                      ▼
                          map.setStyle(...) (rebuilds tiles)
                                      │
                          ┌───────────┴───────────┐
                          ▼                       ▼
                  successful tile loads     failure detection
                          │                       │
                          ▼                       ▼
                   AttributionBar updates    TileFailureSnapshot
                                                  │
                                                  ▼
                                          revertToPrevious + toast
```

---

## 8. Files affected

| File | Status | What it owns |
|---|---|---|
| `src/map/sources.ts` | NEW | `MapLayerOption`, `BasemapId`, `OverlayId`, `MAP_SOURCES`, `DEFAULT_BASEMAP`. |
| `src/map/styleBuilder.ts` | NEW | `buildStyle(basemap, overlay)`. |
| `src/types/map.ts` | NEW | `LayerSelection`. |
| `src/storage/preferences.ts` | AMENDED | `mapLayer` / `overlay` validation + defaults. |
| `src/map/MapController.ts` | AMENDED | `setBasemap(id, overlay)` method; `tilefail` event. |
| `src/components/MapView.svelte` | AMENDED | Subscribes to `tilefail`; calls `map.setStyle` on layer change. |
| `src/components/AttributionBar.svelte` | AMENDED | Renders attribution from active basemap (and overlay if on). |
| `src/components/LayerPicker.svelte` | NEW | Toolbar dropdown; basemap radio + overlay checkbox. |
| `src/components/LocalePicker.svelte` | NEW | Toolbar dropdown; zh / en / ja radio. |
| `src/i18n/{zh,en,ja}.json` | AMENDED | New keys under `map.layers.*`, `map.attribution.*`, `map.failure.*`, `locale.picker.*`, `toolbar.{layers,locale}.button`. |
| `vite.config.ts` | AMENDED | `runtimeCaching` rules for NLSC + Google origins. |
| `tests/unit/map/sources.spec.ts` | NEW | Catalogue invariants. |
| `tests/unit/map/styleBuilder.spec.ts` | NEW | Per-(basemap, overlay) style JSON. |
| `tests/unit/map/MapController.spec.ts` | EXTENDED | `setBasemap` + tile-failure path. |
| `tests/unit/storage/preferences.spec.ts` | EXTENDED | `mapLayer` / `overlay` defaults + validation. |
| `tests/integration/layers-and-locale.spec.ts` | NEW | Picker wiring. |
| `tests/e2e/story-3c-layers-and-locale.spec.ts` | NEW | E2E for US1 / US2 / US3. |
