# UI Record 0011 — Browser Safe-Area Compliance and a Settings-Page Install Button

**Status**: Accepted (landed at `/speckit.implement` 2026-04-28)
**Affected screens**: every persistent on-screen surface (top toolbar,
coordinate readout, attribution bar, zoom controls + compass cluster,
install banner, iOS install sheet) plus the Settings sheet (which gains
both safe-area-aware positioning AND a new "Install app" section at the
top of its body).
**Feature**: `specs/011-safe-area-install-buttons/`

## Context

Two phone-class complaints were raised against the shipped product
(features 001–010):

1. **Controls hidden behind the iOS notch / Dynamic Island and the
   Android system status bar / gesture region**. The top toolbar slid
   _under_ the notch in mobile Safari and PWA standalone mode; the
   bottom-pinned readout / zoom controls / attribution bar overlapped
   the home indicator on iOS and the gesture region on Android. The
   only safe-area-aware surface in the prior version was feature 009's
   notification region — every other surface used hard-coded
   `top: var(--space-3)` / `bottom: var(--space-4)` literals.
2. **No on-demand install path**. The transient install banner
   (feature 005, ADR 0025) appears once, suppresses itself for 30 days
   on dismissal, and never re-surfaces by user action. A user who
   missed or dismissed the banner had no in-app way to invoke the OS
   install prompt (Android / Desktop Chromium) or to look up the
   Add-to-Home-Screen instructions (iOS Safari) without clearing the
   dismissal storage by hand.

This UI record captures the visible behaviour changes and the
supporting design tokens.

## Design goals

1. **One safe-area composition pattern for every surface**. Four shared
   `--*-stack-zone-*` tokens in `tokens.css`, composed with each
   surface's existing `--space-*` literal via `calc(...)`. No surface
   uses `env(safe-area-inset-*)` directly outside `tokens.css`. The
   existing `--notification-zone-*` tokens (feature 009) are refactored
   to delegate to the new shared tokens — same final value, single
   source of truth.
2. **One on-demand install affordance per platform — surfaced in the
   Settings sheet**. The Settings sheet gains a new "Install app"
   section that adapts its rendered branch to the user's platform via
   a new `installSettingsSurface` derived store. Chromium → enabled
   install button that calls the same `triggerInstall()` action the
   transient banner uses; iOS Safari → button that opens an
   instructional dialog (same three steps the iOS install sheet shows
   today); iOS-other → "open in Safari" hint with no button;
   standalone → "App is already installed" status; unsupported →
   section unrendered (no empty heading).
3. **No regression to install-banner discoverability**. The transient
   `InstallBanner.svelte` and `InstallIosSheet.svelte` keep using the
   un-derived `installSignal.surface` which still respects the 30-day
   dismissal. Only the new Settings entry uses the derived store and
   ignores the dismissal — the user's "stop popping at me" choice is
   honoured for pop-ups, never for the on-demand entry.

## Visible changes

### 1. Top toolbar respects `env(safe-area-inset-top)` and `env(safe-area-inset-right)` (FR-001 / FR-003)

Before: `.toolbar { top: 12px; right: 12px; }`. On a notched iPhone
the Go To / Format / Layers / Locale / Settings buttons slid under
the notch.

After: `.toolbar { top: calc(var(--space-3) + var(--top-stack-zone-top)); right: calc(var(--space-3) + var(--inline-stack-zone-right)); }`.
The toolbar offsets shift by the engine-reported safe-area inset on
every device that reports a non-zero value; on devices that report
`0px` (every desktop browser, every older Android), the layout is
identical to the pre-feature baseline.

### 2. Bottom-pinned surfaces respect `env(safe-area-inset-bottom)` and `env(safe-area-inset-right)` (FR-002 / FR-003)

Same pattern applied to:

- `.readout` in `CoordinateReadout.svelte`
- `.attribution` in `AttributionBar.svelte`
- `.install-ios-sheet` in `InstallIosSheet.svelte`
- `.map-controls` in `App.svelte` (see §2a — re-anchored to left-center
  on every viewport, picks up `env(safe-area-inset-left)` instead)

`InstallBanner.svelte` does NOT need its own per-component edit
because feature 009 (ADR 0029) already moved its positioning into
the parent `<NotificationRegion>`, whose `--notification-zone-bottom`
token now delegates to `--bottom-stack-zone-bottom` after this feature.

#### 2a. Layout tweaks (post-implementation)

Two small position changes shipped after the initial implementation:

- **Zoom + compass cluster moved to left-center on EVERY viewport.**
  `.map-controls` is re-anchored from bottom-right to left-center:
  `position: fixed; left: calc(var(--space-3) + var(--inline-stack-zone-left)); top: 50%; transform: translateY(-50%);`
  Reasons: (a) the bottom-right corner is reserved for the readout /
  attribution stack, (b) the controls stay reachable for either thumb
  in one-handed use, (c) the left edge honours
  `env(safe-area-inset-left)` via `--inline-stack-zone-left`. Applies
  on every viewport (no `@media` gate) — desktop users get the same
  left-center placement as phones.

