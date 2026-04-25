# UI Record 0002 — Go-To Split-Field Input

**Status**: Accepted (landed at `/speckit.implement` 2026-04-25)
**Affected screens**: Go-To modal (`src/components/GoToDialog.svelte`)
**Feature**: `specs/002-goto-split-input/`

## Context

Feature 001 shipped the Go-To modal as a single free-text textarea. The
operator carried the full grammar burden: comma placement, hemisphere
letters, `°′″` glyphs, the `TWD67` qualifier, MGRS upper-casing. Field
ops feedback says this defeats the value of the modal — operators want
to type one semantic component per field and let the app handle
canonical assembly.

This UI record covers the redesign delivered by feature 002.

## Design goals

1. **Recognition over recall** — labelled fields per format component.
2. **Format-specific affordances** — DMS hemisphere segmented selector,
   MGRS auto-uppercase, Taipower precision toggle, TWD97 zone
   selector.
3. **One-tap repeat** — recents row above the chip rack persists
   across reloads.
4. **Disambiguation visible** — when auto-detect produces ≥ 2
   candidates, surface a bottom-sheet picker rather than silently
   guessing.
5. **Confirmation** — fading destination indicator at viewport center
   on every successful Go-To.
6. **Zoom preserved** — Go-To never changes the operator's chosen
   zoom.

## Layout & tokens

- Reuses `--color-accent`, `--color-surface`, `--color-border`,
  `--color-fg`, `--color-bg`, `--color-danger`, and the `--space-*`
  scale from `src/app/tokens.css`.
- Chip rack: pill buttons (`role="tab"`), 32 px tall, 12 px horizontal
  padding, 6 px gap, wraps on narrow viewports.
- Layout body: 8 px row gap; field labels in `--font-numeric`.
- Recents row: same chip token as the format rack, distinguished by a
  subtle `--color-surface-elev` background.
- Disambiguator: bottom sheet, `border-radius: 12px 12px 0 0`,
  candidate rows = full-width buttons.
- Destination indicator: 24 px concentric circles at viewport center,
  `pointer-events: none`, fades in 200 ms / holds 3 s / fades out
  300 ms.

## Interactions

| Surface                | Tap                     | Long-press          | Keyboard                                                               |
| ---------------------- | ----------------------- | ------------------- | ---------------------------------------------------------------------- |
| Format chip            | Switch layout           | —                   | Arrow Left/Right cycles chips; Enter activates; Tab enters layout body |
| Recent chip            | Re-submit               | Open delete-confirm | Enter = re-submit; Delete key opens confirm                            |
| Disambiguator row      | Pick candidate, fly map | —                   | Arrow Up/Down moves focus; Enter picks                                 |
| Disambiguator backdrop | Cancel                  | —                   | Escape cancels                                                         |

## Accessibility notes

- Chip rack: `role="tablist"`, each chip `role="tab"` with
  `aria-selected`; the layout body is `role="tabpanel"`
  `aria-labelledby="chip-id"`.
- DMS hemisphere: `role="radiogroup"` with two `role="radio"` buttons
  per axis, `aria-checked` on the active option.
- MGRS GZD/square fields auto-uppercase on input.
- Easting/northing fields filter non-digit characters on input.
- Disambiguator: `role="dialog" aria-modal="true"`,
  `aria-labelledby="disambig-title"`, focus trapped while open,
  `aria-live="polite"` announces the candidate count.
- Destination indicator: `aria-hidden="true"`, never receives focus.
- Tap targets ≥ 32 × 32 px.

## Screenshots

_Filled in at `/speckit.implement` time once components are wired._

## Open questions

None — all clarifications resolved in `specs/002-goto-split-input/research.md`.

## References

- Feature spec: `specs/002-goto-split-input/spec.md`
- Plan: `specs/002-goto-split-input/plan.md`
- Research: `specs/002-goto-split-input/research.md`
- Contracts: `specs/002-goto-split-input/contracts/`
- Reference document: `../atak_flutter_map/docs/ui/007-goto-modal-and-taipower-rows.md`
