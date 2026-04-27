# Phase 0 Research: Offline-First PWA + Update Prompt + UI Polish

**Feature**: `004-offline-pwa-polish` | **Date**: 2026-04-26
**Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md)

This document resolves every "NEEDS CLARIFICATION" implied by the plan
into concrete decisions. Decisions are numbered D1..D11 and are
referenced by ID from `data-model.md`, the `contracts/` files, and
`tasks.md`.

---

## D1. Service-worker registration strategy: `'prompt'` (not `'autoUpdate'`)

**Decision**: Switch `vite-plugin-pwa`'s `registerType` from
`'autoUpdate'` to `'prompt'`. Continue to set `injectRegister: false`
and call `registerSW(...)` from `src/pwa/registerSW.ts` ourselves so
we own the lifecycle.

**Rationale**: `'autoUpdate'` calls `skipWaiting` automatically, which
swaps the SW silently and forces a reload on next navigation — exactly
the behaviour US2 / FR-007 / FR-008 / FR-009 forbid. `'prompt'` keeps
the new SW in `waiting` state until `updateSW(true)` is called from
JS, which lets us surface a UI prompt and only swap on operator
confirmation. The `virtual:pwa-register` module accepts both
`onNeedRefresh()` and `onOfflineReady()` callbacks under `'prompt'`
and returns an `updateSW(reloadPage?: boolean): Promise<void>`
function that we call from the prompt's "Update now" button. This is
the shape vite-plugin-pwa explicitly documents for "prompt for user
update".

**Alternatives considered**:

- `'autoUpdate'` with a post-update toast (no pre-update prompt) —
  rejected because the user has already lost in-flight state by the
  time they see the toast (the new version is already loaded). Fails
  FR-008.
- Keep `'autoUpdate'` and detect `controllerchange` to show a
  warning — rejected because by the time `controllerchange` fires the
  new SW is already controlling the page, and FR-009's "do not reload
  during the postpone window" is no longer enforceable.
- A custom service worker (no Workbox) — rejected; would require
  re-implementing precache, runtime caching, and lifecycle that
  Workbox already gives us correctly.

---

## D2. Dev-mode manifest fix via a single-purpose Vite middleware

**Decision**: Add a tiny dev-only Vite middleware in `vite.config.ts`
that responds to `GET /manifest.webmanifest` with the same manifest
object passed to `VitePWA(...)`, serialised as JSON. Keep
`devOptions.enabled: false` so the SW does NOT run in dev. The
production build is unchanged — Workbox writes
`dist/manifest.webmanifest` from the same source object as it does
today.

**Implementation sketch** (encoded as a returnable Vite plugin):

```ts
function devManifestPlugin(manifest: object) {
  return {
    name: 'pwa-map:dev-manifest',
    apply: 'serve' as const,
    configureServer(server) {
      server.middlewares.use('/manifest.webmanifest', (req, res, next) => {
        if (req.method !== 'GET') return next();
        res.setHeader('Content-Type', 'application/manifest+json');
        res.end(JSON.stringify(manifest));
      });
    },
  };
}
```

The `manifest` object is hoisted to a `const` so both
`VitePWA({ manifest })` and `devManifestPlugin(manifest)` share the
same source of truth.

**Rationale**:

- Single source of truth — no `public/manifest.webmanifest` fixture
  to drift from the in-config object (which would re-introduce the
  bug a different way).
- Fixes only the manifest endpoint — leaves `devOptions.enabled` at
  `false`, so tests, HMR, and dev tooling that rely on no SW being
  installed during development are unaffected (FR-020).
- ~12 lines, no new dep.

**Alternatives considered**:

- `devOptions: { enabled: true, type: 'module' }` — registers a real
  SW in dev. Breaks Vitest test runs (the SW caches the test runner
  HTML), and Playwright's `setOffline()` behaves differently when a
  real SW is installed. Rejected.
- A static `public/manifest.webmanifest` fixture — works, but
  duplicates the manifest JSON in two places. Rejected for drift
  risk.
- Just dismissing the console error as harmless — rejected; SC-006
  + FR-017 require zero entries.

---

## D3. Update-prompt postpone window: 30 minutes per session, in-memory only

