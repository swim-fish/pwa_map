# Feature Specification: Settings About Section, README Live Link, Go-To Mobile Fit, and Map 3D / Terrain Lockdown

**Feature Branch**: `012-settings-about-and-mobile-fixes`
**Created**: 2026-04-28
**Status**: Draft
**Input**: User description (combined):

1. "Settings 增加 About 頁面" — surface the live map URL `https://swim-fish.github.io/pwa_map/` and the project source URL `https://github.com/swim-fish/pwa_map` inside the Settings panel.
2. "README 新增 地圖網址" — link the live map URL from the project README so first-time visitors can open the deployed app without grepping the deploy config.
3. "修正 Go To 表格再手機窄螢幕太寬問題" — the multi-column input grids inside the Go To dialog overflow the viewport on narrow phones, forcing horizontal scrolling and pushing inputs off-screen.
4. "關閉地圖 3D 顯示 (maplibre off 3d 傾斜功能)" — the MapLibre map currently allows the user to pitch/tilt the canvas (drag-to-pitch, two-finger pitch gesture, keyboard pitch shortcuts), which is incompatible with this app's premise that the centre crosshair reads coordinates from a strictly top-down 2D projection.

`/speckit.clarify` follow-up (2026-04-28): catalog every MapLibre 3D / Terrain capability so the lockdown is comprehensive and a future "enable 3D" change is a deliberate, single-point flip.

## Clarifications

### Session 2026-04-28

- Q: Scope of the 3D / Terrain lockdown inventory → A: Option C — pitch (`maxPitch` / `touchPitch` / drag-pitch / keyboard pitch) + atmospheric `sky` style layer + globe projection + terrain DEM (`map.setTerrain`) + 3D `fill-extrusion` layers + `hillshade` layers. Marker `pitchAlignment` / `rotationAlignment` defaults are out of scope (this app does not use Markers).
- Q: Engineering shape of the lockdown register → A: Option A — single source of truth. A new module `src/map/threeDLockdown.ts` exports an immutable registry listing the six capability classes and their locked values. `MapView.svelte` (construction options), `styleBuilder.ts` (layer / `sky` filtering), and `src/map/sources.ts` (source catalogue) all import the registry at assembly time. No dev-only override / runtime escape hatch — re-enabling 3D is always a deliberate code change. Tests `import` the registry directly to assert its shape and to drive runtime assertions.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Map view stays strictly 2D — every MapLibre 3D / Terrain affordance is locked off (Priority: P1)

A user interacting with the map currently has access to several
MapLibre capabilities that can break the app's "top-down 2D
coordinate-reading" invariant: pinch-pitch on touch, right-mouse
drag-pitch on desktop, keyboard pitch shortcuts, and (latent /
future) terrain DEM, hillshade, sky layers, 3D fill-extrusion
layers, or globe projection. Any of these — even unintentionally —
turns the visual relationship between the centre crosshair and the
tile beneath it into something the user's mental model no longer
matches. After this change, every MapLibre capability that could
render the map in 3D or expose a tilt-aware affordance is explicitly
locked off in this version. The lockdown is captured as an
authoritative inventory so a future "enable 3D" feature is a
deliberate, single-point change rather than an archaeological dig.

The lockdown register covers six capability classes:

1. **Pitch / tilt** — `maxPitch: 0` ceiling, `touchPitch` disabled,
   drag-pitch neutralised, keyboard pitch shortcuts neutralised
   (clamped by the maxPitch ceiling).
2. **Atmospheric `sky` style layer** — `styleBuilder.ts` never emits
   a `sky` block in the assembled style; if a future basemap source
   ships one, it is filtered out at style-assembly time.
3. **Globe projection** — the map's projection remains mercator;
   `projection: 'globe'` is never set, and the construction options
   pin the projection so that an upstream MapLibre upgrade cannot
   silently flip to globe.
4. **Terrain DEM** — `map.setTerrain(...)` is never called; no
   terrain RGB DEM source is registered in the source catalogue.
5. **3D `fill-extrusion` layers** — no `fill-extrusion` layer is
   present in the assembled style, even if a future vector source
   defines one.
