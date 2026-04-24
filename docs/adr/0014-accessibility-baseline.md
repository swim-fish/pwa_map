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
