# Contract: `bearingSignal` — Svelte writable for reactive bearing

**Module**: `src/map/bearingSignal.ts`
**Consumed by**: `src/components/Compass.svelte`, all integration
tests for the compass surface.
**Verifies**: spec FR-002 (compass tracks bearing within 100 ms).

## §1. Public surface

```ts
import { type Readable } from 'svelte/store';

export interface BearingState {
  readonly bearing: number; // [0, 360)
}

export const bearingSignal: Readable<BearingState>;

/** Internal — wires the controller's onBearing channel into the
    store. Called once at module-import via attachToController(...).
    Idempotent. Test code calls it again with a fresh stub controller
    after __resetForTests(). */
export function attachToController(controller: MapController): () => void;

/** Reset the store to bearing = 0 and detach any prior controller
    subscription. */
export function __resetForTests(): void;
```

The module MUST export only those four symbols. No default export.

## §2. State invariants

```ts
function initialBearingState(): BearingState {
  return { bearing: 0 };
}

const store = writable<BearingState>(initialBearingState());

export const bearingSignal: Readable<BearingState> = {
  subscribe: store.subscribe,
};
```

Invariants:

| #  | Invariant                                                                                                                  |
| -- | -------------------------------------------------------------------------------------------------------------------------- |
| I1 | `bearing ∈ [0, 360)` at all times. The store ALWAYS holds a normalised value (the controller does the normalisation in `emitBearing`). |
| I2 | The store updates **synchronously** on every controller `onBearing` notification. No microtask deferral.                  |
| I3 | `__resetForTests()` resets the store AND detaches any prior controller subscription. Idempotent.                          |

## §3. `attachToController(controller)` semantics

- Subscribes via `controller.onBearing(deg => store.set({ bearing:
  deg }))`.
- Returns the controller's `unsubscribe` fn so callers can detach
  manually.
- If called twice, the second call MUST detach the first
  subscription before installing the new one. (This matters for
  test isolation — every spec rebuilds a fresh controller stub and
  re-attaches.)

## §4. Required test cases

`tests/unit/map/bearingSignal.spec.ts` MUST cover:

1. **Initial state — `bearing === 0`** before any controller is
   attached.
2. **After `attachToController(stubController)` and the controller
   fires `emitBearing(45)`**: store value is `{ bearing: 45 }`.
3. **After several `emitBearing(...)` calls** (45, 90, 180, 270),
   the store reflects the latest value each time.
4. **Re-attaching to a new controller** detaches the old
   subscription: emits from the OLD controller MUST NOT update the
   store.
5. **`__resetForTests()`** resets bearing to 0 AND prevents the
   previously-attached controller's subsequent emits from updating
   the store.
6. **`bearingSignal.subscribe(handler)` fires handler immediately**
   with the current state (Svelte's standard contract).

## §5. Stability commitment

The three named exports (`bearingSignal`, `attachToController`,
`__resetForTests`) are the public contract. The single field
`bearing` is the persisted shape (in-memory only). Future work that
needs richer reactive map state (zoom level, pitch, etc.) MUST
introduce a new store rather than expanding `BearingState` —
keeping each store single-purpose and keeping their consumers'
subscriptions narrow.