6. **`hillshade` layers** — no `hillshade` layer is present in the
   assembled style; although hillshade is a 2D-rendered effect, it
   requires a terrain RGB source and is grouped with terrain for
   re-enable consistency.

Bearing rotation stays available (rotation is orthogonal to 3D and
is meaningful for compass alignment).

**Why this priority**: This is the single most foundational
invariant in the app. Every coordinate readout, every Go-To
navigation, and every crosshair alignment is computed against a 2D
map projection — the moment any of these capabilities engages, the
live readout still shows the pin's lat/lon, but the *visual*
relationship between the crosshair and the tile beneath it stops
matching the user's mental model. We have heard informal user
complaints about accidental tilt since launch; the comprehensive
lockdown is configuration-only on map construction and style
assembly, so risk is bounded.

**Independent Test**: Open the deployed map and exercise every
documented 3D / Terrain entry point: (a) pitch gestures (right-mouse
drag, two-finger touch, keyboard <kbd>Shift</kbd>+arrow); (b) attempt
to register a terrain DEM via dev-tools (`map.setTerrain({...})`);
(c) attempt to swap projection (`map.setProjection('globe')`);
(d) inspect the assembled style — assert no `sky`, `fill-extrusion`,
or `hillshade` entries are present. After every attempt: `pitch === 0`,
`projection === 'mercator'`, `getTerrain() === null`, layer list
contains no 3D-class entries. Verify rotate, zoom, pan, crosshair,
and coordinate readout are unchanged. Repeat after a basemap /
overlay swap to confirm the lockdown survives style rebuilds.

**Acceptance Scenarios**:

1. **Given** the map is loaded on a touch device, **When** the user
   makes a two-finger pitch gesture, **Then** `map.getPitch()`
   remains `0`.
2. **Given** the map is loaded on a desktop, **When** the user
   right-mouse-button drags vertically, **Then** the map does not
   tilt and `map.getPitch()` remains `0`.
3. **Given** the map is loaded with a keyboard, **When** the user
   presses <kbd>Shift</kbd>+<kbd>↑</kbd>, **Then** the map does not
   tilt and `map.getPitch()` remains `0`.
4. **Given** any code path calls `map.setPitch(45)`, **Then** the
   pitch must remain clamped at `0`.
5. **Given** the map is loaded, **When** any code path calls
   `map.setTerrain({ source: 'dem', exaggeration: 1.5 })`, **Then**
   the call is either rejected or no-ops; `map.getTerrain()` returns
   `null`.
6. **Given** the map is loaded, **When** any code path calls
   `map.setProjection('globe')`, **Then** the effective projection
   remains mercator.
7. **Given** a basemap source whose upstream definition includes a
   `sky` block, **When** `styleBuilder.ts` assembles the style,
   **Then** the resulting style has no top-level `sky` entry.
8. **Given** the assembled style, **When** the layer list is
   inspected, **Then** no layer has `type: 'fill-extrusion'` or
   `type: 'hillshade'`.
9. **Given** the user rotates the map via the compass interaction
   or two-finger rotate gesture, **Then** rotation behaviour is
   unaffected — bearing changes as before, the compass arrow
   updates, and pitch stays at `0`.
10. **Given** the user swaps basemap or toggles the overlay,
    **When** the style rebuilds, **Then** all six lockdown classes
    still hold (`pitch === 0`, no sky / fill-extrusion / hillshade
    layers, no terrain, projection === mercator).

---

### User Story 2 - The Go To dialog input grid fits the narrowest supported phone viewport (Priority: P2)

A user opens the Go To dialog on a narrow phone (≈ 320–360 CSS px
wide, e.g. an iPhone SE in portrait or a small Android in
split-screen). The dialog currently renders coordinate-input grids —
DD (2 cols), DMS (3 cols + auto), TM2 / TWD67 / MGRS / Taipower
(2 cols) — that overflow the dialog's max-width on the narrowest
devices. Inputs are either clipped, push the dialog into horizontal
scrolling, or sit under the safe-area inline inset on landscape
with a notch. After this change, every Go To layout fits within
the dialog's content area at the smallest supported viewport with
no horizontal scroll, no input clipping, and no overlap with the
dialog's chrome (close button, format chips, recent chips).

