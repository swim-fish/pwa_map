# Implementation Plan: Go-To Split-Field Input

**Branch**: `002-goto-split-input` | **Date**: 2026-04-25 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-goto-split-input/spec.md`

## Summary

Replace the single free-text Go-To dialog shipped by feature 001 with a
chip-driven, split-field modal. A **format chip rack** (`自動偵測`, `台電
座標`, `WGS84 (DD)`, `WGS84 (DMS)`, `TWD67 TM2`, `TWD97 TM2`, `MGRS`)
re-lays the modal body so the operator types one semantic component per
field instead of remembering the canonical delimiter or the `°′″` glyphs.
For each chip, the visible fields' values are composed into a canonical
raw string and routed through the existing `parseGoTo` dispatcher (or its
per-format sub-parsers for explicit chips), preserving every grammar
guarantee in `specs/001-coord-map-pwa/contracts/go-to-grammar.md`.

The same modal also adds: a **recent-inputs** chip row (max 10 entries,
de-duped by `(format, raw)`, FIFO-evicted, persisted in
`localStorage['pwa_map:gotoHistory_v1']`); a **Disambiguator** bottom
sheet that surfaces every plausible interpretation when `自動偵測` returns
multiple candidates; a transient **Destination Indicator** DOM overlay
that fades out after 3 s on every successful Go-To; and **zoom
preservation** — `MapController.flyTo` no longer rewrites the zoom level.

Technical approach: keep the existing TypeScript + Svelte + MapLibre + Vite
toolchain (no new runtime deps); add a `src/coord/composer.ts` that turns
a typed layout into a canonical raw string, a `src/coord/disambiguate.ts`
that generates candidate interpretations from ambiguous input by
re-parsing the raw via every plausible sub-parser (zone-explicit TM2 in
both zones, TWD67, etc.), a `src/storage/recents.ts` schema-guarded
recents store, and one Svelte component per layout under
`src/components/goto/`. Tests are TDD: Vitest unit specs for composer +
disambiguate + recents storage, Vitest integration for compose-and-parse
round-trips against `tests/unit/fixtures/test-vectors.json`, Playwright
E2E for the seven-chip flow + recents + disambiguator + zoom-preservation
+ destination-indicator timing.

## Technical Context

**Language/Version**: TypeScript 5.5+ (ES2022 target) — inherited from 001.
**Primary Dependencies**:

- `svelte` 4.x (UI; reuse the existing component conventions, stores).
- `maplibre-gl` 3.x (existing — only `flyTo` semantics change).
- Existing `proj4` / `mgrs` deps via `src/coord/`. **No new runtime deps.**

**Storage**: One new `localStorage` key — `pwa_map:gotoHistory_v1` — with
the same schema-guard pattern as `pwa_map:prefs` (validate on load;
discard on parse failure or `version` mismatch). `pwa_map:prefs` and
`pwa_map:lastView` are not touched.

**Testing**: Vitest (unit + integration) + Playwright (E2E). Layout
components covered by Vitest with `@testing-library/svelte` (already a
dev-dep transitively via Svelte 4); E2E flows live alongside the
existing `tests/e2e/story-3-go-to.spec.ts` (extended) and a new
`tests/e2e/story-3b-split-and-recents.spec.ts`.

**Target Platform**: Same as 001 — Chrome 120+, Edge 120+, Firefox 120+,
Safari 17+; Android 10+, iOS 15+.

**Project Type**: Single project — extension of the existing PWA. No
backend, no new package boundary.

**Performance Goals**:

- Modal open → first paint of the chosen layout: ≤ 50 ms (60 fps budget).
- Submit (any chip) → flyTo start: ≤ 1 s (inherits SC-003 from feature 001).
- Recent-chip tap → flyTo start: ≤ 1 s (SC-006).
- Destination indicator dismissal on user pan/zoom: ≤ 150 ms (SC-007).
- Indicator fade animation: 300 ms ease-out at the 3 s mark.

**Constraints**:

- Total JS bundle (gzipped, initial load): unchanged at ≤ 200 KB. The
  new layouts are small static Svelte components; budget is verified by
  the existing `npm run bundle-size` script.
- Total CSS bundle (gzipped, initial load): ≤ 22 KB (a 2 KB headroom over
  001's 20 KB budget for the chip-rack + layout grid).
- No runtime network dependency added.
- WCAG AA contrast preserved on the new chips, fields, and bottom sheet.

**Scale/Scope**: 7 layout components (one per chip including auto-detect),
1 chip-rack component, 1 recents row component, 1 disambiguator sheet,
1 destination-indicator overlay; 1 new coord helper (`composer`) +
1 new coord helper (`disambiguate`); 1 new storage module; ~25 new i18n
keys per locale (zh / en / ja); ~15 new test cases (5 unit, 4 integration,
6 E2E).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Requirement | How this plan complies |
|---|---|---|
| I. Code Quality & Formatting | Formatter + linter clean before every commit | Reuse the existing Prettier + ESLint config; `npm run format` is run after every code edit per the project workflow. New Svelte components inherit the same `prettier-plugin-svelte` config. |
| II. Test-First Development (NON-NEGOTIABLE) | Red-Green-Refactor for all production paths | Tasks generated from this plan order tests before implementation per layer: composer unit specs first, then `composer.ts`; recents-store unit spec first, then `recents.ts`; layout component specs before `*.svelte`; E2E story specs before wiring. |
| III. User Experience Consistency | Design-system consistency; `docs/ui/` updated on UI change | Reuse the design tokens from `src/app/tokens.css` (chip = pill button reusing existing `--color-accent`; bottom-sheet reuses dialog shadow + radius). A new `docs/ui/0002-goto-split-input.md` will be added before implementation lands, covering chip rack, layout grids, recents row, disambiguator, destination indicator, and the zoom-preservation contract. |
| IV. Performance Requirements | Explicit budgets + CI verification | Budgets declared in **Performance Goals** above. `npm run bundle-size` continues to assert JS/CSS gzipped budgets; new Playwright assertions cover the indicator-dismissal timing (SC-007) and recent-chip latency (SC-006). |
| V. Documentation & ADRs | English-first; ADRs for significant decisions; index updated after `/speckit.analyze` & `/speckit.implement` | Three planned ADRs (see `research.md` decisions D1, D3, D5): `0017-goto-split-layout-architecture.md`, `0018-recents-storage-schema.md`, `0019-flyto-zoom-preservation.md`. Indexed in `docs/adr/README.md` at `/speckit.implement` time per Principle V. |

**Verdict**: PASS. No deviations, no Complexity Tracking rows required.

## Project Structure

### Documentation (this feature)

```text
specs/002-goto-split-input/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 — decisions + alternatives rejected
├── data-model.md        # Phase 1 — entities (FormatSelection, RecentList, …)
├── quickstart.md        # Phase 1 — dev + smoke-test walkthrough
├── contracts/           # Phase 1 — interface contracts
│   ├── composer.md            # Layout-fields → canonical raw string
│   ├── recents-storage.md     # localStorage schema + load/save semantics
│   ├── disambiguator.md       # Candidate-interpretation generator
│   ├── destination-indicator.md # Overlay lifecycle + a11y contract
│   └── flyto-zoom.md          # Zoom-preservation contract for MapController.flyTo
└── checklists/
    └── (created by /speckit.checklist when needed)
