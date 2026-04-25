# Feature Specification: Locale Switcher + Map Layer Selector

**Feature Branch**: `003-i18n-and-map-layers`
**Created**: 2026-04-25
**Status**: Draft
**Input**: User description: "i18n Enable, Map layer select — include nlsc-emap5,
google-hybrid, google-satellite, google-terrain, google-roadmap,
google-road-overlay; Chinese Google maps must include `hl=zh-TW`"

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Switch the map layer (Priority: P1) 🎯 MVP

Field operators in Taiwan rely on different basemaps depending on the
mission: NLSC's official electronic map for civil-defence detail,
Google satellite or hybrid for terrain familiarity, Google road map for
navigation context, plus a Google road overlay that can be layered
on top of any imagery. The current PWA only renders OpenStreetMap.
Operators need a control that picks the basemap with one tap and a
second control that toggles the road overlay on top.

**Why this priority**: this is the headline value of the feature.
Without it, operators cannot match the map style to the task and have
to fall back to other tools.

**Independent Test**: open the app, tap the layer-picker, select each
basemap in turn, verify the correct tiles render, then enable the
Google road overlay and verify the road network appears on top. After
a reload, the previously-selected basemap and overlay state are
restored.

**Acceptance Scenarios**:

1. **Given** the layer picker is closed, **When** the operator taps
   the picker affordance, **Then** the picker shows seven options
   grouped as: NLSC (1 entry), Google base (4 entries), and Google
   overlay (1 entry, separately selectable).
2. **Given** OSM is the current basemap, **When** the operator picks
   `NLSC 電子地圖（等高線+門牌）`, **Then** the map repaints with NLSC
   tiles within 1 s and the attribution updates to NLSC.
3. **Given** any Google basemap is selected, **When** the operator
   toggles `Google 路網疊加層` on, **Then** the road network appears
   on top of the basemap; toggling it off removes the overlay.
4. **Given** the operator selected `Google 衛星混合` and reloads the
   page, **When** the app starts, **Then** the same basemap renders.
5. **Given** any Google basemap that supports localised labels is
   selected, **When** tiles render, **Then** the labels appear in
   Traditional Chinese — independent of the operator's UI locale
   (the `hl=zh-TW` parameter is fixed in the URL template; see
   FR-007 + FR-013).

---

### User Story 2 — Switch the interface language (Priority: P2)

The PWA already ships with three locale catalogues (`zh`, `en`, `ja`)
seeded from the browser. Operators handing the device to a colleague
who speaks a different language need a quick in-app switch without
having to change the browser locale.

**Why this priority**: lower than the layer picker because the locale
is already auto-detected — the manual switch is a fallback, not the
primary value path. But it is a constitutional requirement (locale
parity is a Principle V invariant) and must be reachable from the UI.

**Independent Test**: open the language picker, switch to each of
`zh / en / ja`, verify visible UI strings change immediately
(toolbar buttons, modal titles, error messages, layer-picker labels).
After a reload, the chosen locale is restored.

**Acceptance Scenarios**:

1. **Given** the language picker is closed, **When** the operator
   opens it, **Then** the three locales are listed with their
   self-name (`中文`, `English`, `日本語`).
2. **Given** the operator selects `English`, **When** the picker
   closes, **Then** every visible label, button, and tooltip in the
   PWA is in English within one repaint.
3. **Given** the operator selected `日本語` and reloads the page,
   **When** the app starts, **Then** the UI is still in Japanese.
