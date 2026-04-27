# ADR 0025 — PWA install surfaces & dismissal-key design

**Status**: Accepted
**Date**: 2026-04-26
**Feature**: `specs/005-pwa-installable/`

## Context

Features 001–004 shipped an installable PWA: the manifest, icons,
service worker, runtime tile cache, controlled update prompt, and the
dev-mode manifest middleware. Chromium fires `beforeinstallprompt` in
production preview, and the manifest passes installability checks.
But the app surfaced **no in-product offer** to install, and iOS
Safari operators had no localised guidance about the Share →
Add-to-Home-Screen gesture. Five design questions were entangled in
that gap:

1. **How does the app present an install offer across three
   platforms** (Android / desktop Chromium with `beforeinstallprompt`,
   iOS Safari with no programmatic install API, and iOS
   Chrome / Firefox / Edge with no install path at all)?
2. **Where in the viewport does each surface anchor** without
   colliding with the existing toolbar (top-right), update-prompt
   (top-center), toast column (top-center, ~32 px below header),
   coordinate readout (bottom-left), attribution badge
   (bottom-right), or layer / locale pickers (top-right popovers)?
3. **How is dismissal persisted**, and for how long, without touching
   the additive `pwa_map:prefs` blob (ADR 0021) or any of the four
   feature-001..004 keys?
4. **What detection rules** distinguish the three install paths
   reliably across browsers and standalone mode?
5. **What is the minimum viable test discipline** for verifying the
   install flow without depending on Chromium's installability
   heuristics (which require a 30 s engagement timer + first-visit
   gate and so are too non-deterministic for CI)?

## Decision

### A. Three render surfaces, one source of truth

Three platform-distinct surfaces share one Svelte writable
(`src/pwa/installSignal.ts`) whose `surface` field is the single
discriminant for rendering:

| Surface              | Component                | Renders                                                        |
| -------------------- | ------------------------ | -------------------------------------------------------------- |
| `'android-chromium'` | `InstallBanner.svelte`   | bottom-right banner with **Install** + **Not now**             |
| `'desktop-chromium'` | `InstallBanner.svelte`   | (identical DOM)                                                |
| `'ios-safari'`       | `InstallIosSheet.svelte` | bottom-center sheet with three steps + share-icon + **Got it** |
| `'ios-other'`        | `InstallIosSheet.svelte` | bottom-center read-only "Open in Safari" hint + **Got it**     |
| `'standalone'`       | (none — render nothing)  | DOM-absent (FR-011)                                            |
| `'hidden'`           | (none — render nothing)  | DOM-absent (dismissal / install-driven)                        |
| `'unsupported'`      | (none — render nothing)  | DOM-absent (Firefox desktop, in-app browsers)                  |

The two non-rendering surfaces (`'standalone'` and `'hidden'`) are
kept distinct so tests can assert provenance — `'standalone'` is
platform-driven (the user already installed) and `'hidden'` is
dismissal- or install-driven.

### B. Detection priority (`src/pwa/installPlatform.ts`)

A pure function `detectInstallSurface(probe: PlatformProbe):
InstallSurface` reads only the four-field `PlatformProbe`
(`{ userAgent, standalone, standaloneDisplayMode, hasDeferredPrompt }`)
and returns one of seven literals. Priority — first match wins:

1. `standalone === true || standaloneDisplayMode === true` →
   `'standalone'`. Wins over **every** other rule (FR-011).
2. `/iPhone|iPad|iPod/.test(ua)` AND NOT
   `/CriOS|FxiOS|EdgiOS/.test(ua)` → `'ios-safari'`.
3. `/iPhone|iPad|iPod/.test(ua)` AND
   `/CriOS|FxiOS|EdgiOS/.test(ua)` → `'ios-other'`.
4. `/Android/.test(ua)` AND `hasDeferredPrompt` →
   `'android-chromium'`.
5. `hasDeferredPrompt` (and not Android) → `'desktop-chromium'`.
6. else → `'unsupported'`.

The function is total, pure, and trivially unit-testable (13 cases).
It is the **only** place where UA parsing happens — no consumer
(component, store action, App.svelte) re-reads `navigator`.

### C. Dismissal key — `pwa_map:installDismissedUntil`

A new localStorage key, **separate from** `pwa_map:prefs`,
`pwa_map:lastView`, `pwa_map:gotoHistory_v1`, and
`pwa_map:offlineReadyShown`. Value: a string-ified positive integer
epoch millisecond at which the affordance MAY re-appear. Default
window: `30 * 24 * 60 * 60 * 1000` (30 days), encoded once as
`DISMISSAL_WINDOW_MS` in `src/storage/installDismissed.ts`.

Reader (`getDismissedUntil`) is corruption-tolerant:

- Absent / non-integer / non-positive / past-timestamp → `null`
- localStorage throwing (private mode / SSR / quota) → `null`
- The reader does NOT mutate localStorage in any rejection branch —
  cleanup happens implicitly on the next writer call or via
  site-data clear.