**Why this priority**: Go To is the second of the app's two primary
input surfaces (the first being live crosshair reading). When the
form overflows, users on narrow phones cannot enter coordinates
reliably — they have to scroll the dialog horizontally to find the
missing field, and on some layouts the input gets stuck under the
dialog border. This is a regression visible on every commodity phone
in portrait, so it is more impactful than the About-section
addition.

**Independent Test**: At a viewport width of `320 px` (the narrowest
supported viewport per existing mobile specs), open the Go To dialog
and switch through every layout (Auto, DD, DMS, TM2, TWD67, MGRS,
Taipower). For each layout: (a) every input is fully visible without
horizontal scrolling of the dialog; (b) every input retains a usable
tap target (≥ 44 × 44 CSS px); (c) the chip rack and recent-chips
list are not clipped; (d) the dialog itself does not overflow the
viewport horizontally. Repeat at `360 px` and `390 px` to confirm
no regression at slightly wider phones.

**Acceptance Scenarios**:

1. **Given** the viewport is `320 px` wide, **When** the Go To
   dialog is opened in DMS layout (3 numeric inputs + a hemisphere
   control), **Then** all four cells are visible inside the dialog
   without horizontal scrolling and each input retains a tap target
   ≥ 44 px on its short axis.
2. **Given** the viewport is `360 px` wide, **When** the Go To
   dialog is opened in any 2-column layout (DD / TM2 / TWD67 /
   MGRS / Taipower), **Then** both columns fit side-by-side inside
   the dialog with no horizontal overflow.
3. **Given** the viewport is `390 px` wide and the device exposes a
   non-zero inline safe-area inset (iPhone in landscape with the
   notch on a side), **When** the Go To dialog is opened, **Then**
   no input cell overlaps the safe-area inset region.
4. **Given** the dialog is open at `320 px`, **When** the user
   focuses a grid input and the on-screen keyboard appears, **Then**
   the focused input remains visible (not clipped or hidden by the
   dialog's own scroll container).

---

### User Story 3 - "About" entry inside Settings exposes the live URL and the source repository (Priority: P3)

A user opens Settings looking for the canonical link to share the
map, or to find the source repository to file an issue / fork the
project. Currently neither URL is surfaced anywhere inside the
running app — they exist only in the deploy pipeline and in
`package.json`. After this change, Settings exposes a clearly
labelled "About" area that lists:

- The live map URL: `https://swim-fish.github.io/pwa_map/`
- The project source URL: `https://github.com/swim-fish/pwa_map`

Each URL is presented as both readable text and a tappable link
(opening in a new tab/window with the standard `rel="noopener
noreferrer"` precaution). The area is keyboard-accessible (Tab
ordering follows the visual order; each link is a focusable target
with a visible focus ring).

**Why this priority**: This is a discoverability and shareability
improvement. It is not a usability blocker (users can still find
the URL by inspecting the address bar), and it is independent of
the two fixes above — it can ship in any order. It is grouped under
P3 because the value is real but lower than fixing a regression
that breaks input.

**Independent Test**: Open Settings and locate the About area.
Verify both URLs are visible and rendered as accessible links.
Tap/click each link and verify it opens the target URL in a new
tab/window. Reach the About area via keyboard only (Tab from the
Settings open trigger) and verify each link is focusable and
activatable with <kbd>Enter</kbd>. Verify the About area does not
break the existing safe-area centring of the Settings sheet at any
viewport.

**Acceptance Scenarios**:

1. **Given** Settings is open, **When** the user scrolls or
   navigates to the About area, **Then** both URLs are visible as
   labelled, tappable links.
2. **Given** the About area is visible, **When** the user clicks
   the "Live map" link, **Then** the URL
   `https://swim-fish.github.io/pwa_map/` opens in a new tab with
   the security attributes `rel="noopener noreferrer"` set.
3. **Given** the About area is visible, **When** the user clicks
   the "Source code" link, **Then** the URL
   `https://github.com/swim-fish/pwa_map` opens in a new tab with
   the same security attributes set.
4. **Given** the user is navigating Settings with the keyboard,
   **When** focus reaches the About area, **Then** each link
   receives a visible focus ring and is activatable with
   <kbd>Enter</kbd> or <kbd>Space</kbd>.
5. **Given** the user's locale is `zh`, `en`, or `ja`, **When** the
   About area renders, **Then** the section heading and link labels
   are translated; the URL strings themselves remain literal.

---

### User Story 4 - README links the deployed live map URL (Priority: P4)

A first-time visitor to the GitHub repository wants to try the app
before reading the source. The README currently describes the app
("A Progressive Web App that displays a Taiwan-covering base map…")
but does not give a link to the deployed instance. After this
change, the README's introduction (or a dedicated "Live demo"
section near the top) includes a clearly labelled link to
`https://swim-fish.github.io/pwa_map/`.

