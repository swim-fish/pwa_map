# Phase 0 Research: Locale Switcher + Map Layer Selector

**Feature**: `003-i18n-and-map-layers` | **Date**: 2026-04-25
**Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md)

This document resolves the design questions implicit in the spec
before Phase 1 begins. The spec deliberately stays UI-flavoured; this
file captures the architecture decisions that the Phase 1 contracts
depend on.

No `NEEDS CLARIFICATION` markers were emitted in `plan.md`. The
ambiguous areas surfaced during planning are listed and resolved
below.

---

## D1. Map source catalogue + URL templates

**Decision**: Introduce `src/map/sources.ts` exporting a frozen
`MAP_SOURCES: readonly MapLayerOption[]` of seven entries, mirroring
the labels and IDs from
`atak_flutter_map/lib/features/mbtiles/domain/models/online_source.dart`
for cross-tool naming parity. The PWA-specific divergences are:

1. **HTTPS upgrade** for every Google URL. The Flutter source uses
   `http://mt1.google.com/vt/...`; the PWA must use
   `https://mt1.google.com/vt/...` to satisfy modern browsers'
   mixed-content rule when the PWA is served over HTTPS.
2. **`hl=zh-TW` policy** is FIXED in the URL templates per FR-007,
   not driven by the UI locale. Pure satellite (`google-satellite`)
   omits `hl` because it carries no labels.
3. **Subset only** of the Flutter catalogue:
   - NLSC: `nlsc-emap5` only (drop `emap`, `emap2`, `emap6`, `emap8`,
     `emap12`, `emap15`, `nlsc-photo`).
   - Sinica `sinica-topo25k`: dropped.
   - OSM: kept as `osm-standard` (the day-1 default).
   - Google: 4 base + 1 overlay.

The catalogue's value type is plain TypeScript:

```ts
export interface MapLayerOption {
  readonly id: string;
  readonly labelKey: string;       // i18n key, e.g. 'map.layers.googleHybrid'
  readonly group: 'nlsc' | 'google' | 'other';
  readonly urlTemplate: string;    // {x}/{y}/{z} placeholders preserved
  readonly tileSize: 256;
  readonly minZoom: number;
  readonly maxZoom: number;
  readonly attributionKey: string; // i18n key, e.g. 'map.attribution.nlsc'
  readonly isOverlay: boolean;
}
```

**Rationale**:

- Centralising the catalogue makes the picker, the style-builder,
  and the SW-cache origin list read from one source of truth.
- Mirroring the Flutter IDs avoids confusion when operators switch
  between the two tools.
- Frozen at module load keeps the catalogue trivially testable.

**Alternatives considered**:

- *Fetch the catalogue from a server.* Rejected: introduces a
  runtime dependency and a cache-coherence problem for an
  effectively-static list of 7 entries.
- *Store the catalogue inside `pwa_map:prefs`.* Rejected: catalogue
  is reference data, not user preference; the user picks an *id*
  from the catalogue.
- *Match the full Flutter catalogue verbatim.* Rejected — see spec
  Out-of-scope: the additional NLSC / Sinica entries are not in
  scope for v1, and shipping them would muddy the picker.

**Planned ADR**: `docs/adr/0020-map-source-catalogue.md`.

---

## D2. MapLibre style rebuild — `setStyle` vs source-mutation

**Decision**: Use `map.setStyle(buildStyle(basemap, overlay))` on
every `(basemap, overlay)` change. `buildStyle` returns a complete
MapLibre style JSON with one or two raster sources and one or two
raster layers (overlay's layer is appended above the basemap's).

**Rationale**:

- MapLibre's `setStyle` is the documented, supported way to swap
  the entire visual stack atomically. The current zoom / center /
  bearing are preserved by passing the second argument
  `{ diff: false }` is **not** required — `setStyle` preserves
  the camera by default unless `transformStyle` is set.
- A single API call simplifies the controller surface; we don't
  have to track which sources/layers exist and surgically remove
  them, which is brittle when the operator rapidly toggles overlays.
- The performance cost of `setStyle` for a 1-source / 1-layer style
  is dominated by the first tile fetch — within the 1.5 s SC-001
  budget on a typical 4G link.

**Alternatives considered**:

- *Add / remove sources + layers individually via
  `map.addSource` / `removeSource` / `addLayer` / `removeLayer`.*
  Rejected: race-prone (the `removeLayer` must precede
  `removeSource`), and tracking which IDs are present at any time
  duplicates state already known to the catalogue.
- *Pre-attach all sources at startup, only toggle layer
  visibility.* Rejected: each source pre-fetches metadata even
  with `visibility: none` in MapLibre 3.x, costing extra requests
  the operator never pays for if they never switch.

---

## D3. Service-worker tile cache for new origins

