# Contract: Safe-Area Zone Tokens

**Feature**: 011-safe-area-install-buttons
**Surface**: CSS custom properties declared in `src/app/tokens.css`
**Author**: `/speckit.plan` (Phase 1)
**Spec FRs**: FR-001..FR-008 · **Spec SCs**: SC-001..SC-004
**Related**: feature 009 / ADR 0029 (notification-zone tokens — refactored, not replaced)

## §1. Public surface

`tokens.css` declares the following four shared safe-area-component
tokens at `:root` scope. Every persistent UI surface in the app
composes them with its own `--space-*` literal to derive its
positional offset from each viewport edge.

```css
:root {
  /* Shared safe-area components — composed per-surface. Each token
     is exactly env(safe-area-inset-*) with the documented 0px
     fallback. No surface MUST consume env(safe-area-inset-*) directly
     outside this file. */
  --top-stack-zone-top: env(safe-area-inset-top, 0px);
  --bottom-stack-zone-bottom: env(safe-area-inset-bottom, 0px);
  --inline-stack-zone-left: env(safe-area-inset-left, 0px);
  --inline-stack-zone-right: env(safe-area-inset-right, 0px);

  /* Existing feature-009 tokens, refactored to delegate to the
     shared safe-area components. The resolved value MUST match the
     pre-refactor value for every viewport (FR-007). */
  --notification-zone-top: calc(var(--space-4) + var(--top-stack-zone-top));
  --notification-zone-bottom: calc(var(--readout-clearance) + var(--bottom-stack-zone-bottom));
}
```

## §2. Surface composition rules

Each persistent surface that touches a viewport edge MUST compose
its existing `--space-*` literal with the corresponding shared safe-area
token via `calc(...)`. Per-surface rules — taken from the data-model's
PerSurfaceSafeAreaOffset table:

```css
/* App.svelte */
.toolbar {
  position: absolute;
  top: calc(var(--space-3) + var(--top-stack-zone-top));
  right: calc(var(--space-3) + var(--inline-stack-zone-right));
  /* ... existing layout rules unchanged ... */
}

.map-controls {
  position: fixed;
  right: calc(var(--space-4) + var(--inline-stack-zone-right));
  bottom: calc(var(--space-4) + var(--space-6) + var(--bottom-stack-zone-bottom));
  /* ... existing layout rules unchanged ... */
}

/* CoordinateReadout.svelte */
.readout {
  position: <existing>;
  bottom: calc(<existing-literal> + var(--bottom-stack-zone-bottom));
  /* ... existing layout rules unchanged ... */
}

/* AttributionBar.svelte */
.attribution {
  position: <existing>;
  bottom: calc(<existing-literal> + var(--bottom-stack-zone-bottom));
  /* ... existing layout rules unchanged ... */
}

/* InstallBanner.svelte (re-using feature 005's offset stack) */
.install-banner {
  position: fixed;
  bottom: calc(var(--space-4) + var(--space-6) + var(--bottom-stack-zone-bottom));
  right: calc(var(--space-4) + var(--inline-stack-zone-right));
  /* ... existing visual rules unchanged ... */
}

/* InstallIosSheet.svelte */
.install-ios-sheet {
  position: fixed;
  bottom: calc(var(--space-4) + var(--bottom-stack-zone-bottom));
  /* ... centering via left: 50%; transform: translateX(-50%) preserved ... */
}

/* SettingsSheet.svelte — see research.md §R4 for the rationale */
.sheet {
  position: fixed;
  top: max(var(--space-4), var(--top-stack-zone-top));
  bottom: max(var(--space-4), var(--bottom-stack-zone-bottom));
  left: max(var(--space-4), var(--inline-stack-zone-left));
  right: max(var(--space-4), var(--inline-stack-zone-right));
  margin: auto;
  max-width: min(440px, calc(100vw - 2 * max(var(--space-4), var(--inline-stack-zone-left), var(--inline-stack-zone-right))));
  max-height: calc(100vh - 2 * max(var(--space-4), var(--top-stack-zone-top), var(--bottom-stack-zone-bottom)));
  overflow-y: auto;
  /* ... existing background / border / shadow / padding rules unchanged ... */
}
```

