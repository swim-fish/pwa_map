# Implementation Plan: Locale Switcher + Map Layer Selector

**Branch**: `003-i18n-and-map-layers` | **Date**: 2026-04-25 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/003-i18n-and-map-layers/spec.md`

## Summary

Promote two latent capabilities of the PWA to first-class operator
surfaces:

1. **Map layer selector** (US1, P1 / MVP) — replace the hardcoded OSM
   raster source from features 001–002 with a small online-tile
   catalogue plus a basemap picker and a separately-toggleable Google
   road overlay. Catalogue entries: `osm-standard`, `nlsc-emap5`,
   `google-hybrid`, `google-satellite`, `google-terrain`,
   `google-roadmap` (basemaps) and `google-road-overlay` (overlay).
   IDs, labels, and URL templates mirror the Flutter project's
   `online_source.dart` for cross-tool naming parity, except every
   Google URL is upgraded from `http://` to `https://` to avoid
   mixed-content blocking on the HTTPS-served PWA. The four Google
   layers that support localised labels carry `hl=zh-TW`; pure
   satellite (no labels) does not.

2. **Locale picker** (US2, P2) — surface the existing `zh / en / ja`
   i18n catalogue (already shipped in features 001–002) behind a
   toolbar control so operators can flip the UI language without
   changing the browser locale. The Google `hl` parameter is fixed
   on the URL template and is intentionally decoupled from the UI
   locale.

3. **Offline cache parity** (US3, P3) — extend the existing
   service-worker runtime-cache (`StaleWhileRevalidate` for OSM
   tiles) to the new tile origins so previously-fetched NLSC and
   Google tiles continue to render offline.

Technical approach: keep the TypeScript + Svelte + MapLibre + Vite
toolchain (no new runtime deps). Add a small `src/map/sources.ts`
catalogue + `src/map/styleBuilder.ts` that constructs MapLibre style
JSON from a `(basemapId, overlay)` pair; rebuild the active style via
`map.setStyle()` on changes. Add a `LayerPicker.svelte` (toolbar
button → grouped dropdown) and `LocalePicker.svelte` (toolbar button →
self-name list). Extend `src/storage/preferences.ts` with optional
`mapLayer` (basemap id, default `'osm-standard'`) and `overlay`
(boolean, default `false`) fields — additive on top of the existing
`pwa_map:prefs` blob; absent fields validate via the default. Tests
are TDD: Vitest unit specs for the catalogue + style-builder + prefs
schema, Vitest integration for component-level wiring, Playwright
E2E for the picker flows + tile-failure toast + reload persistence.

## Technical Context

**Language/Version**: TypeScript 5.5+ (ES2022 target) — inherited from
001 / 002.
**Primary Dependencies**:

- `svelte` 4.x (UI; reuse the existing component conventions, stores).
- `maplibre-gl` 3.x (existing — `setStyle` is the only new API call).
- `vite-plugin-pwa` 0.20.x (existing — only the `runtimeCaching`
  origin list grows). **No new runtime deps.**

**Storage**: One additive field set on the existing
`pwa_map:prefs` localStorage key. New optional fields:

- `mapLayer`: `'osm-standard' | 'nlsc-emap5' | 'google-hybrid' |
  'google-satellite' | 'google-terrain' | 'google-roadmap'`
- `overlay`: `boolean` (true → `google-road-overlay` on)

