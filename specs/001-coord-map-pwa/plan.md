# Implementation Plan: Taiwan Coordinate Map (PWA)

**Branch**: `001-coord-map-pwa` | **Date**: 2026-04-24 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-coord-map-pwa/spec.md`

## Summary

Build a PWA that shows a Taiwan-covering base map with a crosshair reticle
locked to the viewport center. The crosshair's location is rendered live in
six coordinate formats (WGS84 DD, WGS84 DMS, TWD97 TM2, TWD67 TM2, MGRS,
Taipower) with the TWD97 zone auto-selected at the 120° E boundary. A Go To
control parses any of those formats and pans the map to the requested point;
malformed or out-of-coverage input is rejected with a category-tagged error.
All conversion math runs client-side against the test vectors in
`test-vectors.json` v2.0.0 (imported verbatim from the reference document) so
the app works offline after first load.

Technical approach: TypeScript + Vite + Svelte for the UI (small bundle, fast
HMR, reactive store); MapLibre GL JS for the map (GPU-accelerated, vector-tile
ready, PWA-friendly); `proj4` (npm) for TWD97/TWD67/EPSG registration, `mgrs`
(npm) for MGRS round-trips, and a hand-rolled Taipower encoder that follows
the reference document §8 algorithm byte-for-byte. OSM Standard is the default
base tile source (attribution-only, CORS-permissive, no referer lock). Vitest
runs unit tests driven by the reference test vectors; Playwright drives the
PWA-level acceptance scenarios. TDD is non-negotiable (Principle II).

## Technical Context

**Language/Version**: TypeScript 5.5+ (ES2022 target)
**Primary Dependencies**:
- `svelte` 4.x (UI framework — small bundle, reactive)
- `maplibre-gl` 3.x (map engine — GPU, vector-tile ready, PWA-friendly)
- `proj4` 2.x (WGS84 ↔ TWD97/TWD67 TM2 projections)
- `mgrs` 2.x (WGS84 ↔ MGRS round-trips)
- `vite` 5.x + `@sveltejs/vite-plugin-svelte` (build + dev server)
- `vite-plugin-pwa` (service worker, manifest, offline caching via Workbox)
**Storage**: Browser `localStorage` for format-visibility preferences and
"last view" map state (center + zoom). IndexedDB is NOT used in MVP.
**Testing**: Vitest (unit + contract, loads `test-vectors.json` directly) +
Playwright (E2E + PWA acceptance scenarios).
**Target Platform**: Modern evergreen browsers (Chrome 120+, Edge 120+,
Firefox 120+, Safari 17+) on desktop and mobile; Android 10+, iOS 15+.
**Project Type**: Single project — a standalone PWA (no backend).
**Performance Goals**:
- First interactive over 10 Mbps, no cache: ≤ 3 s (SC-008).
- Repeat visit (service-worker cached): ≤ 1 s (SC-008).
- Pan-end → coordinate readout update: ≤ 100 ms (FR-015).
- During continuous pan: ≥ 10 Hz readout refresh (SC-007, US1.AS3).
- Single coordinate conversion (any format pair): ≤ 1 ms on mid-range 2024
  mobile (benchmarked in Vitest).
- Lighthouse PWA score: ≥ 90.
**Constraints**:
- JS bundle (gzipped, initial load): ≤ 200 KB.
- CSS bundle (gzipped, initial load): ≤ 20 KB.
- Offline-capable after first load (service-worker-cached shell; tiles
  best-effort cached, graceful-degrade if missing).
- No implementation-side runtime network dependency for coordinate math.
- Attribution string for the active tile source MUST render on-screen.
**Scale/Scope**: Single-page application; 6 coordinate systems; 4 primary UI
components (MapView, Crosshair, CoordinateReadout, GoToInput); ~40 test
vectors from the reference document; three locales — `zh` (default),
`en`, and `ja` — runtime-switchable and persisted per user.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Requirement | How this plan complies |
|---|---|---|
| I. Code Quality & Formatting | Formatter + linter clean before every commit | Prettier + ESLint with `typescript-eslint`; `npm run format` mapped to `prettier --write .`; CI runs `npm run lint` + `npm run typecheck` on every PR. |
| II. Test-First Development (NON-NEGOTIABLE) | Red-Green-Refactor for all production paths | Vitest unit tests written first from `test-vectors.json`; integration tests written before components; E2E tests written alongside story acceptance scenarios. |
| III. User Experience Consistency | Design-system consistency; `docs/ui/` updated on UI change | `docs/ui/0001-coord-map-layout.md` will document crosshair, readout panel, Go To dialog; design tokens (spacing, colors, typography) defined up-front in `src/app/tokens.css`. |
| IV. Performance Requirements | Explicit budgets + CI verification | Budgets declared in **Performance Goals** above; `bundle-size` script asserts JS/CSS ≤ budget; Lighthouse CI on PRs; Vitest benchmark suite for per-conversion time. |
| V. Documentation & ADRs | English-first; ADRs for significant decisions; index updated after `/speckit.analyze` & `/speckit.implement` | ADR index seeded at `docs/adr/README.md`; Phase 0 decisions logged as planned ADRs (see research.md); all in-repo docs in English (UI strings localise to zh separately). |

**Verdict**: PASS. No deviations, no Complexity Tracking rows required.

## Project Structure

### Documentation (this feature)

```text
specs/001-coord-map-pwa/
├── plan.md              # This file (/speckit.plan command output)
├── spec.md              # Feature specification (/speckit.specify output)
├── research.md          # Phase 0 output — decisions + alternatives rejected
├── data-model.md        # Phase 1 output — entity model
├── quickstart.md        # Phase 1 output — dev setup and smoke-test walkthrough
├── contracts/           # Phase 1 output — interface & grammar contracts
│   ├── coord-api.md     # Public TypeScript surface for conversion functions
│   ├── go-to-grammar.md # Input grammar per format (from reference §3–§8)
│   └── test-vectors.md  # How test-vectors.json is consumed
└── checklists/
    └── requirements.md  # Spec quality checklist (already produced)
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── main.ts              # PWA entry, Svelte root
│   ├── App.svelte           # Shell layout
│   └── tokens.css           # Design tokens (colors, spacing, typography)
├── components/
│   ├── MapView.svelte       # MapLibre GL wrapper; emits `move`/`moveend`
│   ├── Crosshair.svelte     # Center reticle overlay (fixed to viewport)
│   ├── CoordinateReadout.svelte # Multi-format display list
│   ├── FormatToggle.svelte  # Show/hide formats; persists to localStorage
│   ├── GoToDialog.svelte    # Modal with input field + error surface
│   └── AttributionBar.svelte# Tile-source attribution
├── coord/
│   ├── index.ts             # Public coord API (the Phase 1 contract)
│   ├── wgs84.ts             # DD ↔ DMS, parsing, formatting (§3)
│   ├── twd97.ts             # WGS84 ↔ TWD97 TM2 via proj4 (§4/§5)
│   ├── twd67.ts             # WGS84 ↔ TWD97 ↔ TWD67 four-parameter (§6)
│   ├── mgrs.ts              # WGS84 ↔ MGRS via mgrs pkg (§7)
│   ├── taipower.ts          # TWD67 ↔ Taipower grid (§8, hand-rolled)
│   ├── zone.ts              # TM2 zone boundary rule (§9)
│   └── parser.ts            # Dispatching Go-To parser (tries each grammar)
├── map/
│   ├── MapController.ts     # MapLibre lifecycle + animation helpers
│   └── tileSource.ts        # OSM Standard config with attribution
├── i18n/
│   ├── index.ts             # Minimal i18n store (fallback chain ja → en → zh)
│   ├── zh.json           # Default locale & canonical key set
│   ├── en.json              # English
│   └── ja.json              # Japanese
├── storage/
│   └── preferences.ts       # localStorage read/write with schema guard
├── pwa/
│   └── registerSW.ts        # Service worker registration
│                            # (manifest declared inline in vite.config.ts
│                            #  via VitePWA({ manifest }) — no separate file.)
└── types/
    └── coord.ts             # Branded types: Lat, Lon, Easting, Northing, Zone