4. **Given** the operator selects a locale, **When** any localised
   Google basemap is currently active, **Then** the Google `hl`
   parameter does NOT change — Google labels stay in Traditional
   Chinese (the operator's interface language is independent of the
   tiles' label language for this feature).

---

### User Story 3 — Cache previously-loaded tiles for offline use (Priority: P3)

Operators routinely lose connectivity in the field. The app already
stale-while-revalidates OSM tiles via the service worker. Extending
that behaviour to the new tile sources keeps the UX consistent — once
a tile has been downloaded, it remains available offline.

**Why this priority**: opportunistic robustness. The app stays
usable offline for OSM today; the new layers should match. But
nothing in this feature *requires* it — it is a UX consistency win,
not a critical capability.

**Independent Test**: load an area with `NLSC 電子地圖`, then go
offline, pan within that area — tiles still render. Switch to
`Google 純衛星`, pan in the same area while offline — already-cached
satellite tiles render, uncached ones show the missing-tile fallback.

**Acceptance Scenarios**:

1. **Given** the operator viewed area A on `NLSC 電子地圖`, **When**
   the device goes offline and the operator pans within area A,
   **Then** the cached NLSC tiles render.
2. **Given** the operator never viewed area B, **When** the operator
   pans to area B while offline, **Then** the missing-tile placeholder
   is shown (no crash, no spinner forever).

---

### Edge Cases

- The operator picks a basemap whose tiles fail to load (HTTP 4xx /
  5xx, blocked by network policy). The picker indicator MUST surface
  the failure within 5 s and the previous basemap remains visible
  rather than leaving a blank canvas.
- The operator selects an overlay-only entry as a basemap (impossible
  by design — overlays are not selectable as base). The picker MUST
  visually distinguish the overlay row so this misuse is unreachable.
- The operator's `localStorage` is full / disabled. Layer + locale
  selection still work for the current session; the next reload falls
  back to defaults (NLSC for layer if reachable, otherwise OSM;
  navigator-derived for locale).
- The operator switches locale while a Google base is active. The
  Google `hl=zh-TW` query parameter is fixed by the tile source's
  URL template — it does NOT track the UI locale. (See US2.AS4.)
- The operator's preferred basemap from `pwa_map:prefs` is no longer
  in the catalogue (after a future schema change). The app falls back
  to the default basemap and persists that fallback.
- The operator on a metered connection picks a heavy raster source
  (Google satellite). No data-usage warning is shown — it is the
  operator's choice. (Out of scope.)
- Tiles requested over `http://` (Google's `mt1.google.com`) on an
  HTTPS-served PWA. Modern browsers may block mixed content. The
  catalogue MUST upgrade Google URLs to `https://` so the PWA does
  not require mixed-content allowances.

## Requirements *(mandatory)*

### Functional Requirements

#### Layer selector

- **FR-001**: The system MUST expose a layer-picker control reachable
  from the toolbar with a localised label (`圖層` / `Layers` /
  `レイヤー`).
- **FR-002**: The picker MUST list at least these basemap entries with
  the labels from the reference Flutter source so cross-team operators
  recognise them:
  - `nlsc-emap5` — `NLSC 電子地圖（等高線+門牌）` — NLSC group.
  - `osm-standard` — `OpenStreetMap` — Other group (the day-1 default
    is preserved for compatibility).
  - `google-hybrid` — `Google 衛星混合` — Google group.
  - `google-satellite` — `Google 純衛星` — Google group.
  - `google-terrain` — `Google 地形` — Google group.
  - `google-roadmap` — `Google 路線圖` — Google group.
- **FR-003**: The picker MUST list `google-road-overlay`
  (`Google 路網疊加層`) as a SEPARATE overlay toggle, not selectable
  as a basemap, that can be combined with any basemap.
- **FR-004**: Selecting a basemap MUST repaint the map within 1 s and
  update the attribution-bar text to the source's published
  attribution (NLSC for NLSC tiles, Google for Google tiles, OSM for
  OSM tiles).
- **FR-005**: Toggling the overlay MUST add / remove the road network
  on top of the active basemap; the basemap is not affected.
- **FR-006**: The selected basemap and overlay state MUST persist to
  the same `localStorage` blob as the existing format preferences
  (`pwa_map:prefs`) and survive page reloads.
- **FR-007**: All Google basemap URLs that support localised labels
  (`google-hybrid`, `google-terrain`, `google-roadmap`,
  `google-road-overlay`) MUST include the `hl=zh-TW` query parameter
  so labels render in Traditional Chinese. `google-satellite` (pure
  imagery, no labels) MUST NOT include `hl`.
- **FR-008**: All tile-template URLs in the catalogue MUST use
  `https://` to avoid mixed-content blocking.
- **FR-009**: Tile failures (HTTP error, network failure) MUST be
  surfaced as a non-modal toast that names the failing basemap; the
  previous basemap MUST remain visible. The toast auto-dismisses after
  5 s.

#### Locale switcher

- **FR-010**: The system MUST expose a language-picker control
  reachable from the toolbar with a localised label
  (`語言` / `Language` / `言語`).
- **FR-011**: The picker MUST list the three supported locales by
  their self-name: `中文` (`zh`), `English` (`en`), `日本語` (`ja`).
- **FR-012**: Selecting a locale MUST update every visible UI string
  in the application within one repaint without a page reload, and
  persist the choice to `pwa_map:prefs`.
- **FR-013**: The locale switch MUST NOT alter the Google tile
  URLs' `hl` parameter — Google label language is fixed at
  `hl=zh-TW` per FR-007.

#### Persistence + offline

- **FR-014**: The `pwa_map:prefs` schema MUST gain a `mapLayer` field
  (basemap id from FR-002) and an `overlay` flag (boolean for the
  Google road overlay). On any schema-validation failure the prefs
  fall back to defaults and the corrupt blob is overwritten on next
  save.
- **FR-015**: The service-worker runtime caching strategy MUST
  apply the same `StaleWhileRevalidate` policy currently used for OSM
  to all newly-added tile origins so previously-fetched tiles remain
  available while offline.

### Key Entities

- **MapLayerOption** — a catalogued tile source: stable id, display
  label (localisation key), URL template, tile size, min/max zoom,
  attribution text, group (NLSC / Google / Other), whether it's an
  overlay.
- **LayerSelection** — the operator's runtime + persisted choice:
  active basemap id (one of FR-002), overlay-on flag (boolean).
- **LocaleSelection** — the operator's chosen UI language: one of
  `zh / en / ja`. Already represented in `pwa_map:prefs` from
  feature 001; this feature exposes the picker only.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Operators can switch from any basemap to any other in
  ≤ 1.5 s (tap → first new tile painted on a typical 4G link).
- **SC-002**: Operators can find and operate the layer picker on
  first encounter without help: ≥ 90 % task-completion rate in a
  five-operator dogfood test.
- **SC-003**: All four Chinese-labelled Google basemaps render
  Traditional Chinese place names by default — verified by
  inspecting the rendered tile URLs (each carries `hl=zh-TW`) on
  every Google basemap path covered by FR-007.
- **SC-004**: After reload, ≥ 99 % of operators' last basemap +
  overlay choice is restored (anything below indicates a persistence
  bug).
- **SC-005**: Switching the UI locale updates every user-facing
  string within 200 ms with no flicker of the previous language.
- **SC-006**: Layer-switch failures (FR-009) surface a localised
  toast in ≤ 5 s; the previous basemap remains visible — verified by
  blocking the new origin and asserting no blank canvas.
- **SC-007**: PWA initial-load JavaScript bundle (gzipped) gains
  ≤ 5 KB versus feature 002's baseline (the new code is a small
  catalogue + two pickers; no new runtime dependency).

## Assumptions

- The PWA continues to run on the existing Svelte / MapLibre GL JS /
  Vite stack from features 001–002. No new map engine.
- Tile sources are accessed directly from the browser; no CORS proxy
  is introduced. Where a source requires HTTPS upgrade (Google), the
  catalogued URL uses `https://`.
- Google tile URLs (`https://mt1.google.com/vt/...`) are governed by
  Google's terms of service for the operator's specific deployment
  context. Compliance is the operator's responsibility; the app only
  exposes the URLs.
- NLSC's WMTS endpoints (`wmts.nlsc.gov.tw`) are public, free, and
  served over HTTPS.
- The day-1 default basemap remains OSM for first-run users; the
  default flips to the operator's persisted choice on subsequent
  loads.
- The reference Flutter source
  (`atak_flutter_map/lib/features/mbtiles/domain/models/online_source.dart`)
  is the authoritative ID + label catalogue for cross-tool naming
  parity. Where the Flutter source uses `http://` for Google, the
  PWA upgrades to `https://` (FR-008).
- The existing service-worker-managed runtime cache (currently OSM)
  is extended to additional origins via the same StaleWhileRevalidate
  policy without per-source TTL tuning.
- This feature does NOT add an MBTiles offline-bundle picker (the
  Flutter source supports custom MBTiles); only the **online** layers
  enumerated in FR-002 / FR-003 are in scope.
- The feature does NOT add transparent NLSC overlay tiles
  (`nlsc-emap2` / `nlsc-emap12` from the Flutter source); only
  `nlsc-emap5` is in scope for the v1 picker.
- Locale switching does NOT translate map tile labels (Google `hl`
  is a separate concern — see FR-007 + FR-013).

## Out of scope

- MBTiles / offline-bundle picker (covered by `custom_map_source.dart`
  in the Flutter source, not in this PWA feature).
- A "preview / thumbnail" affordance for each layer in the picker.
- Per-layer zoom-range enforcement that overrides the map's current
  zoom (the map keeps its current zoom; the layer's max-zoom only
  affects when tiles stop loading).
- Custom user-defined tile templates ("paste a TMS URL").
- Transparent NLSC overlays (multiple labelled-tile combinations).
- A data-usage warning for heavy raster sources.
- Server-side localised Google tile language toggle (FR-013 fixes
  `hl=zh-TW`).