Writer (`setDismissedUntil`) coerces fractional inputs via
`Math.floor`, rejects non-finite / non-positive, and silently
swallows storage errors.

### D. Layout anchors

| Surface                  | Anchor                                                                                                                                     |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `InstallBanner` (banner) | `position: fixed; bottom: calc(var(--space-4) + var(--space-6)); right: var(--space-4);` (above the attribution badge by `var(--space-6)`) |
| `InstallIosSheet`        | `position: fixed; bottom: var(--space-4); left: 50%; transform: translateX(-50%);` (bottom-center card)                                    |

Both at `z-index: 6` — deliberately BELOW the bottom-center toast
column (z-index 50). Toast surfaces are transient (≤ 5 s); the
banner / sheet are persistent until dismissed. On the rare overlap
the toast wins by z-index, which is acceptable since both clear
quickly. The `UpdatePrompt` is also at z-index 6 but anchors
top-center, so the three persistent cards never collide.

### E. Test-only synthetic-event window hook (research D7)

Real `beforeinstallprompt` events depend on Chromium's installability
heuristic (engagement timer + first-visit gate + manifest hygiene),
which is too non-deterministic for CI. Mirroring the feature-004
`triggerUpdateAvailable` pattern, `App.svelte` exposes
`window.__pwaTestHooks.triggerBeforeInstallPrompt(opts?)` and
`window.__pwaTestHooks.triggerAppInstalled()` gated by
`import.meta.env.DEV || import.meta.env.MODE === 'test'`. The hook
constructs a minimal mock event whose `prompt()` is a no-op and
whose `userChoice` resolves with `{ outcome: 'accepted' | 'dismissed',
platform: 'web' }`. The Vitest integration tests and the Playwright
E2E spec drive the install flow through this hook; the real
Chromium heuristic path is verified by manual smoke per SC-002.

## Consequences

- The install affordance is **invisible** under every documented
  suppression scenario (`'standalone'`, `'hidden'`, `'unsupported'`)
  because the components key off `surface` via `{#if}` blocks. No
  CSS `display: none` — DOM absence is the contract.
- The dismissal record is **separate from** `pwa_map:prefs`, so ADR
  0021's additive-evolution invariant is unaffected. Site-data clear
  re-arms; rolling back this feature leaves the new key as harmless
  garbage.
- Detection lives in **one** pure function. Future surfaces (e.g.,
  Trusted Web Activity, Samsung Internet's specific heuristic) MUST
  extend the `InstallSurface` union by adding a new literal — never
  by reinterpreting an existing one. Existing unit tests MUST
  continue to pass.
- The bottom-right banner overlaps the visual zone of the attribution
  badge by design (research D5) — it offsets upward by
  `var(--space-6)` to clear the badge while keeping a coherent
  "small persistent corner widget" feel.
- iOS users now have a localised three-step instructional sheet with
  a share-icon hint, AND the iOS-Other (CriOS / FxiOS / EdgiOS)
  variant tells the operator to switch to Safari rather than fake an
  Install button that does nothing.
- Reduced-motion compliance is preserved: the entry animation is a
  single CSS keyframe gated by `@media (prefers-reduced-motion:
reduce) { animation: none !important; }`.
- The new `BeforeInstallPromptEvent` ambient interface lives inside
  `src/pwa/installSignal.ts` (re-exported from there). No global
  `declare global` block is added — every consumer imports the type
  from the store.

## Alternatives considered

- **Feature-detection-based iOS classification**
  (`'BeforeInstallPromptEvent' in window`) — rejected. Safari does
  not implement `BeforeInstallPromptEvent` at all, so the type-check
  cannot distinguish "iOS Safari (instructional path needed)" from
  "iOS Chrome (no path possible)". UA-string matching is the only
  cross-browser baseline.
- **Multi-record dismissal blob** (per-surface windows in one JSON
  object) — rejected. The spec treats Android dismissal and iOS
  dismissal symmetrically; a single timestamp suffices.
- **Storing dismissal in `pwa_map:prefs`** — rejected. Each new
  field in that blob requires a schema bump (ADR 0021); a separate
  single-purpose key avoids touching the prefs contract entirely.
- **Top-center anchor for both surfaces** — rejected. Would stack
  with the existing UpdatePrompt and the four bottom-center toasts;
  forces stacking discipline. Bottom anchors create visual separation
  between "ephemeral notifications" (top) and "persistent offers"
  (bottom).
- **Three ADRs (one per surface)** — rejected. The surface variants
  are an implementation detail of one design (one detector + one
  store + multiple render paths). Splitting forces cross-ADR
  references for every reader.
- **Real Chromium-driven E2E** (using
  `--enable-features=PreinstalledPwa` + artificial engagement
  signals) — rejected. Flaky across Chromium versions and the
  feature flag changes name regularly. The synthetic event path
  (research D7) verifies the app-side wiring; the real heuristic
  path is manual-smoke territory per SC-002.
