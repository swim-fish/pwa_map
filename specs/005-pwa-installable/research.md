# Phase 0 Research: PWA Install Affordance for Android & iOS

**Feature**: `005-pwa-installable` | **Date**: 2026-04-26
**Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md)

This document resolves every "NEEDS CLARIFICATION" implied by the plan
into concrete decisions. Decisions are numbered D1..D11 and are
referenced by ID from `data-model.md`, the `contracts/` files, and
`tasks.md`.

---

## D1. Capture `beforeinstallprompt` once on `window`, defer the prompt

**Decision**: Register a single `window.addEventListener('beforeinstallprompt', …)`
listener as part of the application bootstrap (inside `App.svelte`'s
`onMount`, before any user interaction). The handler MUST call
`event.preventDefault()` and stash the event reference into the
`installSignal` store via `captureBeforeInstallPrompt(event)`. The
handler MUST also re-arm itself idempotently — if the event fires a
second time within the same session (e.g., the user navigates back
after dismissing the native sheet), the most recent reference wins.

**Rationale**: Chromium fires `beforeinstallprompt` exactly once per
qualifying load if installability heuristics pass. Without
`preventDefault()`, Chromium auto-dismisses the event and invalidates
the captured `prompt()` method — so the in-app banner's "Install"
button would no longer be able to surface the native sheet (browsers
emit a console warning and ignore the call). Capturing the event into
a Svelte store decouples the listener (early bootstrap) from the
button click (later user gesture), which is exactly the contract
`prompt()` requires: it MUST be called from a user-gesture-rooted
event loop turn, not from the original `beforeinstallprompt` handler.

**Alternatives considered**:

- Register the listener inside `InstallBanner.svelte`'s `onMount`
  instead of `App.svelte` — rejected because the banner is rendered
  conditionally (only when surface === 'android-chromium'), and the
  surface decision depends on having captured the event. Listening
  inside the banner creates a cyclic activation order that drops the
  first event.
- Use `vite-plugin-pwa`'s built-in install helpers — rejected because
  the plugin's `virtual:pwa-register` module is concerned with SW
  lifecycle (`onNeedRefresh`, `onOfflineReady`), not the install
  prompt. There is no native install hook in `vite-plugin-pwa`.
- Capture into a module-level `let` rather than a Svelte store —
  rejected because reactive UI state (the surface variant decision)
  needs to re-evaluate when the event fires; a non-reactive let
  would force a manual force-update after capture.

---

## D2. Single source of truth: a Svelte writable mirroring `updateSignal`

**Decision**: Introduce `src/pwa/installSignal.ts` exposing a Svelte
`Readable<InstallPromptState>` plus named action functions
(`captureBeforeInstallPrompt`, `triggerInstall`, `recordDismissal`,
`markInstalled`, `__resetForTests`). The shape of `InstallPromptState`:

```ts
interface InstallPromptState {
  readonly surface:
    | 'android-chromium'
    | 'ios-safari'
    | 'ios-other'
    | 'desktop-chromium'
    | 'unsupported'
    | 'standalone'
    | 'hidden';
  readonly deferredPrompt: BeforeInstallPromptEvent | null;
  readonly dismissedUntil: number | null;
  readonly installed: boolean;
}
```

All UI ("which surface, if any, do I render?") derives from this one
store. The store is initialised eagerly on import via a small bootstrap
function that (a) reads `pwa_map:installDismissedUntil`, (b) runs the
`installPlatform` detector against the current `navigator` /
`matchMedia`, and (c) seeds `surface` to one of the enumerated
literals. `surface === 'standalone'` and `surface === 'hidden'` BOTH
mean "render nothing"; the difference is provenance only (standalone
is platform-driven, hidden is dismissal-driven) — kept distinct so
tests can assert the cause.

**Rationale**: Mirroring the feature-004 `updateSignal.ts` shape keeps
the codebase coherent — both signals are transient, both expose a
`Readable` plus named actions, both have a `__resetForTests` escape
hatch, both store the same kind of in-memory + minimal-localStorage
mix. A reviewer who has internalised `updateSignal` immediately
understands `installSignal`. Diverging would create cognitive load with
no upside.

**Alternatives considered**:

- A custom `class InstallController` instead of a Svelte writable —
  rejected because the rest of the app (App.svelte, components)
  consumes signals via `$store` autosubscribe; a class would force a
  manual subscription wrapper.
