# Implementation Plan: Mobile Collapsed Coordinate Readout, Drag-to-Reorder Priority, Taipower Auto-Precision, and TWD Zone Geographic Hints

**Branch**: `010-mobile-collapsed-readout` | **Date**: 2026-04-27 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/010-mobile-collapsed-readout/spec.md`

## Summary

Five coupled UX changes — three tied to the phone-class readout
overlapping the zoom controls plus two coordinate-input clarity
fixes that ride the same delivery cycle:

1. **Collapse-on-narrow** (US1, P1) — when the viewport is narrower
   than `600 CSS pixels` AND `≥ 2` coordinate formats are enabled,
   `CoordinateReadout.svelte` renders only the highest-priority
   enabled row. Threshold lives as a `--readout-collapse-bp` token in
   `tokens.css` and is enforced by a CSS `@media` query (selector
   change) plus a derived `enabledCount ≥ 2` reactive flag (component
   logic). No JavaScript layout measurement, no `ResizeObserver`.

2. **Drag-to-reorder priority list** (US2, P2) — `FormatToggle.svelte`
   (today's "show / hide formats" drawer) gains a draggable list whose
   row order encodes priority. The drag mechanism is a self-contained
   ~80-line Pointer Events implementation (no `svelte-dnd-action` —
   the library would consume the entire +1 KiB budget; see
   research.md §R1). The same priority order drives row order on
   *every* viewport, not just collapse-mode selection.

3. **Tap-to-expand** (US3, P3) — when collapsed, tapping the readout
   body (excluding the copy button) flips a transient
   `tapExpanded` flag on the component; tapping again clears it. The
   state is component-local (NOT persisted) and auto-clears when the
   matchMedia query reports a wide viewport.

4. **Taipower auto-precision** (US4, P2) — `defaultPreferences()`
   ships `taipowerPrecision: 11` (was 9); the upgrade path
   preserves any explicitly stored value. The Go To Taipower
   parser (`src/coord/parse/taipower.ts` or equivalent) determines
   precision from the trimmed, separator-stripped input length —
   length 9 → 9-precision, length 11 → 11-precision, anything else
   → existing localised "unsupported precision" rejection. The
   precision selector on the input layout is removed (the parser
   no longer needs it); the readout's per-format Settings dropdown
   keeps the manual choice for *display* precision.

5. **TWD zone geographic hints** (US5, P3) — `Tm2Layout.svelte` and
   `Twd67Layout.svelte` render the `121` / `119` zone options with
   a localised geographic tag (`本島` / `Penghu`). The
   composition uses two new `goto.fields.zoneTagMainIsland` /
   `goto.fields.zoneTagPenghu` keys per locale — the only place
   this feature adds new i18n keys, and explicitly justified in
   FR-013 / research.md §R8 because no existing key carries the
   geographic semantic. The "auto" option label (`goto.fields.zoneAuto`)
   is unchanged.

Persistence: `preferences.ts` gains a new `formatOrder: readonly
CoordinateKind[]` field of length 6 (one entry per
`ALL_COORDINATE_KINDS`) AND ships an updated default for
`taipowerPrecision`. Schema bumps v2 → v3 via the project's existing
additive-migration pattern (ADR 0021). On v2 → v3 upgrade, missing
`formatOrder` is filled with the project's documented default order;
the existing `taipowerPrecision` is preserved verbatim (the default
change applies only to fresh `defaultPreferences()` calls).

What this plan deliberately does **not** do:

- It does not change which formats exist (still six:
  `wgs84-dd`, `wgs84-dms`, `twd97-tm2`, `twd67-tm2`, `mgrs`,
  `taipower`).
- It does not redesign the rest of the Settings sheet or any
  unrelated screens.
- It does not introduce keyboard reordering — that is acknowledged
  as future work and is *not* a blocker for this feature; the
  visible order remains keyboard-readable (rows still focusable,
  drag handles still tabbable).
- It does not change copy/share output — the `format*()` helpers
  and `coordinateSegments()` (feature 009) remain untouched.
- It does not introduce a new dependency. Drag is built on the
  Pointer Events API (already available in every supported
  browser).
- It does not change Taipower's transformation math, just the
  default-precision constant and the input parser's length
  classification step.
- It does not change auto-zone resolution behaviour from feature
  002 — only the manual-zone option labels are touched.

## Technical Context

**Language/Version**: TypeScript 5.6+ (ES2022 target), Svelte 4.2 —
inherited unchanged from features 001–009. `tsconfig.json` and
`eslint.config.js` are not amended.

**Primary Dependencies**:

- `svelte` 4.2.x + `@sveltejs/vite-plugin-svelte` — already in use.
  This feature uses only existing primitives plus `<svelte:window
  on:resize>` and Svelte's `tick()` helper for post-drag reflow.
  **No version bump.**
- `maplibre-gl` 3.6.x — unchanged.
- `mgrs` 2.1, `proj4` 2.12 — unchanged.
- **No new runtime deps. No new dev deps. No new build plugins.**

**Storage**: `localStorage` only, via the existing
`pwa_map:prefs` key (`src/storage/preferences.ts`). The schema
gains one ordered-array field (`formatOrder`) and bumps the
`version` constant from `2` to `3`. No new storage key. The
existing `pwa_map:lastView` key and `pwa_map:installDismissedUntil`
key (feature 005) are untouched. Migration is purely additive
(ADR 0021).

**Testing**: Vitest (unit + integration in `tests/unit/` /
`tests/integration/`) + Playwright (`tests/e2e`). RED-first per
Principle II:

- `tests/unit/preferences-format-order.spec.ts` — v2 → v3 migration
  fills `formatOrder` from default; `formatOrder` survives a
  save / load round-trip; corrupted `formatOrder` (wrong length /
  duplicate / unknown kind) falls back to default without losing
  unrelated prefs (FR-006 / FR-007 / SC-005).
- `tests/unit/coordinate-readout-collapse.spec.ts` — at viewport
  ≤ 599 px AND `enabled.length ≥ 2`, only the highest-priority
  enabled row renders; at ≤ 599 px AND `enabled.length === 1`,
  that single row renders without collapse styling; at ≥ 600 px,
  every enabled row renders in priority order (FR-001 / FR-002 /
  US1 acceptance scenarios 1–3).
- `tests/unit/coordinate-readout-tap-expand.spec.ts` — tapping the
  readout body in collapsed state flips `tapExpanded` on; tapping
  again flips it off; resizing past 600 px clears it; tapping the
  copy button does not flip it (FR-008 / FR-009 / FR-010 / SC-004).
- `tests/unit/format-priority-list.spec.ts` — Pointer-Events drag
  reorders the array; drag from index `i` to `j` produces a stable
  permutation; aborting (pointer cancel) does not commit (FR-004 /
  FR-005 / FR-011).
- `tests/integration/settings-format-priority.spec.ts` — opening
  FormatToggle, dragging row 3 to row 1, asserting the readout's
  collapsed-mode visible kind matches the new priority-1 kind
  within 200 ms (SC-002).
- `tests/e2e/mobile-collapsed-readout.e2e.spec.ts` — Playwright
  Mobile Chrome 360 × 640 + iOS Safari 17: launch, observe
  collapsed readout, tap to expand, tap to collapse; reorder
  priorities through FormatToggle and observe row order change
  on the readout. Asserts `getBoundingClientRect()` of the
  readout does not intersect the zoom-controls' rect at any
  point (SC-001).
- `tests/unit/taipower-parse-auto-precision.spec.ts` — feeds
  trimmed length-9, length-11, length-10 (rejected), and
  separator-laden inputs to the Go To Taipower parser; asserts
  precision is derived from input length and that an unsupported
  length surfaces the existing localised rejection (FR-015 /
  SC-007).
- `tests/unit/preferences-defaults.spec.ts` — asserts
  `defaultPreferences().taipowerPrecision === 11` (FR-014) and
  asserts the upgrade path preserves an existing `9` value
  (extending `preferences-format-order.spec.ts` if the test
  utilities collide).
- `tests/unit/zone-label.spec.ts` — for each of `zh`, `en`, `ja`
  locales, asserts the `Tm2Layout` and `Twd67Layout` zone
  selector renders option `121` with the locale's "main island"
  tag and option `119` with the locale's "Penghu" tag; asserts
  the `auto` option's label is unchanged from feature 002
  (FR-016 / FR-017 / SC-008).

**Target Platform**: Identical to features 001–009 — Chromium 120+
(desktop + Android), WebKit / iOS Safari 17+, Firefox 120+ desktop,
Firefox Android. Pointer Events API support is universal in this
matrix (no fallback to TouchEvent or MouseEvent needed).

**Project Type**: Single project — extension of the existing PWA. No
new module under `src/`, no new top-level directory.

**Performance Goals** (per Constitution Principle IV):

- **Bundle delta**: ≤ **+1 KiB gzipped** on the entry JS bundle.
  The drag implementation is plain TS / Svelte (no third-party DnD
  library — research.md §R1 documents the rejected
  `svelte-dnd-action` 5.6 KB gzipped alternative). Verified by
  `npm run bundle-size`.
- **Reorder reflow**: ≤ 200 ms from drag-release to readout's
  visible row order updating (SC-002), measured by Vitest fake
  timers in the integration spec.
- **Collapse / expand transition**: ≤ 200 ms (SC-004), CSS-only
  via `transition: max-height` + `transition: opacity`. No JS
  measurement loop.
- **Drag interaction frame rate**: 60 fps during drag —
  achieved by translating only the dragged row (`transform:
  translateY`) and by running re-order math only on
  `pointerup`, not on every `pointermove`. Verified manually in
  Chrome Performance panel during quickstart §2.
- **Map pan/zoom unchanged**: 60 fps maintained — the
  drag handler uses `e.preventDefault()` only when the pointer
  starts inside a drag handle, never on the map canvas.

**Constraints**:

- **Local-dev preservation**: `npm run dev`, `npm run build`,
  `npm run preview`, `npm run preview:local` (added in branch 009),
  `npm test`, Playwright E2E, `npm run bundle-size`,
  `npm run deploy:check` ALL keep working unchanged.
- **Locale conventions** (Constitution v1.1.0): no new i18n keys.
  `format.labels.<kind>` keys (already in `zh.json`, `en.json`,
  `ja.json`) are reused for the drag-list rows. The drag handle's
  `aria-label` reuses an existing key from the toggle / move
  vocabulary; if no exact-match key exists, the implementation
  notes will pick the closest existing key (research.md §R3) —
  never adding a new key.
- **Accessibility floor** (ADR 0014):
  - Tap targets on each drag handle ≥ 44 × 44 CSS px (feature 009's
    `--tap-min` token reused; the handle gets `class="tap-target"`).
  - Each row remains focusable via Tab; visible focus indicator
    preserved.
  - The drag list is announced via `aria-label` on the wrapping
    `<ul role="list">`; live updates use `aria-live="polite"` on a
    visually-hidden status line that announces "Moved {format} to
    position {n}" (using existing locale keys composed via
    `tStore`).
  - Keyboard reordering is *not* implemented in this feature; the
    visible drag affordance is decorative-only for keyboard users.
    A future feature 0xx will add `↑` / `↓` keyboard reorder; this
    is documented in ADR 0030 §"Future work" and is NOT a release
    blocker.
- **Color tokens & dark mode**: re-uses `--color-fg-muted`,
  `--color-border`, `--readout-bg` from `tokens.css`; the new
  collapse / expand transitions use the existing scrim and
  surface tokens — no new light/dark pair is introduced.
- **No persisted-state migrations beyond v2 → v3**: ADR 0021's
  additive-evolution rule is the migration contract. Older PWA
  installs upgrade in-place, fill `formatOrder` from default.

**Scale/Scope**:

- **Source files amended (~7)**:
  - `src/storage/preferences.ts` — adds `FormatPreferencesV3`
    interface, bumps `PREFS_VERSION` to `3`, validates and
    migrates `formatOrder`, ships `taipowerPrecision: 11` as the
    new default while preserving any stored value on upgrade.
  - `src/components/FormatToggle.svelte` — replaces the static
    `<ul>` with a drag-to-reorder list; keeps the
    enable / disable checkbox per row; emits a `reorder` event
    in addition to the existing `change` event.
  - `src/components/CoordinateReadout.svelte` — adds collapsed /
    tap-expanded mode with a CSS `@media` breakpoint, a
    `tapExpanded` reactive flag, and tap handler on the readout
    body; orders rows by `formatOrder` instead of
    `ALL_COORDINATE_KINDS`.
  - `src/app/App.svelte` — passes `formatOrder` prop down to
    `CoordinateReadout` and `FormatToggle`; persists `reorder`
    events via `savePreferences`. (No new business logic — wiring
    only.)
  - `src/components/goto/TaipowerLayout.svelte` — removes the
    user-facing precision selector (the parser now infers
    precision from the input). The component still renders
    inputs that accept length-9 OR length-11 codes.
  - `src/components/goto/Tm2Layout.svelte` — wraps each
    non-`auto` zone option's label with the geographic tag
    composition (FR-016).
  - `src/components/goto/Twd67Layout.svelte` — same as
    `Tm2Layout` (FR-017).
  - `src/coord/parse/taipower.ts` (or the location of the
    existing Go To Taipower parser — research.md §R7 will
    confirm the actual filename) — replaces explicit
    precision-parameter handling with length-based dispatch.
- **Source files added (1)**:
  - `src/components/FormatPriorityRow.svelte` — single row of the
    draggable list (drag handle + label + checkbox); its own unit
    test covers `pointerdown` / `pointermove` / `pointerup` /
    `pointercancel` semantics in isolation.
- **Tokens added (1)**:
  - `--readout-collapse-bp: 600px` in `src/app/tokens.css` —
    consumed by the readout's `@media` query.
- **Tests added (9)**:
  - `tests/unit/preferences-format-order.spec.ts`
  - `tests/unit/preferences-defaults.spec.ts`
  - `tests/unit/coordinate-readout-collapse.spec.ts`
  - `tests/unit/coordinate-readout-tap-expand.spec.ts`
  - `tests/unit/format-priority-list.spec.ts`
  - `tests/unit/taipower-parse-auto-precision.spec.ts`
  - `tests/unit/zone-label.spec.ts`
  - `tests/integration/settings-format-priority.spec.ts`
  - `tests/e2e/mobile-collapsed-readout.e2e.spec.ts`
- **Docs added (2)**:
  - `docs/ui/0010-mobile-collapsed-readout.md` — UI record per
    Principle III, covering all five user-visible changes.
  - `docs/adr/0030-format-priority-and-collapse.md` — ADR
    codifying the `formatOrder` schema, the collapse-on-narrow
    rule, the rejection of `svelte-dnd-action`, the deferral of
    keyboard reorder, the Taipower auto-precision rule, and the
    explicit two new zone-tag i18n keys.
- **i18n changes**: **2 new keys × 3 locales = 6 new strings**
  total. Keys: `goto.fields.zoneTagMainIsland`,
  `goto.fields.zoneTagPenghu`. All other UI strings reuse
  existing keys (`format.labels.<kind>`, `toggle.title`,
  `toggle.hint`, `toggle.close`, `goto.fields.zone119`,
  `goto.fields.zone121`, `goto.fields.zoneAuto`). research.md §R8
  documents why these two keys are the only allowed exception
  to FR-013's "no new keys" rule.
- **Storage / network / permissions changes**: schema bumps
  `prefs.version` from `2` to `3` AND ships a new
  `taipowerPrecision` default (11); no new storage key, no new
  permission, no new network call.
- **Bundle delta**: ≤ +1 KiB gzipped (target).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle                                       | Verdict     | Justification |
| ----------------------------------------------- | ----------- | -------------- |
| **I. Code Quality & Formatting**                | PASS        | All edits ride existing Prettier + ESLint flat config. No new linter rule, no new file extension. `npm run format` is run after every code edit per Development Workflow. The drag implementation is one new component (`FormatPriorityRow.svelte`) plus the change to `FormatToggle.svelte` — no duplicate state, no shadow stores. |
| **II. Test-First Development (NON-NEGOTIABLE)** | PASS        | Nine test files (7 Vitest unit, 1 Vitest integration, 1 Playwright E2E) land RED before any source change. Each FR maps to ≥ 1 failing assertion: FR-001/002/003 → coordinate-readout-collapse + e2e; FR-004/005/011 → format-priority-list + integration; FR-006/007 → preferences-format-order; FR-008/009/010 → coordinate-readout-tap-expand; FR-013/014 → preferences-defaults; FR-015 → taipower-parse-auto-precision; FR-016/017 → zone-label. The existing copy-string assertions and the `coordinate-readout-segments.spec.ts` (feature 009) are explicitly *not* changed — they are the regression guards for FR-005 (canonical copy unchanged) and segment-shape consistency. |
| **III. User Experience Consistency**            | PASS w/ doc | Three user-visible changes (collapse on narrow, drag-to-reorder, tap-to-expand). New `docs/ui/0010-mobile-collapsed-readout.md` mandatory before merge. Design-token additions (`--readout-collapse-bp`) extend `tokens.css` rather than overriding inline. WCAG 2.5.5 Level AAA touch-target floor (`--tap-min: 44px`, feature 009) preserved on every row's drag handle. Drag-list announces moves via `aria-live` polite. Keyboard reorder explicitly deferred and documented; visible focus indicators remain on every row regardless. Dark-mode tokens unchanged. |
| **IV. Performance Requirements**                | PASS        | Five explicit budgets: bundle delta ≤ +1 KiB gzipped; reorder reflow ≤ 200 ms (SC-002); collapse / expand transition ≤ 200 ms (SC-004); 60 fps drag interaction; 60 fps map interaction preserved. Verified by existing `bundle-size` script + new component-level timing assertion in `settings-format-priority` integration spec + manual Playwright trace check on the e2e spec. |
| **V. Documentation & ADRs**                     | PASS w/ doc | One new ADR planned: ADR 0030 (format-priority schema + collapse-on-narrow + Pointer Events drag + keyboard-reorder deferral). The relationship to ADR 0014 (Accessibility Baseline), ADR 0017 (Go To split layout), ADR 0021 (additive prefs evolution), and ADR 0029 (mobile touch-target) is captured in ADR 0030's "related" section. The ADR index (`docs/adr/README.md`) is updated post-`/speckit.implement`. No existing ADR is superseded. |

**Locale convention compliance** — only the two zone-tag keys
(`goto.fields.zoneTagMainIsland`, `goto.fields.zoneTagPenghu`) are
new, and the spec's FR-013 explicitly allows this exception.
Everything else (drag list, format labels, live region, toggle UI)
reuses existing keys. The `zh` BCP-47 rule is unchanged: every
locale path uses `zh` (never `zh-TW` / `zh-Hant`).

**Result**: All five principles pass on the planned design. No
unjustified deviations → Complexity Tracking section left empty.

## Project Structure

### Documentation (this feature)

```text
specs/010-mobile-collapsed-readout/
├── plan.md                                 # This file
├── research.md                             # Phase 0 output
├── data-model.md                           # Phase 1 output
├── quickstart.md                           # Phase 1 output (incl. mobile-emulator walkthrough)
├── contracts/
│   ├── format-priority-schema.md           # prefs v3: formatOrder field shape + migration rule
│   ├── readout-collapse-mode.md            # collapse + tap-expand state machine + a11y contract
│   ├── drag-reorder-interaction.md         # Pointer Events lifecycle + commit semantics
│   ├── taipower-precision-autodetect.md    # Go To input length → precision mapping + rejection rule
│   └── zone-label-i18n.md                  # Two new locale keys + composition rule for 121 / 119 labels
├── checklists/
│   └── requirements.md                     # /speckit.specify output (already exists)
└── tasks.md                                # /speckit.tasks output (Phase 2; later)
```

### Source code (repository root)

```text
src/
├── app/
│   ├── App.svelte                          # AMENDED — pass formatOrder to readout + FormatToggle; persist reorder events
│   └── tokens.css                          # AMENDED — adds --readout-collapse-bp
├── components/
│   ├── CoordinateReadout.svelte            # AMENDED — collapse + tapExpanded; orders rows by formatOrder
│   ├── FormatToggle.svelte                 # AMENDED — wraps rows in drag-to-reorder list; emits reorder event
│   ├── FormatPriorityRow.svelte            # NEW — single draggable row (drag handle + label + checkbox)
│   └── goto/
│       ├── TaipowerLayout.svelte           # AMENDED — drops the user-facing precision selector
│       ├── Tm2Layout.svelte                # AMENDED — zone option labels gain geographic tag composition
│       └── Twd67Layout.svelte              # AMENDED — same as Tm2Layout
├── coord/
│   └── parse/
│       └── taipower.ts                     # AMENDED — replaces precision-arg with length-based dispatch (filename verified in research.md §R7)
├── i18n/
│   ├── zh.json                             # AMENDED — adds goto.fields.zoneTagMainIsland / zoneTagPenghu
│   ├── en.json                             # AMENDED — same two keys
│   └── ja.json                             # AMENDED — same two keys
└── storage/
    └── preferences.ts                      # AMENDED — adds FormatPreferencesV3, formatOrder, v2 → v3 migration, taipowerPrecision default → 11

