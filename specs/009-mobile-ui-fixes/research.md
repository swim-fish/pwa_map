# Phase 0 Research — Mobile UI Adjustments

**Feature**: 009-mobile-ui-fixes
**Date**: 2026-04-27
**Plan**: [plan.md](./plan.md)
**Spec**: [spec.md](./spec.md)

This document resolves open questions raised by the spec and the plan
so that Phase 1 (data model + contracts) can be authored without
further open `NEEDS CLARIFICATION` markers. The plan above has zero
remaining markers; the entries below document *why* each decision was
chosen.

## R1 — Touch-target minimum size

**Decision**: 44 × 44 CSS pixels, applied as `min-width: var(--tap-min);
min-height: var(--tap-min);` with `--tap-min: 44px` declared once in
`tokens.css`.

**Rationale**:

- WCAG 2.5.5 Level AAA ("Target Size (Enhanced)") explicitly mandates
  44 × 44 CSS pixels for pointer target size — the strictest published
  bar in the design system family the project already aligns with
  (ADR 0014, Accessibility Baseline).
- iOS Human Interface Guidelines recommend a 44 × 44 pt minimum for
  hit targets — bit-identical when rendered at 1× / 2× / 3× because
  CSS pixels and iOS points share the abstract size space.
- Google's Material guidance recommends 48 dp; 44 px is one CSS-pixel
  short of that but stays within Material's "tappable zone may extend
  beyond the visual bounds via padding" allowance — and 48 dp would
  push the toolbar 4 px wider, which collides with the 320-px-wide
  budget (FR-003 / SC-006).
- The current button sizes (36 × 36 px on the compass and zoom
  controls; ~30 × 30 px on the inline toolbar text buttons; 16–18 px on
  the readout copy button) sit clearly below this floor.

**Alternatives considered**:

- **24 × 24 (WCAG 2.5.8 Level AA)** — meets the *minimum* legal bar
  but would not measurably improve the user's stated complaint
  ("不能太小"); rejected as not solving the problem.
- **48 × 48 (Material)** — solves the problem but pushes the existing
  toolbar past 320 px on the smallest supported phones; rejected on
  layout-budget grounds.
- **Ad-hoc per-component sizing** (e.g., compass 44, zoom 40, copy
  36) — rejected because it leaves no single auditable invariant for
  the tap-target test (`tests/unit/tap-target.spec.ts`) to enforce.

## R2 — Notification stacking strategy

**Decision**: One single `<NotificationRegion>` host that lays its
children out as a **vertical stack with `gap: var(--space-3)`**.
Children render in mount order; oldest at the top of the stack,
newest at the bottom. We do **not** introduce a queue (where only
one banner is visible at a time) — concurrency between SW-update
and install-prompt is already legitimate and the spec asks only that
they not overlap *visually*.

**Rationale**:

- The existing banner population is small (≤ 6 distinct triggers, of
  which at most 2–3 are realistically concurrent: a ready-to-update
  service worker + an install prompt + one transient toast). A simple
  CSS-grid / flex stack handles the worst case without introducing
  scheduler logic, dismiss-priority rules, or a queue data structure
  that would need its own tests.
- Banner content already encodes its own dismissal (per-banner
  buttons, auto-fade timeouts). Moving them into a shared region does
  not change those behaviours; the region is layout-only.
- Stacking (vs queueing) gives the user the option to act on either
  banner without forcing one to dismiss the other, preserving feature
  005's "Install" CTA discoverability while a SW-update arrives.

**Alternatives considered**:

- **Queue / single-active model** — would require a global
  notification store and cross-component ordering rules. Rejected as
  bigger than the spec asks for and harder to TDD.
- **Two regions (top for system, bottom for user-action)** — clean
  but redundant: with only ≤ 6 banner classes and no co-occurrence
  pattern that benefits from spatial separation, one region is
  enough. Reverse-compatible expansion to two regions remains open
  for a future feature without re-doing this work.
- **Reuse MapLibre's built-in popup/overlay layer** — rejected: those
  are anchored to map coordinates, not viewport corners, and would
  break under map pan.

## R3 — Notification region position on phone vs desktop

**Decision**: Anchor the region to the **top center** of the viewport
on phone-class viewports (matches the current `App.svelte` toast
position); on desktop viewports keep the same anchor for consistency.
Vertical offset is driven by a token chain:
`top: var(--notification-zone-top, calc(var(--space-4) + env(safe-area-inset-top)))`.
When a dialog (Go To, Settings) is open, the region shifts to the
bottom edge via a `body[data-dialog-open]` attribute selector that
flips to `bottom: var(--notification-zone-bottom)` and unsets `top`,
so the dialog's primary action row is never shadowed.