- Splitting into two stores ("platform store" + "dismissal store")
  and combining via `derived(...)` — rejected because the platform
  detection result and the dismissal record are not independent: every
  consumer needs both, so the indirection of `derived(...)` only adds
  fan-out without any reuse benefit.
- Encoding the surface variant on the components themselves (each
  component subscribes to platform + dismissal independently and
  decides whether to render) — rejected because it's the same logic
  duplicated twice and risks drift.

---

## D3. Platform detection is a pure function

**Decision**: `src/pwa/installPlatform.ts` exports a single pure
function `detectInstallSurface(input: PlatformProbe): InstallSurface`
where `PlatformProbe` is `{ userAgent: string; standalone: boolean
| undefined; standaloneDisplayMode: boolean; hasDeferredPrompt:
boolean }`. The function performs no side effects and reads no
globals — every input is passed in. `installSignal.ts` is the sole
caller and is responsible for gathering the inputs from `navigator`,
`matchMedia`, and the captured event.

**Detection rules** (in priority order — first match wins):

1. `standalone === true || standaloneDisplayMode === true` →
   `'standalone'`.
2. UA matches `/iPhone|iPad|iPod/` AND UA does NOT match
   `/CriOS|FxiOS|EdgiOS/` → `'ios-safari'`.
3. UA matches `/iPhone|iPad|iPod/` AND UA matches
   `/CriOS|FxiOS|EdgiOS/` → `'ios-other'`.
4. UA matches `/Android/` AND `hasDeferredPrompt === true` →
   `'android-chromium'`.
5. `hasDeferredPrompt === true` (and not Android) →
   `'desktop-chromium'`.
6. Anything else → `'unsupported'`.

**Rationale**: Pure-function detectors are trivially unit-testable —
the spec lists ~6 distinct UA / standalone / event combinations, and
each becomes a direct `expect(detectInstallSurface({...})).toBe(...)`
assertion. Side-effecting detectors that read `navigator` directly
require global stubs in every test, which compound mock fragility.

The priority order matters: standalone wins over everything (FR-011 —
standalone MUST suppress the affordance even on iOS), iOS-specific
matches win over Android because some iOS browsers append "Android"-
like substrings via their UA spoofing settings, and the
`hasDeferredPrompt` gate distinguishes the desktop-chromium case from
"Firefox desktop" (no event ever fires) without needing to enumerate
Firefox UAs.

**Alternatives considered**:

- Check `'BeforeInstallPromptEvent' in window` (feature detection
  instead of UA-based) — rejected for **iOS Safari specifically**
  because Safari does not implement the type at all; no feature check
  can distinguish "iOS Safari (instructional path needed)" from "iOS
  Chrome (no path possible)". The instructional decision MUST be UA-
  driven.
- Use the Client Hints API (`navigator.userAgentData`) — rejected
  because Chrome on iOS does NOT expose it (WebKit shim), Safari
  doesn't expose it, and Firefox blocks it. UA-string matching is the
  least-bad cross-browser baseline.
- A single regex over the UA string — rejected; the spec needs to
  distinguish three iOS sub-cases (Safari vs Chrome / Firefox / Edge
  on iOS vs in-app browsers) and an Android-Chromium-vs-other split.
  Five small named tests are clearer than one mega-regex.

---

## D4. Dismissal persistence: one localStorage key, integer epoch ms

**Decision**: Add `src/storage/installDismissed.ts` exposing
`getDismissedUntil(): number | null` and
`setDismissedUntil(timestampMs: number): void`. The persistent key is
`pwa_map:installDismissedUntil` (literal). The value is the
`String(timestampMs)` representation of the epoch-millisecond moment
at which the affordance MAY re-appear.

The reader MUST be corruption-tolerant per the same pattern as
`offlineReady.ts`:

- Absent key → `null` (treat as never dismissed).
- Non-numeric value (`'true'`, `'{"foo": 1}'`, empty string) → `null`.
- Numeric but `≤ 0` or `NaN` → `null`.
- Numeric but **already in the past** (`Date.now() >= parsed`) →
  `null` (treat as never dismissed; the dismissal expired).
- localStorage throws (private mode / quota / SSR) → `null` for read,
  silent no-op for write.

The default dismissal window is **30 days** (per spec FR-012) and is
encoded as a single named export `DISMISSAL_WINDOW_MS = 30 * 24 * 60
* 60 * 1000` so tests can read it without re-deriving the magic
number.

