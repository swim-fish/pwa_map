# Contract — `src/map/geolocationController.ts`

The watcher wrapper. Translates `LocateState` transitions into
`navigator.geolocation` lifecycle calls; normalises errors;
guards the user-gesture invariant.

## Public surface

```ts
import type { LocateFrequencyPreset, PositionFix } from './locateMachine';

export interface GeolocationControllerOptions {
  readonly onFix: (fix: PositionFix) => void;
  readonly onPermissionDenied: () => void;
  readonly onPositionUnavailable: () => void;
  readonly onTimeout: () => void;
}

export class GeolocationController {
  constructor(options: GeolocationControllerOptions);

  /**
   * Pre-flight permission check, best-effort.
   * Returns 'unavailable' if `navigator.geolocation` is absent
   * or `navigator.permissions.query` rejects.
   * MUST NOT trigger the permission prompt.
   */
  queryPermission(): Promise<'prompt' | 'granted' | 'denied' | 'unavailable'>;

  /**
   * Start the watcher with the given frequency preset.
   * MUST be called synchronously inside a user-gesture handler
   * on the first activation (iOS Safari constraint).
   * Idempotent: calling start while already started swaps the
   * options (frequency change live-applies per FR-025) by
   * calling clearWatch + watchPosition under the hood.
   * Throws no exceptions; permission failures route through
   * onPermissionDenied. API absence routes through
   * onPositionUnavailable.
   */
  start(preset: LocateFrequencyPreset): void;

  /**
   * Stop the watcher. Idempotent. Cancels any in-flight
   * geolocation request; releases the OS subscription.
   */
  stop(): void;

  /**
   * Tear down. Releases all listeners. After dispose, all
   * methods are no-ops.
   */
  dispose(): void;

  /** True if the watcher is currently subscribed. */
  get isRunning(): boolean;

  /** The preset most recently passed to `start`, or null. */
  get currentPreset(): LocateFrequencyPreset | null;
}
```

## Frequency-preset → API options

```ts
export function frequencyToWatchOptions(
  preset: LocateFrequencyPreset,
): PositionOptions;
```

| Preset | `enableHighAccuracy` | `maximumAge` | `timeout`  |
|--------|----------------------|--------------|------------|
| Smart  | `false`              | `5_000`      | `30_000`   |
| Fast   | `true`               | `0`          | `10_000`   |
| Slow   | `false`              | `30_000`     | `60_000`   |

The Slow preset additionally enforces an internal
**min-dispatch interval of 10 000 ms**: fixes from
`watchPosition` that arrive sooner than 10 s after the last
*accepted* fix are silently dropped. Smart's "promote to high
accuracy after movement burst" branch is implemented by issuing
a second `watchPosition` (with `enableHighAccuracy: true`) for a
5 s window when two consecutive fixes show movement ≥ 1 m/s, then
reverting to the base Smart options.

## Permission semantics

1. **Pre-flight** — `queryPermission()` calls
   `navigator.permissions.query({ name: 'geolocation' })` if
   available. On reject (e.g., older Firefox), returns
   `'prompt'` (best-effort fallback).
2. **API absent** — if `navigator.geolocation` is undefined
   (insecure context, very old browser), returns
   `'unavailable'`. The LocateButton consumes this state to
   render disabled.
3. **First activation** — `start(preset)` calls
   `navigator.geolocation.watchPosition(success, error,
   options)` synchronously. On iOS Safari, this synchronous
   call is the user-gesture-coupled invocation that triggers
   the prompt; any `await` / `then` boundary between the
   `pointerup` event and this call invalidates the gesture.
4. **Permission denial mid-session** — error callback fires
   with code `1`; controller calls `onPermissionDenied()`,
   stops the watcher, and refuses subsequent `start` calls
   until `dispose()` + reconstruct (the LocateButton handles
   this by transitioning state to Off and surfacing the
   toast; on the next user tap a fresh controller is
   created).

## Error normalisation

| Native callback | Code | Controller emits           |
|-----------------|------|----------------------------|
| `error`         | `1`  | `onPermissionDenied()`     |
| `error`         | `2`  | `onPositionUnavailable()`  |
| `error`         | `3`  | `onTimeout()`              |
| (API absent)    | n/a  | `onPositionUnavailable()` (constructor sets unavailable; methods become no-op) |

Each callback is invoked at most once per error event. The
controller does not re-fire the same error in a tight loop —
on `error code 2/3`, the watcher stays subscribed (per browser
semantics these are recoverable) but the controller debounces
its callback emission to once per 5 s so a single subscriber
toast is not duplicated.

## Test contract

`tests/unit/locate-frequency-cadence.spec.ts`:

- `frequencyToWatchOptions('smart')` returns the documented
  triple.
- `frequencyToWatchOptions('fast')` returns the documented
  triple.
- `frequencyToWatchOptions('slow')` returns the documented
  triple.
- The Slow min-dispatch throttle drops fixes arriving < 10 s
  apart.
- The Smart "promote on movement" branch upgrades to a 5 s
  high-accuracy watcher when two consecutive fixes show
  movement ≥ 1 m/s, then reverts.

`tests/integration/locate-button-permission.spec.ts`:

- Mock `navigator.geolocation.watchPosition`. The mock spy
  asserts: (a) the call happens with the documented options
  for the persisted preset; (b) the call is synchronous with
  the pointerup handler — verified by recording call order
  against `Promise.resolve().then(() => recorderTimestamp =
  Date.now())`.
- Mock `navigator.permissions.query` to return each of the four
  states; assert the LocateButton's visual + a11y reflect the
  correct branch.

`tests/integration/locate-button-cycle.spec.ts`:

- Wire a real `GeolocationController` to a stubbed
  `navigator.geolocation`; drive a Show → Follow → Show
  sequence and assert the watcher subscription survives the
  Follow → Show demote (only the marker / recenter behaviour
  changes).
