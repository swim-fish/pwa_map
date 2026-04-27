# Implementation Plan: Mobile UI Adjustments — Touch Targets, Segmented Coordinate Readout, Notification Stacking

**Branch**: `009-mobile-ui-fixes` | **Date**: 2026-04-27 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/009-mobile-ui-fixes/spec.md`

## Summary

Three small, independent UX fixes targeted at phone-class viewports, all
delivered as in-place edits to existing Svelte components plus three
disciplined new building blocks (one CSS-token group, one coordinate
helper, one notification-region container):

1. **Tap-target floor** (US1, P1) — every interactive control reachable
   on a phone is raised to a 44×44 CSS-pixel hit area. Implemented by
   adding `--tap-min: 44px` (and a shared `.tap-target` utility class)
   in `src/app/tokens.css`, and applying it to the seven buttons that
   currently fall short (compass toggle, zoom in/out, settings icon,
   toolbar buttons, install/update banner actions, copy buttons in the
   readout). No new components.

2. **Notification region** (US2, P2) — all transient banners
   (`UpdatePrompt`, `InstallBanner`, the four inline toasts in
   `App.svelte`) move into a single fixed stacking region below the
   toolbar and above the coordinate readout. The region uses a vertical
   `gap` and z-indexes itself relative to two new tokens
   (`--notification-zone-top`, `--readout-clearance`) so it never
   overlaps the toolbar, the compass / zoom / settings column, the
   readout panel, or any open dialog's primary action row. A tiny new
   `NotificationRegion.svelte` host owns the layout; banner components
   keep their content but drop their per-component `position: fixed`.

3. **Segmented coordinate readout** (US3, P3) — `CoordinateReadout.svelte`
   stops rendering each row as one monospace string and instead renders
   it as a labelled-field row that mirrors the corresponding Go To
   layout exactly. A single new pure helper
   `src/coord/segments.ts :: coordinateSegments(kind, position)` returns
   the canonical `{ label, value }[]` per format; both the readout
   component and (later, if desired) the Go To layouts can read from it.
   The copy button keeps the existing canonical single-string output —
   we do **not** touch `formatWGS84DD/DMS/MGRS/...` — so paste/share
   workflows are bit-exact preserved. i18n keys are reused verbatim from
   `goto.fields.*` (added in feature 002) — no new locale strings.

What this plan deliberately does **not** do:

- It does not redesign any banner's *contents* — only their host.
- It does not introduce a new dependency (no toast library, no headless
  UI library) — the notification region is ~30 lines of Svelte.
- It does not change copy/share output — `format*()` helpers untouched
  (preserves SC-004 and the FR-005 "canonical string" guarantee).
- It does not introduce a new coordinate format. The readout's segment
  catalogue is the same six formats already supported (DD, DMS, TWD97-TM2,
  TWD67-TM2, MGRS, Taipower).

## Technical Context

**Language/Version**: TypeScript 5.6+ (ES2022 target) and Svelte 4.2 —
inherited unchanged from features 001–008. `tsconfig.json` and
`eslint.config.js` are not amended by this feature.

**Primary Dependencies**:

- `svelte` 4.2.x + `@sveltejs/vite-plugin-svelte` — already in use; this
  feature relies only on existing Svelte primitives (`$:` reactivity,
  slots, named props). **No version bump.**
- `maplibre-gl` 3.6.x — unchanged. The notification region sits above
  the map but does not touch MapLibre layers, sources, or events.
- `mgrs` 2.1, `proj4` 2.12 — unchanged. The new
  `coord/segments.ts` helper composes the existing
  `wgs84DdToDms / wgs84ToTwd97 / wgs84ToTwd67 / wgs84ToMgrs / wgs84ToTaipower`
  conversions and the existing format helpers; it does not call proj4
  or mgrs directly.
- **No new runtime deps. No new dev deps.**

**Storage**: **None** added. No `localStorage`, no `IndexedDB`, no
`Cache` writes. The notification region is purely view-layer; no
persisted "dismissed banners" set is introduced (existing dismiss flows
in `InstallBanner` / `UpdatePrompt` keep their current persistence
contracts under feature 005 / feature 004 unchanged).

**Testing**: Vitest (unit + integration in `tests/unit` /
`tests/integration`) + Playwright (`tests/e2e`). Three new Vitest specs
land **RED first** per Principle II:

- `tests/unit/tap-target.spec.ts` — instantiates each flagged
  component, mounts at 360×640, and asserts every interactive
  descendant's `getBoundingClientRect()` is ≥ 44×44 CSS px and that
  no two adjacent rectangles overlap (FR-001 / FR-002 /
  SC-001).
- `tests/unit/coordinate-readout-segments.spec.ts` — for every
  `CoordinateKind`, asserts the rendered segment count, label keys,
  and order match the corresponding Go To layout's input field count,
  label keys, and order; asserts the canonical copy string still
  equals `format*()` output for that kind (FR-004 / FR-005 / FR-006 /
  SC-004).
- `tests/integration/notification-region.spec.ts` — drives each banner
  trigger (SW update, install prompt, copy success, layer-load
  failure, offline-ready, zone hint) at 360×640 and 640×360 and
  asserts the banner's bounding box does not intersect the toolbar,
  the compass / zoom / settings column, the readout, or — when a
  dialog is open — the dialog's primary action row (FR-007 / FR-008 /
  SC-002 / SC-003).

A small Playwright spec
`tests/e2e/mobile-tap-targets.e2e.spec.ts` runs the same tap-target
assertion against the actual built bundle in Mobile Chrome 120 and iOS
Safari 17 viewports — covering the rendering-engine-specific cases
(touch-action, line-box rounding) that jsdom can't represent.

**Target Platform**: Identical to features 001–008 — Chromium 120+
(desktop + Android), WebKit / iOS Safari 17+, Firefox 120+ desktop,
Firefox Android. Phone coverage targeted by this feature is concretely
the 320–640 CSS-pixel-wide viewport class in both portrait and
landscape; tablet (≥ 768 px) layouts are out of scope for the changes
themselves but verified to not regress (existing snapshots / Playwright
specs for desktop layouts must keep passing).

**Project Type**: Single project — extension of the existing PWA. No
new module under `src/`, no new top-level directory.

**Performance Goals** (per Constitution Principle IV):

- **Bundle delta**: ≤ **+1 KiB gzipped** on the entry JS bundle. The
  feature is mostly CSS + ~30 lines of Svelte (`NotificationRegion`)
  + ~80 lines of pure TS (`coord/segments.ts`). Verified by
  `npm run bundle-size` in CI; new threshold to be wired into
  `scripts/check-bundle-size.js` only if existing budget would be
  exceeded — current measurement suggests it will not.
- **First paint of a notification**: ≤ 200 ms from trigger fire to
  banner visible on Mobile Chrome 360×640 (matches SC-005's class).
  Region uses CSS-only entry transition; no layout-thrashing
  measurement loop.
- **Tap-target render cost**: 0 ms regression. `min-width / min-height`
  on existing buttons does not introduce reflow on hover/active and
  does not change the toolbar's flex layout (verified by visual
  diff of the toolbar in dev mode).
- **Coordinate readout reflow**: ≤ 200 ms switch transition (SC-005),
  measured by toggling format kinds in a Vitest fake-timers spec.
- **Frame rate**: existing 60 fps map pan/zoom budget unchanged — no
  banner uses opacity/transform animations longer than 200 ms and the
  region container is `position: fixed; will-change: auto`.

**Constraints**:

- **Local-dev preservation**: `npm run dev`, `npm run build`,
  `npm run preview`, `npm test`, Playwright E2E, `npm run bundle-size`,
  `npm run deploy:check` ALL keep working unchanged. Touch behaviour
  is purely client-rendered; no SSR or service-worker change.
- **Locale conventions** (Constitution v1.1.0): no new i18n keys are
  introduced. The segmented readout *re-uses* the existing Go To
  field-label keys (`goto.fields.latDeg`, `goto.fields.lonDeg`,
  `goto.fields.latMin`, `goto.fields.tm2Easting`, etc.). The `zh`
  locale rule is preserved verbatim.
- **Accessibility floor** (ADR 0014):
  - Touch targets ≥ 44×44 CSS px (WCAG 2.5.5 Level AAA).
  - Visible focus indicators on every enlarged button (no removal of
    `:focus-visible` outlines).
  - Notification region uses `aria-live="polite"` (preserving
    `App.svelte`'s current toast semantics) and remains keyboard-
    dismissible.
  - Readout segments stay machine-copyable: `aria-label` on each
    copy button still reads the format name; the SR-only canonical
    string at the foot of the readout (`<span class="sr-only"
    data-testid="readout-dd">`) is preserved unchanged.
- **Color tokens & dark mode**: re-uses `--color-fg-muted`,
  `--color-border`, `--readout-bg` from `tokens.css`; the new
  notification region is themed via existing tokens — no new
  light/dark pair is introduced.
- **No persisted-state migrations**: the localStorage `prefs` schema
  (ADR 0021) is untouched. The dismissed-prompt timestamp keys owned
  by feature 005 are untouched. Older PWA installs upgrade
  in-place with zero data migration.

**Scale/Scope**:

- **Source files amended (5)**:
  - `src/app/tokens.css` — adds `--tap-min`, `--notification-zone-top`,
    `--notification-zone-bottom`, `--readout-clearance` tokens and the
    `.tap-target` utility class.
  - `src/components/CoordinateReadout.svelte` — re-renders rows as
    labelled-field grids; copy button keeps `--tap-min` size.
  - `src/components/Compass.svelte` — `min-width / min-height` →
    `var(--tap-min)`.
  - `src/components/ZoomControls.svelte` — same.
  - `src/app/App.svelte` — `.toolbar-btn` and `.settings-toolbar-btn`
    pick up `min-height: var(--tap-min)`; the four inline transient
    toasts portal into `<NotificationRegion>` instead of
    fixed-positioning themselves.
- **Source files amended (notification hosts) (2)**:
  - `src/components/InstallBanner.svelte` — content kept; outer
    `position: fixed; bottom: …; right: …` removed; mounts inside
    `<NotificationRegion>`.
  - `src/components/UpdatePrompt.svelte` — same.
- **Source files added (2)**:
  - `src/components/NotificationRegion.svelte` — single fixed-position
    stacking host; vertical layout; respects
    `--notification-zone-top` (default mobile) / `--notification-zone-bottom`
    (when a dialog is open). Owns `aria-live="polite"`.
  - `src/coord/segments.ts` — pure helper
    `coordinateSegments(kind, position, prefs): { labelKey, value }[]`;
    re-uses existing converters and existing locale keys.
- **Tests added (4)**:
  - `tests/unit/tap-target.spec.ts`
  - `tests/unit/coordinate-readout-segments.spec.ts`
  - `tests/integration/notification-region.spec.ts`
  - `tests/e2e/mobile-tap-targets.e2e.spec.ts`
- **Docs added (2)**:
  - `docs/ui/0009-mobile-ui-fixes.md` — UI record per Principle III
    (the visible behaviour change: touch sizes, readout layout,
    banner position).
  - `docs/adr/0029-mobile-touch-target-and-notification-region.md`
    — ADR codifying the 44 × 44 CSS-px floor, the notification-region
    pattern, and the rejection of (a) per-component fixed positioning
    and (b) a third-party toast library.
- **i18n changes**: **0** new keys. Re-uses
  `goto.fields.{latDeg,latMin,latSec,latHem,lonDeg,...}`,
  `format.labels.*`, `coverage.notInTaiwan`, etc.
- **Storage / network / permissions changes**: **none**.
- **Bundle delta**: ≤ +1 KiB gzipped (target).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle                                       | Verdict     | Justification |
| ----------------------------------------------- | ----------- | -------------- |
| **I. Code Quality & Formatting**                | PASS        | All edits ride existing Prettier + ESLint flat config. No new linter rule, no new file extension. `npm run format` will be run after every code edit per Development Workflow. No dead code: each amended file removes redundant local sizing in favour of the new shared token; no comment-marker scaffolding. |
| **II. Test-First Development (NON-NEGOTIABLE)** | PASS        | Three Vitest specs (`tap-target`, `coordinate-readout-segments`, `notification-region`) and one Playwright spec land RED before any source change. Each FR maps to ≥ 1 failing assertion: FR-001/002 → tap-target spec; FR-004/005/006 → segments spec; FR-007/008/009 → notification-region spec. The existing copy-string assertions in `tests/unit/coord/format-*.spec.ts` are explicitly *not* changed — that's the regression guard for FR-005. |
| **III. User Experience Consistency**            | PASS w/ doc | Three user-visible changes (button sizes; readout layout; banner positions). New `docs/ui/0009-mobile-ui-fixes.md` mandatory before merge. Design-token additions (`--tap-min`, `--notification-zone-top`, `--notification-zone-bottom`, `--readout-clearance`) extend `tokens.css` rather than overriding inline; existing `--space-*` scale and color tokens are reused. WCAG 2.5.5 Level AAA touch-target floor explicitly chosen (vs WCAG 2.5.5 Level AA's 24-px floor) — see ADR 0029. Dark-mode tokens unchanged. |
| **IV. Performance Requirements**                | PASS        | Five explicit budgets: bundle delta ≤ +1 KiB gzipped; notification first-paint ≤ 200 ms; readout format-switch ≤ 200 ms (SC-005); 60 fps map interaction preserved; tap-target enlargement causes 0 ms render regression. Verified by existing `bundle-size` script + new component-level timing assertion in the segments spec + manual Playwright trace check on the notification spec. |
| **V. Documentation & ADRs**                     | PASS w/ doc | One new ADR planned: ADR 0029 (touch-target floor + notification-region pattern). The segmented-readout decision does **not** justify its own ADR — it is a direct application of ADR 0017 (Go To split layout architecture) to the readout side, and that connection is captured in ADR 0029's "related" section and in `docs/ui/0009`. The ADR index will be updated post-`/speckit.implement`. No existing ADR is superseded. |

**Locale convention compliance** — no new i18n keys introduced; the
segmented readout *consumes* existing keys. The `zh` BCP-47 rule
remains the single canonical Chinese identifier.

**Result**: All five principles pass on the planned design. No
unjustified deviations → Complexity Tracking section left empty.

## Project Structure

### Documentation (this feature)

```text
specs/009-mobile-ui-fixes/
├── plan.md                                # This file
├── research.md                            # Phase 0 output
├── data-model.md                          # Phase 1 output
├── quickstart.md                          # Phase 1 output (incl. mobile-emulator walkthrough)
├── contracts/
│   ├── tap-target.md                      # which controls + invariants + minimum sizes
│   ├── notification-region.md             # region layout + safe zones + aria-live contract
│   └── coordinate-segments.md             # coordinateSegments(kind, position) shape per kind
├── checklists/
│   └── requirements.md                    # /speckit.specify output (already exists)
└── tasks.md                               # /speckit.tasks output (Phase 2; later)
```

### Source code (repository root)

```text
src/
├── app/
│   ├── App.svelte                         # AMENDED — toolbar/settings buttons get --tap-min; toasts move into NotificationRegion
│   └── tokens.css                         # AMENDED — adds --tap-min, --notification-zone-*, --readout-clearance + .tap-target utility
├── components/
│   ├── Compass.svelte                     # AMENDED — min-width/min-height → var(--tap-min)
│   ├── ZoomControls.svelte                # AMENDED — same
│   ├── CoordinateReadout.svelte           # AMENDED — row renders as labelled segments (no copy-output change)
│   ├── InstallBanner.svelte               # AMENDED — drops fixed positioning; mounts inside <NotificationRegion>
│   ├── UpdatePrompt.svelte                # AMENDED — same
│   └── NotificationRegion.svelte          # NEW — fixed stacking host with safe-zone tokens + aria-live="polite"
└── coord/
    └── segments.ts                        # NEW — coordinateSegments(kind, position, prefs): { labelKey, value }[]

