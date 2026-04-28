# Phase 1 Data Model — Safe-Area Compliance and Settings-Page Install Button

**Feature**: 011-safe-area-install-buttons
**Date**: 2026-04-28
**Plan**: [plan.md](./plan.md)

This feature is layout-and-rendering-only on the safe-area side and
view-only-over-existing-state on the install side. It persists
nothing new, sends nothing over the wire, and introduces no
client-side schema migration. The "data" the design relies on is
therefore not application state — it is (a) the small set of CSS
custom properties (design tokens) that govern safe-area composition
and (b) the in-memory derived store that exposes the un-suppressed
install surface to the new Settings section. Both are captured here
so the contracts and the tests have a single authoritative
reference.

## Persisted state

**None added.** No `localStorage` key is created, read, written, or
removed by this feature. The dismissal-timestamp key owned by feature
005 (`pwa_map:installDismissedUntil`) remains untouched and continues
to govern the *transient* `InstallBanner.svelte` /
`InstallIosSheet.svelte` only; the new Settings section deliberately
ignores it (research.md §R6, FR-015). The preferences key
`pwa_map:prefs` (feature 010, `version: 3`) is unchanged — no
v3 → v4 migration.

## In-memory entities

### SafeAreaZoneTokens

A small set of CSS custom properties declared in `src/app/tokens.css`,
forming the single source of truth for "how far in from the system
edge does the app paint".

| Token                         | Default value                              | Purpose                                                                                       |
| ----------------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------- |
| `--top-stack-zone-top`        | `env(safe-area-inset-top, 0px)`            | Shared top-edge safe-area component. Composed with each top-anchored surface's own offset.    |
| `--bottom-stack-zone-bottom`  | `env(safe-area-inset-bottom, 0px)`         | Shared bottom-edge safe-area component. Composed with each bottom-anchored surface's offset.  |
| `--inline-stack-zone-left`    | `env(safe-area-inset-left, 0px)`           | Shared left-edge safe-area component (iPhone landscape with side notch).                       |
| `--inline-stack-zone-right`   | `env(safe-area-inset-right, 0px)`          | Shared right-edge safe-area component (iPhone landscape with side notch).                      |
| `--notification-zone-top`     | `calc(var(--space-4) + var(--top-stack-zone-top))` | Existing token from feature 009 — refactored to delegate the safe-area component to the new shared token (FR-007). |
| `--notification-zone-bottom`  | `calc(var(--readout-clearance) + var(--bottom-stack-zone-bottom))` | Existing token from feature 009 — same refactor (FR-007).                                       |

**Invariants**:

- Each shared safe-area token (`--top-stack-zone-top`,
  `--bottom-stack-zone-bottom`, `--inline-stack-zone-left`,
  `--inline-stack-zone-right`) MUST resolve to exactly the
  corresponding `env(safe-area-inset-*)` value with a `0px` fallback.
  Any other shape (e.g. a hard-coded `47px`, an `@supports` gate
  that swaps the value) MUST cause the safe-area-tokens spec to
  fail (FR-006).
- Per-surface offsets MUST be expressed as
  `calc(<existing-spacing-token-or-literal> + var(--<axis>-stack-zone-<edge>))`
  — never as a separate per-surface `env(safe-area-inset-*)` literal.
  This invariant is enforced by a grep guard in the safe-area-tokens
  spec that scans every `*.svelte` and `*.css` file for the
  forbidden patterns `env(safe-area-inset` outside `tokens.css`.
- The existing `--notification-zone-*` tokens MUST be refactored to
  delegate to the new shared tokens (FR-007). The post-refactor
  resolved values MUST equal the pre-refactor resolved values within
  1 CSS pixel on every test viewport — i.e. the refactor is
  layout-equivalent.
- With every safe-area inset stubbed to `0px`, every surface's
  rendered position MUST equal its pre-feature position within 1
  CSS pixel (SC-004). This invariant is enforced by the
  `safe-area-layout.spec.ts` baseline assertion.

**State transitions**: none. This entity is static — the tokens are
declared once at parse time and re-evaluated by the browser only when
the engine-reported safe-area insets change (e.g. device rotation),
which is the native CSS `env(...)` behaviour and out of this entity's
control.

### PerSurfaceSafeAreaOffset

A static, per-component CSS rule that composes one or more
`SafeAreaZoneTokens` with the component's own `--space-*` literals to
produce its `top` / `bottom` / `left` / `right` offset. Not a
runtime entity — captured here for the contract spec.

