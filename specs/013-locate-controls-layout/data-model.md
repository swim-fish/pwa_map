# Data Model — 013-locate-controls-layout

Two concerns: a **runtime** state machine (component-local, not
persisted) and a **persisted** preference (added to `pwa_map:prefs`
schema v4).

## Runtime — Locate state machine

### `LocateState`

```ts
export type LocateState = 'off' | 'show' | 'follow';
```

Initial value: `'off'` on every page load (FR-028 — no auto-resume).

### `LocateEvent`

The state machine is driven by a discriminated union:

```ts
export type LocateEvent =
  | { type: 'shortTap' }
  | { type: 'longPress' }   // long-press release ≥ 1.5 s OR Shift+Enter / Shift+Space
  | { type: 'manualPan' }   // user-initiated dragstart while in Follow
  | { type: 'permissionDenied' }    // toast already raised by caller
  | { type: 'permissionUnavailable' }  // insecure context / API absent
  | { type: 'firstFix'; lat: number; lon: number; accuracy: number; timestamp: number };
```

`firstFix` is the first position-fix event after permission grant;
it does not by itself cause a state transition (Show / Follow
already consume position fixes through `locateSignal`), but it
is included for completeness so the unit-test transition table
asserts "no state change".

### Transition table

| From state | Event | To state | Side effects |
|------------|-------|----------|--------------|
| `off` | `shortTap` | `show` | start watcher with current frequency preset; permission prompt may appear synchronously |
| `off` | `longPress` | `off` | no-op (FR-014g) |
| `off` | `permissionDenied` | `off` | no transition; toast already raised by caller |
| `off` | `permissionUnavailable` | `off` | button is visually disabled |
| `show` | `shortTap` | `follow` | call `recenterTo(lastFix, animated=!reducedMotion)` |
| `show` | `longPress` | `off` | stop watcher; clear marker |
| `show` | `manualPan` | `show` | no-op (manual pan in Show is a free pan, expected) |
| `show` | `permissionDenied` | `off` | stop watcher; clear marker; toast |
| `follow` | `shortTap` | `show` | stop auto-recenter (next fix updates the marker but not the centre) |
| `follow` | `longPress` | `off` | stop watcher; clear marker |
| `follow` | `manualPan` | `show` | demote without explicit gesture (FR-018, R5) |
| `follow` | `permissionDenied` | `off` | stop watcher; clear marker; toast |
| any | `firstFix` | unchanged | update `lastFix` field on the snapshot; if state is `follow`, also `recenterTo(...)` |

Invariants:

- `off` is unreachable from itself via `shortTap` (shortTap from
  `off` always produces `show`).
- The only paths to `off` from an active state are `longPress`,
  `permissionDenied`, and (indirectly) component destroy.

### `LocateMachineSnapshot`

A read-only projection of the machine state for consumers
(LocateButton.svelte for visuals + a11y, App.svelte for marker
mount, geolocationController for watcher lifecycle):

```ts
export interface LocateMachineSnapshot {
  readonly state: LocateState;
  readonly permission: 'prompt' | 'granted' | 'denied' | 'unavailable';
  readonly lastFix: PositionFix | null;
}

export interface PositionFix {
  readonly lat: number;
  readonly lon: number;
  readonly accuracy: number;  // metres
  readonly timestamp: number; // ms since epoch
}
```

> **Post-implementation note (Addendum 2026-04-28)**: the `pressStartedAt` field
> originally proposed on the snapshot was dropped — press-start tracking is
> handled entirely via component-local state in `LocateButton.svelte`
> (the `pressTimerId !== null` predicate). Keeping it on the snapshot
> would have required a setter that the machine doesn't naturally express.

_(Historical, pre-implementation: the original design held `pressStartedAt`
on the snapshot for diagnostic visibility; in the shipped implementation
this responsibility is component-local.)_

## Runtime — Locate signal store

`src/map/locateSignal.ts` exports:

```ts
export const locateSignal: Readable<LocateMachineSnapshot>;
export function applyLocateEvent(event: LocateEvent): void;
```

The store mirrors the `bearingSignal` pattern (feature 006):
component-local imports subscribe with `$locateSignal` and react
to changes via `$:` blocks. The setter function is the only
mutation point and is called from:

- `LocateButton.svelte` — on every gesture (short-tap / long-press
  / keyboard chord)
- `geolocationController.ts` — on every `firstFix` /
  `permissionDenied` / `permissionUnavailable` event
- `App.svelte` — on every detected manual pan (via the
  MapController `move` listener with truthy `originalEvent`)

The store is a singleton per app instance; tests reset it by
calling `__TESTING__.resetLocateSignal()`.

## Persisted — `FormatPreferencesV4`

### Schema diff vs v3