**Decision**: When the operator taps "Later", set
`postponedUntil = Date.now() + 30 * 60 * 1000` on the in-memory
`UpdatePromptState` writable. While `Date.now() < postponedUntil`,
the prompt stays hidden. The state is **not persisted** — closing the
tab clears it; on the next page load the prompt re-evaluates the SW
state and re-fires if a `waiting` SW is still present.

**Rationale**:

- FR-009 requires the prompt to re-appear on next session start,
  which is exactly what "in-memory + read SW state on load" gives.
- 30 min is the assumption from the spec (no field-task-duration
  data); short enough that a once-per-30-min nag does not strand the
  user on a stale version, long enough that a short field task (10–
  20 min) finishes uninterrupted.
- Persisting the postpone time would create a false-positive case:
  user dismisses on tab A, opens tab B 5 min later → tab B should
  see the prompt (it is a fresh session for that tab), but a
  persisted timer would suppress it. In-memory avoids this.

**Alternatives considered**:

- Persist `postponedUntil` to localStorage — rejected (false-positive
  cross-tab suppression above).
- 5 / 10 / 60 / 120 min postpone — 30 min is the documented spec
  default; numeric values away from this require evidence that
  10 min is too aggressive or 60 min too lax. Hold on 30 unless
  field data later argues otherwise.
- Show no postpone, only "Update" — rejected; FR-008 mandates two
  distinct actions.

---

## D4. Offline-ready toast: persistent flag `pwa_map:offlineReadyShown`

**Decision**: SC-008 requires the toast to fire **exactly once per
install lifetime**. Use a separate boolean key in localStorage —
`pwa_map:offlineReadyShown` — set to `'1'` the first time
`onOfflineReady()` fires AND the toast has been displayed. Subsequent
sessions read the flag; if set, the toast is suppressed. Resetting
localStorage (e.g., uninstalling the PWA, clearing site data) re-arms
the toast — that matches "per install lifetime" semantics.

**Rationale**:

- Keeping the flag separate from `pwa_map:prefs` means we do not
  touch ADR 0021's additive-evolution invariant on the prefs blob.
- Single boolean, no schema, no validator. Stored as the literal
  string `'1'` (presence ≡ true) for forward-compatible parsing.
- "Per install lifetime" is the only sensible semantics — repeating
  the toast every session would train the operator to dismiss it,
  defeating the purpose.

**Alternatives considered**:

- Add `offlineReadyShown` to `pwa_map:prefs` — rejected; dirties an
  unrelated schema and forces a defaults-helper change for a
  one-bit flag.
- Use IndexedDB — rejected; overkill for a boolean.
- Show the toast every session — rejected (UX nag).

---

## D5. Attribution colour tokens: opaque dual-token pair, both schemes

**Decision**: Add to `src/app/tokens.css`:

```css
/* Light theme */
:root {
  --attribution-bg: rgba(255, 255, 255, 0.95);  /* was 0.82 — bumped for contrast against bright tiles */
  --attribution-fg: #0f172a;                    /* slate-900 */
}

/* Dark theme */
@media (prefers-color-scheme: dark) {
  :root {
    --attribution-bg: rgba(15, 23, 42, 0.92);   /* slate-900 @ 92 % */
    --attribution-fg: #f1f5f9;                  /* slate-100 */
  }
}
```

Computed contrast (text vs. badge background, ignoring underlying
tile because alpha ≥ 0.9):

- Light: `#0f172a` on `#fffffff4` ≈ **15.8 : 1** ✅ (≥ 4.5)
- Dark: `#f1f5f9` on `#0f172aeb` ≈ **15.5 : 1** ✅ (≥ 4.5)

Update `AttributionBar.svelte` to use these two tokens instead of
`var(--color-fg)` + a hardcoded RGBA literal.

**Rationale**:

- Two new dedicated tokens (not reusing `--color-fg` /
  `--color-surface`) keeps the badge's contrast guarantee independent
  from any future shift in the global text/surface tokens.
- Bumping background opacity from 0.82 → 0.92–0.95 means the badge
  contrast holds against its own background, not against the tile
  beneath (FR-014). At 0.92 dark-mode opacity, even a fully white
  underlying tile shifts perceived background luminance only ~8 %,
  keeping computed contrast > 13 : 1 (well above 4.5).