| Surface                              | Edge   | Pre-feature value                  | Post-feature value                                                                       |
| ------------------------------------ | ------ | ---------------------------------- | ---------------------------------------------------------------------------------------- |
| `.toolbar` (App.svelte)              | top    | `var(--space-3, 12px)`             | `calc(var(--space-3) + var(--top-stack-zone-top))`                                       |
| `.toolbar` (App.svelte)              | right  | `var(--space-3, 12px)`             | `calc(var(--space-3) + var(--inline-stack-zone-right))`                                  |
| `.map-controls` (App.svelte)         | bottom | `calc(var(--space-4) + var(--space-6))` | `calc(var(--space-4) + var(--space-6) + var(--bottom-stack-zone-bottom))`               |
| `.map-controls` (App.svelte)         | right  | `var(--space-4, 16px)`             | `calc(var(--space-4) + var(--inline-stack-zone-right))`                                  |
| `.readout` (CoordinateReadout.svelte) | bottom | (existing literal — verified at impl) | `calc(<existing-literal> + var(--bottom-stack-zone-bottom))`                          |
| `.attribution` (AttributionBar.svelte) | bottom | (existing literal — verified at impl) | `calc(<existing-literal> + var(--bottom-stack-zone-bottom))`                         |
| `.install-banner` (InstallBanner.svelte) | bottom | `calc(var(--space-4, 16px) + var(--space-6, 24px))` (per ADR 0025) | `calc(var(--space-4) + var(--space-6) + var(--bottom-stack-zone-bottom))`            |
| `.install-banner` (InstallBanner.svelte) | right | `var(--space-4, 16px)`             | `calc(var(--space-4) + var(--inline-stack-zone-right))`                                  |
| `.install-ios-sheet` (InstallIosSheet.svelte) | bottom | `var(--space-4, 16px)`        | `calc(var(--space-4) + var(--bottom-stack-zone-bottom))`                                 |
| `.sheet` (SettingsSheet.svelte)      | top    | `50%` + `transform: translate(-50%, -50%)` (visually centred) | `max(var(--space-4), var(--top-stack-zone-top))` (see research.md §R4)             |
| `.sheet` (SettingsSheet.svelte)      | bottom | (implicit; centred via transform) | `max(var(--space-4), var(--bottom-stack-zone-bottom))` (see research.md §R4)             |
| `.sheet` (SettingsSheet.svelte)      | left   | `50%` + `transform: translate(-50%, -50%)` | `max(var(--space-4), var(--inline-stack-zone-left))` (see research.md §R4)              |
| `.sheet` (SettingsSheet.svelte)      | right  | (implicit; centred via transform)  | `max(var(--space-4), var(--inline-stack-zone-right))` (see research.md §R4)              |

**Invariants**:

- For each `(Surface, Edge)` row, the post-feature value MUST be
  derivable as the pre-feature value PLUS the corresponding
  `--*-stack-zone-*` token (with the exception of `.sheet`, which
  switches centring strategy per research.md §R4).
- No surface MUST consume `env(safe-area-inset-*)` directly outside
  `tokens.css`.
- Every surface's rendered position with all insets at `0px` MUST
  equal its pre-feature position within 1 CSS pixel (SC-004).

### SettingsInstallSurface

A new derived store exported from `src/pwa/installSettingsSurface.ts`.
Returns the *un-suppressed* install surface for the new Settings
section, so the section can render the right branch independently of
the 30-day banner-dismissal gate.

| Field    | Type                                                                                                 | Notes                                                                                                                                                              |
| -------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| (value)  | `'android-chromium' \| 'desktop-chromium' \| 'ios-safari' \| 'ios-other' \| 'standalone' \| 'unsupported'` | Derived synchronously from `installSignal` whenever it changes. Six literals, one fewer than `InstallSurface` (the `'hidden'` literal is intentionally absent). |

**Invariants** (all asserted in `install-settings-surface.spec.ts`):