```ts
export type LocateFrequencyPreset = 'smart' | 'fast' | 'slow';

export interface FormatPreferencesV4 {
  readonly version: 4;
  // ── v3 fields unchanged ───────────────────────────────────
  readonly visible: readonly CoordinateKind[];
  readonly mgrsPrecision: MGRSPrecision;
  readonly taipowerPrecision: TaipowerPrecision;
  readonly locale: Locale;
  readonly mapLayer?: BasemapId;
  readonly overlay?: boolean;
  readonly tileTtlDays: TtlDays;
  readonly tileMaxEntries: TileMaxEntries;
  readonly formatOrder: readonly CoordinateKind[];
  // ── v4 NEW ────────────────────────────────────────────────
  readonly locateFrequency: LocateFrequencyPreset;
}

export type FormatPreferences = FormatPreferencesV4;
```

`PREFS_VERSION` constant: `3` → `4`.

### Migration matrix

| Stored version | Field present? | Field valid? | Resulting `locateFrequency` |
|----------------|----------------|--------------|------------------------------|
| 4              | yes            | yes (`'smart'` / `'fast'` / `'slow'`) | as stored |
| 4              | yes            | invalid (e.g. `'turbo'`)              | `'smart'` (default) |
| 4              | no             | —                                     | `'smart'` |
| 3 / 2 / 1      | n/a            | n/a                                   | `'smart'` (additive migration) |
| missing / corrupt JSON | —      | —                                     | full `defaultPreferences()` returned |

Validator gains:

```ts
const LOCATE_FREQUENCIES = ['smart', 'fast', 'slow'] as const;
function isLocateFrequency(v: unknown): v is LocateFrequencyPreset {
  return typeof v === 'string'
    && (LOCATE_FREQUENCIES as readonly string[]).includes(v);
}
```

### Default

`defaultPreferences()` returns `locateFrequency: 'smart'` (FR-023).

## Notification region — message catalog

The existing `NotificationRegion.svelte` consumes message records
from `i18n` (zh / en / ja). The feature adds these zh keys (en /
ja parity-required):

| Key                                 | Trigger                                    |
|-------------------------------------|--------------------------------------------|
| `locate.error.permissionDenied`     | `PositionError.code === 1` or pre-flight `permission === 'denied'` |
| `locate.error.positionUnavailable`  | `PositionError.code === 2`                 |
| `locate.error.timeout`              | `PositionError.code === 3`                 |
| `locate.error.unavailable`          | `navigator.geolocation` undefined / insecure context |

zh proposed copy (final wording goes in i18n PR — these are
illustrative):

- `locate.error.permissionDenied`: 「定位權限被拒絕，請至裝置設定開啟。」
- `locate.error.positionUnavailable`: 「無法取得位置，可能是訊號不足或裝置 GPS 未就緒。」
- `locate.error.timeout`: 「定位逾時，仍未取得位置。」
- `locate.error.unavailable`: 「此環境不支援定位。」

Plus button-state accessible names (FR-020):

| Key                          | Used when           |
|------------------------------|---------------------|
| `locate.button.aria.off`     | state = off; permission ∈ {prompt, granted} |
| `locate.button.aria.show`    | state = show        |
| `locate.button.aria.follow`  | state = follow      |
| `locate.button.aria.disabled` | permission = unavailable |

zh proposed copy:

- `locate.button.aria.off`: 「啟用定位」
- `locate.button.aria.show`: 「定位中（顯示）」
- `locate.button.aria.follow`: 「定位中（跟隨）」
- `locate.button.aria.disabled`: 「定位不可用」

Plus reduced-motion long-press announcement (FR-014e):

| Key                            | Used when                           |
|--------------------------------|-------------------------------------|
| `locate.button.aria.holdToStop` | reduced-motion long-press in progress |

zh: 「按住停止…」

Plus Settings-section copy (FR-021):

| Key                                   |
|---------------------------------------|
| `settings.locate.heading`             |
| `settings.locate.preset.smart`        |
| `settings.locate.preset.smart.hint`   |
| `settings.locate.preset.fast`         |
| `settings.locate.preset.fast.hint`    |
| `settings.locate.preset.slow`         |
| `settings.locate.preset.slow.hint`    |

(7 settings keys + 4 button-aria keys + 4 toast keys + 1
reduced-motion key = 16 keys × 3 locales = 48 entries. The
estimate of "≈ 10 keys" in the plan refers to the ~10 *new
strings per locale*; the matrix is 16 because some labels share
an aria-key path.)

## Out of scope (explicit non-entities)

- **No persisted "last active state"** — FR-028.
- **No persisted "remembered cycle position"** — the gesture
  model has no remembered cycle (each press starts from the
  current state).
- **No marker accuracy circle** — Edge Cases lists this as
  future polish.
- **No device heading state** — Assumption: "no on-screen
  heading indicator in this feature".
- **No new top-level storage key** — `pwa_map:prefs` v4 absorbs
  the change additively.
