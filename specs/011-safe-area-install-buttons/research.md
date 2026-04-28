# Phase 0 Research — Safe-Area Compliance and Settings-Page Install Button

**Feature**: 011-safe-area-install-buttons
**Date**: 2026-04-28
**Plan**: [plan.md](./plan.md)
**Spec**: [spec.md](./spec.md)

This document resolves open questions raised by the spec and the plan
so that Phase 1 (data model + contracts) can be authored without
further open `NEEDS CLARIFICATION` markers. The plan above has zero
remaining markers; the entries below document *why* each decision was
chosen.

## R1 — Safe-area mechanism: CSS `env(safe-area-inset-*)` vs JS measurement

**Decision**: CSS `env(safe-area-inset-*)` only, composed via design
tokens in `tokens.css`. No JavaScript measurement of system bars;
no `ResizeObserver`; no per-platform UA branching.

**Rationale**:

- The four `env(safe-area-inset-{top,right,bottom,left})` variables
  are the standard CSS facility for exactly this problem. Every
  browser in the project's target matrix (Chromium 120+, WebKit /
  iOS Safari 17+, Firefox 120+, Firefox Android — see plan.md
  Technical Context) supports them with the documented `0px` fallback
  for unsupported / zero-inset contexts.
- Feature 009 (`docs/ui/0009-mobile-ui-fixes.md`, ADR 0029) already
  established this mechanism for the notification region's
  `--notification-zone-top` / `--notification-zone-bottom` tokens.
  Generalising the same pattern to the toolbar / map-controls /
  readout / attribution / settings-sheet zones is a literal extension
  of an already-proven approach.
- A JS-measured approach (`window.visualViewport`,
  `screen.availHeight`, custom `ResizeObserver`) would require
  recomputation on every device-orientation change, would rely on
  per-engine quirks for the iOS Dynamic Island vs notch distinction,
  and would burn JS bundle bytes that the CSS approach gets for free.

**Alternatives considered**:

- **Per-component `padding-top: max(...)` declarations** — would scatter
  the safe-area knowledge across every fixed-positioned component
  rather than centralising it in tokens. Rejected for the same reason
  feature 009 chose to centralise the notification-region offsets.