**Why this priority**: Documentation only; the value is in
discoverability of the live deploy by repo visitors. No code
change. Lowest priority of the four because it does not affect
users of the running app.

**Independent Test**: View `README.md` rendered on GitHub. The live
map URL appears as a Markdown link near the top of the file (within
the first screen of content). Click the link and verify it lands on
the deployed map. The link text is human-readable (not a bare URL
dump).

**Acceptance Scenarios**:

1. **Given** a reader views `README.md` on GitHub, **When** the
   page renders, **Then** a clickable link to
   `https://swim-fish.github.io/pwa_map/` appears within the first
   ~30 lines (above-the-fold on a typical desktop viewport).
2. **Given** a reader clicks the live link, **When** the browser
   navigates, **Then** the deployed app loads at that URL.
3. **Given** the same README is rendered as plain text (e.g. via
   an `npm` package preview, a CLI viewer), **When** the reader
   scans it, **Then** the URL is still legible (not hidden behind a
   label that omits the URL entirely).

---

### Edge Cases

- **Pitch ceiling clamps programmatic calls**: `map.setPitch(>0)`
  is clamped back to `0` by `maxPitch: 0`. The constraint is
  enforced at the engine level, not by decorating individual call
  sites.
- **Pitch keyboard shortcuts on focused map**: With `maxPitch: 0`,
  <kbd>Shift</kbd>+<kbd>↑</kbd>/<kbd>↓</kbd> no-op without
  disabling the keyboard handler entirely (panning + rotation
  keyboard shortcuts remain available).
- **Lockdown survives style reload**: The map style is rebuilt on
  basemap / overlay changes (`buildStyle()` in `MapView.svelte`).
  The lockdown register's six classes must all hold after rebuild —
  asserted by a regression test that swaps basemaps.
- **Sky / fill-extrusion / hillshade in upstream basemap definitions**:
  If a future raster or vector basemap definition includes any of
  these layer types, `styleBuilder.ts` MUST filter them out so the
  assembled style is always 2D.
- **Future terrain DEM source**: If a future feature adds a terrain
  RGB DEM tile source to the catalogue (`src/map/sources.ts`),
  `map.setTerrain(...)` MUST still not be called — the source's
  presence MUST not implicitly enable terrain rendering.
- **Globe projection auto-default in newer MapLibre versions**:
  Upgrading MapLibre to a version that defaults `projection` to
  `'globe'` MUST not silently flip the app to globe. The
  construction options must explicitly pin the projection (or the
  test suite must assert `getProjection() === 'mercator'` after
  construction).
- **Re-enabling 3D in a future feature**: The lockdown register
  (`src/map/threeDLockdown.ts`) is the authoritative source of
  truth for what to flip back on. A future "enable 3D" feature
  edits the registry's locked values and (where applicable)
  removes the corresponding filter call sites in `styleBuilder.ts`
  / `sources.ts`. It does not bypass the registry or introduce
  parallel state.
- **Go-To dialog narrow viewport with on-screen keyboard**: When
  the soft keyboard reduces the visible viewport height to a
  fraction of the original, the Go To dialog's vertical layout is
  pushed; horizontal layout is unaffected. The fix is horizontal
  only — vertical scrolling inside the dialog is acceptable.
