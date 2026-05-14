# Data Model — 014-smart-promote-cadence

One concern: a small **runtime** state cluster inside
`GeolocationController`. No persisted change.

## Runtime — Promote-on-movement state cluster

Four new private instance fields on `GeolocationController`,
co-located with the existing `baseWatchId` / `lastAcceptedFix` /
`lastUnavailableEmitAt` / `lastTimeoutEmitAt` fields:

```ts
private burstWatchId: number | null = null;
private burstTimer: ReturnType<typeof setTimeout> | null = null;
private previousFix: PositionFix | null = null;
private previousFixWasMoving = false;
```

### Semantics

| Field | Meaning | Reset by |
|-------|---------|----------|
| `burstWatchId` | `clearWatch` handle for the active burst subscription, `null` when no burst is active. | `endBurst()` / `stop()` / `dispose()` / preset switch in `start(preset)` |
| `burstTimer` | Handle for the 5 s burst tear-down `setTimeout`. | `endBurst()` (also clears the timeout) / `stop()` / `dispose()` |
| `previousFix` | The most recent raw position fix used for motion comparison. *Separate from* `lastAcceptedFix`, which is the Slow preset's throttle state. | `stop()` / `dispose()` |
| `previousFixWasMoving` | True iff the previous pair of fixes showed ≥ 1 m/s motion. Used to require **two consecutive** moving pairs before triggering a burst. | `stop()` / `dispose()` / `endBurst()` |

### Why `previousFix` is separate from `lastAcceptedFix`

`lastAcceptedFix` is gated by the Slow preset's 10 s
min-dispatch throttle — fixes that arrive < 10 s after the last
accepted fix are silently dropped on Slow and `lastAcceptedFix`
is not updated for them. For promote-on-movement (Smart only),
we want EVERY raw fix to feed the motion-detection comparator
regardless of throttle state.

In the shipped implementation the two fields happen to receive
the same values on the Smart preset (Smart has no throttle), but
collapsing them would create a hidden coupling: a future change
to Smart's throttle behaviour would silently break the promote
logic. Keeping them separate is one extra field for one fewer
class of future bug.

### Lifecycle diagram

```text
                  ┌────────────────────┐
                  │ no burst (default) │
                  │ burstWatchId null  │
                  │ burstTimer  null   │
                  └─────────┬──────────┘
                            │
                            │  two consecutive moving pairs
                            │  while preset === 'smart'
                            ▼
            ┌──────────────────────────────────┐
            │ burst active                     │
            │ burstWatchId = clearWatch handle │
            │ burstTimer = setTimeout handle   │
            └─────────┬──────────────┬─────────┘
                      │              │
       5 s elapsed    │              │   stop() / dispose() /
       (burstTimer    │              │   start(non-smart)
        fires)        │              │
                      ▼              ▼
            ┌────────────────────────────────┐
            │ no burst                       │
            │ previousFixWasMoving = false   │
            │ ready to re-arm                │
            └────────────────────────────────┘
```

### Invariants

1. **Single burst in flight**: `burstWatchId !== null` implies
   `maybePromoteOnMovement` MUST short-circuit before starting
   another burst.
2. **Burst lifetime is bounded to 5 s**: `burstTimer` is the only
   path to ending a burst voluntarily; `clearTimeout` in
   `stop()` / `endBurst()` ensures it never fires after teardown.
3. **Preset-locked**: `maybePromoteOnMovement` MUST short-circuit
   when `currentPreset !== 'smart'`. (Fast already runs high
   accuracy; Slow's throttle would defeat the purpose.)
4. **No state leakage across sessions**: `stop()` and `dispose()`
   reset all four fields. Reload starts fresh.
5. **No leakage into the public API**: the four fields are
   `private`. The public surface of `GeolocationController`
   from feature 013 is unchanged.

## Persisted — `pwa_map:prefs` (UNCHANGED)

`FormatPreferencesV4` is not amended. `PREFS_VERSION` stays at 4.
No migration is required. `defaultPreferences()` is unchanged.

## Position-fix shape (UNCHANGED)

`PositionFix` from feature 013 is reused verbatim:

```ts
export interface PositionFix {
  readonly lat: number;
  readonly lon: number;
  readonly accuracy: number;  // metres
  readonly timestamp: number; // ms since epoch
}
```

## Out of scope (explicit non-entities)

- **No `LocateMachineSnapshot` change** — the state machine
  remains DOM-, clock-, and burst-unaware. Bursts are an
  implementation detail of `GeolocationController`.
- **No `locateSignal` shape change** — consumers
  (`LocateButton.svelte`, `App.svelte`) receive the same
  snapshot type they did before. The cadence boost is
  invisible to them.
- **No persisted promote-state** — instance memory only.
- **No new top-level storage key** — there is no storage at all.
- **No new module** — all logic lives in
  `src/map/geolocationController.ts`.
