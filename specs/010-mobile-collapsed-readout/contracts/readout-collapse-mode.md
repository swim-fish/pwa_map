# Contract: Readout collapse + tap-expand mode

**Feature**: 010-mobile-collapsed-readout
**Surface**: Svelte component `src/components/CoordinateReadout.svelte`
**Author**: `/speckit.plan` (Phase 1)
**Spec FRs**: FR-001, FR-002, FR-003, FR-008, FR-009, FR-010 · **Spec SCs**: SC-001, SC-004

## State machine

```text
                       enabled.length < 2     OR     viewport >= 600px
                       ────────────────────────────────────────────────▶ expanded
                                                  ▲
                                                  │ resize past 600px (clears tapExpanded)
                                                  │
   collapsed ◀───── tap on body ─────▶ tap-expanded
   (single row)                       (all enabled rows)
        │                                   │
        │  resize past 600px                │  reload page
        ▼                                   ▼
   expanded                            collapsed (start state on narrow + multi-enabled)
```

## Public component surface (excerpt)

```svelte
<CoordinateReadout
  position={crosshair}
  visible={prefs.visible}
  formatOrder={prefs.formatOrder}     {/* NEW prop */}
  mgrsPrecision={prefs.mgrsPrecision}
  taipowerPrecision={prefs.taipowerPrecision}
/>
```

The component owns `tapExpanded: boolean` as `let` state; **no
prop, no event** drives it externally. `formatOrder` is the only
new prop introduced by this feature.

## CSS contract

```css
.readout {
  /* …existing properties… */
}

@media (max-width: calc(var(--readout-collapse-bp) - 0.02px)) {
  .readout[data-mode='collapsed'] .row:not(.row--priority-one) {
    display: none;
  }
  .readout[data-mode='collapsed'] {
    /* Collapsed visual treatment — single-row footprint */
    cursor: pointer;
  }
  .readout[data-mode='tap-expanded'] {
    /* All rows visible; same width budget as collapsed */
  }
}
```

`--readout-collapse-bp: 600px` (defined in `src/app/tokens.css`).
The `0.02px` adjustment matches the canonical Bootstrap / Material
half-pixel-rounding pattern (research.md §R6).

## Invariants

1. **Single-row collapse.** When `data-mode === 'collapsed'`, exactly one row (the priority-one enabled format) is rendered visible; other rows are removed from the visual flow (`display: none`).
2. **Order parity.** When `data-mode === 'expanded'` or `'tap-expanded'`, rows render in `formatOrder` order — projected through `visible` (disabled formats omitted).
3. **Tap pass-through to copy.** Clicking the copy button does NOT toggle `tapExpanded` — `event.stopPropagation()` on the copy handler.
4. **No persistence.** `tapExpanded` is never written to localStorage; on page reload, narrow-viewport sessions start in `collapsed`, not `tap-expanded`.
5. **Resize clears.** When the matchMedia query for `(max-width: calc(var(--readout-collapse-bp) - 0.02px))` transitions from match → no-match, `tapExpanded` is reset to `false` synchronously (so a later narrowing returns to `collapsed`, not `tap-expanded`).
6. **Single-format escape.** When `enabled.length < 2`, `data-mode` resolves to `'expanded'` regardless of viewport — no collapse styling, no tap-to-expand affordance, no `cursor: pointer`.
7. **Zoom-controls non-overlap.** On viewports 320–599 px wide, in `data-mode === 'collapsed'` and `'tap-expanded'`, `getBoundingClientRect()` of the readout does not intersect the rect of `.zoom-controls`.

## A11y contract

- `data-mode === 'collapsed'` adds `role="button"` and `aria-expanded="false"` to the readout root; `data-mode === 'tap-expanded'` switches `aria-expanded="true"`. `data-mode === 'expanded'` removes the role and the attribute (the readout is pure presentational on wide viewports).
- Keyboard: `Enter` and `Space` on the focused readout root toggles between `collapsed` and `tap-expanded` (mirrors the tap behaviour for keyboard users).
- The copy button retains its existing `aria-label` and `tap-target` class (44 × 44 floor from feature 009).

## Verification

| Spec | Asserts |
| ---- | ------- |
| `tests/unit/coordinate-readout-collapse.spec.ts` | Invariants 1, 2, 6 (jsdom + matchMedia stub). |
| `tests/unit/coordinate-readout-tap-expand.spec.ts` | Invariants 3, 4, 5; A11y `aria-expanded` toggling. |
| `tests/e2e/mobile-collapsed-readout.e2e.spec.ts` | Invariant 7 (Mobile Chrome + iOS Safari). |

## Non-goals

- Animated row insertion / removal during tap-expand (CSS `display: none` is acceptable; advanced FLIP transitions are out of scope).
- Collapse mode on tablet (≥ 600 px) — never collapses regardless of enabled-format count.
- Long-press to expand — only tap (and keyboard `Enter` / `Space`).
