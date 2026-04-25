# UI Record 0003 — Layer Picker + Locale Picker

**Status**: Accepted (landed at `/speckit.implement` 2026-04-26)
**Affected screens**: top-right toolbar, map canvas (style swap),
attribution bar, transient failure toast
**Feature**: `specs/003-i18n-and-map-layers/`

## Context

Feature 002 shipped a chip-driven Go-To dialog and reused the
toolbar's two existing buttons (`前往` / `格式`). Feature 003 adds
two more toolbar buttons (`圖層` / `語言`) that drive grouped
dropdown pickers, and replaces the hardcoded OSM raster source with a
six-basemap catalogue plus an independently-toggleable Google road
overlay. The locale picker exposes the existing `zh / en / ja`
catalogue (already shipped in features 001 / 002) as a first-class
operator surface.

This UI record covers both pickers, the attribution-bar update, and
the failure toast.

## Design goals

1. **One-tap layer switching** — operator picks any of six basemaps
   in a single tap on the toolbar.
2. **Independent overlay toggle** — the Google road overlay is NOT
   one of the radio choices; it is a checkbox that combines with any
   basemap.
3. **Grouped recognition** — basemaps grouped under NLSC / Google /
   Other so the operator can scan visually.
4. **Localised attribution** — the active basemap's attribution
   localises through `$i18n` so legal text matches the UI language.
5. **Recoverable failures** — when a basemap fails to load, the
   operator sees a localised toast and the previous basemap remains
   visible (never a blank canvas).
6. **Locale-independent tile language** — the Google `hl=zh-TW`
   parameter is FIXED on the URL template; switching the UI locale
   does NOT change the tile labels.

## Layout & tokens

- Reuses `--color-accent`, `--color-surface`, `--color-surface-elev`,
  `--color-border`, `--color-fg`, `--color-bg`, `--color-danger`, and
  the `--space-*` scale from `src/app/tokens.css`.
- Toolbar buttons (`圖層`, `語言`) reuse the same pill style as
  `前往` and `格式`.
- Layer picker dropdown anchors to the toolbar button, opens
  downward; min-width 280 px; max-height 60vh with overflow-y auto.
- Group headers: 11 px caps-style, `--color-fg` at 60 % opacity.
- Basemap rows: 36 px tall, leading dot `--color-accent` when
  selected.
- Overlay row: separated by a 1 px `--color-border` rule, same
  visual style as basemap rows but with checkbox semantics.
- Locale picker dropdown: same anchor / positioning model; rows
  render the locale's self-name (`中文`, `English`, `日本語`) in
  the locale's own font / direction.
- Failure toast: bottom-center, `rgba(15,23,42,0.92)` background,
  white text, 5 s auto-dismiss; reuses the existing `.toast` token
  from `App.svelte`.

## Interactions

| Surface                | Tap                                | Keyboard                                          |
| ---------------------- | ---------------------------------- | ------------------------------------------------- |
| Toolbar `圖層` button  | Open layer picker                  | Enter / Space activates                           |
| Basemap row            | Select basemap, picker closes      | Enter selects; Up / Down moves focus within group |
| Overlay toggle row     | Toggle overlay (picker stays open) | Space toggles                                     |
| Toolbar `語言` button  | Open locale picker                 | Enter / Space activates                           |
| Locale row             | Select locale, picker closes       | Enter selects                                     |
| Either picker backdrop | Close                              | Escape closes                                     |

## Accessibility notes

- Toolbar buttons: `aria-haspopup="menu"`, `aria-expanded` reflects
  open state.
- Layer picker: `role="menu"` with three group headers
  (`role="presentation"`); basemap rows `role="menuitemradio"` with
  `aria-checked`; overlay row `role="menuitemcheckbox"` with
  `aria-checked`.
- Locale picker: `role="menu"` with three `role="menuitemradio"`
  rows, each rendering its self-name with `lang="<locale>"` so
  screen readers announce in the right voice.
- Failure toast: `role="status" aria-live="polite"`; never steals
  focus.
- WCAG AA contrast preserved on all text + active highlights.
- Tap targets ≥ 36 × 36 px on touch.

## Screenshots

Captured 2026-04-26 at `/speckit.implement` time via the one-shot
Playwright harness `tests/e2e/_screenshots-003.spec.ts` (now deleted
post-capture). The page is in `zh` locale; the layer picker shows
the three groups (Other / NLSC / Google) plus the separate Google
road-overlay toggle.

### Toolbar (collapsed)

Default state — four toolbar buttons: `前往` (Go-To), `格式`
(Formats), `圖層` (Layers, new in 003), `語言` (Language, new in
003).

![Toolbar collapsed](./screenshots/0003-toolbar-collapsed.png)

### Layer picker open

Grouped dropdown with the active basemap (`OpenStreetMap`) marked
by the leading `--color-accent` dot. The Google road overlay sits
below the separator as a checkbox row.

![Layer picker open](./screenshots/0003-layer-picker-open.png)

### Locale picker open

Three rows in `[zh, en, ja]` order; self-names are plain literals
(NOT i18n keys) so the operator can recognise their own language
even when the active locale is one they cannot read.

![Locale picker open](./screenshots/0003-locale-picker-open.png)

### Failure toast

Surfaced when NLSC tile origin is blocked. The localised text
(`NLSC 圖磚載入失敗，已退回上一個圖層`) names the failing source
group; auto-dismisses after 5 s. Per FR-009, the previous basemap
remains visible — the canvas is never blank.

![Layer failure toast](./screenshots/0003-layer-fail-toast.png)

## Open questions

None — all clarifications resolved in
`specs/003-i18n-and-map-layers/research.md`.

## References

- Feature spec: `specs/003-i18n-and-map-layers/spec.md`
- Plan: `specs/003-i18n-and-map-layers/plan.md`
- Research: `specs/003-i18n-and-map-layers/research.md`
- Contracts: `specs/003-i18n-and-map-layers/contracts/`
- Reference Flutter source:
  `../atak_flutter_map/lib/features/mbtiles/domain/models/online_source.dart`