**Decision**: Extend the existing `vite.config.ts`
`runtimeCaching` array (currently a single
`StaleWhileRevalidate` rule for `tile.openstreetmap.org`) to add one
rule per new origin, all using `StaleWhileRevalidate` with the same
`maxEntries: 4096, maxAgeSeconds: 7 * 24 * 3600` pattern. New origins:

- `https://wmts.nlsc.gov.tw/.*` (cacheName: `nlsc-tiles`).
- `https://mt1.google.com/.*` (cacheName: `google-tiles`).

Each cache is independent so eviction isolation is preserved.

**Rationale**:

- Same policy across origins keeps the offline UX uniform — once a
  tile is fetched it's available offline (US3.AS1).
- Independent cache names prevent one origin's churn from evicting
  another's tiles.
- 7 days × 4096 entries ≈ 1 GB per origin if tiles average 256 KB —
  realistically far less because the user pans a small area; quota
  pressure is handled by the browser.

**Alternatives considered**:

- *Single shared cache for all tile origins.* Rejected: hot origin
  evicts cold one's entries; debugging is harder.
- *`CacheFirst` policy.* Rejected: stale tiles can hide map updates
  for a week; SWR is the better default for tiles that change
  rarely but do change.

---

## D4. Prefs schema additive evolution

**Decision**: Add two new optional fields to the existing
`pwa_map:prefs` blob without bumping `version` from 1:

```ts
mapLayer?: 'osm-standard' | 'nlsc-emap5' | 'google-hybrid' |
           'google-satellite' | 'google-terrain' | 'google-roadmap';
overlay?: boolean;
```

The validator in `src/storage/preferences.ts`:

- accepts a prefs blob whose `mapLayer` / `overlay` are absent
  (defaults: `mapLayer = 'osm-standard'`, `overlay = false`);
- rejects (overall validation fails → returns defaults) if
  `mapLayer` is present but not in the allowed set, or `overlay`
  is present but not boolean.

**Rationale**:

- The existing `validatePreferences` already gracefully discards
  unknown / extra fields. Making the new fields optional means
  pre-003 prefs still load (returning defaults for the missing
  fields).
- Avoids a `version: 2` bump that would force every existing user
  to lose their feature 002 settings on upgrade.

**Alternatives considered**:

- *Bump `version` to 2 and migrate.* Rejected: invalidates every
  user's stored `pwa_map:prefs` — they lose their saved format
  visibility, MGRS precision, locale, etc. Net negative UX for a
  purely additive change.
- *Store layer state under a separate key
  (`pwa_map:mapLayer_v1`).* Rejected: fragments persistence across
  multiple keys for state that is conceptually one preference blob.

**Planned ADR**: `docs/adr/0021-prefs-additive-evolution.md`.

---

## D5. Tile failure detection + toast surface

**Decision**: Subscribe to MapLibre's `error` event in `MapView` and
debounce by source-id (50 ms): if any tile from the active basemap
errors, surface a localised toast (`map.layers.failure.{group}`,
e.g. "NLSC 圖磚載入失敗，已退回上一個圖層"). The MapController
records the previous-good basemap id; on failure it auto-reverts
to that id and persists the revert.

Failure detection rule:

- A basemap is "failing" if ≥ 3 of its tile requests in the first
  5 s after a swap return non-2xx, OR a single request errors
  with a CORS / network failure.
- The 5 s window matches FR-009 / SC-006.

**Rationale**:

- An auto-revert keeps the operator productive — they don't need to
  manually undo the swap.
- Debouncing prevents one transient flake (e.g., one tile 502'd)
  from triggering a revert.
- Localised toast names the failing source so the operator
  understands.

**Alternatives considered**:

- *Show an error banner inside the picker; stay on the failing
  source.* Rejected: leaves a blank canvas, which contradicts FR-009
  ("the previous basemap MUST remain visible").
- *Auto-retry with exponential backoff.* Rejected: adds complexity;
  the SWR cache already retries on the next pan / zoom.

**Planned ADR**: `docs/adr/0022-tile-failure-toast.md`.

---

## D6. Locale picker UI placement

**Decision**: Render the locale picker as a **toolbar button** sibling
to the existing `前往` (Go-To) and `格式` (Formats) buttons. Click →
small native-feel popover listing the three self-names (`中文`,
`English`, `日本語`) with the active locale highlighted. Selecting
one closes the popover and updates the locale store + persists to
`pwa_map:prefs`.

**Rationale**:

- The toolbar is already the "settings cluster" of the PWA; adding
  the language picker keeps switching one tap away.
- A self-name list (rather than a translated list) means the
  operator can find their own language even when the current locale
  is one they cannot read.
- Reusing the toolbar-button + dropdown design tokens from
  `FormatToggle` keeps Principle III's design-system rule.

**Alternatives considered**:

- *Bury the locale switch inside a Settings sheet.* Rejected: more
  taps; locale switching is a top-level concern when handing the
  device to a colleague.
- *Use the browser's `Accept-Language` header / language detection
  only (no UI).* Rejected: violates FR-010 (operator MUST be able
  to switch in-app).

---

## D7. Layer picker UI

**Decision**: Render the layer picker as a **toolbar button** that
opens a grouped dropdown / sheet with:

1. A radio-group of basemaps, grouped under `NLSC`, `Google`, and
   `Other` headers.
2. Below the groups, a separate single-row toggle for the Google
   road overlay (only enabled when a basemap is selected).
3. The active source's attribution is shown at the bottom of the
   picker for transparency.

The picker is implemented as a `role="menu"` with grouped
`role="menuitemradio"` for basemaps and `role="menuitemcheckbox"`
for the overlay toggle — matching ARIA conventions for a single-
selection radio with an independent checkbox.

**Rationale**:

- The grouped structure mirrors the catalogue's `group` property and
  the operator's mental model (NLSC is "official Taiwan", Google is
  "satellite + reference", OSM is "fallback").
