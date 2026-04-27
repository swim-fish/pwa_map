# Contract: `src/pwa/updateSignal.ts`

**Feature**: `004-offline-pwa-polish`

The single source of truth for "is an app update available, and is the
prompt currently shown to the operator?". A separate
`offlineReadySignal` covers the one-shot "PWA cached and ready
offline" toast.

---

## 1. Public types

```ts
export interface UpdatePromptState {
  readonly visible: boolean;
  readonly postponedUntil: number | null;
  readonly confirmUpdate: (() => Promise<void>) | null;
}

export interface OfflineReadyState {
  readonly visible: boolean;
}
```

## 2. Public stores

```ts
export const updateSignal: Readable<UpdatePromptState>;
export const offlineReadySignal: Readable<OfflineReadyState>;
```

Both are `Readable` (not `Writable`) — mutations go through the named
actions below so the invariants in §4 stay enforceable.

## 3. Public actions

```ts
/** Called by registerSW.ts when vite-plugin-pwa fires onNeedRefresh.
 *  Bind the SW's updateSW(true) function so confirm() can call it. */
export function fireNeedRefresh(confirmUpdate: () => Promise<void>): void;

/** Called by UpdatePrompt.svelte when the operator taps "Later". */
export function postpone(now?: number): void;

/** Called by UpdatePrompt.svelte when the operator taps "Update now". */
export function confirm(): Promise<void>;

/** Called by registerSW.ts when vite-plugin-pwa fires onOfflineReady,
 *  if the persistent flag has not been set yet. */
export function fireOfflineReady(): void;

/** Called by App.svelte after the 5 s toast timeout. */
export function dismissOfflineReady(): void;

/** Test-only — resets both stores. NOT exported in prod bundles. */
export function __resetForTests(): void;
```

## 4. Behavioural rules

### 4.1 `updateSignal`

- Initial state: `{ visible: false, postponedUntil: null, confirmUpdate: null }`.
- After `fireNeedRefresh(fn)`:
  - If `postponedUntil` is `null` OR `Date.now() >= postponedUntil`:
    - Set `visible = true`, `confirmUpdate = fn`.
  - Otherwise:
    - Keep `visible = false`; just bind `confirmUpdate = fn`.
- After `postpone()`:
  - Set `visible = false`, `postponedUntil = now + 30 * 60 * 1000`.
  - Do NOT clear `confirmUpdate` — when the postpone window expires
    on the next `fireNeedRefresh` call, the same `fn` is reused.
- After `confirm()`:
  - If `confirmUpdate === null`, the call is a no-op (returns
    `Promise.resolve()`).
  - Otherwise: call `confirmUpdate()`. The page reloads. The store
    is implicitly reset on reload.

### 4.2 `offlineReadySignal`

- Initial state: `{ visible: false }`.
- After `fireOfflineReady()`: `{ visible: true }`.
- After `dismissOfflineReady()`: `{ visible: false }`.
- Calling `fireOfflineReady()` more than once during a single session
  is a no-op once the flag is already set (idempotent).

### 4.3 Cross-store invariants

- `updateSignal.visible` and `offlineReadySignal.visible` are
  independent — both MAY be true at the same moment (e.g., a brand-new
  SW that activated AND immediately discovered a queued update). The
  two toasts MUST NOT overlap visually (handled in `App.svelte` via
  separate viewport anchors — top-center vs. bottom-center).

## 5. Tests required (TDD-first)

`tests/unit/pwa/updateSignal.spec.ts`:

1. Fresh module: `updateSignal.visible === false`,
   `offlineReadySignal.visible === false`.
2. `fireNeedRefresh(fn)` → `visible === true`, `confirmUpdate === fn`.
3. `postpone()` → `visible === false`,
   `postponedUntil ≈ Date.now() + 1_800_000` (± 100 ms tolerance).
4. After `postpone()`, calling `fireNeedRefresh(fn2)` while
   `Date.now() < postponedUntil` keeps `visible === false`.
5. After `postpone()`, calling `fireNeedRefresh(fn2)` once
   `Date.now() >= postponedUntil` (use `vi.useFakeTimers` +
   `vi.advanceTimersByTime`) sets `visible === true`.
6. `confirm()` calls the bound `confirmUpdate` exactly once.
7. `confirm()` with `confirmUpdate === null` is a safe no-op.
8. `fireOfflineReady()` → `offlineReadySignal.visible === true`.
9. `dismissOfflineReady()` → `offlineReadySignal.visible === false`.
10. `fireOfflineReady()` is idempotent (calling twice does not throw,
    second call is a no-op).
11. `__resetForTests()` clears both stores.
