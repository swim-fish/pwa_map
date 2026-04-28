# UI Record 0012 — Settings About Section, Go-To Mobile Fit, and Map 3D / Terrain Lockdown

**Status**: Accepted (landed at `/speckit.implement` 2026-04-28)
**Affected screens**: Settings sheet (new About section), Go-To dialog
(narrow-viewport collapse), entire map canvas (no perceptible visual
change today, but tilt / globe / terrain entry points are blocked).
**Feature**: `specs/012-settings-about-and-mobile-fixes/`

## Context

Three direct user-facing pain points and one foundational invariant
fix:

1. **Settings exposed no canonical link to the live deploy or the
   source repo**. Users sharing the app had to rely on copy-pasting
   the address bar, and would-be contributors had to dig through
   `package.json` to find the GitHub URL.
2. **Go-To dialog overflowed on narrow phones**. Multi-column input
   grids (DD: 2 cols; DMS: 3 cols + auto; TM2 / TWD67 / MGRS /
   Taipower: 2 cols) pushed the dialog into horizontal scroll on
   320 px-class viewports (iPhone SE in portrait, small Android in
   split-screen).
3. **Map could be unintentionally pitched / tilted**. Two-finger
   gesture, right-mouse drag, and keyboard pitch shortcuts each
   tipped the canvas into a 3D perspective, breaking the central
   "crosshair reads off a top-down 2D projection" UX premise.
4. **README contained no link to the live deploy**. First-time GitHub
   visitors had no way to try the app before reading the source.

## Visible changes

### A. Settings → About section

A new `<section class="about-section">` appears in the Settings sheet
**after** the Install section and **before** the Cache rows
(corrected in commit `7cb22cf`; the initial implementation had About
above Install, which violated `contracts/settings-about-section.md`
§1). The section renders:

- An `<h3>` heading reading the locale-translated `About` text.
- A `<ul>` with two list items, each a real `<a href target="_blank" rel="noopener noreferrer" class="about-link tap-target">`:
  - **Live map** — `https://swim-fish.github.io/pwa_map/`
  - **Source code** — `https://github.com/swim-fish/pwa_map`

Each anchor is styled as a **secondary button** (commit `7cb22cf`)
with the same shape as the install primary button —
`var(--space-2) var(--space-3)` padding, `6 px` border-radius, `600`
font-weight, 44 × 44 px minimum tap target — but with a neutral
outline fill (`var(--color-border)` border,
`var(--color-surface-elev)` background, `var(--color-fg)` text) so
the install accent-filled button stays the visual primary CTA.
Hover / focus shifts the border + text colour to
`var(--color-accent)` with a 120 ms transition that respects
`prefers-reduced-motion: reduce`.

URLs open in a new browser tab (so the PWA standalone state is not
disturbed). Long-press on a touch device surfaces the OS's standard
"copy link" / "share" affordance because each link is a real anchor
element.

#### i18n keys (added to all three locales)

| Key                         | English       | Traditional Chinese (`zh`) | Japanese (`ja`)  |
| --------------------------- | ------------- | -------------------------- | ---------------- |
| `settings.about.heading`    | `About`       | `關於`                     | `アプリについて` |
| `settings.about.liveMap`    | `Live map`    | `地圖網址`                 | `マップ URL`     |
| `settings.about.sourceCode` | `Source code` | `原始碼`                   | `ソースコード`   |

The two URLs are inline string literals and are **not** translated.

#### Tokens added

**None.** The About section reuses existing tokens:

- `var(--color-fg)` for link text.
- `var(--color-accent)` for the hover / focus link colour.
- The existing `:focus-visible` outline rule for keyboard focus.
- Spacing via the existing `--space-1` / `--space-2` / `--space-3`
  scale.

The contrast regression net (`tests/integration/settings-contrast.spec.ts`)
passes unchanged — no hard-coded `#hex` / `rgb(...)` declarations
were introduced.

### B. Go-To dialog narrow-viewport collapse

Each of the six grid-based Go-To layouts gains a single
`@media (max-width: calc(360px - 0.02px))` block that switches its
`grid-template-columns` to `1fr` (single column):