Schema validation rejects unknown ids and falls back to defaults on
any failure (FR-014). No version bump needed; missing fields validate
via defaults (additive evolution per ADR 0008's pattern).

**Testing**: Vitest (unit + integration) + Playwright (E2E).
Component specs use the Svelte 4 raw-mount pattern from feature 002's
integration tests (no new testing-library dep). New E2E lives in
`tests/e2e/story-3c-layers-and-locale.spec.ts`.

**Target Platform**: Same as 001 / 002 — Chrome 120+, Edge 120+,
Firefox 120+, Safari 17+; Android 10+, iOS 15+.

**Project Type**: Single project — extension of the existing PWA. No
backend, no new package boundary.

**Performance Goals**:

- Basemap switch → first new tile painted: ≤ 1.5 s on a typical 4G
  link (SC-001).
- Locale switch → every visible string repainted: ≤ 200 ms with no
  flicker of the previous language (SC-005).
- Tile-failure toast surfaces: ≤ 5 s after a base swap whose new
  origin returns errors (SC-006).

**Constraints**:

- Total JS bundle (gzipped, initial load): unchanged ceiling of
  ≤ 200 KB; **delta from feature 002 ≤ 5 KB** (SC-007). Feature 002's
  measured size was 77.61 KB; budget = 82.61 KB.
- Total CSS bundle (gzipped, initial load): ≤ 22 KB.
- No runtime network dependency added beyond the new tile origins.
- WCAG AA contrast preserved on the two new toolbar pickers.
- Mixed-content compliance: every catalogued URL MUST be `https://`
  (FR-008).
- Tile-language constraint: Google URLs that support labels MUST
  include `hl=zh-TW`; pure satellite MUST NOT include `hl`
  (FR-007).

**Scale/Scope**: 7 catalogue entries (6 basemaps + 1 overlay); 1
catalogue module, 1 style-builder module, 2 picker components, 1
schema-extension to `preferences.ts`, 1 service-worker config update;
~10 new i18n keys per locale (zh / en / ja); ~25 new test cases
(8 unit, 6 integration, 6 E2E, 5 schema).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Requirement | How this plan complies |
|---|---|---|
| I. Code Quality & Formatting | Formatter + linter clean before every commit | Reuse the existing Prettier + ESLint config; `npm run format` is run after every code edit per the project workflow. |
| II. Test-First Development (NON-NEGOTIABLE) | Red-Green-Refactor for all production paths | Tasks generated from this plan order tests before implementation per layer: catalogue + style-builder unit specs first, then `sources.ts` / `styleBuilder.ts`; preferences schema spec first, then schema extension; component specs before `*.svelte`; E2E story specs before wiring. |
| III. User Experience Consistency | Design-system consistency; `docs/ui/` updated on UI change | Reuse the toolbar-button + dropdown tokens from feature 001's `FormatToggle` and feature 002's `ChipRack`. A new `docs/ui/0003-layers-and-locale.md` will be added before implementation lands, covering the two pickers, attribution-bar update behaviour, and the failure-toast affordance. |
| IV. Performance Requirements | Explicit budgets + CI verification | Budgets declared in **Performance Goals** above. `npm run bundle-size` continues to assert JS / CSS gzipped budgets; the new feature's delta is bounded at ≤ 5 KB JS gzipped. |
| V. Documentation & ADRs | English-first; ADRs for significant decisions; index updated after `/speckit.analyze` & `/speckit.implement` | Three planned ADRs (see `research.md` decisions D1, D2, D5): `0020-map-source-catalogue.md`, `0021-prefs-additive-evolution.md`, `0022-tile-failure-toast.md`. Indexed in `docs/adr/README.md` at `/speckit.implement` time per Principle V. |

**Verdict**: PASS. No deviations, no Complexity Tracking rows
required.

## Project Structure

### Documentation (this feature)

```text
specs/003-i18n-and-map-layers/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 — decisions + alternatives rejected
├── data-model.md        # Phase 1 — entities (MapLayerOption, LayerSelection, …)
├── quickstart.md        # Phase 1 — dev + smoke-test walkthrough
├── contracts/           # Phase 1 — interface contracts
│   ├── map-sources.md         # Tile-source catalogue API
│   ├── style-builder.md       # (basemap, overlay?) → MapLibre style JSON
│   ├── preferences-v1.md      # Additive schema for mapLayer / overlay
│   ├── layer-picker.md        # Picker UI contract
│   ├── locale-picker.md       # Picker UI contract
│   └── service-worker-cache.md # Runtime-cache origin coverage
└── checklists/
    └── requirements.md  # Quality checklist (already created)
```

### Source Code (repository root)

```text
src/
├── components/
│   ├── LayerPicker.svelte           # NEW — toolbar dropdown; basemap + overlay toggle
│   ├── LocalePicker.svelte          # NEW — toolbar dropdown; zh / en / ja
│   ├── MapView.svelte               # AMENDED — applies style from styleBuilder; subscribes to error events
│   ├── AttributionBar.svelte        # AMENDED — text comes from active source's attribution
│   └── (existing components unchanged)
├── map/
│   ├── tileSource.ts                # KEPT — `osmTileSource` shape + `buildOsmStyle` retained for backwards-compat tests; deprecated annotation
│   ├── sources.ts                   # NEW — MapLayerOption catalogue (7 entries)
│   ├── styleBuilder.ts              # NEW — buildStyle(basemap, overlay) → MapLibre style JSON
│   └── MapController.ts             # AMENDED — exposes a setBasemap(id, overlay) method that rebuilds style
├── storage/
│   ├── preferences.ts               # AMENDED — adds mapLayer + overlay validation; defaults
│   └── recents.ts                   # UNCHANGED
├── i18n/
│   ├── zh.json                      # AMENDED — new keys for layer / locale pickers, attribution variants, failure toast
│   ├── en.json                      # AMENDED — same keys
│   └── ja.json                      # AMENDED — same keys
└── (no other source changes)

tests/
├── unit/
│   ├── map/
│   │   ├── MapController.spec.ts    # EXTENDED — setBasemap state transitions
│   │   ├── sources.spec.ts          # NEW — catalogue invariants (https, hl=zh-TW, ids)
│   │   └── styleBuilder.spec.ts     # NEW — style JSON for each (basemap, overlay) pair
│   └── storage/
│       └── preferences.spec.ts      # EXTENDED — mapLayer / overlay defaults + validation
├── integration/
│   ├── go-to-split.spec.ts          # UNCHANGED
│   └── layers-and-locale.spec.ts    # NEW — picker wiring against a mock controller
└── e2e/
    ├── story-3c-layers-and-locale.spec.ts  # NEW — covers US1 / US2 / US3
    └── (other story specs unchanged)

docs/
├── adr/
│   ├── README.md                    # AMENDED — index 0020 / 0021 / 0022 after /speckit.implement
│   ├── 0020-map-source-catalogue.md # NEW (planned)
│   ├── 0021-prefs-additive-evolution.md # NEW (planned)
│   └── 0022-tile-failure-toast.md   # NEW (planned)
└── ui/
    ├── README.md                    # AMENDED — index entry for 0003
    └── 0003-layers-and-locale.md    # NEW — pickers, attribution-bar, failure toast

vite.config.ts                       # AMENDED — runtimeCaching origin list grows
```

**Structure Decision**: Continue with Option 1 (single project) — this
feature is an additive UI + map-engine layer on top of the existing
trees. The `src/map/` module keeps its purpose (map adapter); the new
`sources.ts` + `styleBuilder.ts` siblings are pure modules. Picker
components live alongside the existing `FormatToggle.svelte` and
`GoToDialog.svelte` in `src/components/` rather than getting their
own subdirectory because they are independent of the goto subtree.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations. All five principles are satisfied as written; no
deviations require justification.