`ZoomControls.svelte` and `Compass.svelte` do **NOT** receive their
own safe-area edits (research.md §R3) — they inherit the bottom-right
inset via the parent `.map-controls` wrapper.

## §3. Invariants (testable)

1. **Token shape**. Each of `--top-stack-zone-top`,
   `--bottom-stack-zone-bottom`, `--inline-stack-zone-left`,
   `--inline-stack-zone-right` MUST resolve to exactly
   `env(safe-area-inset-<edge>, 0px)`. Asserted by reading the
   `tokens.css` source via the unit spec's text-loader and matching
   against the regex.
2. **0px fallback**. With `env(safe-area-inset-*)` stubbed to `0px`
   (the natural state in jsdom and on every desktop browser), the
   resolved value of every per-surface offset token MUST equal the
   pre-feature literal value within 1 CSS pixel (FR-006 / SC-004).
3. **Notification-zone refactor**. The post-refactor
   `--notification-zone-top` resolved value MUST equal
   `var(--space-4) + var(--top-stack-zone-top)` and the post-refactor
   `--notification-zone-bottom` resolved value MUST equal
   `var(--readout-clearance) + var(--bottom-stack-zone-bottom)`.
   Both MUST resolve to the same final value as the pre-refactor
   declaration on every viewport (FR-007).
4. **No `env()` outside `tokens.css`**. A grep guard in the unit spec
   scans every `*.svelte` and `*.css` file under `src/` (excluding
   `tokens.css`) for the literal pattern `env(safe-area-inset` and
   asserts zero matches. This invariant prevents future surfaces
   from accidentally re-introducing per-component safe-area
   knowledge.
5. **`viewport-fit=cover` preserved**. The unit spec asserts
   `index.html` contains the literal substring `viewport-fit=cover`
   (FR-005). Removing it would silently break every safe-area edit
   in this feature.
6. **Per-surface positioning**. Each `(Surface, Edge)` row in the
   data-model's PerSurfaceSafeAreaOffset table MUST be implemented
   as the documented `calc(...)` expression. The integration spec
   verifies this indirectly via `getBoundingClientRect()` rect
   assertions on each surface with the safe-area tokens stubbed to
   non-zero values (research.md §R9).

## §4. Required tests

`tests/unit/safe-area-tokens.spec.ts` MUST cover invariants 1, 2, 3,
4, and 5 by:

- Loading `src/app/tokens.css` as text and matching token
  declarations against the documented regex.
- Loading `index.html` as text and asserting the
  `viewport-fit=cover` substring is present.
- Walking every file under `src/` matching `*.svelte` or `*.css`
  (excluding `src/app/tokens.css`) and asserting none contains the
  substring `env(safe-area-inset`.
- Mounting a synthetic root with the safe-area tokens stubbed to
  `0px` and asserting the resolved per-surface offsets equal the
  pre-feature literals (uses the same `getComputedStyle` approach
  as feature 009's notification-region spec).

`tests/integration/safe-area-layout.spec.ts` MUST cover invariant 6
by:

- Mounting `<App>` in jsdom with the safe-area tokens stubbed to
  non-zero values via a synthetic `<style>` block (research.md §R9).
- Asserting `getBoundingClientRect()` of the toolbar, the readout,
  the attribution bar, the map controls (zoom + compass cluster),
  the install banner (when triggered), and the iOS install sheet
  (when triggered) clears each viewport edge by at least the
  stubbed inset value.
- Mounting again with all insets at `0px` and asserting the rects
  equal the feature-009 baseline positions within 1 CSS pixel
  (SC-004).

`tests/e2e/safe-area-install.e2e.spec.ts` MUST exercise the same
invariants under real engine-reported insets via Playwright's
iPhone 14 emulation (Mobile Safari) and Pixel 7 emulation (Mobile
Chrome). The e2e spec is the closing-the-jsdom-gap step
(research.md §R9) and is the only place where the engine's actual
`env(safe-area-inset-*)` values are exercised end-to-end.

## §5. Non-goals

- Per-platform UA branching. The CSS approach handles every
  supported platform uniformly.
- A "safe area is non-zero" feature flag the user can override.
  Out of scope.
- New light/dark color tokens. The safe-area work is positional
  only; no colour change.
- A change to `viewport-fit`. The meta declaration stays at `cover`.
