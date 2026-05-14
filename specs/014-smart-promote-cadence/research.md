# Research — 014-smart-promote-cadence

Phase 0 outputs. Each entry resolves a decision the plan and
contract depend on. No `NEEDS CLARIFICATION` markers remain after
this document.

## R1 — Motion threshold + two-consecutive-pairs guard

### Decision

A burst is initiated only when **two consecutive pairs** of fixes
both show motion ≥ 1 m/s, computed via haversine great-circle
distance over the timestamp delta.

- Threshold: 1 m/s (≈ 3.6 km/h — comfortably below a slow walking
  pace).
- Guard: two consecutive moving pairs. The first pair establishes
  `previousFixWasMoving = true`; the second pair's check is `(now
  isMoving) && previousFixWasMoving`.
- Distance: haversine formula on `(lat, lon)` in degrees, earth
  radius `6_371_000 m`. No reliance on `Geolocation.speed`.

### Rationale

- Feature 013 research §R1 documented the same 1 m/s threshold but
  the implementation was deferred. This feature reuses the
  established threshold verbatim — changing it would create a
  new decision surface without justification.
- A single moving pair is *not* sufficient. GPS jitter can
  produce a 5–10 m position swing in 1 s, which would naively
  read as 5–10 m/s motion. Requiring two consecutive pairs adds
  ~5–10 s of "sustained motion" evidence before paying the burst
  cost. False-positive rate from two consecutive jitter spikes
  is dramatically lower than from one.
- `Geolocation.speed` is frequently `null` on desktop and iOS
  Safari (feature 013 research §R1 confirmed this). A
  delta-based heuristic on `(lat, lon)` works universally.
- Haversine is the standard geodesic distance formula for
  short-range calculations and is accurate to << 1 m for the
  distance scales we observe between consecutive `watchPosition`
  fixes. The simpler equirectangular approximation would also
  work at these scales but its error grows with distance; using
  haversine costs ~3 extra trig calls and removes the
  approximation as a potential reviewer-flag.

### Alternatives considered

- **Single-moving-pair trigger**. Rejected: GPS jitter
  false-positive rate is too high (informal estimate from
  feature 013 manual testing on stationary devices: ~5 % of
  consecutive-fix pairs report > 1 m/s drift). Two consecutive
  pairs drops this to estimated ~0.25 %.
- **Three-consecutive-moving-pairs guard**. Rejected: adds
  another ~5 s of latency before the burst fires. The whole
  point of the burst is to tighten cadence ≤ 5 s; requiring ~15
  s of evidence defeats the contract.
- **Speed via `Geolocation.speed`**. Rejected as in feature 013
  §R1: `null` on a non-trivial subset of the support matrix.
- **Velocity from a Kalman filter / moving average over N
  fixes**. Rejected: increases controller state, complicates
  testing, and the simple two-pair heuristic is provably
  sufficient at the precision we need.

## R2 — Burst initiation site (NOT a user-gesture handler)

### Decision

`startBurst()` is called from inside `handlePosition(pos)` — i.e.,
the success-callback of the base watcher. It is NOT called from a
user-gesture (pointerup / click) handler.

### Rationale

- iOS Safari's user-gesture coupling rule applies to *first*
  invocation of a permission-requiring API. Once permission is
  granted for the base subscription, subsequent `watchPosition`
  calls in the same browsing context do not require a fresh
  user-gesture. (Verified across the WebKit blog's geolocation
  documentation and informal Safari source-code reading.)
- The base subscription's first `watchPosition` call IS still
  inside a user-gesture handler (feature 013's FR-010), so the
  permission grant precondition is preserved.
- Initiating the burst from `pointerup` would be architecturally
  wrong: by the time motion is detected, the gesture is long
  gone.

### Alternatives considered

- **Promise the burst from `pointerup` and resolve later**.
  Rejected: by the time motion is detected, the gesture handler
  has long returned. iOS Safari's gesture-coupling rule is
  about the synchronous call site, not about Promise chains.
- **Force-re-prompt at burst-start to obtain a "fresh" gesture
  grant**. Rejected: gratuitous user friction, and the
  permission state is already `granted` so re-prompting would
  be a no-op anyway.

## R3 — `watchPosition` throw handling for the burst differs

### Decision

The burst's `watchPosition` call is wrapped in
`try { … } catch { … }`. On throw, the controller:

1. Resets `burstWatchId` and `burstTimer` to `null`.
2. Resets `previousFixWasMoving = false` so the next pair starts
   fresh.
3. Returns silently. It does NOT call
   `options.onPositionUnavailable`.

This differs from the base subscription's `start(preset)` throw
handling (feature 013 PR #5 review C-2 / Codex P2), which DOES
route to `onPositionUnavailable`.

### Rationale

- A burst-start throw indicates a transient policy or
  privacy-extension override that affected the second
  subscription only (e.g., Permissions-Policy disallow on the
  embedding frame; Brave-shield-style throttling that allows one
  watcher but blocks a second).
- The base subscription is still healthy and the user is still
  receiving fixes. Surfacing a toast for a *cadence* failure
  would confuse the user: their location is still being shown,
  just at the base Smart cadence.
- The base subscription's throw, by contrast, leaves the user
  with no position fix at all, so a toast is justified.

### Alternatives considered

- **Route burst-throw to `onPositionUnavailable`**. Rejected per
  rationale above — false positive toast.
- **Silently retry the burst after N seconds**. Rejected: adds
  state (`burstRetryAt`) and complicates the FR table. If the
  next motion pair triggers a fresh `maybePromote`, that will
  re-attempt the burst naturally.

## R4 — Burst options reuse the Fast preset's triple

### Decision

The burst uses:

```ts
{ enableHighAccuracy: true, maximumAge: 0, timeout: 10_000 }
```

— identical to `frequencyToWatchOptions('fast')`.

### Rationale

- These are the strongest cadence-driving options available per
  feature 013 research §R1. Using the documented Fast preset
  triple keeps the contract surface shallow: any future change
  to Fast's options also tightens the burst, naturally.
- Inlining the literal vs calling `frequencyToWatchOptions('fast')`
  is a minor style call. The literal is used so the code reads
  self-explanatorily without a one-step indirection.

### Alternatives considered

- **Custom triple with even shorter `timeout`** (e.g., 5_000
  ms). Rejected: the burst is already only 5 s long; a
  5_000 ms timeout means at most one timeout error per burst,
  which is wasteful telemetry.
- **`{ enableHighAccuracy: true, maximumAge: 5_000, timeout:
  10_000 }`** — let the burst reuse cached fixes. Rejected:
  defeats the whole point. We want the freshest possible fix
  cadence during the burst.

## R5 — Test strategy

### Decision

A single new vitest unit file
`tests/unit/geolocation-controller-promote.spec.ts` covers the
entire FR-001..FR-011 surface using `vi.useFakeTimers()` and a
stubbed `navigator.geolocation`. The existing
`tests/unit/locate-frequency-cadence.spec.ts` is extended with
tighter assertions on the promote-on-movement path but its
existing GREEN coverage of the Smart/Fast/Slow option triples
remains untouched.

### Test surface

| FR | Test name | Mechanism |
|----|-----------|-----------|
| FR-001 / FR-002 | "two consecutive moving pairs start a burst with Fast options" | spy on `navigator.geolocation.watchPosition`; feed two pairs; assert second call has `{ enableHighAccuracy: true, maximumAge: 0, timeout: 10_000 }` |
| FR-003 | "burst tears down after 5 000 ms" | `vi.advanceTimersByTime(5_000)`; assert `clearWatch` called on burst handle |
| FR-004 | "haversine threshold is 1 m/s" | feed pairs at exactly 1.0 m/s (just above threshold) → triggers; at 0.99 m/s → does not |
| FR-005 | "non-Smart presets do not promote" | run controller on `fast` / `slow`, feed moving pairs, assert no second `watchPosition` |
| FR-006 | "single burst in flight" | feed third moving pair during active burst, assert no second `watchPosition` call beyond the first burst |
| FR-007 | "stop() / dispose() tear down burst" | start burst, then call `stop()` / `dispose()`; assert `clearWatch` on burst handle + `clearTimeout` on burst timer |
| FR-008 | "preset switch tears down burst" | start burst on Smart, then call `start('fast')`; assert burst torn down before new base subscription |
| FR-009 | "watchPosition throw on burst start is swallowed silently" | second `watchPosition` call throws; assert `onPositionUnavailable` NOT called; base subscription unaffected |
| FR-010 | "burst fixes flow through onFix" | burst's success-callback fires; assert `options.onFix` called with normalised `PositionFix` |
| FR-011 | "first fix does not start a burst" | feed only one fix; assert no second `watchPosition` |
| SC-004 | "stationary user does not trigger a burst" | feed 10 consecutive fixes with ≤ 0.5 m drift; assert no second `watchPosition` |

All cases use `vi.useFakeTimers({ shouldAdvanceTime: false })` for
deterministic ordering. The stubbed `navigator.geolocation`
captures `watchPosition(success, error, options)` call args in an
ordered array so test assertions can inspect each subscription
independently.

### Alternatives considered

- **Playwright e2e for real-pointer / real-viewport cadence
  measurement**. Rejected for this feature: the burst is
  invisible to the user beyond cadence change, and cadence is
  best measured against a fake-timer for determinism. Manual
  device testing is covered by `quickstart.md`.

All entries resolve any `NEEDS CLARIFICATION` placeholder. None
remain open.
