# Phase 1 Data Model: Offline-First PWA + Update Prompt + UI Polish

**Feature**: `004-offline-pwa-polish` | **Date**: 2026-04-26
**Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md)
**Research**: [research.md](./research.md)

This document inventories every entity introduced or extended by
feature 004 and shows how they relate. Most data is transient
in-memory state — only one new persistent flag is added, and no
existing persisted shape is modified.

---

## 1. UpdatePromptState (transient, in-memory)

A Svelte writable that drives the new `UpdatePrompt.svelte` toast.

```ts
// src/pwa/updateSignal.ts
export interface UpdatePromptState {
  /** True when an update is available AND the postpone window is not active. */
  readonly visible: boolean;
  /** Epoch ms; the prompt stays hidden until Date.now() ≥ postponedUntil. */
  readonly postponedUntil: number | null;
  /** Bound at registration; calling it triggers skipWaiting + reload. */
  readonly confirmUpdate: (() => Promise<void>) | null;
}
```

**Module shape**:

```ts
import { writable, type Readable } from 'svelte/store';

const state = writable<UpdatePromptState>({
  visible: false,
  postponedUntil: null,
  confirmUpdate: null,
});

export const updateSignal: Readable<UpdatePromptState> = { subscribe: state.subscribe };

export function fireNeedRefresh(confirm: () => Promise<void>): void;
export function postpone(now?: number): void;             // sets postponedUntil = now + 30 min
export function confirm(): Promise<void>;                 // calls confirmUpdate(), then no-ops
export function dismissForTesting(): void;                // test-only reset
```

**State transitions**:

```text
initial → fireNeedRefresh()      → visible:true,  postponedUntil:null
visible → postpone()             → visible:false, postponedUntil:now+30m
hidden  → (Date.now() ≥ postponedUntil)
        → next call to fireNeedRefresh re-shows the prompt
visible → confirm()              → no transition; page reloads, store dies with the page
```

**Invariants**:

- `visible === true` ⇒ `confirmUpdate !== null`.
- `postponedUntil !== null` ⇒ `visible === false`.
- The store is **never persisted**. Resets on page load.

**Persistence**: none.

---

## 2. OfflineReadyShownFlag (persisted, single-key)

A separate localStorage key dedicated to suppressing the
"available offline" toast after the first show.

```ts
// src/storage/offlineReady.ts (NEW, ~ 10 lines)
const KEY = 'pwa_map:offlineReadyShown';

export function hasShownOfflineReady(): boolean;          // reads storage[KEY] === '1'
export function markOfflineReadyShown(): void;            // sets storage[KEY] = '1'
```

**Persistence**: `localStorage[pwa_map:offlineReadyShown] = '1'` after
first show. Absence ≡ unshown.

**Validation**: none — string `'1'` only. Any other value (including
JSON, accidental dirties) MUST be treated as "absent" so a corrupted
state simply re-shows the toast once and self-heals.

**Invariants**:

- The flag is set **before** the toast is dismissed (i.e., if the user
  immediately closes the tab during the 5 s display window, the flag
  is still set and the toast does NOT re-show next session).

**Lifecycle**:

- Read on app startup; if absent AND `onOfflineReady()` fires →
  display toast for 5 s AND immediately set flag.
- Cleared by browser site-data-clear / PWA uninstall — re-arms.

---

## 3. AttributionTokenPair (CSS, defined in `tokens.css`)

```css
:root {
  --attribution-bg: rgba(255, 255, 255, 0.95);
  --attribution-fg: #0f172a;
}
@media (prefers-color-scheme: dark) {
  :root {
    --attribution-bg: rgba(15, 23, 42, 0.92);
    --attribution-fg: #f1f5f9;
  }
}
```

**Validation rules** (asserted by tests):

- Computed contrast ratio between `--attribution-fg` and the visible
  portion of `--attribution-bg` (treating it as if rendered over both
  pure white and pure black tile underlays) MUST be ≥ 4.5:1 in **both**
  schemes.
- Background opacity MUST be ≥ 0.90 so underlying tile colour cannot
  shift the badge contrast below 4.5:1 (FR-014).
- Foreground colour MUST NOT use `var(--color-fg)` directly (otherwise
  the dark-mode regression returns).

**State transitions**: none (static design tokens).

---

## 4. UpdatePromptComponent (new Svelte component)

```ts
// src/components/UpdatePrompt.svelte (props)
type Props = Record<string, never>;  // no props — reads from updateSignal store
type Events = Record<string, never>; // no events — fires confirm/postpone via store actions
```

**Lifecycle**:

- Mounted unconditionally inside `App.svelte`.
- Only renders DOM when `$updateSignal.visible === true`.
- Listens to Escape via `<svelte:window on:keydown>` — Escape ≡ Later.
- Buttons:
  - Primary "Update now" → `updateSignal.confirm()` (which calls
    `confirmUpdate()`; the page reloads).
  - Secondary "Later" → `updateSignal.postpone()`.

**ARIA / a11y**:

- Outer `role="status" aria-live="polite"`.
- Buttons are real `<button type="button">` with localised labels.
- Tap targets ≥ 36 × 36 px.

---

## 5. DevManifestMiddleware (build-config artefact)

```ts
// vite.config.ts (inlined)
type DevManifestPlugin = (manifest: object) => Plugin;
```

**Behaviour**:

- Active only under `apply: 'serve'` (i.e., `vite dev`).
- Intercepts `GET /manifest.webmanifest`.
- Returns `JSON.stringify(manifest)` with `Content-Type:
  application/manifest+json`.
- `next()` for any other method or path.

**Validation**: tests assert that a `GET` against the dev server
returns valid JSON parseable into an object containing `name`,
`short_name`, `icons`, `start_url`, and `display`.

