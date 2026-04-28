# ADR 0031 — Safe-Area Zone Tokens (Generalised) + On-Demand Install Entry

**Status**: Accepted
**Date**: 2026-04-28
**Feature**: `specs/011-safe-area-install-buttons/`
**Related**: ADR 0014, ADR 0021, ADR 0025, ADR 0029

## Context

Two coupled UX gaps were identified after features 005 (PWA installable)
and 009 (mobile UI fixes) shipped:

1. The safe-area-aware positioning pattern from feature 009
   (`--notification-zone-top` / `--notification-zone-bottom`, both
   composed as `calc(<base spacing> + env(safe-area-inset-*, 0px))`)
   was scoped to the notification region only. The toolbar, the
   coordinate readout, the attribution bar, the map-controls
   cluster, the iOS install sheet, and the Settings sheet all
   continued to use literal `top: var(--space-3)` / `bottom: var(--space-4)`
   declarations and consequently slid under the iOS notch / Dynamic
   Island and the Android edge-to-edge gesture region.
2. The transient `InstallBanner.svelte` (feature 005) is a
   discoverability surface — it appears automatically when
   `beforeinstallprompt` fires AND the user has not dismissed it
   within the last 30 days. There was no _on-demand_ affordance: a
   user who missed or dismissed the banner had no in-app way to
   invoke the install path on their own initiative without manually
   clearing `pwa_map:installDismissedUntil`.

## Decision

### A. Generalise the safe-area zone tokens

`tokens.css` declares **four shared safe-area component tokens**, each
exposing exactly one `env(safe-area-inset-*)` value with the documented
`0px` fallback:

```css
--top-stack-zone-top: env(safe-area-inset-top, 0px);
--bottom-stack-zone-bottom: env(safe-area-inset-bottom, 0px);
--inline-stack-zone-left: env(safe-area-inset-left, 0px);
--inline-stack-zone-right: env(safe-area-inset-right, 0px);
```

Every persistent UI surface composes one of these tokens with its own
existing `--space-*` literal via `calc(...)` to derive its positional
offset. The existing `--notification-zone-top` / `--notification-zone-bottom`
tokens are refactored to delegate to the new shared tokens — the
post-refactor resolved value equals the pre-refactor declaration on
every viewport, but the safe-area component now lives in exactly one
place.

The Settings sheet uses a distinct composition (`max(var(--space-4),
var(--*-stack-zone-*))`) because it switches centring strategy from
`transform: translate(-50%, -50%)` to `top/bottom/left/right + margin: auto`
in order to honour the safe area on every edge while preserving visual
centring on devices with no insets.

A grep guard in `tests/unit/safe-area-tokens.spec.ts` enforces that no
file under `src/` other than `tokens.css` contains the literal substring
`env(safe-area-inset` — every consumer is forced through the shared
tokens.

### B. Add an on-demand install entry inside the Settings sheet

A new `<section class="install-section">` block in
`SettingsSheet.svelte` is rendered iff
`installSettingsSurface !== 'unsupported'`. Its DOM contents are
derived from a **new derived store**, `installSettingsSurface`
(in `src/pwa/installSettingsSurface.ts`), that returns the
_un-suppressed_ install surface:

```ts
export type SettingsInstallSurface =
  | 'android-chromium'
  | 'desktop-chromium'
  | 'ios-safari'
  | 'ios-other'
  | 'standalone'
  | 'unsupported';
```

Distinct from feature 005's `installSignal.surface`: that store
collapses both "30-day banner dismissal" and "app installed" into the
single `'hidden'` literal, which the on-demand Settings entry MUST NOT
honour. The derived store ignores `dismissedUntil` and reads
`installSignal.installed` directly to recover the standalone-vs-dismissed
distinction.

The Chromium branches reuse `triggerInstall()` from feature 005
verbatim — no parallel install state. The iOS-Safari branch opens an
instructional dialog whose body is the same three steps the existing
`InstallIosSheet.svelte` shows today (re-openable any number of times,
re-using the same `pwa.install.ios.*` locale keys).

### C. Keep the transient banner / iOS sheet on the un-derived signal

`InstallBanner.svelte` and `InstallIosSheet.svelte` continue to read
`installSignal.surface` (which still respects the 30-day dismissal).
Only the new Settings entry subscribes to `installSettingsSurface`.

This dual-surface design preserves the user's "stop popping at me"
choice for pop-ups while restoring on-demand discoverability via
Settings.

## Consequences

### Positive

- One source of truth for the safe-area composition. Future surfaces
  add a one-line `calc(...)` rule and pick up the inset
  automatically.