- **Coordinate readout always lifts above the attribution badge.**
  `.readout`'s base `bottom` declaration adds `var(--space-5)`
  (≈ 20 px — slightly more than the attribution badge's height) so
  the readout panel never visually overlaps the bottom-right
  attribution on any viewport:
  `bottom: calc(var(--space-3) + var(--space-5) + var(--bottom-stack-zone-bottom))`.
  Universal — no `@media` gate. (The earlier mobile-only variant was
  promoted to the base rule after a follow-up review confirmed the
  overlap occurs on tablet-class widths too.)

#### 2b. Coordinate readout collapse re-architected (post-implementation)

Feature 010 introduced a narrow-only collapse mode with a transient
`'tap-expanded'` literal. Feature 011 generalises the mechanism so
the readout is collapse-toggleable on **every** viewport with `≥ 2`
enabled formats, and the _default_ state depends on width OR height:

| Viewport                           | Default `data-mode` | Toggleable?               |
| ---------------------------------- | ------------------- | ------------------------- |
| Width ≥ 600 px AND height ≥ 800 px | `'expanded'`        | yes (tap → `'collapsed'`) |
| Width < 600 px OR height < 800 px  | `'collapsed'`       | yes (tap → `'expanded'`)  |
| < 2 enabled formats                | `'expanded'`        | no (nothing to collapse)  |

Implementation notes:

- Two `matchMedia` subscriptions — `(max-width: calc(600px - 0.02px))`
  for narrow and `(max-height: calc(800px - 0.02px))` for short.
- A new `userToggled` boolean (component-local, never persisted)
  inverts the viewport-derived default. It clears whenever
  `defaultCollapsed` flips so the user always sees the viewport's
  natural state on a fresh threshold crossing.
- `data-mode` simplified to `'collapsed'` / `'expanded'` (the
  `'tap-expanded'` literal from feature 010 is removed; the
  refactored test suite reflects the new shape).
- New `data-toggleable` attribute (`"true"` / `"false"`) on the
  `<section>` root surfaces "≥ 2 formats enabled" to CSS (cursor)
  and ARIA (`role`, `tabindex`, `aria-expanded`).

#### 2c. Hidden segments in readout display (post-implementation)

Two `goto.fields.*` segments are filtered out of the readout's DOM:

- `goto.fields.zone` — TWD97-TM2 zone digit (e.g. `121`)
- `goto.fields.precision` — Taipower precision digit (e.g. `9` / `11`)

Both are configured in Settings (the user picks them once) rather
than primary coordinate values; showing them inline was visual
noise. The hide is **presentation-only**:

- `coordinateSegments()` in `src/coord/segments.ts` is unchanged —
  Go To layouts still receive the full segment list (feature 009
  data-model invariant preserved).
- The copy button still emits the canonical full-format string (so
  pasting back into Go To round-trips with zero data loss).
- The filter lives inside `CoordinateReadout.svelte`'s `rowFor()`
  as a `Set<string>` look-up; new noisy segments can be added by
  editing the constant.

### 3. Settings sheet itself respects every safe-area edge (FR-008)

Before: `.sheet { top: 50%; left: 50%; transform: translate(-50%, -50%); }`.
On a notched iPhone in PWA standalone mode the sheet's bottom edge
sat very close to the home indicator; in landscape the leading rows
hid under the side notch.

After: `.sheet` uses `top: max(var(--space-4), var(--top-stack-zone-top));`
on every edge, with `margin: auto` for centring. The
`max(...)` idiom keeps today's layout on devices with no insets (the
literal wins) AND honours the inset on notched devices (the
`env()`-derived value wins). The sheet's `max-width` and `max-height`
are recomputed against the same `max(...)` insets so the scrollable
content never overflows the safe area.

### 4. Settings sheet contains a new "Install app" section (FR-009..FR-018)

A new `<section class="install-section">` sits at the top of the
Settings sheet's body, immediately after the licence notice and
before the cache-list section. Its rendered branch is derived from
the new `installSettingsSurface` store:

| Branch               | Rendered DOM                                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------------------------------ |
| `'android-chromium'` | Section + heading + enabled "Install" button (calls `triggerInstall()`)                                      |
| `'desktop-chromium'` | Same as `'android-chromium'`                                                                                 |
| `'ios-safari'`       | Section + heading + button labelled "加入主畫面" / "Add to Home Screen"; click opens an instructional dialog |
| `'ios-other'`        | Section + heading + "open in Safari to install" hint, no button                                              |
| `'standalone'`       | Section + heading + "App is already installed" status line                                                   |
| `'unsupported'`      | Section is unrendered (no DOM presence)                                                                      |

The Chromium install button is disabled while `triggerInstall()` is
in flight (one-shot guard) and re-enabled in the Promise's `finally`
block. Clicking it kicks off the OS install prompt; on `appinstalled`
the section reactively flips to the `'standalone'` branch's status
line without requiring the sheet to be reopened (FR-018).

The iOS-Safari instructional dialog is re-openable any number of
times (FR-011). It uses the same three steps as the existing
`InstallIosSheet.svelte` (Share icon → Add to Home Screen → Add) and
reuses the existing `pwa.install.ios.{title,step1,step2,step3,
shareIconAlt,dismiss}` locale keys verbatim.

