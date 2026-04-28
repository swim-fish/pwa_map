# Contract — `App.svelte` `.map-controls` cluster layout

The on-map control cluster's geometry, ordering, and safe-area
discipline. Enforced by a combination of integration tests
(geometry + DOM order) and source-text grep tests (token usage).

## DOM order (top-to-bottom reading)

```html
<div class="map-controls">
  <Compass {controller} />          <!-- 1st child -->
  <LocateButton {controller} />      <!-- 2nd child (NEW) -->
  <ZoomControls {controller} />      <!-- 3rd child (renders + above −) -->
</div>
```

Reading top-to-bottom yields four icons: compass → my-location →
zoom-in → zoom-out (FR-002).

## CSS rule

```css
.map-controls {
  position: fixed;
  top:  calc(var(--space-3) + var(--top-stack-zone-top));
  left: calc(var(--space-3) + var(--inline-stack-zone-left));
  z-index: 6;                         /* unchanged from feature 006 */
  display: flex;
  flex-direction: column;
  gap: var(--space-2, 8px);
}
```

The cluster MUST NOT use `transform: translateY(-50%)` (the old
vertical-centring trick is removed). The cluster MUST NOT use
`bottom:` or `right:` declarations.

## Token discipline (verified by `tests/unit/safe-area-tokens.spec.ts`)

The grep guard from feature 011 / `.claude/rules/pwa-positioning.md`
applies in full. The MODIFIED test gains these new assertions
specific to `App.svelte` source text:

1. The `.map-controls` selector's `top` declaration MUST contain
   the substring `var(--top-stack-zone-top)`.
2. The `.map-controls` selector's `left` declaration MUST
   contain the substring `var(--inline-stack-zone-left)`.
3. Neither declaration MUST contain a literal `env(` substring.
4. The `.map-controls` selector MUST NOT contain a `transform:`
   declaration (defensive against the old vertical-centring
   pattern returning).
5. The `.map-controls` selector MUST NOT contain a `bottom:` or
   `right:` declaration.

## Geometry contract (verified by `tests/integration/cluster-layout-top-left.spec.ts`)

Mount `App.svelte` in jsdom with simulated viewport sizes and
safe-area inset values via the existing test fixture. Assert:

| Viewport (px)         | Top inset (px) | Expected `.map-controls` top edge | Expected left edge |
|------------------------|----------------|------------------------------------|---------------------|
| 390 × 844 (iPhone)     | 47             | `var(--space-3) + 47`              | `var(--space-3) + 0` |
| 320 × 568 (small)      | 0              | `var(--space-3) + 0`               | `var(--space-3) + 0` |
| 568 × 320 (landscape)  | 0              | `var(--space-3) + 0`               | `var(--space-3) + 0` |
| 1440 × 900 (desktop)   | 0              | `var(--space-3) + 0`               | `var(--space-3) + 0` |

Computed-style numbers are read via `getComputedStyle(el).top` /
`.left` and matched against the expected `calc(...)` text.

DOM ordering assertion: `el.children[0]` selectors verify
`data-testid="compass"` is first, `data-testid="locate"` second,
`data-testid="zoom-in"` third (rendered as the first child of
`ZoomControls`), `data-testid="zoom-out"` fourth.

Each child's bounding box MUST be at least 44 px × 44 px
(`var(--tap-min)`); each adjacent gap MUST be 8 px
(`var(--space-2)`).

## Non-overlap contract

The cluster MUST NOT overlap:

- The top-right `.toolbar` (Settings + Go-To buttons) — the
  toolbar's left edge is right of the cluster's right edge by at
  least `var(--space-4)`.
- The bottom-right coordinate readout — the readout's top edge is
  below the cluster's bottom edge.
- The notification region (install banner / update prompt /
  offline-ready toast) — the notification region anchors top
  with its own safe-area inset; the cluster sits below it via
  the same `--top-stack-zone-top` token (the existing
  composition mechanism handles stacking automatically).
- The attribution badge — bottom-right, never near the cluster.

The `tests/integration/cluster-layout-top-left.spec.ts` file
asserts no overlap by computing bounding boxes of the cluster
plus each of those surfaces and checking that the rectangles
do not intersect.

## E2E contract

`tests/e2e/cluster-layout.e2e.spec.ts` exercises real-browser
geometry on:

- Chromium 1440 × 900 (desktop)
- Chromium 390 × 844 with simulated 47 px top inset (iPhone-class)
- Chromium 320 × 568 (small phone, no inset)
- Chromium 568 × 320 (small landscape)

The test takes a screenshot of each viewport for the
`docs/ui/screenshots/` archive (the existing convention in
`docs/ui/screenshots/`).
