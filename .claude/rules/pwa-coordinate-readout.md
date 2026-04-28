---
paths:
  - "src/components/CoordinateReadout.svelte"
  - "src/coord/segments.ts"
  - "src/components/goto/**/*.svelte"
  - "tests/unit/coordinate-readout-*.spec.ts"
  - "tests/unit/coord/**/*.spec.ts"
---

# Coordinate readout + segments contract

Long-form context: [`docs/pwa-mobile-desktop-lessons.md`](../../docs/pwa-mobile-desktop-lessons.md)
§ 8. Authoritative ADRs: 0017 (Go-To split layout), 0030 (format
priority + collapse), 0031 (safe-area + readout rework).

## SEGMENTS HELPER: full list, never prune at source

`coordinateSegments()` in `src/coord/segments.ts` is a PURE helper
that emits the full per-format segment list. Both the readout AND
the Go To layouts depend on it. Feature 009's data-model invariant:

> The number, order, and labelKey values in the returned array MUST
> equal the number, order, and field-label i18n keys of the
> corresponding Go To layout's input fields.

NEVER prune segments at the source — Go To round-trip parity
breaks immediately. Tests in
`tests/unit/coordinate-readout-segments.spec.ts` enforce parity.

## DISPLAY FILTER: hide in the readout component, never at source

If a segment is "Settings-configured noise" (TM2 zone, Taipower
precision, etc. — values the user picks once in Settings, not
primary coordinate data) and shouldn't render inline in the
readout, ADD its labelKey to the `HIDDEN_SEGMENT_LABEL_KEYS` set
in `CoordinateReadout.svelte`:

```ts
const HIDDEN_SEGMENT_LABEL_KEYS = new Set<string>([
  'goto.fields.zone',
  'goto.fields.precision',
  // 'goto.fields.<your new noisy segment>',
]);

// Inside rowFor():
segments: seg.segments.filter((s) => !HIDDEN_SEGMENT_LABEL_KEYS.has(s.labelKey)),
```

The hide is **one-way: presentation-only**:

- The `HIDDEN_SEGMENT_LABEL_KEYS` filter affects only the readout's
  rendered DOM.
- `coordinateSegments()` keeps emitting the full list.
- The copy button MUST keep emitting the canonical full-format
  string via `format*()` helpers (so paste-back into Go To
  round-trips with zero data loss).

## VIEW MODE: two literals only

After feature 011 the `data-mode` attribute on the readout
`<section>` carries one of TWO literals:

- `'collapsed'` — single priority-one row in DOM. Other rows
  filtered out via `slice(0, 1)`.
- `'expanded'` — every enabled-format row in DOM, in `formatOrder`.

Feature 010's `'tap-expanded'` literal is REMOVED. If a future
feature reintroduces a third readout mode, choose a new literal
that doesn't collide with these two and update every spec / test
that pattern-matches `data-mode`.

The complementary `data-toggleable` attribute (`'true'` /
`'false'`) surfaces "≥ 2 formats enabled" to CSS (cursor) and ARIA
(`role`, `tabindex`, `aria-expanded`).

## DEFAULT MODE: width OR height threshold

Default `data-mode` derives from:

```ts
defaultCollapsed = enabled.length >= 2 && (isNarrow || isShort);
```

Where `isNarrow = (max-width: calc(600px - 0.02px))` and
`isShort = (max-height: calc(800px - 0.02px))`. Both are
matchMedia subscriptions in `CoordinateReadout.svelte`.

If you add a new dimension (e.g. orientation, dpr), it joins the
OR. Update `defaultCollapsed`, the userToggled-reset condition
(see [pwa-component-state.md](./pwa-component-state.md) §
"VIEWPORT-DERIVED DEFAULTS"), and the data-model in
`specs/011-safe-area-install-buttons/data-model.md`.
