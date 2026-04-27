# UI Design Records

This directory holds per-change UI documentation per Constitution
**Principle III — User Experience Consistency**.

## Why this exists

> Any change that introduces new UI patterns, modifies existing screens, or
> alters interaction semantics MUST be accompanied by an update under
> `docs/ui/` describing the change, the rationale, affected screens, and
> any new tokens or components. Accessibility (contrast, tap targets,
> semantic labels, keyboard navigation where applicable) MUST be considered
> for every UI change.

## Index

| #                                        | Title                                                                                             | Status   | Affected screens                                                                |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------- |
| [0001](0001-coord-map-layout.md)         | Coord-map PWA layout (feature 001)                                                                | Accepted | Map shell, crosshair, readout, format toggle, Go-To dialog                      |
| [0002](0002-goto-split-input.md)         | Go-To split-field input (feature 002)                                                             | Accepted | Go-To modal                                                                     |
| [0003](0003-layers-and-locale.md)        | Layer + locale pickers (feature 003)                                                              | Accepted | Toolbar, map canvas, attribution bar, failure toast                             |
| [0004](0004-offline-pwa-polish.md)       | Offline PWA + update prompt (feature 004)                                                         | Accepted | App shell (offline), update-prompt, offline-ready toast, attribution bar        |
| [0005](0005-pwa-installable.md)          | PWA install affordance (feature 005)                                                              | Accepted | Install banner (bottom-right), iOS instructional sheet (bottom-center)          |
| [0006](0006-compass.md)                  | Compass + crosshair-zoom (feature 006)                                                            | Accepted | Bottom-right control cluster (compass + +/− buttons), wheel-zoom anchor         |
| [0007](0007-settings-tile-cache.md)      | Tile-cache Settings sheet (feature 007)                                                           | Accepted | Toolbar gear + centred modal sheet + confirmation dialog                        |
| [0008](0008-deploy-and-base-path.md)     | GitHub Pages deploy + subpath URL (feature 008)                                                   | Accepted | Public URL + `npm run preview` URL + installed-PWA manifest paths               |
| [0009](0009-mobile-ui-fixes.md)          | Mobile UI fixes (feature 009)                                                                     | Accepted | Tap targets, segmented readout, notification region                             |
| [0010](0010-mobile-collapsed-readout.md) | Mobile collapsed readout + drag priority + Taipower auto-precision + TWD zone hints (feature 010) | Accepted | Coordinate readout, format-toggle drawer, Go To dialog (TM2 / TWD67 / Taipower) |

## Adding a new UI record

1. Create `NNNN-<short-slug>.md`.
2. Structure: Context, Design goals, Layout & tokens, Interactions, Accessibility notes, Screenshots, Open questions.
3. Append a row to the Index table above.
4. Link screenshots / mockups from the `public/` or repo-local tree — do not
   upload to third-party services.