**Rationale**: One key, one shape, one parser — the simplest possible
schema that meets the spec. Storing as a string-ified number rather
than JSON keeps the parser one `Number()` call and avoids the
corruption surface area JSON parsing would add. Treating "past
timestamp" as `null` at read time means the 30-day window
auto-re-arms without any cleanup task — there is no cron, no startup
purge, no test for "stale entry".

**Alternatives considered**:

- A single key holding a JSON object with multiple dismissal records
  (per surface) — rejected; the spec treats Android dismissal and iOS
  dismissal symmetrically (both share the same 30-day window), so a
  single timestamp suffices. A multi-record blob would also collide
  with ADR 0021's "additive evolution" principle for richer schemas.
- Storing dismissal in `pwa_map:prefs` — rejected because that blob
  is gated by ADR 0021 (each new field requires a schema bump and a
  fallback). A separate single-purpose key avoids touching the prefs
  contract entirely (same reasoning as feature 004's
  `pwa_map:offlineReadyShown`).
- Persisting the deferred event itself — impossible:
  `BeforeInstallPromptEvent` is non-serialisable and is invalidated
  the moment the page unloads. The captured event is in-memory only.

---

## D5. Banner anchor: bottom-right; iOS sheet: bottom-center modal-style

**Decision**: The Android / desktop-chromium banner anchors to the
**bottom-right** corner of the viewport (`bottom: var(--space-4);
right: var(--space-4);`) with a max-width clamp identical to the
existing UpdatePrompt (`max-width: min(420px, calc(100vw - 32px))`).
The iOS instructional sheet anchors to the **bottom of the viewport
with horizontal centering** as a card-style sheet (`bottom:
var(--space-4); left: 50%; transform: translateX(-50%);` with the
same max-width clamp), one viewport-row above the standard toast
column. Both surfaces use `position: fixed`, `z-index: 6` (one above
the toast layer, one below any future modal dialogs).

**Conflict map** (existing surfaces from features 001–004):

| Surface                         | Anchor                            | Owner       |
| ------------------------------- | --------------------------------- | ----------- |
| Toolbar                         | top-right                         | feature 003 |
| `UpdatePrompt`                  | top-center                        | feature 004 |
| Toast column (copy/zone/layer/offline-ready) | top-center, ~32 px below header   | features 001–004 |
| Coordinate readout              | bottom-left                       | feature 001 |
| Attribution badge               | bottom-right (single-line)        | feature 003 |
| Layer / Locale picker (popover) | top-right (toolbar-anchored)      | feature 003 |
| Crosshair                       | viewport center                   | feature 001 |
| **InstallBanner** (NEW)         | **bottom-right (above attribution)** | feature 005 |
| **InstallIosSheet** (NEW)       | **bottom-center**                 | feature 005 |

The Android banner is offset upward by `calc(var(--attribution-height,
24px) + var(--space-3, 12px))` to clear the attribution badge in the
bottom-right. The iOS sheet does NOT collide with the bottom-center
toast column because the sheet is mutually exclusive with toasts —
toast surfaces only render after a user action (copy / layer-fail /
zone-hint), and US3 / FR-011 already suppresses the sheet under
standalone mode. In the rare overlap window (toast fires while the
iOS sheet is up), the toast layer's z-index of 50 wins, which is
acceptable since both are transient.

**Rationale**: The existing top-center toast column is already
crowded; adding a fourth top-anchored surface would make the
UpdatePrompt + offline-ready stack visually unwieldy on phone-width
viewports. Splitting Install affordances to bottom anchors creates
visual separation between "ephemeral notifications" (top) and
"persistent offers" (bottom). The Android banner picks bottom-right
specifically so it visually clusters with the attribution badge it
overlaps — the user already looks bottom-right for "what map data am
I seeing?", and the install offer joining that visual zone reads as
"a small persistent corner widget" rather than an alert.

**Alternatives considered**:

- Both surfaces on the bottom-center — rejected; collides with the
  existing toast column and forces stacking logic.
- Both on the top — rejected; collides with UpdatePrompt and forces
  a vertical stack discipline.
- Right-edge slide-in panel (full-height) — rejected; too heavy for
  a "tap to install" affordance, and competes with a future side-
  panel feature.

---

## D6. Reduced-motion: skip slide-in, use opacity-only fade

