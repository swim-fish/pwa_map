# Contract: Tap-target floor

**Feature**: 009-mobile-ui-fixes
**Surface**: CSS (token + utility class), applied to existing Svelte components.
**Author**: `/speckit.plan` (Phase 1)
**Spec FRs**: FR-001, FR-002, FR-003 · **Spec SCs**: SC-001, SC-006

## Surface owned by this contract

Two declarations in `src/app/tokens.css`:

```css
:root {
  --tap-min: 44px;
}

.tap-target,
.tap-target:where(:disabled) {
  min-width: var(--tap-min);
  min-height: var(--tap-min);
}
```

That is the entire public surface. There is no JavaScript API, no
event, no exported symbol, no module.

## Required application of the contract

The following selectors / components MUST resolve to a rendered box of
≥ 44 × 44 CSS px on a 360 × 640 viewport:

| Component / selector                                  | File                                          | Application                                          |
| ----------------------------------------------------- | --------------------------------------------- | ---------------------------------------------------- |
| `.compass-button` (the toggle root)                   | `src/components/Compass.svelte`               | replace literal `36px` with `var(--tap-min)`         |
| `.zoom-controls button` (zoom in + zoom out)          | `src/components/ZoomControls.svelte`          | replace literal `36px` with `var(--tap-min)`         |
| `.toolbar-btn`                                        | `src/app/App.svelte`                          | add `min-height: var(--tap-min)`                     |
| `.settings-toolbar-btn`                               | `src/app/App.svelte`                          | add `min-height: var(--tap-min)`                     |
| `.copy` inside `.readout`                             | `src/components/CoordinateReadout.svelte`     | add `min-width: var(--tap-min); min-height: var(--tap-min)` |
| Buttons inside `InstallBanner.svelte`                 | `src/components/InstallBanner.svelte`         | add `class="tap-target"` (drops literal `36px`)      |
| Buttons inside `UpdatePrompt.svelte`                  | `src/components/UpdatePrompt.svelte`          | add `class="tap-target"` (drops literal `36px`)      |
| `Disambiguator` choice buttons                        | `src/components/goto/Disambiguator.svelte`    | add `class="tap-target"` (verify only — may already be ≥ 44) |

## Invariants

1. **Floor is 44 × 44.** Every selector listed above renders at ≥ 44 × 44 CSS pixels on the test viewport.
2. **No overlap.** No two listed boxes' bounding rectangles intersect on the test viewport.
3. **No horizontal scroll at 320 px.** `document.documentElement.scrollWidth ≤ 320` on a 320 × 640 viewport with all of these controls present.
4. **No regression on desktop.** On a 1280 × 800 viewport the floor still applies (controls do not visually shrink) but the layout does not regain any horizontal scroll either.
5. **`--tap-min` value is exactly `44px`.** A regex over `tokens.css` confirms this and prevents drift.

## Verification

| Spec                                                          | Asserts                                                     |
| ------------------------------------------------------------- | ----------------------------------------------------------- |
| `tests/unit/tap-target.spec.ts`                               | Invariants 1, 2, 5 (jsdom, 360 × 640).                       |
| `tests/unit/tap-target.spec.ts` (second viewport block)       | Invariants 1, 2, 3 (jsdom, 320 × 640).                       |
| `tests/e2e/mobile-tap-targets.e2e.spec.ts`                    | Invariants 1, 2 in real Mobile Chrome and iOS Safari profiles. |
| `tests/integration/notification-region.spec.ts` (cross-check) | Banners do not collapse the floor by overlapping a control.  |

## Non-goals

- Changing icon sizes, colors, or labels.
- Changing button text or labels.
- Adding a `--tap-target-bg` token.
- Reflowing the toolbar order or grid.
