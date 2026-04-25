# 0001 — Coord Map Layout (US1 MVP)

**Status**: Active
**Feature**: `001-coord-map-pwa`
**Scope**: US1 MVP — full-viewport map, centered crosshair reticle, single-row WGS84 DD readout, tile attribution.
**Affected screens**: Root shell (`App.svelte`).
**Created**: 2026-04-24 (concurrent with feature 001-coord-map-pwa).

## Context

The MVP slice needs four things stacked on a single full-viewport canvas:
a panable/zoomable map, a crosshair pinned to the geometric center, a floating
coordinate readout, and a tile-source attribution string required by the OSM
licence. All four coexist on the same surface; none of them are in their own
route or dialog.

## Design goals

- **Zero chrome**: the map _is_ the interface. No header bar, no sidebar — the
  crosshair and readout float over the map surface.
- **Always-visible coordinate**: the readout is the primary affordance. It
  must stay readable against every tile colour (light OSM topo + future dark /
  imagery layers).
- **Touch + desktop parity**: MapLibre handles both input families; we do not
  duplicate that logic. The readout + crosshair do not accept input — they
  are decoration.
- **PWA-friendly viewport**: `viewport-fit=cover` + `inset: 0` shell so the
  map fills the full available area including safe-area insets.

## Layout

Every child of `App.svelte > main.shell` is absolutely positioned and uses
`inset`, `top/left`, or `right/bottom` for pinning. The stacking order, lowest
to highest:

| Layer (z-index)        | Component                  | Anchor                                       | Notes                                                                                                                                       |
| ---------------------- | -------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| base (MapLibre canvas) | `MapView.svelte`           | `inset: 0`                                   | Raster OSM tile layer; `attributionControl: false` because we render our own.                                                               |
| 4                      | `AttributionBar.svelte`    | `right: 8px; bottom: 8px`                    | Licence text `© OpenStreetMap contributors`; semi-opaque background so it reads over both light and dark tiles.                             |
| 5                      | `Crosshair.svelte`         | `top: 50%; left: 50%; translate(-50%, -50%)` | Fixed-size 48 px SVG reticle; `pointer-events: none` so drags reach the map.                                                                |
| 6                      | `CoordinateReadout.svelte` | `left: 12px; bottom: 12px`                   | Single row (US1) with `Lat 緯度` + value + `Lon 經度` + value; `max-width: min(640px, calc(100vw - 24px))` so it never overflows on mobile. |

## Crosshair spec

SVG 48 × 48 px icon with:

- Outer ring: 22 px diameter, 3 px dark stroke + 1 px light overlay (the
  1 px halo in R14).
- Four cardinal strokes: dark 3 px + light 1 px each, breaking at the ring.
- Center dot: 2 px dark + 1 px light.

Rationale: the dark stroke is always visible on light tiles; the light halo
preserves legibility on imagery / dark tiles, satisfying R14 without
switching icons per theme.

## Readout panel (US1 MVP)

One row only: `{label.lat} {value.lat}°` + `{label.lon} {value.lon}°`.

- Values rendered with `formatWGS84DD` style (`NN.NNNNNN`) — six decimals,
  sign-bearing, locale-invariant numerals.
- Labels `readout.dd.lat` / `readout.dd.lon` are looked up from the i18n
  store; `zh` is the canonical key set.
- The whole panel is wrapped in `aria-live="polite"` so screen readers
  announce only on pan-end (R14). A visually-hidden canonical
  "{lat}, {lon}" span is also present for screen readers that prefer a
  single comma-separated spelling.

Tokens are defined in `src/app/tokens.css`:

- Spacing scale: 4 / 8 / 12 / 16 / 20 / 24 / 32 px (`--space-1..6,8`).
- Background: `var(--color-surface-elev)` → light `rgba(255,255,255,0.95)`,
  dark `rgba(30,41,59,0.95)` (via `prefers-color-scheme: dark`).
- Typography: system UI stack with `Noto Sans TC` / `Noto Sans JP`
  fallbacks for CJK.
- Numeric values use `font-variant-numeric: tabular-nums` so the readout
  does not jump width when digits change during pan.

## Attribution bar

- Bottom-right, `pointer-events: none`.
- Semi-opaque background so the text reads over both light and dark tiles.
- `font-size: 12px` to stay legible on phones without eating space.

## Accessibility (R14)

| Concern              | Treatment                                                                                                                                                                         |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Crosshair semantics  | `role="img"` + `aria-label` interpolated from `a11y.crosshair.label` with `{lat}` / `{lon}` vars. Child SVG is `aria-hidden`.                                                     |
| Readout announcement | Wrapped in `aria-live="polite"`; update frequency is therefore a read-out-on-moveend issue, not a continuous flood.                                                               |
| Keyboard             | MapLibre's own keyboard controls (`+ - arrows`) work as-is; no custom key bindings in US1. `Tab` order in US1 is just the MapLibre root.                                          |
| Contrast             | Dark stroke + light halo on crosshair meet WCAG AA on both light and dark tiles. Readout background opacity 95 % ensures text contrast ≥ 4.5:1 regardless of the underlying tile. |

## Performance notes

- `move` events coalesce through `requestAnimationFrame` so the readout
  re-renders at screen rate (≥ 60 Hz on 60 Hz displays, exceeding the 10 Hz
  budget in SC-007).