```

### Source Code (repository root)

```text
src/
├── components/
│   ├── GoToDialog.svelte          # REWRITTEN — hosts chip rack + active layout + recents + disambiguator
│   ├── goto/                      # NEW — split-input subcomponents
│   │   ├── ChipRack.svelte        # 7-chip horizontal strip; wraps on narrow viewports
│   │   ├── AutoLayout.svelte      # single free-text field (today's behaviour)
│   │   ├── DdLayout.svelte        # 緯度 / 經度 numeric pair (signed DD)
│   │   ├── DmsLayout.svelte       # deg/min/sec × 2 + N/S, E/W segmented
│   │   ├── Tm2Layout.svelte       # E / N (+ optional zone selector for TWD97 explicit; TWD67 has no zone)
│   │   ├── MgrsLayout.svelte      # GZD+band / 100 km square / easting / northing
│   │   ├── TaipowerLayout.svelte  # 前 5 碼 / 後 4 或 6 碼 (with precision toggle 9 vs 11)
│   │   ├── RecentChips.svelte     # tap = submit; long-press = delete confirm
│   │   ├── Disambiguator.svelte   # bottom-sheet candidate list
│   │   └── DestinationIndicator.svelte # transient viewport overlay
│   └── (existing components unchanged)
├── coord/
│   ├── composer.ts                # NEW — pure: layout state → canonical raw string + sub-parser hint
│   ├── disambiguate.ts            # NEW — pure: raw → readonly Candidate[]
│   ├── parser.ts                  # UNCHANGED grammar; only consumed by composer + disambiguate
│   └── (other coord modules unchanged)
├── map/
│   └── MapController.ts           # AMENDED — flyTo: do not change zoom unless caller passes one
├── storage/
│   ├── preferences.ts             # UNCHANGED
│   └── recents.ts                 # NEW — load/append/remove RecentList; schema guard; max 10
├── i18n/
│   ├── zh.json                    # AMENDED — new keys for chip labels, field labels, errors, tooltip
│   ├── en.json                    # AMENDED — same keys
│   └── ja.json                    # AMENDED — same keys
└── (no other source changes)

tests/
├── unit/
│   ├── coord/
│   │   ├── composer.spec.ts       # NEW — round-trip layout ↔ raw against test-vectors.json
│   │   └── disambiguate.spec.ts   # NEW — ambiguous input → ≥ 2 candidates; unambiguous → 1
│   └── storage/
│       └── recents.spec.ts        # NEW — append/dedup/evict/version-guard
├── integration/
│   └── go-to-split.spec.ts        # NEW — Svelte component-level wiring with mock MapController
└── e2e/
    ├── story-3-go-to.spec.ts                  # EXTENDED — auto-detect path still works
    ├── story-3b-split-and-recents.spec.ts     # NEW — covers US1 (split), US2 (recents), US3 (disambiguator + indicator + zoom)
    └── (other story specs unchanged)

docs/
├── adr/
│   ├── README.md                  # AMENDED — index 0017 / 0018 / 0019 after /speckit.implement
│   ├── 0017-goto-split-layout-architecture.md  # NEW (planned)
│   ├── 0018-recents-storage-schema.md          # NEW (planned)
│   └── 0019-flyto-zoom-preservation.md         # NEW (planned)
└── ui/
    ├── README.md                  # AMENDED — index entry for 0002
    └── 0002-goto-split-input.md   # NEW — chip rack, layout grids, recents, disambiguator, indicator
```

**Structure Decision**: Continue with Option 1 (single project) — this
feature is an additive UI layer on top of the existing `src/coord/` and
`src/components/` trees. A new `src/components/goto/` subdirectory keeps
the seven layout components cohesively grouped without scattering them
across the flat `src/components/` namespace. Coordinate-domain helpers
(`composer.ts`, `disambiguate.ts`) stay in `src/coord/` because they are
pure functions over the existing parser surface.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations. All five principles are satisfied as written; no
deviations require justification.