- **Go-To dialog at exactly the dialog's max-width breakpoint**: If
  the fix uses a breakpoint to switch from N-column to single-column
  layout, the breakpoint must avoid the `0.02 px` rounding hazard
  documented in `.claude/rules/pwa-positioning.md`
  (`max-width: calc(<bp>px - 0.02px)`).
- **Settings About i18n key parity**: New i18n keys must be added
  to all three locale catalogues (`zh.json`, `en.json`, `ja.json`)
  per the `.claude/rules/pwa-tokens-and-contrast.md` parity rule.
- **Settings About link tap on standalone PWA**: When the app is
  installed as a standalone PWA, opening an external URL must NOT
  navigate the PWA itself (that would lose state and force a reload
  on return). The link must open in a new browser context (handled
  via `target="_blank"` + the security attributes).
- **Settings About link long-press**: Long-pressing the link on a
  touch device must surface the device's standard "copy link
  address" / "share" affordance — i.e. the link must be a real
  `<a href>` element, not a click-handler-only element.

## Requirements *(mandatory)*

### Functional Requirements

#### FR-001 to FR-009: Map 3D / Terrain lockdown register (User Story 1)

- **FR-001**: A new module at `src/map/threeDLockdown.ts` MUST
  export an immutable registry (e.g. a `const` object frozen at
  module load) that lists every MapLibre 3D / Terrain capability
  the app deliberately keeps off, covering all six classes from
  User Story 1: pitch (gestures + keyboard), `sky` style layer,
  globe projection, terrain DEM, 3D `fill-extrusion` layers, and
  `hillshade` layers. Each class entry MUST carry: a stable key
  (e.g. `'pitch'`, `'sky'`, `'globe'`, `'terrain'`,
  `'fillExtrusion'`, `'hillshade'`), the locked value (e.g. for
  `pitch` the maximum allowed value `0`; for the layer-type
  classes the boolean `false`), and a one-line human-readable
  description of how to re-enable that class.
- **FR-001a**: `MapView.svelte` (Map construction options),
  `styleBuilder.ts` (style assembly / layer + `sky` filtering),
  and `src/map/sources.ts` (source catalogue) MUST `import` the
  registry from FR-001 and consume its locked values at assembly
  time. They MUST NOT hard-code parallel literals that duplicate
  the registry's values.
- **FR-001b**: The lockdown registry MUST NOT expose any
  runtime / dev-only escape hatch (no URL query parameter, no
  environment variable, no `localStorage` toggle). Re-enabling
  3D is always a deliberate code change — flipping values inside
  the registry and removing the corresponding filter call sites.
- **FR-002**: The MapLibre `Map` instance MUST be constructed with
  `maxPitch: 0` and `touchPitch: false`, so that no input —
  gesture, keyboard, or programmatic — can pitch the map above
  `0°`. Drag rotation MAY remain enabled (rotation is in scope;
  pitch is not).
- **FR-003**: The assembled map style produced by `styleBuilder.ts`
  MUST NOT contain a `sky` style spec entry, even if an upstream
  basemap definition declares one. The builder MUST filter out
  `sky` blocks at assembly time.
- **FR-004**: The map projection MUST remain mercator. The
  construction options MUST explicitly set `projection: 'mercator'`
  (or, if MapLibre's default for the project's pinned version is
  mercator, document that fact in the lockdown register so a
  future MapLibre upgrade cannot silently flip the app to globe).
- **FR-005**: `map.setTerrain(...)` MUST never be called by app
  code, and no terrain RGB DEM source MUST be registered in the
  source catalogue (`src/map/sources.ts`). `map.getTerrain()` MUST
  return `null` for the entire session.
- **FR-006**: The assembled map style MUST contain no layer with
  `type: 'fill-extrusion'`. The style builder MUST filter such
  layers out at assembly time, even if an upstream vector source
  defines one.
- **FR-007**: The assembled map style MUST contain no layer with
  `type: 'hillshade'`. Same filter rule as FR-006.
- **FR-008**: After a basemap or overlay style swap, every
  lockdown class (FR-002..007) MUST still hold. The lockdown is a
  standing invariant, not a one-time configuration applied only at
  first construction.