- `moveend` debounces the `lastView` save by 250 ms to avoid hammering
  `localStorage` during free-form panning.

## Screenshots

> _To capture after first `npm run dev` succeeds; store in `public/docs/ui/` when added._

## US2 extension — multi-row readout + FormatToggle

The US1 single-row readout becomes a grid of up to six rows, one per
`CoordinateKind` in `FormatPreferences.visible`. The row order is fixed
by `ALL_COORDINATE_KINDS` so toggling visibility does not cause layout
reflow beyond insertion/removal of a single row.

### Multi-row readout

- Row layout: `label` (120 px fixed-width left column) + `value` (mono
  tabular-nums).
- Each row has `data-testid="readout-{kind}"` for E2E selectors.
- When `coverageOf(kind, dd) === 'out-of-coverage'`, the value cell is
  replaced by the i18n string `coverage.notInTaiwan` in an italic muted
  colour, keeping the row in place so users can see _which_ formats are
  out of range.

### FormatToggle drawer

- Triggered by the top-right "Formats" toolbar button
  (`data-testid="open-format-toggle"`) or the `F` keyboard shortcut.
- Implemented as a centered modal with `role="dialog"`,
  `aria-modal="true"`, and a blurred/darkened backdrop that closes on
  click or Escape.
- Lists all six `ALL_COORDINATE_KINDS` as checkboxes; toggling fires
  `on:change { visible }` which flows to `preferences.ts` and persists.
- Changes take effect immediately — no Apply button — matching the
  "every tap is a commit" gesture users expect on mobile.

### Toolbar

- Single `.toolbar` region in the top-right, space-2 padding.
- Current US2 button: Formats. US3 will add a Go-To button before
  Formats.

### Accessibility additions (US2)

| Concern               | Treatment                                                                                                                                                                                                            |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Format toggle         | `aria-haspopup="dialog"` + `aria-expanded` on the trigger; `role="dialog"` + `aria-modal` on the panel; `Escape` closes; backdrop is a `<button>` with `aria-label` from `toggle.close` for keyboard-only dismissal. |
| Out-of-coverage rows  | Readout panel's `aria-live="polite"` wrapper still announces on moveend, so flipping between "code" and "not in Taiwan coverage" is read cleanly.                                                                    |
| Keyboard shortcut `F` | Only fires when the event target is not an `<input>`/`<textarea>` so it cannot hijack text entry.                                                                                                                    |

### i18n keys added in US2

`format.labels.{wgs84-dd, wgs84-dms, twd97-tm2, twd67-tm2, mgrs, taipower}`,
`format.zone`, `format.twd97.zone.label`, `coverage.notInTaiwan`,
`toggle.title`, `toggle.hint`, `toggle.close`, `toggle.open.button`.
`zh.json` is canonical; `en.json` / `ja.json` translated independently.

## US3 extension — Go To dialog + zone-auto toast

The toolbar gains a **Go To** button before the Formats button. The
`G` keyboard shortcut opens the dialog (same gating as `F`: not inside
an input/textarea).

### GoToDialog

- Centered modal (`role="dialog"`, `aria-modal="true"`); backdrop is a
  button for keyboard dismissal; `Escape` closes.
- Input is a 3-row `<textarea>` with mono font for coordinate legibility.
- Submit triggers `parseGoTo()` (the dispatching parser in
  `src/coord/parser.ts`). On success the parent flies the map to the
  target and closes the dialog. On failure the dialog stays open and
  shows an `aria-live="assertive"` error region with the i18n'd reason.
- Initial field reset uses a `wasOpen` guard so the user's typed input
  is not wiped by reactive re-execution of `$: if (open)`.

### Zone-auto toast

- When a TM2 pair is parsed without an explicit zone and `§9` auto-
  selects one, the parent surfaces a centered top toast with the chosen
  zone. Dismisses after ~3 s.
- Element: `<div role="status" aria-live="polite" data-testid="zone-toast">`.

### i18n keys added in US3

`goto.open.button`, `goto.title`, `goto.placeholder`, `goto.submit`,
`goto.zone.auto.toast`, plus the full `errors.*` catalogue from
`contracts/go-to-grammar.md §3` (21 keys × 3 locales).

## US4 extension — copy button + fallback modal

Each `ok` readout row now has a small unicode `⧉` copy button at the
right edge. Tapping it copies the **exact canonical display string**
(byte-for-byte — Unicode glyphs for DMS, spaces inside MGRS, etc.).

### Copy feedback

- **Success** — top centered toast (`copy-toast`), dismisses after ~2 s.
  Messages read from `copy.toast.success`.
- **Permission denied / Clipboard API absent** — fallback modal
  (`CopyFallback.svelte`) with a pre-selected read-only `<textarea>`
  from which the user can `Ctrl+C` / `Cmd+C` manually.

### Accessibility

- Each copy button has `aria-label` from `copy.button.aria` interpolated
  with the localised format label.
- Copy success toast uses `aria-live="polite"` so the screen reader
  announces it once without interrupting pan readouts.

### i18n keys added in US4

`copy.button.aria`, `copy.toast.success`, `copy.fallback.title`,
`copy.fallback.hint`.
