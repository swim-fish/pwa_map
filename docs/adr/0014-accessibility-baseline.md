# ADR 0014 — Accessibility baseline

**Status**: Accepted
**Date**: 2026-04-24

## Context

Principle III requires accessibility consideration for every UI change.
MVP + US2–US4 together comprise MapView, Crosshair, CoordinateReadout,
FormatToggle, GoToDialog, CopyFallback, AttributionBar, and toolbar
buttons.

## Decision

- **Crosshair**: `role="img"` + `aria-label` interpolated from
  `a11y.crosshair.label` with `{lat}` / `{lon}` variables (rounded to
  4 decimal places to avoid flooding assistive tech during pan). Inner
  SVG is `aria-hidden`.
- **Readout panel**: wrapped in `aria-live="polite"` so screen readers
  announce on pan-end only. Each row has `data-testid="readout-{kind}"`.
  Out-of-coverage rows render the localised `coverage.notInTaiwan`
  label rather than an empty value.
- **Copy buttons**: per-row with localised `aria-label` via
  `copy.button.aria`. Success toast uses `aria-live="polite"`.
- **Go-To dialog**: `role="dialog"` + `aria-modal="true"` + focus-on-open;
  `Escape` closes; error region uses `aria-live="assertive"` so users
  hear rejection reasons immediately.
- **FormatToggle + CopyFallback**: same `role="dialog"` +
  `aria-modal="true"` pattern; backdrop is a real `<button>` so it's
  keyboard-focusable for dismissal (no `click-events-have-key-events`
  warnings).
- **Contrast**: crosshair uses a 3 px dark stroke + 1 px light halo,
  meeting WCAG AA over both OSM light tiles and dark theme. Readout
  background uses `rgba(…, 0.95)` surface colour tokens so text
  contrast stays ≥ 4.5:1 regardless of underlying tile.
- **Keyboard shortcuts**: `G` opens Go-To, `F` opens FormatToggle.
  Gated on `e.target` not being an `<input>` / `<textarea>` so they
  never hijack typing.

## Consequences

- All interactive controls keyboard-reachable; Tab order is MapView →
  Go-To trigger → FormatToggle trigger → copy buttons (per row).
- A dedicated accessibility sweep task (T107) confirmed these before
  release.

## Alternatives considered

- **`aria-live="assertive"` readout** — floods the screen reader during
  pan; rejected.
- **Defer a11y to v1.1** — violates Principle III; rejected.

## Implementation outcome — 2026-04-26 attribution badge contrast tokens

Feature 004 (`specs/004-offline-pwa-polish/`) discovered that the
`AttributionBar` component's `.attribution` selector used
`color: var(--color-fg)` + a hardcoded `rgba(255,255,255,0.82)`
background. In light mode that produced near-black text on near-white,
which is fine. In dark mode `--color-fg` resolves to `#f1f5f9` (slate-100,
near-white), so the foreground colour collapsed against the still-near-white
hardcoded background — the legal attribution string was effectively
invisible.

This regressed the Principle III contrast guarantee for the badge. The
fix is a token swap:

- New token pair `--attribution-bg` / `--attribution-fg` defined in
  `src/app/tokens.css` for both `:root` and the
  `@media (prefers-color-scheme: dark)` block.
- `.attribution` now references `var(--attribution-bg)` /
  `var(--attribution-fg)` instead of the global colour tokens.
- Background opacity raised from 0.82 to 0.95 (light) / 0.92 (dark) so
  the contrast guarantee holds against the badge's own background even
  over a worst-case underlying tile (FR-014).

**Computed contrast** (verified by `tests/unit/components/AttributionBar.spec.ts`):

- Light: 15.8 : 1 (slate-900 on alpha-blended white)
- Dark: 15.5 : 1 (slate-100 on alpha-blended dark slate)

Both > 3 × the WCAG AA threshold of 4.5 : 1. The token pair is
intentionally NOT aliased to `--color-fg` / `--color-surface` so the
badge's contrast guarantee stays independent of any future shift in the
global text/surface tokens.

Layout, position, font-size, and DOM structure are unchanged — the fix
is a token swap only.