- **FR-009**: Existing rotate / zoom / pan / crosshair / coordinate
  readout / Go-To behaviour MUST be unchanged. No regression in
  bearing tracking (the `bearingSignal` still emits on rotation).

#### FR-010 to FR-014: Go To dialog narrow-viewport fit (User Story 2)

- **FR-010**: Every Go To input layout (`DdLayout`, `DmsLayout`,
  `Tm2Layout`, `Twd67Layout`, `MgrsLayout`, `TaipowerLayout`,
  `AutoLayout`) MUST fit inside the Go To dialog's content area at
  a viewport width of `320 px` with no horizontal overflow.
- **FR-011**: Each input cell at the `320 px` viewport MUST retain
  a tap target ≥ `44 × 44 CSS px` on its short axis (per the
  existing accessibility baseline established by ADR-0014).
- **FR-012**: The fix MUST NOT widen the Go-To dialog beyond its
  current max-width on viewports ≥ `768 px` (no regression on
  tablets / desktops).
- **FR-013**: The fix MUST compose with the safe-area tokens from
  `.claude/rules/pwa-positioning.md` — no input cell may sit under
  the inline safe-area inset on landscape phones with a notch.
- **FR-014**: If the fix uses a breakpoint to switch column count,
  the breakpoint declaration MUST use
  `(max-width: calc(<bp>px - 0.02px))` to keep CSS `@media` and any
  JS subscription thresholds in lockstep (per the documented PWA
  positioning rule).

#### FR-015 to FR-019: Settings About area (User Story 3)

- **FR-015**: The Settings panel MUST expose an "About" area
  containing two labelled links: a "Live map" link to
  `https://swim-fish.github.io/pwa_map/` and a "Source code" link
  to `https://github.com/swim-fish/pwa_map`.
- **FR-016**: Each link MUST be a real `<a href>` element with
  `target="_blank"` and `rel="noopener noreferrer"` so that link
  semantics (open in new tab, long-press copy, security decoupling
  from the parent context) work natively.
- **FR-017**: The About area's section heading and link labels
  MUST be translatable via the existing i18n catalogues
  (`zh.json`, `en.json`, `ja.json`) — adding the new keys to ALL
  three catalogues per the locale-parity rule. The URL strings
  themselves remain literal (not translated).
- **FR-018**: The About area MUST NOT use any hard-coded colour —
  every colour MUST resolve via an existing token from
  `tokens.css` (per the `settings-contrast.spec.ts` regression net
  in `.claude/rules/pwa-tokens-and-contrast.md`).
- **FR-019**: The About area MUST be keyboard accessible: each
  link MUST be reachable via Tab in visual order, MUST receive a
  visible focus ring (the existing focus-ring tokens), and MUST be
  activatable with <kbd>Enter</kbd> or <kbd>Space</kbd>.

#### FR-020 to FR-021: README live link (User Story 4)

- **FR-020**: `README.md` MUST contain a Markdown link to
  `https://swim-fish.github.io/pwa_map/` within the first ~30 lines
  (above-the-fold on a typical desktop reader). The link text MUST
  be human-readable (e.g. "Live demo" or the URL itself), not an
  anonymous "click here".
- **FR-021**: The README link MUST remain consistent with the
  deploy-base configuration — the URL committed to the README must
  match the `deploy.base` setting in `vite.config.ts` (the
  `npm run deploy:check` pipeline already asserts the deploy-base
  spec; the README link is a human-facing mirror).

### Key Entities *(none)*

This feature does not introduce new persisted state or new domain
entities. It (a) adds a 3D / Terrain lockdown register and the
configuration / style-filtering it implies, (b) adjusts CSS in
existing components, (c) adds presentational content (links + i18n
keys) to the Settings sheet, and (d) edits a documentation file.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After every documented 3D / Terrain capability test
  (pitch gestures, programmatic `setPitch` / `setTerrain` /
  `setProjection`, inspection of the assembled style for `sky` /
  `fill-extrusion` / `hillshade`), the map state matches the locked
  baseline: `getPitch() === 0`, `getTerrain() === null`,
  `getProjection() === 'mercator'`, no `sky` / `fill-extrusion` /
  `hillshade` entries in the assembled style. 100 % of
  capability-attempt cases assert the locked state, including after
  every basemap / overlay swap.