- **`viewport-fit=auto`** (the safe Apple-default) — would re-introduce
  a "letterbox" margin around the page, defeating the edge-to-edge map
  rendering the project deliberately chose in feature 001 (ADR 0001 /
  feature 008's Vite base-path config). Rejected.
- **`@supports (padding: env(safe-area-inset-top))` feature gates** —
  unnecessary because the documented `0px` fallback collapses to the
  pre-feature behaviour on browsers that ignore the variable. The
  plan's FR-006 already requires the `0px` fallback; an `@supports`
  gate would be belt-and-braces.

## R2 — Bottom-zone token allocation: one shared token vs per-surface tokens

**Decision**: One shared bottom-zone token
(`--bottom-stack-zone-bottom`) consumed by every bottom-anchored
surface (coordinate readout, attribution bar, install banner, iOS
install sheet, future bottom-anchored toasts). Each surface adds its
own *vertical reserve* on top of the shared safe-area component:

```css
:root {
  /* Generic bottom safe-area component used by every bottom-anchored surface */
  --bottom-stack-zone-bottom: env(safe-area-inset-bottom, 0px);
}

.readout {
  bottom: calc(var(--space-3) + var(--bottom-stack-zone-bottom));
}

.attribution {
  bottom: calc(var(--space-2) + var(--bottom-stack-zone-bottom));
}

.install-banner {
  bottom: calc(var(--space-4) + var(--space-6) + var(--bottom-stack-zone-bottom));
}
```

**Rationale**:

- The bottom-anchored surfaces stack vertically, not overlay each
  other. The readout sits at the very bottom, the attribution bar
  sits just above it, the install banner sits above the attribution
  bar (per feature 005's `bottom: calc(var(--space-4) + var(--space-6))`).
  Each surface has its *own* vertical offset above the system edge
  (the `var(--space-*)` term), but every surface needs the *same*
  safe-area component (the `var(--bottom-stack-zone-bottom)` term).
- Centralising the safe-area component as one token means future
  bottom-anchored surfaces can adopt the rule with a one-line add
  (`bottom: calc(<their-offset> + var(--bottom-stack-zone-bottom))`)
  rather than re-deriving the calculation.
- Per-surface tokens (`--readout-zone-bottom`,
  `--attribution-zone-bottom`, `--install-banner-zone-bottom`, …)
  would pre-bake each surface's vertical offset *plus* the safe-area
  component into one token. That makes the per-surface offset
  impossible to change without touching the token, which is a
  worse-of-both-worlds split.

The same reasoning applies to the top zone: one shared
`--top-stack-zone-top` token (= `env(safe-area-inset-top, 0px)`) used
by `.toolbar` and (future) any other top-anchored surface, with each
surface adding its own vertical reserve.

For the inline axis (left / right insets, relevant to iPhone
landscape with a side notch), the same rule:
`--inline-stack-zone-left` and `--inline-stack-zone-right` are the
shared safe-area components, each surface adds its own offset.

**Alternatives considered**:

- **Per-surface monolithic tokens** (the rejected variant above) —
  documented the reasoning in the previous bullet; rejected as the
  worst-of-both-worlds split.
- **No tokens, raw `env()` per component** — every fixed-positioned
  component would gain a `calc(<existing-offset> +
  env(safe-area-inset-*, 0px))` rewrite. Functionally correct but
  spreads the "safe area is a thing" knowledge across nine
  components, with no central place for a future contributor to
  understand the design. Rejected on maintainability grounds — same
  rejection rationale as feature 009 §R3.

## R3 — Where do `ZoomControls.svelte` / `Compass.svelte` get their position?

**Decision**: They do **NOT** own their own positioning — they are
visual components mounted inside `App.svelte`'s `.map-controls`
wrapper, which carries `position: fixed; right: var(--space-4);
bottom: calc(var(--space-4) + var(--space-6));`. The safe-area edit
therefore lands on `App.svelte`'s `.map-controls` selector, NOT on
`ZoomControls.svelte` or `Compass.svelte` themselves.

**Rationale**:

- A literal grep of `src/components/ZoomControls.svelte` and
  `src/components/Compass.svelte` (verified during plan authoring)
  shows neither component declares `position: fixed` / `position:
  absolute` at its root selector. Both are flex children of the
  `.map-controls` div in `App.svelte`. The wrapper owns positioning;
  the children own their own intrinsic sizing only.
- Editing the wrapper instead of the leaf components keeps the
  safe-area concern out of the leaf components, which lets them
  remain pure visual primitives.

**Alternatives considered**:

- **Move positioning into the leaf components** — would couple every
  leaf to its viewport anchor, making it harder to re-arrange the
  bottom-right control cluster in a future feature. Rejected.

## R4 — Settings sheet: where exactly does the safe-area inset apply?

**Decision**: The `.sheet` selector in `SettingsSheet.svelte` gains
inset-aware `top` / `bottom` / `left` / `right` constraints:

```css
.sheet {
  position: fixed;
  top: max(var(--space-4), var(--top-stack-zone-top));
  bottom: max(var(--space-4), var(--bottom-stack-zone-bottom));
  left: max(var(--space-4), var(--inline-stack-zone-left));
  right: max(var(--space-4), var(--inline-stack-zone-right));
  /* Centred-and-bounded layout from feature 005 / 007 is preserved
     by the existing transform: translate(-50%, -50%) on top/left:50%
     ONLY in the no-inset path. With insets, the explicit
     top/bottom/left/right plus the existing max-width: min(440px, …)
     keep the sheet centred via auto-margins. */
  margin: auto;
  max-width: min(440px, calc(100vw - 2 * max(var(--space-4), var(--inline-stack-zone-left), var(--inline-stack-zone-right))));
  max-height: calc(100vh - 2 * max(var(--space-4), var(--top-stack-zone-top), var(--bottom-stack-zone-bottom)));
  overflow-y: auto;
  /* … existing background / border / shadow / padding rules
     unchanged … */
}
```

**Rationale**:

- The current sheet uses `top: 50%; left: 50%; transform:
  translate(-50%, -50%)` to centre in the viewport. On a notched
  device that would push the sheet's top edge behind the notch when
  the sheet is tall (the centring is *visual*, not *safe-area-aware*).
- The `max(var(--space-4), var(--*-zone-*))` pattern keeps today's
  layout on devices with no insets (the `var(--space-4)` literal
  wins) AND honours the inset on notched devices (the
  `env()`-derived value wins). This is the same `max(...)` idiom
  the CSS Working Group specifically designed for safe-area
  composition.
- The explicit `top` / `bottom` plus `margin: auto` on the inline
  axis preserves visual centring on every viewport, with insets
  applied where they exist.
- The `max-height: calc(100vh - 2 * max(...))` rule guarantees the
  sheet's scrollable content never grows beyond the safe area, so
  the bottom row (which after this feature contains the install
  button OR the existing "clear all" button) is always reachable
  via scroll.

**Alternatives considered**:

- **Wrap `.sheet` in a parent that owns the safe-area insets** —
  would require a new `<div class="sheet-frame">` element in the
  template, plus moving the scroll behaviour up one level. The
  inline `max(...)` rules achieve the same outcome with no template
  edit. Rejected for surface area.
- **Change the centring strategy from `transform: translate(-50%,
  -50%)` to flex centring on `body`** — bigger blast radius (every
  open dialog in the app uses the same centring idiom); rejected as
  out of feature scope.

## R5 — i18n keys: which strings can be reused, which must be new?

**Decision**: Reuse existing feature-005 install strings for every
button label, dialog body, and hint where the semantic matches
exactly. Introduce **two** new keys per locale (six strings total) for
strings that have no equivalent today. The exception is permitted by
spec FR-016 ("the section MUST reuse the existing key … where the
transient install banner / sheet already has an equivalent string").

| New key                                  | Used by                                                          | Why no existing key fits                                                                                                                                       | zh                              | en                            | ja                                  |
| ---------------------------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- | ----------------------------- | ----------------------------------- |
| `settings.install.heading`               | The new section's `<h3>` heading inside the Settings sheet        | The existing `pwa.install.android.title` ("將此應用安裝以離線使用") is a *banner title* — too long to use as a section heading; would also leak Android-only phrasing onto iOS. | `安裝應用程式`                   | `Install app`                 | `アプリをインストール`              |
| `settings.install.alreadyInstalled`      | The "App is already installed" status line in the standalone branch | No existing key carries the "already installed" status — feature 005 simply hides the banner when installed. Settings needs an explicit affirmative status.    | `應用程式已安裝`                 | `App is already installed`    | `アプリはインストール済みです`     |

| Reused key                               | Used by Settings install section as                                                  |
| ---------------------------------------- | -------------------------------------------------------------------------------------- |
| `pwa.install.android.confirm`            | The Chromium branch's primary button label ("安裝" / "Install" / "インストール")        |
| `pwa.install.ios.title`                  | The iOS-Safari branch's instructional dialog `aria-label` (and the dialog's `<h2>`)     |
| `pwa.install.ios.step1` / `step2` / `step3` | The three list items inside the iOS instructions dialog (verbatim from `InstallIosSheet.svelte`) |
| `pwa.install.ios.shareIconAlt`           | The `aria-label` on the inline Share-icon SVG inside the iOS dialog                     |
| `pwa.install.ios.dismiss`                | The iOS dialog's close button label                                                     |
| `pwa.install.iosOther.hint`              | The `ios-other` branch's "open in Safari to install" hint text                          |

**Rationale**:

- Both new keys denote *Settings-page* concepts (a section heading +
  a status line) that the existing transient banner / sheet does not
  surface. The "reuse first, add only when no existing key fits"
  rule from feature 010's plan §R8 is honoured: every other string
  the new section needs already exists.
- The `settings.install.heading` key is short enough to fit in the
  Settings sheet's existing `<h3 class="section-heading">` style (~13
  CSS characters in the longest locale, vs the 28-character
  `pwa.install.android.title`).
- The `settings.install.alreadyInstalled` key is genuinely new
  semantic content — feature 005 deliberately *hid* the
  banner in the installed state rather than affirming it. Settings
  needs the affirmation because the section is always-visible
  (modulo the `unsupported` / `ios-other` branches).

**Alternatives considered**:

- **Reuse `pwa.install.android.title` as the heading** — too long,
  and Android-specific phrasing on the iOS / desktop branches.
  Rejected.
- **Inline English fallback strings in the component** — would
  violate the i18n contract from ADR 0009 and feature 002. Rejected.
- **Add separate per-platform headings** (`settings.install.heading.android`,
  `settings.install.heading.ios`, …) — over-engineering. The same
  heading works for every branch because the section's *contents*
  carry the platform-specific information. Rejected.

## R6 — The 30-day banner-dismissal-vs-settings-entry split: shared or separate state?

**Decision**: Introduce a new derived store
`installSettingsSurface` in
`src/pwa/installSettingsSurface.ts` that returns the *un-suppressed*
install surface (the platform detector's output, plus the
`installed` / `standalone` gates, but without the 30-day banner
dismissal gate). The transient `InstallBanner.svelte` and
`InstallIosSheet.svelte` keep using the existing
`installSignal.surface` (which still respects the dismissal). Only
the new Settings section subscribes to `installSettingsSurface`.

```ts
// src/pwa/installSettingsSurface.ts
import { derived, type Readable } from 'svelte/store';
import { installSignal } from './installSignal';
import { detectInstallSurface } from './installPlatform';
import type { InstallSurface } from './installPlatform';

export type SettingsInstallSurface =
  | 'android-chromium'
  | 'desktop-chromium'
  | 'ios-safari'
  | 'ios-other'
  | 'standalone'
  | 'unsupported';

export const installSettingsSurface: Readable<SettingsInstallSurface> = derived(
  installSignal,
  ($s) => {
    if ($s.installed) return 'standalone';
    // Re-derive base surface (without the dismissal gate) using the
    // current probe — same probe shape as installSignal but with
    // hasDeferredPrompt = (deferredPrompt !== null).
    const base = detectInstallSurface({
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      standalone:
        typeof navigator !== 'undefined'
          ? ((navigator as Navigator & { standalone?: boolean }).standalone ?? undefined)
          : undefined,
      standaloneDisplayMode:
        typeof window !== 'undefined' && typeof window.matchMedia === 'function'
          ? window.matchMedia('(display-mode: standalone)').matches
          : false,
      hasDeferredPrompt: $s.deferredPrompt !== null,
    });
    if (base === 'standalone') return 'standalone';
    if (base === 'hidden') return 'unsupported'; // unreachable — detector never returns 'hidden'
    return base;
  },
);
```

**Rationale**:

- Spec FR-015 explicitly requires the Settings entry to *bypass* the
  30-day dismissal — the user said "stop popping at me", not "make
  install permanently inaccessible". So the section cannot simply
  consume `installSignal.surface` (which the dismissal would
  flatten to `'hidden'`).
- Spec FR-013 requires the section to render the "App is already
  installed" status when the app is installed. Today's
  `installSignal.surface` collapses both "user dismissed" and
  "installed" into the single `'hidden'` literal — so the section
  cannot tell them apart from `surface` alone. The derived store
  reads `installSignal.installed` directly to recover the
  distinction.
- A derived store is the cleanest shape: it adds zero new persisted
  state, zero new event listeners, zero new lifecycle code. It
  re-evaluates whenever `installSignal` changes, which is the only
  time its value can change.
- The transient banner / sheet is *intentionally* gated by the
  30-day dismissal — that is its discoverability surface, and the
  spec deliberately preserves it. Splitting the two consumers
  (transient on `installSignal`, Settings on
  `installSettingsSurface`) is the correct dual-surface design.

**Alternatives considered**:

- **Add a new `installSignal.settingsSurface` field** — would mutate
  feature 005's contract (ADR 0025). Rejected as a scope intrusion;
  derivation in a sibling module keeps feature 005's surface frozen.
- **Mutate the dismissal storage when the user opens Settings** —
  would silently violate the user's "stop popping at me" choice
  with respect to *other* surfaces (a future feature might add a
  `display: top` banner). Rejected.
- **Compute the surface ad-hoc inside the Settings component** —
  would scatter platform-detection knowledge across two places (the
  module + the component) instead of one. Rejected as
  maintainability erosion.

## R7 — iOS-Safari branch: inline expand-in-place vs separate dialog?

**Decision**: Tapping the Settings install button on iOS Safari opens
a separate `role="dialog"` overlay containing the same three steps
the existing `InstallIosSheet.svelte` shows today (Share icon → Add
to Home Screen → Add). The dialog reuses the
`pwa.install.ios.{title,step1,step2,step3,shareIconAlt,dismiss}`
strings. The dialog is implemented as a sibling component
`<InstallIosInstructions>` (or as an inline `{#if showIosInstructions}`
block inside `SettingsSheet.svelte`, depending on whether the
authoring agent decides extraction is worth the file split — both
shapes satisfy the spec).

**Rationale**:

- The user typed `安裝此 App 按鈕` — "an install-this-app *button*",
  one button per surface. Inlining the three instruction steps under
  a permanently-visible heading would conflict with that phrasing
  (the "button" disappears into prose). Opening a dialog from the
  button preserves "tap a button → see the install path".
- The instructional content is identical to the existing
  `InstallIosSheet.svelte` body. Reusing it as a dialog avoids
  diverging copy.
- A dialog is the same accessibility shape as the existing iOS
  sheet (`role="dialog"`, `aria-modal="true"`, explicit close
  button); no new a11y patterns are introduced.

**Alternatives considered**:

- **Inline the three steps under the section heading on iOS Safari**
  — friendlier on first read but contradicts the spec's "button"
  phrasing and balloons the section's vertical footprint.
  Rejected.
- **Reuse `InstallIosSheet.svelte` directly by toggling its
  visibility from the Settings button** — would couple the auto-
  banner-suppression-state of the iOS sheet to the Settings
  trigger, which the dual-surface design explicitly disallows.
  Rejected; a dedicated dialog (or a snippet sub-component) is
  cleaner.

## R8 — Settings install section's placement inside the sheet

**Decision**: The new install section sits at the **top** of the
Settings sheet, immediately after the licence notice and before the
existing cache-list section. Order in the sheet:

1. Title (`<h2>`)
2. Licence notice
3. **Install app section (NEW)**
4. Cache list (existing)
5. Quota line (existing)
6. Cache controls (TTL, max entries) (existing)
7. "Clear all" footer (existing)

**Rationale**:

- Putting it at the top makes the install action discoverable on
  first open of Settings without scrolling. The cache list and
  quota information is reference-grade content (read mostly when
  troubleshooting cache size); the install action is goal-grade
  content (read when the user wants to install).
- The section is hidden in the `unsupported` branch (FR-014), so
  putting it at the top costs no vertical space on desktop Firefox /
  desktop Safari users.
- The licence notice retains its position because it is contractual
  text that must be visible without scroll on every Settings open
  (per the project's documented licence-display practice).

**Alternatives considered**:

- **Put it at the bottom of the sheet** — buries the section under
  the "clear all" danger button, making the on-demand install path
  less discoverable on a notched phone where the bottom is partially
  reserved by the home indicator. Rejected.
- **Put it next to the close button as a toolbar action** — would
  conflict with the close button's `position: absolute` offset and
  wouldn't have room for a status line in the standalone branch.
  Rejected.

## R9 — How to verify safe-area in jsdom integration tests

**Decision**: Use a synthetic `<style>` element injected into the
test's `document.head` to override `--*-zone-*` tokens to non-zero
values, then read `getBoundingClientRect()` on each surface and
assert the rect clears the corresponding viewport edge by at least
the stubbed inset amount.

```ts
// tests/integration/safe-area-layout.spec.ts (sketch)
beforeEach(() => {
  const style = document.createElement('style');
  style.id = 'safe-area-stub';
  style.textContent = `
    :root {
      --top-stack-zone-top: 47px;
      --bottom-stack-zone-bottom: 34px;
      --inline-stack-zone-left: 16px;
      --inline-stack-zone-right: 16px;
    }
  `;
  document.head.appendChild(style);
});
afterEach(() => {
  document.getElementById('safe-area-stub')?.remove();
});
```

**Rationale**:

- jsdom does not implement `env(safe-area-inset-*)` — the variable
  resolves to its `0px` fallback in every test environment. To
  exercise the non-zero path we have to override the token *value*
  (which is the layer that uses `env()` internally) with a literal.
- The override is per-test (mounted in `beforeEach`, removed in
  `afterEach`), so different specs can stub different inset values
  without cross-contamination.
- `getBoundingClientRect()` is what feature 009's
  `notification-region.spec.ts` already uses for its no-overlap
  assertions; this spec is the same shape with different anchor
  rectangles.
- The Playwright e2e spec (`safe-area-install.e2e.spec.ts`) covers
  the *real* inset values that the engine reports under the iPhone
  14 / Pixel 7 emulation profiles — that closes the gap between the
  jsdom stub and the production engine.

**Alternatives considered**:

- **Patch jsdom to support `env(safe-area-inset-*)`** — out of scope;
  jsdom doesn't expose this hook and a fork is unmaintainable.
  Rejected.
- **Skip the integration spec; rely only on Playwright** — slower
  inner loop and harder to TDD against on a developer machine.
  Rejected for the same reason feature 009 §R6 chose two-tier
  testing.

## Open questions

None. All `NEEDS CLARIFICATION` items have been resolved by the
research above and recorded as decisions in this file or in the
Constitution Check table of `plan.md`.