- The `--notification-zone-*` tokens stay backward-compatible (same
  resolved value) so feature 009's regression specs continue to
  pass.
- The on-demand install entry is purely view-layer over existing
  install state — no new persisted key, no new event listener, no
  new schema migration.
- The 30-day dismissal continues to silence the _transient banner_
  for users who chose to dismiss it. They can still install on
  demand via Settings.
- iOS Safari users now have an in-app "remind me how to add to home
  screen" affordance that does not depend on having seen the
  transient `InstallIosSheet` first.

### Negative

- One additional Svelte derived store (`installSettingsSurface`) to
  reason about. Mitigated by ~50 lines of pure TS, exhaustive unit
  test coverage (S1–S10 invariants), and explicit FR-015 spec
  language documenting why the store exists.
- One new design token (`--color-on-accent`) introduced solely to
  satisfy feature 007's `settings-contrast.spec.ts` "no hard-coded
  colours in SettingsSheet" rule. Could have been folded into a
  larger token-cleanup feature; doing it inline here was the
  smaller diff.
- The Settings sheet's centring strategy changes from
  `transform: translate(-50%, -50%)` to `margin: auto` with explicit
  `top/bottom/left/right` constraints. Visually identical on devices
  with no insets (regression-asserted in `safe-area-tokens.spec.ts`),
  but the change is observable to anyone querying the sheet's
  `transform` property in JS.

### Neutral