- **SC-002**: The Go To dialog renders without horizontal scroll at
  viewport widths `320 px`, `360 px`, and `390 px` for every input
  layout (Auto, DD, DMS, TM2, TWD67, MGRS, Taipower). 0 cases of
  horizontal overflow in the regression test matrix (7 layouts × 3
  widths = 21 cases).
- **SC-003**: All Go To input cells at `320 px` retain a minimum
  short-axis tap target of `44 px` (asserted via the test
  `getBoundingClientRect()`).
- **SC-004**: The Settings About area exposes both URLs as
  `<a href target="_blank" rel="noopener noreferrer">` links, with
  i18n-translated labels in all three locales (`zh`, `en`, `ja`),
  asserted by an integration test that mounts SettingsSheet in
  each locale.
- **SC-005**: The README live-map link is the first non-title
  Markdown link in `README.md` and points at exactly
  `https://swim-fish.github.io/pwa_map/` (asserted by a unit test
  that loads README.md as text and grep-matches the link).
- **SC-006**: The bundle-size budget gate (`npm run bundle-size`)
  passes — the combined feature-012 delta over the feature-011
  baseline is at most `+1 KiB` gzipped on the entry chunk and
  `+0.5 KiB` gzipped on CSS (these are the plan-level targets;
  the project-wide ceiling of `+6 KB` from
  `.claude/rules/quality-gates.md` remains the hard fail bound).
- **SC-007**: The full review-loop passes: `npm run format`,
  `npm run lint` (`--max-warnings 0`), `npm run typecheck` (0
  errors / 0 warnings), `npm test` (all green), `npm run build`,
  `npm run bundle-size`. End-to-end specs (`npm run test:e2e`)
  for mobile install / readout / Go-To pass without flake on the
  three matrix widths.
- **SC-008**: No new hard-coded colours land in
  `SettingsSheet.svelte` —
  `tests/integration/settings-contrast.spec.ts` passes unchanged.
- **SC-009**: The locale-key parity test
  (`tests/unit/i18n/controls-keys-parity.spec.ts`) passes — every
  new About-area key exists in all three locale JSONs.
- **SC-010**: A "lockdown register integrity" test asserts that
  the inventory artifact lists exactly six capability classes
  (pitch / `sky` / globe / terrain / `fill-extrusion` /
  `hillshade`) and that each class has a corresponding runtime
  assertion in the test suite. No silent additions or removals.

## Addendum

> Post-`/speckit.implement` behavioural changes per Constitution
> Principle V — original FRs above are frozen historical record; the
> entries below extend / amend them.

### A.1 Compass takes shortest-path arc across the 0° / 360° seam (commit `619a059`)

**Defect**: `Compass.svelte` mirrored the raw `0..360` bearing from
`bearingSignal` directly into a CSS `rotate()`, so a bearing change
from 20° to 350° (or any seam-crossing step) made the browser
interpolate the long way round — a 330° backwards spin instead of a
30° forward nudge. User-reported as "compass jumps when bearing
changes around 0°".

**Fix**: Compass tracks an unbounded `displayedDeg` accumulator that
adds the shortest signed delta on each `bearingSignal` change. CSS
interpolates against the unbounded angle and always picks the
shortest arc. End state matches the canonical engine bearing modulo
360°; the only observable difference is the smooth rotation path.

