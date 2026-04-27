# UI Record 0009 — Mobile UI Adjustments: Touch Targets, Segmented Coordinate Readout, Notification Stacking

**Status**: Accepted (landed at `/speckit.implement` 2026-04-27)
**Affected screens**: every interactive control on a phone-class viewport — toolbar buttons, settings icon, compass toggle, zoom in / out, coordinate readout copy buttons, install banner, service-worker update prompt, all four transient toasts (zone hint, copy success, layer-load failure, offline-ready), and the Go To disambiguator. The coordinate readout's row layout changes from a single canonical string per row to a labelled-segment row mirroring the corresponding Go To layout.
**Feature**: `specs/009-mobile-ui-fixes/`

## Context

Three independent phone-side complaints were raised against the
shipped product (features 001–008):

1. **Buttons too small to tap**. Compass toggle, zoom controls,
   readout copy button, settings icon, and various dialog buttons
   were sized below the WCAG / iOS HIG / Material touch-target
   floor (some at 36 × 36, the readout copy button at 16–18 px).
   Users reported missed taps and accidental neighbour-presses on
   real phones.
2. **Coordinate readout hard to map back to Go To input**. The
   readout showed each format as one canonical string
   (e.g., `25° 07′ 26.853″ N, 121° 33′ 50.099″ E`) while the Go
   To dialog's input fields for the same format were split into
   labelled inputs (lat-deg, lat-min, lat-sec, hem, …). Users had
   to mentally re-segment the string before they could re-enter
   it, so the readout-to-Go-To round-trip was friction-heavy.
3. **Notifications overlap controls**. `UpdatePrompt` was anchored
   top-center, `InstallBanner` bottom-right, and four inline
   toasts in `App.svelte` were anchored top-center too. When two
   fired simultaneously they overlapped each other; when any
   fired they could shadow toolbar buttons or the readout panel.

This UI record captures the three visible-behaviour changes and
the supporting design tokens.

## Design goals

1. **One tap-target floor for the whole app**. `--tap-min: 44px`
   plus a `.tap-target` utility class in `tokens.css`, applied to
   every interactive control. WCAG 2.5.5 Level AAA + iOS HIG
   point-floor — see ADR 0029.
2. **Single source of truth for coordinate-segment shape**. A new
   pure helper `src/coord/segments.ts :: coordinateSegments(...)`
   returns `{ labelKey, value }[]` whose label-key list and order
   mirror the corresponding Go To layout component for the same
   `CoordinateKind`. The readout consumes it; the existing
   `format*()` helpers remain the canonical single-string source
   of truth (preserved bit-exact for the copy button).
3. **Single fixed-position host for transient banners**.
   `<NotificationRegion>` owns layout for every banner/toast.
   Banner components keep their content + persistence flow but
   drop their own `position: fixed` blocks. The region anchors
   to the top-center by default and flips to bottom-anchor when
   `body[data-dialog-open]` is set, so an open dialog's CTA row
   is never shadowed.
4. **No new locale keys, no new persisted state, no new
   dependencies**. Consumed entirely by re-using the
   `goto.fields.*` namespace introduced in feature 002.

## Visible changes — three audience views

### What the END USER sees

- Every button on a phone is now ≥ 44 × 44 CSS pixels (about
  thumb-tip-sized).
- The coordinate readout now shows each format split into labelled
  fields (e.g., **Lat deg** 25 · **Lat min** 07 · **Lat sec**
  26.853 · **N/S** N), in the same field order Go To expects.
  Tapping the copy button still puts the canonical string on the
  clipboard.
- Notifications no longer cover toolbar buttons or the readout.
  When the SW-update prompt and install banner are both visible
  they sit one on top of the other with explicit spacing instead
  of overlapping.
- When a dialog (Go To, Settings) is open, notifications anchor
  to the bottom edge so the dialog's primary action row stays
  visible.

### What the CONTRIBUTOR sees