**Decision**: Both `InstallBanner.svelte` and `InstallIosSheet.svelte`
implement enter / exit transitions via Svelte's
`transition:fly|local={{ y: 16, duration: 180 }}` for the default
case. A `@media (prefers-reduced-motion: reduce)` block in each
component's `<style>` overrides `transform` and `transition` to
`none`, so the surface appears in place without translation — only
the implicit Svelte mount/unmount happens. No `fade` is required;
absence of motion is the contract (FR-019).

**Rationale**: Svelte transitions add ~120 bytes gzipped per
component, well under the 4 KB SC-007 budget. Replacing them with a
custom CSS class would not save measurable bytes. A pure CSS override
under the prefers-reduced-motion media query is the established
pattern from `App.svelte`'s existing toast styles and keeps the
mental model consistent.

**Alternatives considered**:

- A Svelte transition function that internally checks reduced-motion
  — rejected; Svelte's `fly` does not currently expose a
  motion-skipping mode, so the override has to live in CSS anyway.
- Skipping transitions entirely (no animation at all) — rejected
  because a 180 ms fly-in is part of how feature 003's toolbar pickers
  feel; the install affordance reusing that motion vocabulary is
  Principle III consistency.

---

## D7. Test-only synthetic `beforeinstallprompt` window hook

**Decision**: Reuse the feature-004 pattern: gated behind
`import.meta.env.DEV || import.meta.env.MODE === 'test'`, expose
`window.__pwaTestHooks.triggerBeforeInstallPrompt(opts?: { outcome?:
'accepted' | 'dismissed' })`. The hook constructs a minimal mock
event:

```ts
const evt = new Event('beforeinstallprompt') as unknown as BeforeInstallPromptEvent;
evt.prompt = vi.fn(async () => undefined);
evt.userChoice = Promise.resolve({ outcome: opts?.outcome ?? 'accepted', platform: 'web' });
window.dispatchEvent(evt);
```

The hook also exposes
`triggerAppInstalled()` for the post-accept lifecycle.

**Rationale**: Real Chromium-issued `beforeinstallprompt` events
require the page to satisfy installability heuristics — manifest +
SW + icons + 30-second user engagement timer + first-visit gate.
None of these are reliably reproducible in CI. The synthetic event
verifies that the **app's listener wiring, store updates, button
handlers, and DOM rendering** all behave correctly given a
well-formed event; the actual Chromium heuristic path is verified by
manual smoke per SC-002. This is the same trade-off feature 004 made
for `needRefresh`.

**Alternatives considered**:

- Drive Playwright with `--enable-features=PreinstalledPwa` and
  artificial engagement signals — rejected; flaky across Chromium
  versions and the feature flag changes name regularly.
- Skip integration tests entirely and rely on unit + manual smoke —
  rejected because it leaves the listener-to-UI wiring uncovered
  exactly where regressions are most likely.
- Mock `window.addEventListener` — rejected; too invasive, breaks the
  Svelte component contract that owns its own listeners.

---

## D8. iOS Safari Share-icon hint: inline SVG, not asset import

**Decision**: The iOS sheet renders the Share-icon hint as an inline
SVG component in `InstallIosSheet.svelte` — the canonical iOS Share
glyph (a square with an upward arrow). The SVG path is the standard
SF-Symbols-shape rendition (not Apple's licensed glyph; an
independent reproduction of the open shape). The icon receives an
`aria-label` keyed off `pwa.install.ios.shareIconAlt` for screen
readers. Size: 20 × 20 px nominal, scaled inline; tap-target
inheritance is irrelevant because the icon is purely informational
and not interactive.

**Rationale**: Inline SVG keeps the icon under 200 bytes and avoids
adding a dependency (`@iconify/svelte`, etc.) or an asset bundle
entry that would drag a Workbox cache rule. The Share glyph is a
geometric shape (rectangle + arrow), not a copyrighted artwork — the
inline path is a clean-room reproduction of the open shape, not a
copy of Apple's specific stylisation.

**Alternatives considered**:

- A photo / screenshot of the actual iOS Share button — rejected;
  even the most permissive interpretation of iOS UI screenshots in
  third-party docs is legally murky, and the screenshot would need
  re-shooting on every iOS UI revision.
- A Unicode arrow character (`⬆`) — rejected; renders inconsistently
  across system fonts and conveys the wrong shape on Android-
  rendered fallback (the iOS sheet might be screenshotted by
  contributors on Android during dev).