- No persisted-state migration; `pwa_map:prefs.version` remains at
  `3` (feature 010's value). `pwa_map:installDismissedUntil` is
  unchanged.
- No new third-party dependency. Safe-area is a CSS primitive; the
  install flow already exists from feature 005.
- Bundle size delta: -0.00 KB JS, +0 KB CSS gzipped (well under the
  Plan §"Performance Goals" budgets of +1 KiB JS / +0.5 KiB CSS).

## Alternatives considered

- **Per-component `env(safe-area-inset-*)` declarations** — rejected
  because it scatters the safe-area knowledge across nine
  components. Same rationale as feature 009 §R3.
- **Pre-bake each surface's offset into a per-surface
  monolithic token** (e.g., `--readout-zone-bottom: calc(var(--space-3)
  - env(...))`) — rejected as worst-of-both-worlds: forces every
per-surface offset change to ripple through tokens.css. The shared
*component* token + per-surface `calc(...)` rule keeps each
    surface owning its own offset.
- **Add a new `installSignal.settingsSurface` field** to feature
  005's store — rejected as a contract intrusion into a frozen
  module (ADR 0025). Derivation in a sibling file keeps feature
  005's surface stable.
- **Make the Settings entry honour the 30-day dismissal too** —
  rejected because it conflates "stop popping at me" with "make
  install permanently inaccessible". The user's spec input was
  explicit ("設定頁面新增 ... 安裝此 App 按鈕" — a button on
  demand, not a re-trigger of the pop-up).
- **Show the install button hidden-but-disabled on `'unsupported'`
  desktop browsers** — rejected because rendering an action the
  user cannot use is a worse experience than showing no action.
  Matches feature 005's existing pattern for the transient banner.
- **Inline the iOS Safari instructions under a permanently-visible
  heading** instead of behind a button — rejected because the user
  asked for "一個按鈕" (one button per surface). Inlining the three
  steps would balloon the section's vertical footprint and conflict
  with the spec's "button" phrasing.

## Implementation notes

- `installSettingsSurface` is a `derived(installSignal, ...)` store.
  It re-evaluates synchronously on every `installSignal` change, so
  the Settings section reacts to `markInstalled()` /
  `recordDismissal()` / `captureBeforeInstallPrompt()` from any
  caller without an explicit subscription.
- The Settings install button uses an `installInFlight` local flag
  (component-scoped, never persisted) to disable the button while
  `await triggerInstall()` is pending. This guards against
  double-clicks consuming the same `deferredPrompt`.
- The iOS instructions dialog opens via a `showIosInstructions`
  local flag and closes via Escape (priority: `confirmTarget` >
  `showIosInstructions` > sheet close), the dialog's own close
  button, or the scrim — same shape as the existing cache-clear
  confirm dialog in `SettingsSheet.svelte`.
- `viewport-fit=cover` in `index.html` is preserved — without it
  the page would not paint edge-to-edge and the safe-area edits
  would have no work to do. Asserted by
  `safe-area-tokens.spec.ts`.

## Post-implementation amendments (2026-04-28)

The following four UX adjustments were applied during a same-day
review pass after the original implementation landed. They share
feature 011's scope (mobile polish + safe-area discipline) and ride
the same bundle.

### D. Map controls re-anchored to left-center on every viewport

`.map-controls` (zoom in / out + compass cluster) moved from
`right + bottom` to `left + top: 50% + translateY(-50%)`. Universal —
no `@media` gate. Reasons:

- Bottom-right corner is now reserved for the readout / attribution
  stack; keeping the controls there caused visual contention even
  on desktop.
- Left-center is reachable by either thumb in one-handed mobile use.
- The left edge already honours `env(safe-area-inset-left)` via
  `--inline-stack-zone-left`, so notched-iPhone landscape is covered
  for free.

Trade-off: on very short viewports (< ~280 px tall) the left-center
controls can vertically touch the bottom-anchored readout; treated
as acceptable given that height is below any realistic supported
device.

### E. Coordinate readout always lifts above the bottom-right attribution

`.readout`'s `bottom` declaration in `CoordinateReadout.svelte`
gained `+var(--space-5)` (≈ 20 px) **in the base rule** (not gated
by `@media`). Reason: the original mobile-only `@media` lift left
the desktop / tablet path overlapping the attribution badge whenever
the readout extended close to the right edge (e.g. wide readout on
800-px viewports). Universal lift removes the overlap on every
viewport at no measurable visual cost on desktop.

### F. Coordinate readout collapse re-architected

The `viewMode` state machine from feature 010 (narrow-only
collapse + transient `'tap-expanded'` literal) was reworked:

- **Default state** depends on `defaultCollapsed = enabled.length ≥ 2 && (isNarrow || isShort)` where the new `isShort` matchMedia
  query subscribes to `(max-height: calc(800px - 0.02px))`.
- **All viewports are toggleable** when `≥ 2` formats are enabled
  (was: only narrow viewports). Tap inverts a component-local
  `userToggled` flag; the flag resets whenever `defaultCollapsed`
  flips (viewport threshold crossed) so the user always sees the
  viewport's natural state on a fresh entry.
- **`data-mode` simplified to two literals** — `'collapsed'` /
  `'expanded'`. The previous `'tap-expanded'` literal is gone (its
  semantic was "user-overridden expanded" which is now covered by
  `data-mode='expanded' + data-toggleable='true' + userToggled=true`).
- **New `data-toggleable` attribute** on the `<section>` root
  surfaces "≥ 2 formats enabled" to CSS (cursor) and ARIA
  (`role='button'`, `tabindex='0'`, `aria-expanded`).

Test impact: `coordinate-readout-tap-expand.spec.ts` literal updated
from `'tap-expanded'` to `'expanded'`; two new tests cover the wide+tall
default-expanded → user-toggle-collapse flow and the < 2 formats
non-toggleable case. Feature 010's `coordinate-readout-collapse.spec.ts`
contract was preserved (the test stub returns the same `MQL` for both
queries, so flipping `mql.matches` correctly drives both `isNarrow`
and `isShort` together).

### G. TM2-zone and Taipower-precision segments hidden in readout display

Two `goto.fields.*` segments were removed from the readout's visible
DOM:

- `goto.fields.zone` — TWD97-TM2 zone digit (e.g. `121`)
- `goto.fields.precision` — Taipower precision digit (e.g. `9` / `11`)

Both are configured in Settings (the user picks the zone behaviour
and the Taipower precision once) rather than primary coordinate
data, so showing them inline was visual noise that risked
confusion ("does that 11 mean an 11th something?"). The hide is
**presentation-only**:

- Implemented as a `Set`-based filter inside
  `CoordinateReadout.svelte`'s `rowFor()`.
- The `coordinateSegments()` pure helper in `src/coord/segments.ts`
  is **unchanged** — Go To layouts and the segments contract from
  feature 009 (data-model invariant: "segments mirror the Go To
  layout's input fields exactly") still see the full segment list.
- The copy button still emits the canonical full-format string via
  `format*()` (which independently includes zone / precision where
  applicable), so the user can paste back into Go To and round-trip
  with zero data loss.

### Bundle delta after amendments

Cumulative entry-bundle delta from `master` baseline:

| Asset             | Delta    | Per-feature budget           |
| ----------------- | -------- | ---------------------------- |
| Entry JS gzipped  | +3.15 KB | +6 KB                        |
| Entry CSS gzipped | +0.04 KB | (within the same +6 KB pool) |

Both well within the project-enforced budget. The Plan's tighter
self-imposed +1 KiB JS target is overshoot (documented in the
analyse report finding F2); the iOS instructions dialog SVG and
the dual matchMedia subscription are the largest contributors and
trade well against the UX gain.