tests/
├── unit/
│   ├── tap-target.spec.ts                 # NEW — 44×44 floor + adjacent non-overlap
│   └── coordinate-readout-segments.spec.ts # NEW — segment shape mirrors Go To per kind; canonical copy unchanged
├── integration/
│   └── notification-region.spec.ts        # NEW — banners never intersect toolbar/readout/zoom column/dialog action row
└── e2e/
    └── mobile-tap-targets.e2e.spec.ts     # NEW — Playwright on Mobile Chrome + iOS Safari viewports

docs/
├── ui/
│   └── 0009-mobile-ui-fixes.md            # NEW — UI record per Principle III
└── adr/
    └── 0029-mobile-touch-target-and-notification-region.md  # NEW — ADR per Principle V
```

**Structure Decision**: Single-project layout (Option 1) — same as
features 001–008. New artefacts live alongside their existing peers
(`src/components/*.svelte`, `src/coord/*.ts`, `tests/unit/*.spec.ts`,
`tests/integration/*.spec.ts`, `tests/e2e/*.e2e.spec.ts`, `docs/ui/*`,
`docs/adr/*`) with consecutive numbering. No new top-level directories.

## Complexity Tracking

> No constitutional gate failures. No justified deviations.

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --------- | ---------- | ------------------------------------ |
| (none)    | (none)     | (none)                               |