tests/
├── unit/
│   ├── coord/               # One spec file per coord module
│   │   ├── wgs84.spec.ts
│   │   ├── twd97.spec.ts
│   │   ├── twd67.spec.ts
│   │   ├── mgrs.spec.ts
│   │   ├── taipower.spec.ts
│   │   ├── zone.spec.ts
│   │   └── parser.spec.ts
│   ├── fixtures/
│   │   └── test-vectors.json # Copy of reference v2.0.0 (pinned)
│   └── storage/
│       └── preferences.spec.ts
├── integration/
│   ├── readout.spec.ts      # Crosshair + coord-panel wiring
│   └── go-to.spec.ts        # Parse + map animation
└── e2e/
    ├── story-1-crosshair-readout.spec.ts
    ├── story-2-multi-format.spec.ts
    ├── story-3-go-to.spec.ts
    └── story-4-copy.spec.ts

docs/
├── adr/
│   ├── README.md            # ADR index (Principle V requires it)
│   └── 0001-template.md     # ADR template (filled per decision)
└── ui/
    ├── README.md            # UI docs index (Principle III requires it)
    └── 0001-coord-map-layout.md # Initial layout, crosshair spec, tokens

public/
├── manifest.webmanifest
├── icons/                   # PWA icons (180, 192, 512)
└── offline.html             # Fallback when even shell cache is cold

vite.config.ts
tsconfig.json
package.json
playwright.config.ts
eslint.config.js
.prettierrc
.editorconfig
```

**Structure Decision**: Option 1 (Single project). This is a standalone PWA
with no backend; a two-tier `backend/` + `frontend/` split would be pure
ceremony. Coordinate math lives in `src/coord/` as a set of pure functions
so it remains testable in isolation without touching the map or DOM.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations. All five principles are satisfied by the plan as written; no
deviations require justification.