---

## 6. ServiceWorkerRegistration (existing — re-wired)

The `registerSW(...)` function in `src/pwa/registerSW.ts` already
exists. Feature 004 changes its callbacks:

```ts
// src/pwa/registerSW.ts (AMENDED)
export function registerSW(): void {
  if (import.meta.env.DEV) return;
  try {
    const updateSW = workboxRegister({
      immediate: true,
      onOfflineReady() {
        if (!hasShownOfflineReady()) {
          markOfflineReadyShown();
          // emit a one-shot "offline ready" signal — App.svelte listens
        }
      },
      onNeedRefresh() {
        fireNeedRefresh(async () => { await updateSW(true); });
      },
      onRegisterError() {
        // FR-012 — silent fallback; no toast, no console.error
      },
    });
  } catch {
    /* virtual:pwa-register absent (tests / SSR) — noop */
  }
}
```

**State transitions** (the SW lifecycle, externally driven):

```text
installing → installed (waiting)  ← first time we have a chance to show "Update available"
installed (waiting) → activating  ← only after updateSW(true) is called
activating → activated            ← page reloads
```

---

## 7. OfflineReadySignal (transient, one-shot)

A second Svelte writable distinct from `updateSignal` so the two
toasts can coexist independently:

```ts
// src/pwa/updateSignal.ts (or a sibling module)
export const offlineReadySignal: Readable<{ visible: boolean }>;
export function fireOfflineReady(): void;
export function dismissOfflineReady(): void;
```

`App.svelte` calls `dismissOfflineReady()` after a 5 s `setTimeout` —
same pattern as the existing `copyToast`, `zoneHint`,
`layerFailToast` toasts.

---

## 8. Relationships

```text
vite-plugin-pwa
   │
   │ registerType:'prompt' triggers virtual:pwa-register callbacks
   ▼
src/pwa/registerSW.ts (orchestrator)
   │
   ├── onOfflineReady ─→ hasShownOfflineReady?  ─yes─→ silent
   │                              │
   │                              └no─→ markOfflineReadyShown + fireOfflineReady
   │                                              │
   │                                              ▼
   │                                  offlineReadySignal (Svelte writable)
   │                                              │
   │                                              ▼
   │                                       App.svelte renders toast (5 s)
   │
   └── onNeedRefresh ─→ fireNeedRefresh(updateSW)
                                 │
                                 ▼
                         updateSignal.visible = true
                                 │
                  ┌──────────────┴──────────────┐
                  ▼                             ▼
         User taps "Update now"         User taps "Later"
                  │                             │
                  ▼                             ▼
            updateSW(true)              postponedUntil = now + 30 min
                  │                             │
                  ▼                             ▼
            page reloads               visible = false
                                                │
                                                ▼
                                    next session re-fires onNeedRefresh
                                    (because SW is still in waiting state)
```

---

## 9. Files affected

| File                                                 | Status   | What it owns                                                    |
| ---------------------------------------------------- | -------- | --------------------------------------------------------------- |
| `src/pwa/updateSignal.ts`                            | NEW      | `updateSignal`, `offlineReadySignal`, `fireNeedRefresh`, `postpone`, `confirm`, `fireOfflineReady`, `dismissOfflineReady`. |
| `src/pwa/registerSW.ts`                              | AMENDED  | Wires `onNeedRefresh` / `onOfflineReady` to the signal stores.  |
| `src/storage/offlineReady.ts`                        | NEW      | `hasShownOfflineReady`, `markOfflineReadyShown`.                |
| `src/components/UpdatePrompt.svelte`                 | NEW      | The toast component (renders only when `$updateSignal.visible`). |
| `src/components/AttributionBar.svelte`               | AMENDED  | Switches `.attribution` selector to `var(--attribution-bg)` / `var(--attribution-fg)`. |
| `src/app/App.svelte`                                 | AMENDED  | Mounts `<UpdatePrompt />`; subscribes to `offlineReadySignal` for the 5 s toast. |
| `src/app/tokens.css`                                 | AMENDED  | New `--attribution-bg` / `--attribution-fg` pair, both schemes. |
| `src/i18n/{zh,en,ja}.json`                           | AMENDED  | `pwa.update.title`, `pwa.update.confirm`, `pwa.update.later`, `pwa.offline.ready`. |
| `vite.config.ts`                                     | AMENDED  | `registerType: 'prompt'`; `devManifestPlugin(manifest)` registered. |
| `tests/unit/pwa/updateSignal.spec.ts`                | NEW      | Postpone window, signal lifecycle, idempotency.                  |
| `tests/unit/storage/offlineReady.spec.ts`            | NEW      | Flag absence/presence, corrupted-value tolerance.                |
| `tests/unit/components/AttributionBar.spec.ts`       | NEW      | Token-pair contrast assertions (light + dark).                   |
| `tests/integration/update-prompt.spec.ts`            | NEW      | Component rendering, button wiring, Escape dismissal.            |
| `tests/integration/attribution-contrast.spec.ts`     | NEW      | Runtime `getComputedStyle` contrast in both schemes.             |
| `tests/e2e/story-4-offline-and-update.spec.ts`       | NEW      | Offline reload + deterministic update prompt flow.               |
| `docs/ui/0004-offline-pwa-polish.md`                 | NEW      | UI record per Principle III.                                     |
| `docs/adr/0023-sw-registration-strategy.md`          | NEW      | autoUpdate → prompt registration.                                |
| `docs/adr/0024-dev-manifest-middleware.md`           | NEW      | Dev manifest middleware pattern.                                 |
| `docs/adr/0014-accessibility-baseline.md`            | AMENDED  | Append "Implementation outcome" — Attribution badge contrast tokens. |
