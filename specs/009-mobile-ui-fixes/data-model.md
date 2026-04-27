# Phase 1 Data Model — Mobile UI Adjustments

**Feature**: 009-mobile-ui-fixes
**Date**: 2026-04-27
**Plan**: [plan.md](./plan.md)

This feature is layout-and-rendering-only: it persists nothing, sends
nothing over the wire, and introduces no client-side schema migration.
The "data" the design relies on is therefore not application state —
it is the small set of in-memory shapes the new code paths emit and
the runtime-css surface those shapes are rendered through. They are
captured here so the contracts and the tests have a single
authoritative reference.

## Persisted state

**None added.** No `localStorage` key is created, read, written, or
removed by this feature. The dismissal-timestamp keys owned by feature
005 (`InstallBanner`) and feature 004 (`UpdatePrompt`) remain
untouched and continue to follow ADR 0021 (additive prefs evolution).

## In-memory entities

### TapTargetSizing

A static, shared sizing rule applied via CSS custom properties.

| Field          | Type     | Source                      | Notes                                                                                |
| -------------- | -------- | --------------------------- | ------------------------------------------------------------------------------------ |
| `--tap-min`    | length   | `src/app/tokens.css`        | `44px`, single declaration, no media-query override.                                  |
| `.tap-target`  | CSS rule | `src/app/tokens.css`        | Utility selector that sets `min-width: var(--tap-min); min-height: var(--tap-min)`. |

**Invariants**:

- Every interactive control reachable on a 360×640 viewport (compass
  toggle, zoom in/out, settings icon, every `.toolbar-btn`,
  `.settings-toolbar-btn`, every `InstallBanner` action button, every
  `UpdatePrompt` action button, every `.copy` in the readout, every
  `Disambiguator` choice button, every Go To dialog primary
  confirm/dismiss button) MUST resolve to a rendered box ≥ 44×44 CSS
  pixels.
- No two of those boxes' bounding rectangles MUST intersect.
- `--tap-min` MUST be exactly `44px`. (Tested via a regex assertion in
  the tap-target spec to prevent accidental drift to e.g. `40px`.)

**State transitions**: none. This entity is static.

### NotificationSlot

A single banner instance rendered inside the new region. Emitted by
each existing banner host (`UpdatePrompt`, `InstallBanner`, the four
inline transient toasts in `App.svelte`).

| Field        | Type                                                                                  | Notes                                                                                                                          |
| ------------ | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `id`         | string                                                                                | Stable per-banner-class identifier (`'sw-update'`, `'install'`, `'copy-success'`, `'layer-fail'`, `'offline-ready'`, `'zone-hint'`). |
| `severity`   | `'info' \| 'success' \| 'warning'`                                                    | Used only for ARIA + visual styling; does not affect placement.                                                                 |
| `dismissable`| boolean                                                                               | True when the user can close it; banners with `false` auto-dismiss via existing timeouts.                                       |
| `mountAt`    | DOM portal target = `<NotificationRegion>`'s slot                                     | Replaces today's per-banner `position: fixed` block.                                                                            |

**Invariants**:

- A `NotificationSlot` MUST be a direct child of `<NotificationRegion>`'s
  slot — banner components MUST NOT re-introduce `position: fixed`
  inside their own template.
- The region MUST never contain a slot whose own bounding rectangle
  intersects the toolbar root, the compass, the zoom controls, the
  settings icon, the readout panel, or — when a dialog is open — that
  dialog's primary action row.
- Two slots simultaneously present in the region MUST stack
  vertically with a gap of `var(--space-3)` between them; their
  bounding rectangles MUST NOT intersect each other.

**State transitions** (per banner, owned by each banner's existing
state machine — preserved verbatim):

```text
hidden → visible        (trigger fires)
visible → dismissed     (user action OR auto-timeout)
dismissed → hidden      (next render)
```

The `<NotificationRegion>` host itself is stateless: it renders
whatever slots its parent supplies in mount order.