| Layout           | Default columns                  | At ≤ 360 px |
| ---------------- | -------------------------------- | ----------- |
| `DdLayout`       | `1fr 1fr`                        | `1fr`       |
| `DmsLayout`      | `repeat(3, minmax(0, 1fr)) auto` | `1fr`       |
| `Tm2Layout`      | `1fr 1fr`                        | `1fr`       |
| `Twd67Layout`    | `1fr 1fr`                        | `1fr`       |
| `MgrsLayout`     | `1fr 1fr`                        | `1fr`       |
| `TaipowerLayout` | `1fr 1fr`                        | `1fr`       |

`AutoLayout` already uses a single full-width `<textarea>` and needs
no change.

The `0.02 px` rounding-rule subtraction follows the project's
positioning rule (see `.claude/rules/pwa-positioning.md`) so the CSS
`@media` threshold matches a future JS `matchMedia('(max-width: ...)')`
subscription verbatim.

### C. Map 3D / Terrain lockdown (no visible change today)

`MapView.svelte`'s MapLibre construction options now derive from the
new `src/map/threeDLockdown.ts` registry:

- `maxPitch: 0` — the engine-level pitch ceiling clamps every
  gesture / programmatic / keyboard pitch attempt to 0.
- `touchPitch: false` — explicit touch-pitch disable
  (belt-and-braces against the ceiling).
- `projection: 'mercator'` — explicit pin against future MapLibre
  defaults.

`styleBuilder.ts` post-processes every assembled style to strip any
`sky` block plus any layer of `type: 'fill-extrusion'` or `'hillshade'`.
The strip survives basemap / overlay swaps. `src/map/sources.ts`
gains a JSDoc cross-reference forbidding terrain RGB DEM source
registration while the lockdown is active.

There is **no user-visible UI change** for this slice — the lockdown
prevents an existing failure mode (accidental tilt) from ever
manifesting again. See ADR-0032 for the architectural rationale and
the future re-enable contract.

### D. README live demo link

`README.md` gains a single line above the Quickstart heading:

```markdown
**Live demo**: <https://swim-fish.github.io/pwa_map/>
```

The autolink form renders as a clickable link on GitHub and as a
legible URL in plain-text consumers (CLI viewers, npm package previews).

## Accessibility notes

- **Tap targets** (Go-To): every input cell at the 320 px viewport
  retains a short-axis dimension ≥ 44 px (ADR-0014 baseline).
  Asserted by the new Playwright e2e spec
  `tests/e2e/go-to-narrow-viewport.e2e.spec.ts`.
- **Keyboard navigation** (About): Tab from the Settings open
  trigger reaches the heading → live map link → source code link in
  visual order. Each link receives the existing `:focus-visible`
  outline (2 px solid `var(--color-accent)` with 2 px offset) per
  the SettingsSheet's existing focus rule.
- **Activation** (About): Enter follows the link's `href` natively
  (anchor element default). Asserted by the integration test that
  synth-fires Enter and confirms `defaultPrevented === false`.
- **Long-press / share** (About): Real `<a href>` elements expose
  the OS's native "copy link" / "share" affordance. No JavaScript
  click-handler shim.
- **Screen-reader association** (About): `<section
aria-labelledby="settings-about-heading">` ties the section
  identity to the heading; SR users hear "About region" before the
  link list.
- **Map lockdown a11y**: keyboard pitch shortcuts no-op silently
  via the `maxPitch: 0` ceiling; pan and rotation keyboard
  shortcuts continue to work (a11y baseline preserved).

## Locale changes

3 new `settings.about.*` keys × 3 locales = 9 entries added. Asserted
by the new focused parity spec
`tests/unit/i18n/settings-about-keys-parity.spec.ts` plus the
existing broader `tests/unit/i18n/controls-keys-parity.spec.ts` net.
No `zh-TW` / `zh-Hant` substring appears in any new value
(Constitution v1.1.0).

## Follow-ups

- **Future "enable 3D" feature**: edit
  `LOCKDOWN_REGISTER.<class>.lockedValue` and remove the
  corresponding filter call site per each entry's `reEnableHint`.
  Cite ADR-0032 in the new feature's spec / ADR.
- **MapLibre v4+ upgrade**: the `projection` option becomes
  type-supported; the one-line cast in `MapView.svelte`'s onMount
  can drop. The lockdown register's `globe.lockedValue: 'mercator'`
  literal already speaks the v4+ vocabulary.
- **App version / build-commit display in About**: deliberately not
  added in this slice. If a future feature wants this, extend the
  About section with an additional `<li>` and the corresponding
  i18n keys; the section pattern is established.
