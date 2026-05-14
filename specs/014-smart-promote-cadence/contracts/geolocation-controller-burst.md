# Contract — `src/map/geolocationController.ts` (burst extension)

This contract describes the *internal* additions to
`GeolocationController` for the promote-on-movement burst. The
**public surface from feature 013 is unchanged** — no new exports,
no new constructor options, no new public methods. Consumers
(`LocateButton.svelte`, `locateSignal.ts`, `App.svelte`) see the
same surface; they receive the cadence boost transparently.

## Public surface (UNCHANGED from feature 013)

```ts
export interface GeolocationControllerOptions {
  readonly onFix: (fix: PositionFix) => void;
  readonly onPermissionDenied: () => void;
  readonly onPositionUnavailable: () => void;
  readonly onTimeout: () => void;
}

export class GeolocationController {
  constructor(options: GeolocationControllerOptions);
  queryPermission(): Promise<'prompt' | 'granted' | 'denied' | 'unavailable'>;
  start(preset: LocateFrequencyPreset): void;
  stop(): void;
  dispose(): void;
  get isRunning(): boolean;
  get currentPreset(): LocateFrequencyPreset | null;
}

export function frequencyToWatchOptions(
  preset: LocateFrequencyPreset,
): PositionOptions;
```

`frequencyToWatchOptions` continues to return:

| Preset | `enableHighAccuracy` | `maximumAge` | `timeout`  |
|--------|----------------------|--------------|------------|
| Smart  | `false`              | `5_000`      | `30_000`   |
| Fast   | `true`               | `0`          | `10_000`   |
| Slow   | `false`              | `30_000`     | `60_000`   |

## New private fields

```ts
private burstWatchId: number | null = null;
private burstTimer: ReturnType<typeof setTimeout> | null = null;
private previousFix: PositionFix | null = null;
private previousFixWasMoving = false;
```

(See [data-model.md](../data-model.md) for the semantics of each.)

## New private methods

```ts
private static readonly SMART_MOVEMENT_BURST_MS = 5_000;
private static readonly SMART_MOVEMENT_THRESHOLD_MPS = 1;
private static readonly EARTH_RADIUS_M = 6_371_000;

private haversineMeters(a: PositionFix, b: PositionFix): number;
private maybePromoteOnMovement(fix: PositionFix): void;
private startBurst(): void;
private endBurst(): void;
```

### `haversineMeters(a, b)`

Returns the great-circle distance in metres between two fixes
using the haversine formula. Pure (no side effects). Input is
two `PositionFix` records; output is non-negative number.

### `maybePromoteOnMovement(fix)`

Called from `handlePosition(pos)` AFTER the existing Slow
throttle check. Responsibilities (in order):

1. Short-circuit if `this.preset !== 'smart'`.
2. Short-circuit if `this.burstWatchId !== null` (burst already
   in flight). Update `previousFix = fix` and return.
3. If `this.previousFix === null` (first fix of session), record
   `previousFix = fix` and `previousFixWasMoving = false`, then
   return.
4. Compute `dt = (fix.timestamp - previousFix.timestamp) / 1000`.
   If `dt <= 0`, return without updating (timestamp regression /
   duplicate fix).
5. Compute `dist = haversineMeters(previousFix, fix)`.
6. `const isMoving = dist / dt >= SMART_MOVEMENT_THRESHOLD_MPS`.
7. If `isMoving && previousFixWasMoving` → `startBurst()`.
8. Update `previousFixWasMoving = isMoving` and `previousFix = fix`.

### `startBurst()`

Responsibilities:

1. If `this.burstWatchId !== null` (defensive — invariant 1 from
   data-model), return without starting another burst.
2. Wrap in `try { … } catch { … }`:
   - Call `navigator.geolocation.watchPosition(success, error,
     { enableHighAccuracy: true, maximumAge: 0, timeout: 10_000 })`.
     Bind `success` to the existing `handlePosition` method and
     `error` to the existing `handleError` method (so burst
     fixes flow through `onFix` per FR-010 and burst errors
     route through the existing error normalisation).
   - Store the returned watchId in `this.burstWatchId`.
   - Schedule `setTimeout(() => this.endBurst(), 5_000)`; store
     the handle in `this.burstTimer`.
3. On catch: reset `burstWatchId = null`, `burstTimer = null`,
   `previousFixWasMoving = false`. Do NOT call
   `options.onPositionUnavailable` (per research §R3).

### `endBurst()`

Responsibilities:

1. If `burstWatchId !== null`, call `navigator.geolocation.clearWatch(burstWatchId)`
   and set `burstWatchId = null`.
2. If `burstTimer !== null`, call `clearTimeout(burstTimer)` and
   set `burstTimer = null`.
3. Set `previousFixWasMoving = false` (so the next pair starts
   fresh — does not immediately re-promote off the same
   evidence).