- A new `--tap-min: 44px` token plus a `.tap-target` class in
  `src/app/tokens.css`. Apply via either: (a) `class="tap-target"`
  on a button element, or (b) `min-width: var(--tap-min);
min-height: var(--tap-min);` in a scoped style rule.
- `src/components/NotificationRegion.svelte` is the single host
  for all transient banners. To add a new banner, mount it inside
  the existing `<NotificationRegion>` block in `App.svelte` and
  do **not** give the new component its own `position: fixed`
  block.
- `src/coord/segments.ts :: coordinateSegments(kind, position,
prefs)` returns the segment shape for the readout. To add a
  new `CoordinateKind`, add a case to the function and add the
  matching label keys to `goto.fields.*` (and the Go To layout
  component for the same kind) — keep the two in sync.
- Three new design tokens: `--notification-zone-top`,
  `--notification-zone-bottom`, `--readout-clearance`. Override
  per-screen in your own scoped style rule if you need a
  per-feature offset, but keep the shared default.

### What the AUTOMATED TEST SUITE sees

- `tests/unit/tap-target.spec.ts` — 8 tests; CSS source-string
  net asserting every flagged selector hits the floor.
- `tests/integration/notification-region.spec.ts` — 11 tests;
  structural + ARIA + CSS contract for the region.
- `tests/unit/coordinate-readout-segments.spec.ts` — 12 tests;
  segment-shape parity with Go To + canonical-copy regression
  guard.
- `tests/e2e/mobile-tap-targets.e2e.spec.ts` — 3 tests; real
  Chromium / Firefox / WebKit geometry at 360 × 640 and 320 × 640.

## Tokens added

| Token                        | Default value                                                       | Purpose                                                           |
| ---------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `--tap-min`                  | `44px`                                                              | Minimum hit-zone for every interactive control.                   |
| `--notification-zone-top`    | `calc(var(--space-4) + env(safe-area-inset-top, 0px))`              | Top offset of the notification region in its default state.       |
| `--readout-clearance`        | `calc(var(--space-4) * 6)`                                          | Vertical reserve above the readout panel; sized for six rows.     |
| `--notification-zone-bottom` | `calc(var(--readout-clearance) + env(safe-area-inset-bottom, 0px))` | Bottom offset of the region when `body[data-dialog-open]` is set. |

`.tap-target` utility class applies `min-width: var(--tap-min);
min-height: var(--tap-min);` together. Existing `--space-*`,
`--color-*`, `--font-*` tokens are unchanged.

## Out of scope

- No new color or typography tokens. Dark-mode coverage of the
  enlarged buttons is verified to remain at WCAG AA via the
  pre-existing `tests/integration/controls-contrast.spec.ts`
  net (no token changes triggered new contrast risk).
- No new coordinate format. The segment helper covers exactly the
  six formats already supported.
- No queue / priority policy for the notification region. The
  region renders all visible slots in mount order; existing
  banner state machines decide visibility.

## Acceptance traceability

- spec FR-001 / FR-002 / FR-003 / SC-001 / SC-006 (touch-target
  floor + 320-px-no-scroll): satisfied by the seven button
  surfaces consuming `--tap-min`, asserted by
  `tap-target.spec.ts` and `mobile-tap-targets.e2e.spec.ts`.
- spec FR-004 / FR-005 / FR-006 / SC-004 / SC-005 (segmented
  readout + canonical copy): satisfied by `coordinateSegments`
  composing existing converters / formatters; the copy button in
  `CoordinateReadout.svelte` continues to call `format*()`
  directly. Asserted by `coordinate-readout-segments.spec.ts`.
- spec FR-007 / FR-008 / FR-009 / SC-002 / SC-003 (notifications
  never block UI): satisfied by `NotificationRegion.svelte`
  owning placement, banners stripped of self-positioning, and
  `body[data-dialog-open]` shifting the anchor. Asserted by
  `notification-region.spec.ts`.
- spec FR-010 / FR-011 (keyboard / focus / locale preserved):
  satisfied by leaving banner content + Compass / ZoomControls
  / toolbar focus-visible rules untouched, and re-using existing
  `goto.fields.*` keys (no new translation strings).