- Apple's SF Symbols asset (licensed) — rejected; Apple's terms
  forbid embedding SF Symbols in non-Apple-platform UI.

---

## D9. Bundle-size gate: extend the existing CI script

**Decision**: `scripts/check-bundle-size.js` is already wired into CI
(introduced by feature 003 / 004 budget tracking). For SC-007,
extend its config (or its expectation file) to assert that the
gzipped main-bundle delta from the feature-004 baseline is ≤ 4 KB.
The implementation slot in `tasks.md` Phase 4 amends the script's
threshold; no new tooling is added.

**Rationale**: One source of truth for bundle gates. Adding a
parallel script for "feature-005 delta only" would fragment the
verification flow and force reviewers to inspect two reports.

**Alternatives considered**:

- A new `scripts/check-feature-005-delta.js` — rejected; duplicates
  build infrastructure with no reuse benefit.
- Drop the gate and rely on PR review — rejected; SC-007 is
  measurable by definition and Constitution Principle IV mandates
  the gate.

---

## D10. ADR layout: one ADR covers all of feature 005

**Decision**: Author a single ADR — `docs/adr/0025-pwa-install-surfaces.md`
— covering: (a) the three-surface design (Android banner / iOS
sheet / read-only iOS-other hint), (b) the localStorage key
`pwa_map:installDismissedUntil` and its 30-day default, (c) the
viewport anchor decisions from D5, and (d) the priority of detection
rules from D3. ADR index updated in the same commit.

**Rationale**: All four sub-decisions share one underlying problem
("how does the app surface installability?"), and the implementation
fans out from one detector + one store. Splitting across multiple
ADRs would force cross-ADR references for every reader. Feature 004
landed two ADRs because the SW registration strategy and the dev-
manifest middleware were genuinely independent design problems
(different files, different lifecycles, different rollback paths) —
that asymmetry does not exist here.

**Alternatives considered**:

- Three ADRs (one per surface variant) — rejected; the surface
  variants are an implementation detail of one design (one detector +
  one store + multiple render paths).
- An ADR per concrete decision (5 ADRs for D1–D10's design topics) —
  rejected; ADRs that small become stub records that no one reads.

---

## D11. TDD ordering reaffirmation

**Decision**: Constitution Principle II (Test-First Development —
NON-NEGOTIABLE) is restated explicitly because feature 005 introduces
test-only window hooks (D7) that could be misread as "the test
hook is the test". The TDD discipline is:

1. Write the unit / integration spec for the behaviour.
2. Run `npm test` and confirm the spec is **RED** (it must fail
   because the behaviour is not yet implemented).
3. Implement only enough production code to turn the spec green.
4. Refactor with the test green.

The test-only `triggerBeforeInstallPrompt` window hook is a **fixture
that the spec uses**, not the spec itself — analogous to how feature
004's `triggerUpdateAvailable` hook drives the `needRefresh` E2E test
without itself being a test. Tasks in `tasks.md` Phase 3+ enforce
this ordering by writing the spec slot **before** the implementation
slot for every behaviour.

**Rationale**: The window-hook pattern is unfamiliar enough to invite
"test the hook" anti-patterns. Codifying the discipline in the
research record and the task ordering is the cheapest preventive
measure.

**Alternatives considered**: None. TDD is non-negotiable per
constitution.

---

## Cross-decision matrix

| ID  | Affects                                                                     |
| --- | --------------------------------------------------------------------------- |
| D1  | `installSignal.ts`, `App.svelte`, `contracts/install-signal.md`             |
| D2  | `installSignal.ts`, all integration tests                                   |
| D3  | `installPlatform.ts`, all unit tests                                        |
| D4  | `installDismissed.ts`, `installSignal.ts`, suppression integration test     |
| D5  | `InstallBanner.svelte`, `InstallIosSheet.svelte`, `docs/ui/0005-*.md`       |
| D6  | both new components, `docs/ui/0005-*.md`                                    |
| D7  | `App.svelte` (test hook block), all integration + E2E tests                 |
| D8  | `InstallIosSheet.svelte`, i18n keys (`pwa.install.ios.shareIconAlt`)        |
| D9  | `scripts/check-bundle-size.js` (config update only)                         |
| D10 | `docs/adr/0025-pwa-install-surfaces.md`, `docs/adr/README.md`               |
| D11 | `tasks.md` ordering                                                         |