| #   | Invariant                                                                                                                       |
| --- | ------------------------------------------------------------------------------------------------------------------------------- |
| S1  | If `installSignal.installed === true`, the derived value MUST be `'standalone'` regardless of any other field (FR-013).         |
| S2  | If `window.matchMedia('(display-mode: standalone)').matches === true`, the derived value MUST be `'standalone'` (FR-013).       |
| S3  | If neither standalone gate fires AND `navigator.userAgent` matches the iOS device regex AND is non-Safari (CriOS / FxiOS / EdgiOS), the derived value MUST be `'ios-other'` (FR-012).             |
| S4  | If neither standalone gate fires AND `navigator.userAgent` matches the iOS device regex AND is Safari, the derived value MUST be `'ios-safari'` (FR-011).                                          |
| S5  | If neither standalone gate fires AND `navigator.userAgent` matches Android AND `installSignal.deferredPrompt !== null`, the derived value MUST be `'android-chromium'` (FR-010).                  |
| S6  | If none of the above AND `installSignal.deferredPrompt !== null`, the derived value MUST be `'desktop-chromium'` (FR-010).                                                                          |
| S7  | If none of the above, the derived value MUST be `'unsupported'` (FR-014).                                                                                                                          |
| S8  | The derived value MUST NOT depend on `installSignal.dismissedUntil` — i.e. setting `dismissedUntil` to a future timestamp MUST NOT change the derived value (FR-015).                              |
| S9  | The derived value MUST update synchronously whenever `installSignal` changes (Svelte's `derived(...)` semantics — covered by Vitest fake timers in the spec).                                       |

**State transitions**: none owned by this entity. The transitions are
those of `installSignal` (feature 005 / ADR 0025); this entity is a
pure read-only projection.

### SettingsInstallSection

A new `<section>` block inside `SettingsSheet.svelte`. Its DOM
contents are derived from `SettingsInstallSurface`'s value and from
`installSignal.deferredPrompt` (for the disabled-while-in-flight
guard).

Per-surface render contract (matches FR-009..FR-018):

| `SettingsInstallSurface` | Section visible | Heading | Primary action | Body |
| ------------------------ | --------------- | ------- | -------------- | ---- |
| `'android-chromium'`     | yes             | `tStore('settings.install.heading')` | Button labelled `tStore('pwa.install.android.confirm')`; on click → `await triggerInstall()` (FR-010, FR-017) | (none) |
| `'desktop-chromium'`     | yes             | (same) | (same as android-chromium)                                                       | (none) |
| `'ios-safari'`           | yes             | (same) | Button labelled `tStore('pwa.install.ios.title')`; on click → opens the iOS instructions dialog (FR-011) | (none — the dialog body lives in the dialog overlay, not the section body) |
| `'ios-other'`            | yes             | (same) | (none — no actionable button)                                                    | `tStore('pwa.install.iosOther.hint')` (FR-012)                                                            |
| `'standalone'`           | yes             | (same) | (none)                                                                           | `tStore('settings.install.alreadyInstalled')` (FR-013)                                                    |
| `'unsupported'`          | NO              | (none — the entire section is unrendered via `{#if}`, not `display: none`) (FR-014) | (n/a)                                       | (n/a)                                                                                                     |

**Invariants** (all asserted in `settings-install-section.spec.ts`):

| #   | Invariant                                                                                                                                                                       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | The section is rendered IF AND ONLY IF `SettingsInstallSurface` is one of the five visible literals (everything except `'unsupported'`) (FR-014).                              |
| C2  | The Chromium branches' button is `disabled` while `installSignal.deferredPrompt === null` AND while a `triggerInstall()` call is in flight (FR-017).                           |
| C3  | After a successful install (the OS fires `appinstalled` while the section is mounted), the section MUST update reactively to the `'standalone'` branch's "already installed" status without requiring the sheet to be closed and reopened (FR-018). |
| C4  | The iOS-Safari branch's instructional dialog MUST be re-openable any number of times — clicking the section's primary action while the dialog is closed MUST always re-open it (FR-011).         |
| C5  | The 30-day banner-dismissal window MUST NOT suppress this section (FR-015) — verified by setting `installSignal.dismissedUntil` to a future timestamp and asserting the section still renders. |
| C6  | Every visible string in the section MUST resolve to a non-empty value in every locale catalogue (`zh`, `en`, `ja`) — no untranslated key, no hard-coded English fallback (FR-016 / SC-011).      |

**State transitions** (per Settings sheet open):

```text
hidden            (sheet closed)
   ↓ (sheet open + SettingsInstallSurface = 'unsupported')
hidden            (section unrendered)
   ↓ (SettingsInstallSurface flips to a visible literal — e.g. captureBeforeInstallPrompt fires)
visible / idle    (button enabled, no prompt in flight)
   ↓ (user taps Chromium primary action)
visible / in-flight (button disabled; triggerInstall() awaiting userChoice)
   ↓ (userChoice resolves accepted + appinstalled fires → markInstalled())
visible / installed (the section now reads SettingsInstallSurface = 'standalone'; renders "already installed" status)
   ↑ (userChoice resolves dismissed → recordDismissal()) — back to visible / idle (button re-enabled because deferredPrompt is now null but a fresh capture in the same session re-arms it; until then the button is disabled per C2)
```

The iOS-Safari branch has its own substate:

```text
visible / idle
   ↓ (user taps primary action)
visible / dialog-open (instructions dialog rendered)
   ↓ (user taps dialog close OR Escape OR scrim — feature 005's pattern)
visible / idle (and re-openable per C4)
```

## Out of scope (explicit non-data-model)

- The persistence contract for `InstallBanner` dismissal (owned by
  feature 005 / ADR 0025) — not changed, not duplicated here.
- The `InstallSurface` enum itself (owned by feature 005's
  `installPlatform.ts`) — reused verbatim as the *input* to the
  derived store; not extended.
- `installSignal`'s public surface (capture / trigger / dismiss /
  markInstalled actions) — reused verbatim; not extended.
- The Settings sheet's existing cache-list / quota / TTL / max-entries
  / clear-all sections — not changed.
- The `prefs.version` constant or the `pwa_map:prefs` schema — not
  touched. No v3 → v4 migration.
- Any new map / coordinate format / Go To dialog change — none.