- WCAG AA for body text at 12 px requires ≥ 4.5 : 1; both schemes
  exceed by 3×.

**Alternatives considered**:

- `backdrop-filter: blur(8px)` for a frosted look — rejected;
  Safari/iOS support is patchy and the visual goal is "readable", not
  "fancy".
- Drop opacity entirely (solid colour) — visually heavier; the
  current 0.82 had a usability rationale (don't mask the map). 0.95
  preserves that intent.
- Reuse `--readout-bg` / `--readout-fg` tokens — those tokens are
  already overloaded by CoordinateReadout's much larger surface.
  Coupling them creates a maintenance hazard.

---

## D6. UpdatePrompt component: toast with two buttons, role="status"

**Decision**: New `src/components/UpdatePrompt.svelte`. Renders only
when `$updateSignal.visible === true`. Anchors to the top-center of
the viewport (so it does not overlap the bottom-right attribution
badge or the bottom-center transient toasts from features 002 / 003).
Two `<button>` elements — primary "Update now" (`--color-accent`),
secondary "Later" (transparent + border). `role="status"
aria-live="polite"` so screen readers announce it without stealing
focus. Closes on Escape (via `<svelte:window>` keydown listener
matching the existing pattern).

**Anchor choice — top-center vs. existing bottom-center toasts**:
- The four existing transient toasts (zone-hint, copy-toast,
  layer-fail-toast, offline-ready) all use bottom-center.
- The update prompt is *not* transient (it stays until the operator
  acts), so it needs its own visual lane to avoid stacking with
  bottom-center transient toasts.
- Top-center is the natural second slot — already used by Chrome's
  PWA install prompt and most browser update prompts, so the visual
  metaphor is familiar.

**Rationale**:

- Reuses existing `.toast` token / shadow / radius for visual
  consistency with the bottom-center transient toasts.
- Buttons are real `<button>` elements (not roles on divs) — meets
  Principle III + the standing tap-target ≥ 36 × 36 px rule.
- `role="status"` + `aria-live="polite"` reuses the pattern from
  ADR 0022's tile-failure toast, so screen-reader behaviour is
  familiar to operators of features 002 / 003.

**Alternatives considered**:

- Modal dialog (focus-stealing) — rejected; FR-007 says
  *non-blocking*.
- Persistent banner pinned to the toolbar — rejected; the toolbar is
  already four buttons wide and a fifth surface would crowd it.

---

## D7. E2E update flow: deterministic test-only `needRefresh` hook

**Decision**: Real SW update lifecycle (deploy build A, replace
`sw.js`, wait for natural `waiting`) is too slow + flaky for E2E.
Instead, expose a test-only window hook
`window.__pwaTestHooks.triggerUpdateAvailable()` that calls the
`updateSignal.fireNeedRefresh()` action directly — same code path as
the real `onNeedRefresh` callback. The Playwright spec calls this
hook to assert the prompt appears within 10 s and the buttons work
correctly.

**Real SW lifecycle is still tested** — in unit tests for
`updateSignal.ts` (mock `useRegisterSW` / `registerSW` with vitest's
`vi.mock`). The split is: unit verifies the wiring; E2E verifies the
UI behaviour given the wiring fires.

**Rationale**:

- Playwright's `evaluate()` cannot reliably trigger a SW update
  cycle in `page.goto()` time budgets — it requires modifying the SW
  bundle on disk between visits, which conflicts with vite-plugin-pwa's
  hashed filenames.
- The test-only hook is gated behind `import.meta.env.DEV` AND
  `import.meta.env.MODE === 'test'` so it cannot ship to prod.
- Same pattern as the existing `__mapTestHooks` in `App.svelte`.

**Alternatives considered**:

- Skipping E2E for the update flow — rejected; SC-002 needs an E2E
  to be credible.
- Replacing `sw.js` mid-Playwright run — rejected; flaky and slow.

---

## D8. Offline E2E: `page.context().setOffline(true)` + reload

**Decision**: Standard Playwright pattern. After the first navigation
(which warms the precache + tile runtime cache), call
`page.context().setOffline(true)` and `page.reload()`. Assert: app
shell loaded, controller initialised, MapView has at least one tile
DOM element, attribution bar text visible. Run with the OSM basemap
only (the simplest tile origin to assert fully).

**Rationale**: This is the canonical Playwright + Workbox offline
test. Works deterministically because the first navigation
populates the runtime cache via SWR before `setOffline(true)` is
called.

**Alternatives considered**:

- DevTools Protocol `Network.emulateNetworkConditions` —
  unnecessarily lower-level; `setOffline` wraps it.
- Service-worker-only mock without real network swap — rejected; not
  representative of the actual offline path.

---

## D9. Multi-tab update coordination: rely on the SW lifecycle, no extra wiring

**Decision**: When tab A confirms the update (calls `updateSW(true)`),
the SW broadcasts `controllerchange` to all clients. Tab B's
`registerSW` registration receives `onNeedRefresh` because the new SW
went `waiting` first, then `activated` after skipWaiting. Tab B's
`onNeedRefresh` is already wired to surface the prompt — so tab B
either:

- Already has the prompt visible (because the SW reached `waiting`
  before tab A confirmed) → tab B's prompt is now stale (the SW has
  already activated). Tap "Later" → no-op since `controllerchange`
  fired. Tap "Update now" → `reload()` succeeds without a second
  skipWaiting.
