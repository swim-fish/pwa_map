# Contract — `src/map/locateMachine.ts`

A pure state-machine module. No DOM, no map, no clock, no
geolocation API import. Consumers are
`src/map/locateSignal.ts` (the Svelte store wrapper),
`src/components/LocateButton.svelte` (gesture handlers), and
`src/map/geolocationController.ts` (lifecycle).

## Public surface

```ts
export type LocateState = 'off' | 'show' | 'follow';

export type LocateFrequencyPreset = 'smart' | 'fast' | 'slow';

export type LocatePermissionState =
  | 'prompt' | 'granted' | 'denied' | 'unavailable';

export interface PositionFix {
  readonly lat: number;
  readonly lon: number;
  readonly accuracy: number;  // metres
  readonly timestamp: number; // ms since epoch
}

export type LocateEvent =
  | { type: 'shortTap' }
  | { type: 'longPress' }
  | { type: 'manualPan' }
  | { type: 'permissionDenied' }
  | { type: 'permissionUnavailable' }
  | { type: 'firstFix'; fix: PositionFix };

export interface LocateMachineSnapshot {
  readonly state: LocateState;
  readonly permission: LocatePermissionState;
  readonly lastFix: PositionFix | null;
  readonly pressStartedAt: number | null;
}

export const INITIAL_SNAPSHOT: LocateMachineSnapshot;

export function transition(
  snapshot: LocateMachineSnapshot,
  event: LocateEvent,
): LocateMachineSnapshot;
```

## Invariants

1. **Pure**. `transition` is referentially transparent — same
   inputs always produce the same output. No `Date.now()`,
   no `Math.random()`, no `window.*`, no `import` from `$map/*`
   or `$components/*`.
2. **Total**. Every (state × event) pair has a defined output.
   Unhandled combinations return the input snapshot unchanged
   (no exception thrown).
3. **Frozen output**. Returned snapshots use `Object.freeze` to
   prevent accidental mutation by consumers.
4. **No side effects**. The function returns a new snapshot;
   it does NOT call into a watcher / a map / a logger / a store.
   Side-effecting code (start watcher, recenter map, raise
   toast) lives at the call site (LocateButton or
   geolocationController).
5. **Initial snapshot**. `INITIAL_SNAPSHOT` is
   `Object.freeze({ state: 'off', permission: 'prompt', lastFix:
   null, pressStartedAt: null })`. Tests import it as the
   starting point.

## Transition table (authoritative)

| From state \ Event | `shortTap` | `longPress` | `manualPan` | `permissionDenied` | `permissionUnavailable` | `firstFix` |
|---------------------|------------|-------------|-------------|---------------------|--------------------------|------------|
| `off`               | `show`     | `off`       | `off`       | `off` (perm ← `denied`) | `off` (perm ← `unavailable`) | `off` (lastFix updated) |
| `show`              | `follow`   | `off`       | `show`      | `off` (perm ← `denied`) | `off` (perm ← `unavailable`) | `show` (lastFix updated) |
| `follow`            | `show`     | `off`       | `show`      | `off` (perm ← `denied`) | `off` (perm ← `unavailable`) | `follow` (lastFix updated) |

Notes:

- `shortTap` from `off` only transitions to `show` if `permission
  ∈ {prompt, granted}`. If `permission ∈ {denied, unavailable}`,
  `shortTap` is a no-op (the caller is expected to raise the
  toast via `permissionDenied` / `permissionUnavailable` events
  instead).
- `firstFix` never changes the state by itself; it updates
  `lastFix` only.
- `longPress` is a no-op from `off` (FR-014g). The radial
  progress visual MUST NOT render in `off` — that is enforced at
  the LocateButton component level (the contract there).
- `manualPan` is a no-op from `off` and from `show` (free pan
  is the expected behaviour in those states).

## Test contract — `tests/unit/locate-machine.spec.ts`

The test file MUST cover:

1. **Initial snapshot shape** — every field has the documented
   default; the object is frozen.
2. **All 18 transition table cells** — exactly the resulting
   state listed above.
3. **`shortTap` from `off` with `permission = 'denied'`** — no
   transition.
4. **`shortTap` from `off` with `permission = 'unavailable'`** —
   no transition.
5. **`firstFix` updates `lastFix`** at every state, never
   changes state.
6. **`permissionDenied` from any state** sets `permission` to
   `'denied'` and forces state to `'off'`.
7. **`permissionUnavailable` from any state** sets `permission`
   to `'unavailable'` and forces state to `'off'`.
8. **Frozen output** — every returned snapshot has
   `Object.isFrozen` truthy.
9. **Pure / no side effects** — calling `transition` does not
   touch `localStorage`, does not console.log, does not call
   `Date.now`. Verified by spying on those globals.
10. **Idempotent same-event** — applying the same event twice
    in a row from a state does not produce a different second
    snapshot than its first transition would (e.g.,
    `transition(transition(off, shortTap), shortTap) ===
    transition(transition(off, shortTap), shortTap)` shape
    equals).

## Forbidden imports

The module file MUST NOT contain (verified by a grep guard in
the unit test):

- `import` statements from `$components/*`
- `import` statements from `$pwa/*`
- `import` statements from `$map/MapController`
- `import` statements from `$map/geolocationController`
- `import` statements from `$map/locateSignal`
- references to `window`, `document`, `navigator`, `localStorage`
- references to `Date.now()`, `performance.now()`, `setTimeout`

Allowed imports: `$types/coord` (only if `WGS84DD` is needed for
`PositionFix`; if so, prefer raw `number` to avoid the import).
