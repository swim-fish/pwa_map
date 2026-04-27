# ADR 0029 — Mobile touch-target floor + notification-region pattern

**Status**: Accepted
**Date**: 2026-04-27
**Feature**: `specs/009-mobile-ui-fixes/`
**Supersedes**: —
**Related**: ADR 0014 (Accessibility Baseline — touch-target rationale extends it),
ADR 0017 (Go To split-layout architecture — segment shape mirrors it),
ADR 0023 (SW registration strategy — UpdatePrompt's persistence flow preserved),
ADR 0025 (PWA install surfaces — InstallBanner's persistence flow preserved)

## Context

After feature 008 shipped the project to production via GitHub
Pages, three mobile-side UX problems became visible in the wild:

1. **Sub-floor tap targets**. Multiple interactive controls
   (compass toggle, zoom in/out, settings icon, copy buttons in
   the readout, install / update prompt buttons, several toolbar
   buttons) rendered at 16–36 CSS pixels — well below WCAG 2.5.5
   Level AAA's 44 × 44 floor and below iOS HIG's 44 × 44 pt
   recommendation. Real-thumb users on phones reported repeated
   missed-taps and accidental neighbour-presses.
2. **Coordinate readout / Go To input divergence**. The readout
   showed each format as one canonical string; the Go To dialog
   showed the same format as labelled per-segment inputs. A user
   reading a coordinate from the readout had to mentally re-segment
   it before they could type it back into Go To.
3. **Banner overlap**. `UpdatePrompt`, `InstallBanner`, and four
   inline transient toasts in `App.svelte` each carried their own
   `position: fixed` block. When two banners were visible at once
   they overlapped each other; either one could obscure toolbar
   buttons or the readout panel.

A spec / plan / contracts cycle (`/speckit.specify` →
`/speckit.plan` → `/speckit.tasks` → `/speckit.implement`) produced
the design recorded below; this ADR captures the **decisions**
that bind future contributors.

## Decision

### Part 1 — Tap-target floor: 44 × 44 CSS pixels (WCAG 2.5.5 AAA)

A single design token `--tap-min: 44px` declared once in
`src/app/tokens.css`, plus a sibling `.tap-target` utility class
that sets `min-width: var(--tap-min); min-height: var(--tap-min);`.
Every interactive control reachable on a phone-class viewport
(compass, zoom, settings icon, every `.toolbar-btn`, every banner
action button, the readout copy button, every Go To dialog button)
hits the floor — either via the utility class on the element or
via the same `min-width` / `min-height` rule in its scoped
`<style>` block.

**Rationale**:

- WCAG 2.5.5 Level AAA ("Target Size — Enhanced") explicitly
  mandates 44 × 44 CSS pixels.
- iOS Human Interface Guidelines recommend 44 × 44 pt.
- Material guidance recommends 48 dp; we chose 44 to keep the
  toolbar inside the 320-px-wide budget on the smallest supported
  phones (FR-003 / SC-006).
- One token + one utility class beats per-component sizing
  because (a) a single regression test pins the floor for the
  whole app, (b) the decision is auditable in one place, and
  (c) future buttons inherit the floor by reflex.

**Alternatives considered & rejected**:

- WCAG 2.5.5 Level AA's 24 × 24 floor — meets the legal minimum
  but does not measurably solve the user's stated complaint.
- Material's 48 dp — would require widening the toolbar past
  the 320-px-wide budget on iPhone-SE-class phones.
- Ad-hoc per-component sizing — leaves no single auditable
  invariant for the regression test.

### Part 2 — Single `<NotificationRegion>` host (NOT per-banner positioning)

A new Svelte component `src/components/NotificationRegion.svelte`
owns layout for every transient banner. The component:

- Is `position: fixed` on the viewport.
- Anchors `top: var(--notification-zone-top)` by default.
- Flips to `bottom: var(--notification-zone-bottom)` when
  `body[data-dialog-open]` is set (so an open dialog's primary
  action row is never shadowed).
- Stacks children in a flex column with `gap: var(--space-3)`,
  so two visible banners are visibly distinct.
- `pointer-events: none` on the container with
  `pointer-events: auto` on direct children — taps that miss a
  visible banner pass through to the underlying control.
- `aria-live="polite"` + `aria-atomic="false"` — banner content
  inherits.

`UpdatePrompt`, `InstallBanner`, and the four inline transient
toasts in `App.svelte` were edited to drop their own
`position: fixed` blocks and mount inside the region. Their
content, dismiss flows, persistence (localStorage timestamps),
and ARIA roles are preserved verbatim — this ADR does NOT
supersede ADR 0023 (SW registration) or ADR 0025 (install
surfaces).

`App.svelte` reactively writes / clears
`document.body.dataset.dialogOpen` whenever `goToOpen ||
settingsOpen` toggles.

**Rationale**:

- One layout owner makes "no overlap" a CSS property of the
  region, not a hand-written contract repeated across six
  components.
- Stacking with explicit gap (vs queueing) preserves
  concurrent-banner discoverability (e.g., install + update can
  both be visible without forcing the user to dismiss one).
- The `body[data-dialog-open]` toggle is one line to set and one
  line to clear; no observer / pub-sub plumbing.

**Alternatives considered & rejected**:

- Per-banner `position: fixed` + careful `z-index` ordering
  (the original design): the cause of the bug we're fixing.
- A queue / priority policy where only one banner is visible at
  a time: more state, more tests, no concrete win for a
  ≤ 6-banner population.
- A third-party toast library (e.g., `svelte-french-toast`):
  rejected on dependency-cost grounds — the region is ~30 lines
  of Svelte; adding a runtime dep is not justified.

### Part 3 — Coordinate-segment helper mirrors Go To layouts

A new pure module `src/coord/segments.ts` exports
`coordinateSegments(kind, position, prefs)` returning a
`{ labelKey, value }[]` whose label-key list and order mirror
the corresponding Go To layout component for the same
`CoordinateKind`. The function composes the existing converters
(`wgs84DdToDms`, `wgs84ToTwd97`, etc.) and pre-formats each
segment's display string. The readout consumes it for layout;
the **copy button** continues to call `format*()` directly so
the canonical single-string output is bit-exact preserved.

**Rationale**:

- ADR 0017 already established the split-layout architecture
  on the input side. Putting the same shape on the output side
  closes the round-trip — readout → eye → Go To input becomes a
  trivial 1:1 field copy.
- Pure function ⇒ unit-testable without mounting Svelte. The
  spec asserts segment count + label-key parity with the Go To
  layout source files (`data-testid` / `tStore('goto.fields.*')`
  enumeration).
- Routing the copy button through the existing `format*()`
  helpers (rather than re-joining segments) preserves FR-005's
  byte-exact canonical-string contract that `tests/unit/coord/format-*.spec.ts`
  has guarded since feature 001.
- Re-uses the `goto.fields.*` i18n namespace introduced in
  feature 002 — zero new translation strings.

**Alternatives considered & rejected**:

- Render Go To layouts in a read-only mode inside the readout —
  rejected: would force an `editable: boolean` prop into seven
  layout components.
- Compute segments inside `CoordinateReadout.svelte` — rejected:
  duplicates the per-kind branching that already lives in
  `rowFor`.
- Reconstruct the canonical string from segments by joining —
  rejected: every kind has a different separator pattern (e.g.,
  DMS uses `°`, `′`, `″`, hemisphere; TM2 uses `E `, `, N `,
  ` (zone …)`); joining is brittle. Routing copy through
  `format*()` is cheaper and exact.

## Consequences

- **Performance budget impact**: bundle delta ≤ +1 KiB gzipped,
  measured by `npm run bundle-size`. The whole feature is CSS
  - ~30 lines of Svelte (`NotificationRegion`) + ~120 lines of
    pure TypeScript (`coord/segments.ts`).
- **Locale impact**: zero new keys. `zh / en / ja` catalogues are
  byte-identical to pre-feature.
- **Storage impact**: no `localStorage` schema change.
  Feature 005's install-dismissed timestamp keys and feature
  004's offline-ready signal are untouched.
- **Test impact**: +34 tests (8 tap-target + 11 notification-region
  - 12 coordinate-segments + 3 e2e mobile-tap-targets). Brings
    the suite from 566 to 600 vitest tests; e2e adds 3 new specs
    on top of the existing 12.
- **Future-proofing**:
  - Adding a new on-screen control inherits `--tap-min` if it
    uses the `.tap-target` class; the regression spec catches
    omissions.
  - Adding a new transient banner mounts inside `<NotificationRegion>`
    and inherits the no-overlap property automatically.
  - Adding a new `CoordinateKind` requires a `case` in
    `coordinateSegments` AND a matching Go To layout component
    AND matching `goto.fields.*` keys. The spec guards the
    parity.

## Rollback

If a regression surfaces post-deploy:

- **Rollback the tap-target floor only**: revert
  `src/app/tokens.css` (4-line diff) and the seven component
  edits that consume `--tap-min`. The feature reverts to the
  pre-009 36-px / ad-hoc sizing. Other US2 / US3 changes survive.
- **Rollback the notification region only**: restore the
  per-banner `position: fixed` blocks in `UpdatePrompt`,
  `InstallBanner`, and the four `.toast` rules in `App.svelte`,
  then unmount `<NotificationRegion>`. Other US1 / US3 changes
  survive.
- **Rollback the segmented readout only**: revert
  `src/components/CoordinateReadout.svelte` (the rendering
  block) and remove `src/coord/segments.ts`. The copy button
  contract is independent; no readers of this module exist
  outside the readout. Other US1 / US2 changes survive.

The three sub-features were designed to be rollback-independent
because the spec authored them as three independently testable
user stories.