- Has not yet received the `waiting` event → will receive it shortly
  and show the prompt within the 10 s budget (SC-002).

Therefore: no extra coordination logic is required. The
non-broken-during-update guarantee in the spec edge-cases section is
satisfied because Workbox's atomic activation + the resulting tab-B
reload-on-confirm path handles every transition.

**Rationale**:

- Adding a `BroadcastChannel` to coordinate multi-tab dismissal
  introduces complexity for a near-zero-probability edge case (most
  field operators run a single tab).
- `controllerchange` + `skipWaiting` already gives the right
  behaviour without extra code.

**Alternatives considered**:

- BroadcastChannel + cross-tab dismissal — rejected as premature
  complexity. Re-evaluate if field reports show multi-tab confusion.

---

## D10. Manifest source-of-truth: keep the existing `manifest` object inline in `vite.config.ts`

**Decision**: Hoist the existing `VitePWA({ manifest: { ... } })`
object to a top-level `const manifest = { ... } as const`. Pass it to
both `VitePWA({ manifest })` and the new `devManifestPlugin(manifest)`.
No new file, no new fixture.

**Rationale**:

- The manifest shape is small (~ 20 lines). Externalising it (e.g.,
  to `public/manifest.webmanifest` or `src/pwa/manifest.ts`) would
  fragment the source of truth for marginal benefit.
- Hoisting to a `const` at the top of `vite.config.ts` keeps it
  visible alongside the PWA plugin config it drives.

**Alternatives considered**:

- Extract to `src/pwa/manifest.ts` and import — viable but adds an
  import. Hoist-in-place is simpler.
- Keep manifest inline only on `VitePWA`, duplicate in the dev
  middleware — rejected for drift risk.

---

## D11. Tests-before-implementation order — explicit test-first task slots

**Decision**: For each of the four user stories, the corresponding
unit / integration / E2E tests MUST appear in `tasks.md` *before* the
implementation tasks they validate. This mirrors features 002 / 003.
Concretely:

- US1 (offline): T-tests `tests/e2e/story-4-offline-and-update.spec.ts
  :: offline reload` lands first; passes only after the SW
  registration changes.
- US2 (update prompt): T-tests for `updateSignal.spec.ts` +
  `update-prompt.spec.ts` land first; pass after `UpdatePrompt.svelte`
  + `registerSW.ts` are wired.
- US3 (contrast): T-test for `AttributionBar.spec.ts` (assert
  computed background alpha + text colour pair) lands first; passes
  after tokens are added.
- US4 (manifest): T-test for the dev middleware (HTTP `GET
  /manifest.webmanifest` returns valid JSON) lands first; passes
  after the middleware is registered.

**Rationale**: Constitution Principle II is non-negotiable. Putting
the test slot before the implementation slot in `tasks.md` is the
mechanical way to keep an LLM-driven implementer honest.

**Alternatives considered**: None — this is just bookkeeping.

---

## Summary — decisions resolved

All 11 decisions resolved; no NEEDS CLARIFICATION remain. Phase 1
(`data-model.md`, `contracts/`, `quickstart.md`) can proceed.