- Separating the overlay from the basemaps prevents the user from
  thinking they have to choose one of seven; instead they choose
  one of six bases + an independent road overlay.
- Reusing the toolbar-button + dropdown tokens keeps Principle III.

**Alternatives considered**:

- *A bottom-sheet with chip rack like feature 002.* Rejected: chips
  don't naturally express groups + a separate toggle; a dropdown
  is more honest to the data model.
- *A persistent left-rail layer panel.* Rejected: takes screen
  real estate from the map, which is the primary surface.

---

## D8. Tile attribution surface

**Decision**: The `AttributionBar` already exists from feature 001.
Its visible text MUST come from the active basemap's
`attributionKey` (looked up via i18n). On overlay-on, append the
overlay source's attribution after a separator.

Attribution copy lives under `map.attribution.*` keys, with
locale-specific text:

- `map.attribution.osm` — `© OpenStreetMap contributors` etc.
- `map.attribution.nlsc` — `© 內政部國土測繪中心 (NLSC)` /
  `© Ministry of the Interior NLSC` / `© 内政部 国土測量中心 (NLSC)`.
- `map.attribution.google` — `© Google Maps`.

**Rationale**:

- Per OpenStreetMap, NLSC, and Google attribution requirements,
  showing the data source is mandatory.
- Localising the text keeps Principle III consistency.

**Alternatives considered**:

- *Hardcode an English-only attribution string.* Rejected: violates
  Principle V's locale parity rule.
- *Skip attribution for proprietary sources.* Not legal.

---

## D9. i18n key namespace

**Decision**: All new copy lives under three top-level branches:

- `map.layers.*` — basemap labels (`map.layers.osmStandard`,
  `nlscEmap5`, `googleHybrid`, `googleSatellite`, `googleTerrain`,
  `googleRoadmap`, `googleRoadOverlay`) + group headers
  (`map.layers.group.nlsc`, `google`, `other`).
- `map.attribution.*` — per-source attribution copy (D8).
- `map.failure.*` — failure-toast copy (per group).
- `locale.picker.*` — picker title + close.
- `toolbar.layers.button` / `toolbar.locale.button` — toolbar
  affordance labels.

The `zh` locale is the canonical key set per Constitution v1.1.0;
`en` and `ja` follow the same fallback chain (`ja → en → zh`).

**Rationale**:

- Grouping by component (layers / attribution / failure / locale-
  picker) maps cleanly to the picker / toast / attribution-bar
  boundaries and keeps the diff per-locale symmetrical.
- Self-names in the locale picker (`中文`, `English`, `日本語`)
  are rendered as plain literals, NOT i18n keys, because they
  intentionally break the localised lookup (the operator wants to
  see their own language by name).

---

## D10. Default basemap policy

**Decision**: First-run users get `osm-standard` (matching feature
001 / 002). On second-and-later loads the persisted choice from
`pwa_map:prefs` wins. If the persisted id is not in the catalogue
(future schema drift), the validator's fallback yields
`osm-standard` and persists that fallback on next save.

**Rationale**:

- Keeps the OSM behavioural baseline for new users so existing
  acceptance tests for the map view remain valid.
- The first-load default is OSM (no terms-of-service ambiguity for
  the first-run case); operators who want NLSC or Google opt in
  explicitly.

**Alternatives considered**:

- *Default to NLSC for Taiwanese users (geo-IP detection).*
  Rejected: adds runtime IP / locale guess + bias; explicit picker
  is enough.
- *Default to whatever the browser's locale-derived guess is.*
  Rejected: locale and basemap are independent concerns
  (US2.AS4 / FR-013).

---

## Summary

All `NEEDS CLARIFICATION` items are resolved. Phase 1 may proceed:
data-model.md, the six contract files, and quickstart.md are derived
from these decisions; no decision in this list will require revisiting
unless a Phase 1 review finds an inconsistency.