## Integration points (modifications to existing methods)

### `handlePosition(pos)`

Add a call to `this.maybePromoteOnMovement(fix)` AFTER the
existing Slow throttle check (which may early-return) AND AFTER
the `this.options.onFix(fix)` dispatch. Order matters: we want
`onFix` to fire before the burst is considered (so the consumer
sees the fix), and we want the Slow throttle to fire first (so
dropped fixes don't update the throttle's `lastAcceptedFix`).

Shipped order in `handlePosition`:

```text
1. if (disposed) return
2. construct PositionFix
3. Slow-preset throttle: if dropping, return
4. lastAcceptedFix = fix
5. options.onFix(fix)
6. maybePromoteOnMovement(fix)   ← NEW
```

### `stop()`

Before resetting `preset` / `lastAcceptedFix`, add:

```ts
this.endBurst();
this.previousFix = null;
this.previousFixWasMoving = false;
```

`endBurst()` is idempotent (handles the `null` case), so calling
it when no burst is active is safe.

### `dispose()`

Already calls `this.stop()` — no further change.

### `start(preset)`

Before the existing `if (this.baseWatchId !== null) clearWatch …`
block, add:

```ts
this.endBurst();
```

This ensures that a preset switch (Smart → Fast, Smart → Slow,
even Smart → Smart with the same preset) tears down any active
burst. The base subscription's re-subscription is unaffected.

## Invariants

1. **Public surface stability** — no new exports, no new public
   methods or fields. Consumers continue to work without change.
2. **Single in-flight burst** — at most one burst subscription
   exists at any moment.
3. **Burst-lifetime bounded** — every burst is torn down within
   5 000 ms + one frame of timer resolution.
4. **No promote on non-Smart presets** — `maybePromoteOnMovement`
   is a no-op when `preset !== 'smart'`.
5. **No state across sessions** — `stop()` / `dispose()` reset
   all four new fields.
6. **No burst toast** — burst-specific failures do NOT raise
   `onPositionUnavailable`. Only the base subscription's
   failures do.

## Error handling

| Scenario | Behaviour |
|----------|-----------|
| Burst's `watchPosition` throws | Catch silently; reset `burstWatchId`/`burstTimer`/`previousFixWasMoving`. Do NOT raise `onPositionUnavailable`. Base subscription continues normally. |
| Burst's `error` callback fires with code 1 | Routed through existing `handleError(err)`. Code 1 (permission denied) calls `this.stop()`, which calls `endBurst()` and tears down everything. This is correct — losing permission terminates ALL subscriptions for this controller. |
| Burst's `error` callback fires with code 2 or 3 | Routed through existing `handleError(err)`. The existing 5 s debounce on `onPositionUnavailable` / `onTimeout` applies — a single burst-cause toast does not duplicate the base-cause toast. The burst subscription itself remains; the 5 s burst timer ends it on schedule. |
| `setTimeout` fires after `dispose()` (race) | `endBurst()` is called by the timer; the `if (burstWatchId !== null)` guard makes the `clearWatch` call a no-op when already torn down. No throw, no leaked subscription. |

## Test contract

The following tests in `tests/unit/geolocation-controller-promote.spec.ts`
MUST exist and MUST be RED before the implementation lands:

1. `"first fix does not start a burst"` (FR-011, SC-004 partial)
2. `"single moving pair does not start a burst"` (R1 guard)
3. `"two consecutive moving pairs at exactly 1 m/s start a burst with Fast options"` (FR-001, FR-002, FR-004)
4. `"motion below 1 m/s does not start a burst"` (FR-004)
5. `"burst tears down after 5 000 ms"` (FR-003)
6. `"only one burst is in flight at a time"` (FR-006)
7. `"non-Smart presets do not promote (fast)"` (FR-005)
8. `"non-Smart presets do not promote (slow)"` (FR-005)
9. `"stop() tears down both base and burst subscriptions"` (FR-007)
10. `"dispose() tears down both base and burst subscriptions"` (FR-007)
11. `"preset switch tears down burst before re-subscribing base"` (FR-008)
12. `"burst start that throws is silently aborted"` (FR-009)
13. `"burst fixes flow through options.onFix"` (FR-010)
14. `"10 stationary fixes do not trigger a burst"` (SC-004 full)

The new file uses `vi.useFakeTimers({ shouldAdvanceTime: false })`
for deterministic ordering. A stub of `navigator.geolocation`
captures `watchPosition(success, error, options)` call args in an
ordered array; test bodies inspect each entry.

The existing `tests/unit/locate-frequency-cadence.spec.ts` is
extended with one additional case verifying that
`frequencyToWatchOptions('smart')` still returns the documented
non-burst triple — burst behaviour does not bleed into the
base-options API.