**Tests**: 4 new regression cases under
`tests/integration/compass.spec.ts` "seam-crossing shortest-path"
describe block; one existing case (#3 — `emit 270` from 0)
re-grounded to the shortest-path expectation `90deg`.

**FR amendment**: amends ADR 0026 (Compass + crosshair-anchored zoom).
Bearing rotation behaviour described in spec FR-009 ("rotate / zoom /
pan / crosshair / coordinate readout / Go-To behaviour MUST be
unchanged") is preserved — the user-visible end state still matches
the engine bearing, only the visual transition path changed.

### A.2 Settings About section reordered to match contract (commit `7cb22cf`)

**Defect**: The initial implementation placed the About section
**before** the install section, violating
`contracts/settings-about-section.md` §1 which mandates "after the
existing install section and before the cache rows". The contract
order was the right call — install (primary CTA) above the fold,
About (secondary discovery) below.

**Fix**: Moved the `<section class="about-section">` block in
`SettingsSheet.svelte` to immediately follow the install `{#if}` and
precede the cache rows.

**FR amendment**: spec FR-015 acceptance scenario 1 ("user scrolls or
navigates to the About area") is unchanged in semantics; the area is
just reachable in a different scroll position now.

### A.3 Settings About links use secondary-button styling (commit `7cb22cf`)

**UX gap**: Initially the About anchors were styled as plain
underlined inline text. Side-by-side with the accent-filled
`.install-section-confirm` primary button, the About links read as
recessive text and were easy to skim past — the user reported them
as "not obviously interactive".

**Fix**: Promoted both `<a>` elements to a clear secondary-button
visual using the new `.about-link` class plus the project-wide
`.tap-target` utility. Same shape as `.install-section-confirm`
(padding / border-radius / font-weight / 44 px tap target floor)
but with a neutral outline fill so the install button retains
visual primacy. Hover / focus shifts border + text to
`var(--color-accent)`.

**FR amendment**: extends FR-019 (keyboard accessibility) — the
focus ring on each link is now visible against both the neutral
default fill and the accent hover fill; the WCAG-AA contrast on
both states is inherited from the existing token vocabulary, so
`tests/integration/settings-contrast.spec.ts` continues to pass
without modification.

## Assumptions

- **About area is a section inside the existing Settings sheet,
  not a separate sub-screen**: The user's request "Settings 增加
  About 頁面" is interpreted as "add an About section to the
  existing Settings sheet" rather than introducing a sub-page
  navigation pattern. Justification: the SettingsSheet already
  follows a multi-section pattern (tile cache + install in feature
  011); adding a third "About" section is the lowest-friction
  shape and composes with established patterns. If the user wanted
  a separate routed page, they can clarify in `/speckit.clarify`.
- **The live-map URL and project URL are stable**: Both URLs are
  considered durable identities; they will not be parameterised or
  i18n-swapped. The README link and the in-app link reference the
  same literal strings.
- **Bearing rotation stays enabled**: Disabling 3D / Terrain is
  orthogonal to bearing. The compass arrow continues to update on
  rotation; the spec's "no 3D" requirement does not extend to "no
  rotate".
- **Six is the closed set of 3D / Terrain capability classes for
  this MapLibre version**: pitch, `sky`, globe projection, terrain
  DEM, `fill-extrusion`, `hillshade`. Marker `pitchAlignment` /
  `rotationAlignment` are out of scope (this app does not use
  Markers). If a future MapLibre version adds a new 3D-class
  capability (e.g. shadow casting, atmospheric scattering), the
  lockdown register MUST be amended in the same release that picks
  up the new MapLibre version.
- **Go-To dialog max-width is the constraining envelope, not the
  raw viewport**: The Go-To dialog already renders inside a
  centred container with a maximum width. The fix targets layouts
  inside that container; the dialog's own width clamps already
  work.
- **The narrowest supported viewport is `320 px`**: This matches
  the implicit viewport baseline used by feature 010 (mobile
  collapsed readout) and feature 011 (safe-area work). Anything
  narrower is out of scope.
- **No new persisted preference**: This feature does not
  introduce any new preference-storage key. The About area is
  static content; the 3D / Terrain lockdown is a build-time /
  construct-time configuration, not a user-toggleable setting.
- **MapLibre option semantics**: The fix relies on standard
  MapLibre options on `new maplibregl.Map({...})` and on filtering
  inside `styleBuilder.ts`. We do not monkey-patch internals or
  inject into the gesture handler chain.
- **README link audience**: The README is read on GitHub by
  developers and contributors. The link target is the production
  deploy URL (not a staging URL), which matches the live-map URL
  baked into the in-app About area.