## Affected components

| File                                      | Change                                                                                                                           |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/tokens.css`                      | NEW: 4 shared safe-area tokens + 1 new `--color-on-accent`. REFACTOR: `--notification-zone-*` delegate to the new shared tokens. |
| `src/app/App.svelte`                      | `.toolbar` and `.map-controls` swap literal offsets for `calc(... + var(--*-stack-zone-*))`.                                     |
| `src/components/CoordinateReadout.svelte` | `.readout` swaps `bottom: var(--space-3)` → `calc(var(--space-3) + var(--bottom-stack-zone-bottom))`; `left` similarly.          |
| `src/components/AttributionBar.svelte`    | `.attribution` swaps `bottom` / `right` literals for the safe-area-aware `calc(...)`.                                            |
| `src/components/InstallIosSheet.svelte`   | `.install-ios-sheet` swaps `bottom: var(--space-4)` → `calc(...)`.                                                               |
| `src/components/SettingsSheet.svelte`     | `.sheet` re-centring (top/bottom/left/right + margin: auto) + new install section + iOS instructions dialog + new CSS rules.     |
| `src/components/InstallBanner.svelte`     | (no edit — already positioned by parent NotificationRegion since feature 009)                                                    |
| `src/pwa/installSettingsSurface.ts`       | NEW module (~50 lines TS) — derived store for the Settings entry.                                                                |

## Design tokens added

| Token                        | Value                              | Purpose                                                                           |
| ---------------------------- | ---------------------------------- | --------------------------------------------------------------------------------- |
| `--top-stack-zone-top`       | `env(safe-area-inset-top, 0px)`    | Shared top-edge safe-area component                                               |
| `--bottom-stack-zone-bottom` | `env(safe-area-inset-bottom, 0px)` | Shared bottom-edge safe-area component                                            |
| `--inline-stack-zone-left`   | `env(safe-area-inset-left, 0px)`   | Shared left-edge safe-area component                                              |
| `--inline-stack-zone-right`  | `env(safe-area-inset-right, 0px)`  | Shared right-edge safe-area component                                             |
| `--color-on-accent`          | `#ffffff`                          | Foreground colour for text on `--color-accent` surfaces (Settings install button) |

## Locale changes

Two new keys per locale = **6 new strings** total:

- `settings.install.heading` — `"安裝應用程式"` / `"Install app"` / `"アプリをインストール"`
- `settings.install.alreadyInstalled` — `"應用程式已安裝"` / `"App is already installed"` / `"アプリはインストール済みです"`

Every other string in the new section reuses existing
`pwa.install.android.*` / `pwa.install.ios.*` / `pwa.install.iosOther.*`
keys from feature 005.

## Accessibility notes

- The Settings install section's primary button uses
  `class="tap-target"` (≥ 44 × 44 CSS px from feature 009's
  `--tap-min` token).
- The instructional dialog is `role="dialog"` with `aria-modal="true"`,
  matching the existing `InstallIosSheet.svelte` pattern.
- The standalone-branch status line uses `role="status"` so AT
  readers announce "App is already installed" reactively when the
  user installs without leaving Settings.
- The sheet's safe-area-aware re-centring uses `max(var(--space-4),
var(--*-stack-zone-*))` so the layout degrades gracefully on
  every desktop browser to today's pre-feature behaviour within 1
  CSS pixel (regression-asserted in `safe-area-tokens.spec.ts`).
- Keyboard: `Tab` cycles to the new install button; `Enter`/`Space`
  activates; `Escape` inside the iOS instructions dialog closes the
  dialog (priority: `confirmTarget` > `showIosInstructions` >
  `onClose` per the extended `onWindowKeydown` handler).

## Verification

- `tests/unit/safe-area-tokens.spec.ts` — token shape regression net (10 tests).
- `tests/unit/install-settings-surface.spec.ts` — derived store invariants S1–S10 (12 tests).
- `tests/integration/safe-area-layout.spec.ts` — per-surface CSS source-text contract (14 tests).
- `tests/integration/settings-install-section.spec.ts` — DOM render contract for every visible-or-not branch (13 tests).
- `tests/e2e/safe-area-install.e2e.spec.ts` — Playwright Chromium e2e for the Settings install path + the geometry sanity check on a 360 × 640 viewport.

Total: 700 / 700 tests GREEN; entry-bundle JS gzipped delta = -0.00 KB (well under +1 KiB budget); CSS delta = +0 KB (under +0.5 KiB budget).

## Related ADRs

- ADR 0014 — Accessibility Baseline (tap-target floor)
- ADR 0021 — `pwa_map:prefs` additive schema evolution (this feature adds NO persisted state)
- ADR 0025 — PWA install surfaces + dismissal-key design (extended, not superseded)
- ADR 0029 — Mobile touch-target floor + notification-region pattern (extended — the safe-area work generalises feature 009's pattern)
- ADR 0031 — **Safe-area zone tokens generalised + on-demand install entry** (this feature)
