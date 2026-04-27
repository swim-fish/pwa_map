# ADR 0023 — Service-worker registration strategy: `autoUpdate` → `prompt`

**Status**: Accepted
**Date**: 2026-04-26
**Feature**: `specs/004-offline-pwa-polish/`

## Context

Feature 003 shipped vite-plugin-pwa with `registerType: 'autoUpdate'`.
That strategy calls `skipWaiting` automatically the moment a new
service-worker version reaches `waiting`, which means:

- The SW silently swaps mid-task on the operator.
- On next navigation the page is force-reloaded — any in-flight Go-To
  input, transient toast state, or unsaved selection is lost.
- There is no operator-visible signal that an update happened.

Feature 004 user-story US2 explicitly requires a non-blocking prompt
with **Update now** / **Later** actions, plus a 30-min postpone window.
Those guarantees are incompatible with `'autoUpdate'`'s silent swap.

## Decision

Switch `vite-plugin-pwa`'s `registerType` from `'autoUpdate'` to
`'prompt'`. Keep `injectRegister: false` and continue calling
`registerSW(...)` from `src/pwa/registerSW.ts` ourselves so we own the
lifecycle.

The `'prompt'` strategy keeps the new SW in `waiting` state until JS
calls `updateSW(true)`. We wire the resulting `onNeedRefresh` callback
into a Svelte writable (`updateSignal` in `src/pwa/updateSignal.ts`),
which `UpdatePrompt.svelte` subscribes to. Tapping **Update now** in
that toast invokes `updateSW(true)` (which triggers `skipWaiting` +
reload); tapping **Later** sets `postponedUntil = Date.now() + 30 min`
on the same store, hiding the prompt without touching the SW.

The store also exposes `onOfflineReady` via a separate
`offlineReadySignal` so the one-shot "available offline" toast can
coexist independently.

## Consequences

- The operator can finish a task before absorbing a UI change.
- All persisted state survives the controlled reload because
  `localStorage` keys are unaffected (ADR 0021 additive-evolution
  invariant unchanged; the only new key is the standalone
  `pwa_map:offlineReadyShown`).
- Multi-tab coordination relies on the SW lifecycle itself
  (`controllerchange` + atomic activation) rather than a custom
  `BroadcastChannel` — a near-zero-probability edge case for field
  operators who run a single tab.

## Alternatives considered

- **`'autoUpdate'` + post-update toast** — by the time the toast fires
  the new version is already loaded; in-flight state is already lost.
  Fails FR-008.
- **Detect `controllerchange` and warn** — once `controllerchange`
  fires the new SW is already controlling the page; FR-009's "do not
  reload during the postpone window" is no longer enforceable.
- **Custom service worker (no Workbox)** — would re-implement precache,
  runtime caching, and lifecycle that Workbox already provides
  correctly.