### CoordinateSegment

The shape returned by the new pure helper
`src/coord/segments.ts :: coordinateSegments(kind, position, prefs)`.

| Field      | Type     | Notes                                                                                       |
| ---------- | -------- | ------------------------------------------------------------------------------------------- |
| `labelKey` | string   | An i18n key from the existing `goto.fields.*` namespace; passed through `tStore(...)`.       |
| `value`    | string   | The pre-formatted display text for that one segment (e.g., `'25'`, `'07'`, `'21Q'`).        |

The function returns either an array of segments **or** a coverage
sentinel:

```ts
type CoordinateSegmentResult =
  | { coverage: 'ok'; segments: CoordinateSegment[] }
  | { coverage: 'out-of-coverage' };
```

**Per-kind segment cardinality and order**:

| `CoordinateKind` | Segments returned (in order)                                                                                                       | Mirrors Go To layout |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| `wgs84-dd`       | `lat`, `lon`                                                                                                                        | `DdLayout`           |
| `wgs84-dms`      | `latDeg`, `latMin`, `latSec`, `latHem`, `lonDeg`, `lonMin`, `lonSec`, `lonHem`                                                       | `DmsLayout`          |
| `twd97-tm2`      | `tm2Easting`, `tm2Northing`, `tm2Zone`                                                                                              | `Tm2Layout`          |
| `twd67-tm2`      | `tm2Easting`, `tm2Northing`                                                                                                         | `Twd67Layout`        |
| `mgrs`           | `mgrsGzdBand`, `mgrsSquare`, `mgrsEasting`, `mgrsNorthing`                                                                          | `MgrsLayout`         |
| `taipower`       | `taipowerFirst5`, `taipowerLast`, `taipowerPrecision`                                                                               | `TaipowerLayout`     |

**Invariants**:

- For each `CoordinateKind`, the number, order, and `labelKey` values
  in the returned array MUST equal the number, order, and field-label
  i18n keys of the corresponding Go To layout's input fields.
  (Asserted in `tests/unit/coordinate-readout-segments.spec.ts` by
  reading the static field-key list from each layout component.)
- The pure helper MUST NOT mutate `position` or `prefs`.
- The helper MUST be free of side effects (no DOM, no `localStorage`,
  no `Date.now()`, no `Math.random()`); it composes only the existing
  pure converters and string formatters from `$coord/index`.
- Concatenating the `value` of every segment in order, separated by
  the canonical separator for that kind (space / comma / nothing per
  format), MUST equal — character-for-character —
  `format{Kind}(...)` for the same input. (Asserted in the same
  spec; this is the FR-005 guarantee in test form.)

### NotificationRegionLayoutTokens

Three new design tokens declared in `src/app/tokens.css`.

| Token                          | Default value                                                                  | Purpose                                                                                       |
| ------------------------------ | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| `--notification-zone-top`      | `calc(var(--space-4) + env(safe-area-inset-top, 0px))`                          | The `top` offset for the region in its default (no-dialog) state.                              |
| `--notification-zone-bottom`   | `calc(var(--readout-clearance) + env(safe-area-inset-bottom, 0px))`             | The `bottom` offset used when `body[data-dialog-open]` is set, so the dialog's CTAs stay clear. |
| `--readout-clearance`          | `calc(var(--space-4) * 6)`                                                     | The vertical reserve above the readout panel; sized for up to six visible coordinate rows.    |

**Invariants**:

- Removing or zeroing any of these tokens MUST cause the
  notification-region spec to fail visibly (i.e., the spec depends on
  the tokens being non-zero, not on their literal values).
- No new color or typography tokens are added.

## Out of scope (explicit non-data-model)

- The persistence contract for InstallBanner dismissal (owned by
  feature 005) — not changed, not duplicated here.
- The SW update reload flow (owned by feature 004) — not changed.
- The Go To layout components' input-state shape — not changed.
- Any new map / coordinate format — none.