tests/
├── unit/
│   ├── preferences-format-order.spec.ts            # NEW — schema migration + round-trip + corruption tolerance
│   ├── preferences-defaults.spec.ts                # NEW — fresh-default taipowerPrecision = 11; upgrade preserves stored value
│   ├── coordinate-readout-collapse.spec.ts         # NEW — collapse / expand based on viewport + enabled count
│   ├── coordinate-readout-tap-expand.spec.ts       # NEW — tap-to-expand sentinel state
│   ├── format-priority-list.spec.ts                # NEW — Pointer Events drag → array reorder
│   ├── taipower-parse-auto-precision.spec.ts       # NEW — Go To Taipower length → precision; reject other lengths
│   └── zone-label.spec.ts                          # NEW — Tm2 / Twd67 zone option labels carry geographic tag in zh / en / ja
├── integration/
│   └── settings-format-priority.spec.ts            # NEW — drag in FormatToggle propagates to readout
└── e2e/
    └── mobile-collapsed-readout.e2e.spec.ts        # NEW — Playwright Mobile Chrome + iOS Safari

docs/
├── ui/
│   └── 0010-mobile-collapsed-readout.md            # NEW — UI record per Principle III
└── adr/
    └── 0030-format-priority-and-collapse.md        # NEW — ADR per Principle V
```

**Structure Decision**: Single-project layout (Option 1) — same as
features 001–009. New artefacts live alongside their existing peers
(`src/components/*.svelte`, `src/storage/*.ts`, `tests/unit/*.spec.ts`,
`tests/integration/*.spec.ts`, `tests/e2e/*.e2e.spec.ts`,
`docs/ui/*`, `docs/adr/*`) with consecutive numbering. No new
top-level directories.

## Complexity Tracking

> No constitutional gate failures. No justified deviations.

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --------- | ---------- | ------------------------------------ |
| (none)    | (none)     | (none)                               |