**Rationale**:

- The toolbar already lives at the top, but it sits on the **left
  edge** with `position: fixed` (per `App.svelte`'s current grid).
  A top-center notification region clears the toolbar by horizontal
  position, not by stacking, and clears the readout (bottom-left)
  entirely on phone viewports.
- The compass and zoom controls live on the **right edge**. The
  top-center region is constrained to `max-width: 360px` and
  `transform: translateX(-50%); left: 50%` — never reaches the right
  edge and so never overlaps the compass/zoom column.
- `env(safe-area-inset-top)` keeps the region clear of the iOS notch
  / Android status bar without per-device branching.
- The dialog-open shift is a one-line attribute selector; we do not
  fork into a separate "in-dialog" component.

**Alternatives considered**:

- **Bottom-center** anchor — would clash with the readout panel,
  which is already bottom-left and grows upward with up to six
  visible coordinate format rows. Rejected.
- **Per-banner anchor** (today's behaviour) — the original cause of
  the overlap bug. Rejected by definition of this feature.

## R4 — Coordinate segment helper: where the segments come from

**Decision**: A new pure-TypeScript module
`src/coord/segments.ts` exporting:

```ts
export type CoordinateSegment = { labelKey: string; value: string };
export function coordinateSegments(
  kind: CoordinateKind,
  position: WGS84DD,
  prefs: { mgrsPrecision: number; taipowerPrecision: number },
): CoordinateSegment[] | { coverage: 'out-of-coverage' };
```

The function composes the existing converters
(`wgs84DdToDms`, `wgs84ToTwd97`, `wgs84ToTwd67`, `wgs84ToMgrs`,
`wgs84ToTaipower`) with thin per-segment string formatters; the shape
of the returned array (count, label keys, order) matches the input
field set of the corresponding Go To layout exactly:

| `kind` | Segments returned (in order) |
| ------ | ---------------------------- |
| `wgs84-dd` | `lat`, `lon` (2) |
| `wgs84-dms` | `latDeg`, `latMin`, `latSec`, `latHem`, `lonDeg`, `lonMin`, `lonSec`, `lonHem` (8) |
| `twd97-tm2` | `tm2Easting`, `tm2Northing`, `tm2Zone` (3) |
| `twd67-tm2` | `tm2Easting`, `tm2Northing` (2) |
| `mgrs` | `mgrsGzdBand`, `mgrsSquare`, `mgrsEasting`, `mgrsNorthing` (4) |
| `taipower` | `taipowerFirst5`, `taipowerLast`, `taipowerPrecision` (3) |

**Rationale**:

- Keeps the segment definition in **one** place: the pure helper.
  `CoordinateReadout.svelte` consumes it; (later, optionally) the Go
  To layouts can consume it for their own placeholder labels — a
  refactor that this feature does *not* perform but does not block.
- The per-format format helpers (`formatWGS84DMS`, `formatMGRS`, …)
  remain the single source of truth for the **canonical copy
  string**: the readout's copy button calls them directly,
  unchanged. This satisfies FR-005 (canonical string preserved) by
  construction.
- Pure function ⇒ unit-testable without mounting Svelte. The
  `coordinate-readout-segments.spec.ts` exercise compares
  `coordinateSegments(...)` output keys against the static input
  field key list extracted from each Go To layout component — driving
  ADR 0017's "split layout" architecture into the readout side.

**Alternatives considered**:

- **Render Go To layouts in a read-only mode inside the readout** —
  Rejected: would force an `editable: boolean` prop into seven layout
  components that each currently bind a string state, doubling their
  surface area for a layout-only goal.
- **Compute segments inside `CoordinateReadout.svelte`** — Rejected:
  duplicates the per-kind branching that already lives in `rowFor`,
  which is exactly what we are trying to consolidate.

## R5 — i18n key reuse: are the Go To field-label keys safe to reuse?

**Decision**: Yes. Re-use `goto.fields.{latDeg, latMin, latSec, latHem,
lonDeg, lonMin, lonSec, lonHem, tm2Easting, tm2Northing, tm2Zone,
mgrsGzdBand, mgrsSquare, mgrsEasting, mgrsNorthing, taipowerFirst5,
taipowerLast, taipowerPrecision}` (or whatever subset of those keys
already exists in the locale catalogue, verified at implementation
time) verbatim. No new keys are added by this feature.

**Rationale**:

- Each label denotes the *meaning of a field* (e.g. "Lat Deg",
  "Easting"), not the *role of an input* — the same label is correct
  whether the field is editable (Go To) or read-only (readout).
- Per Constitution v1.1.0 the project ships a single Chinese variant
  (`zh`) plus `en` and `ja`; reusing existing keys keeps the
  three-locale catalogue exactly the size it is today (also matching
  ADR 0009).
- Removes any temptation to introduce parallel keys with subtle
  wording divergence (e.g., `readout.fields.latDeg`), which would
  drift from the Go To labels and undermine the "match exactly"
  acceptance criterion (FR-004).

**Alternatives considered**:

- **New `readout.fields.*` namespace** — rejected for the drift
  reason above.
- **Inline strings in the readout** — would violate the i18n contract
  established by ADR 0009 and feature 002.

## R6 — How to test "no overlap" between notification and other UI

**Decision**: A two-tier approach.

- **Vitest integration spec** (`tests/integration/notification-region.spec.ts`)
  mounts `<App>` at 360 × 640 and 640 × 360 in jsdom, dispatches each
  banner trigger, and uses `getBoundingClientRect()` on the banner
  element and on each "must-not-be-covered" target (toolbar root,
  compass, zoom controls, settings icon, `.readout`, dialog primary
  action row when applicable) to assert
  `rectsDoNotIntersect(banner, target)`. jsdom returns layout boxes
  driven by inline + linked CSS; the project already uses jsdom for
  CoordinateReadout positioning specs (feature 001 baseline).
- **Playwright e2e spec** (`tests/e2e/mobile-tap-targets.e2e.spec.ts`)
  runs the *tap-target* assertion under real Mobile Chrome 120 and
  iOS Safari 17 viewport profiles. We do **not** duplicate the
  notification-overlap assertion in Playwright unless the Vitest
  spec turns out to under-detect a real engine difference — call
  this an addition for a follow-up if needed.

**Rationale**:

- jsdom layout is sufficient for "do these rectangles overlap?"
  questions when the layout is driven by simple `position: fixed`
  + `top/left/transform`. It is *not* sufficient for touch-action,
  pointer events, or browser-specific font metrics — which is why
  the tap-target spec gets a Playwright counterpart.
- Two-tier keeps the fast feedback loop fast (Vitest in CI per push)
  while preserving real-engine confidence for the touch behaviour
  that absolutely needs it.

**Alternatives considered**:

- **Pure visual regression** (Percy / Chromatic) — out of scope and
  introduces a paid SaaS dep; rejected.
- **Playwright-only** — slower CI and harder to TDD against on a
  developer machine; rejected for the inner loop.

## R7 — Dark-mode + high-contrast on enlarged buttons

**Decision**: No new color tokens. Existing `--color-fg`,
`--color-fg-muted`, `--color-border`, and `--color-accent`
(re-shaded under `prefers-color-scheme: dark` in `tokens.css`) cover
all enlarged buttons. The 44×44 floor does not introduce any
background fill that did not exist before; it only enlarges the hit
zone.

**Rationale**: The buttons already meet AA contrast under both
schemes (verified by feature 001 / ADR 0014). Enlarging the hit zone
without touching the background or foreground colour preserves that.

**Alternatives considered**: A new `--tap-target-bg` token to give
mobile buttons a visible "press surface" — rejected for now (out of
spec scope; would need its own UX review).

## R8 — Preserving InstallBanner / UpdatePrompt persistence contracts

**Decision**: `InstallBanner.svelte` and `UpdatePrompt.svelte` keep
all their existing logic — the dismiss timestamps written to
`localStorage` (feature 005 / feature 004), the
`beforeinstallprompt` event flow, the SW `waiting → controlling`
flow — completely unchanged. The only edit is removing their
`position: fixed` outer block and trusting the parent
`<NotificationRegion>` for placement.

**Rationale**:

- The persistence contracts are not in this feature's scope.
- ADR 0023 (SW registration strategy) and ADR 0025 (PWA install
  surfaces) remain authoritative; ADR 0029 will explicitly note
  it does not supersede them.

**Alternatives considered**: Lift the persistence into the new
region — rejected as a scope explosion; the region is a layout host,
not a state owner.

## Open questions

None. All `NEEDS CLARIFICATION` items have been resolved by the
research above and recorded as decisions in this file or in the
Constitution Check table of `plan.md`.
