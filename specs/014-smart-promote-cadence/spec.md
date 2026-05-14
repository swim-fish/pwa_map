# Feature Specification: Smart Preset — Promote-on-Movement Cadence Boost

**Feature Branch**: `014-smart-promote-cadence`
**Created**: 2026-05-14
**Status**: Draft
**Input**: User description: "實作 Smart 'promote on movement' cadence boost"

## Context

Feature 013 (`013-locate-controls-layout`) shipped the Smart / Fast / Slow
update-frequency presets but **deferred** the Smart preset's
*promote-on-movement* adaptive branch during bundle-budget trim (see
[`specs/013-locate-controls-layout/plan.md`](../013-locate-controls-layout/plan.md)
Complexity Tracking and [`specs/013-locate-controls-layout/spec.md`](../013-locate-controls-layout/spec.md)
Addendum A2). This feature retro-fits that branch into
`src/map/geolocationController.ts` so that Smart matches the SC-005
"≤ 5 s while moving" target on devices where the browser's default
cadence under `enableHighAccuracy: false` is too slow.

The shipped Smart preset uses `{ enableHighAccuracy: false,
maximumAge: 5_000, timeout: 30_000 }` and relies entirely on the
browser's built-in cadence governance. Observed cadence on iOS
Safari ≥ 17 and Android Chromium while a user is genuinely moving
is typically 5–10 s but is not guaranteed; on some devices it can
drift to 15–30 s, which violates the SC-005 promise. The Fast preset
already meets SC-005 deterministically (≤ 1 s), and the Slow preset
is application-throttled (≤ 15 s), so Smart is the only remaining
preset whose user-visible cadence is non-deterministic.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Cadence tightens within seconds of starting to walk on Smart (Priority: P1)

When a user is following their position on the map on the Smart
preset and starts walking (or driving / cycling — any motion above a
person's average walking speed), the on-screen position dot should
update within ~5 seconds of the motion starting, even if the browser
would otherwise have delivered the next low-accuracy fix 15–30
seconds later. Once the user stops moving, the cadence should
naturally drop back to the battery-friendly Smart default.

**Why this priority**: This is the only deferred contract from
feature 013 (Addendum A2). Until this lands, the Smart preset's
SC-005 "≤ 5 s while moving" target is best-effort, not guaranteed,
on a non-trivial subset of the support matrix. Restoring it brings
the Smart preset to feature parity with the original design and
closes feature 013's known regression against SC-005.

**Independent Test**: Mount the locate machinery on a stubbed
`navigator.geolocation.watchPosition`. Feed two consecutive fixes
five seconds apart whose great-circle distance is ≥ 5 m (i.e.,
≥ 1 m/s). Assert: a *second* `watchPosition` call is made with
`{ enableHighAccuracy: true, maximumAge: 0, timeout: 10_000 }`,
that second subscription is torn down after 5 s, and during the
burst window the on-screen dot updates per the high-accuracy
watcher's cadence. Then feed a third fix whose distance from the
second is < 0.5 m: assert no further burst is initiated.

**Acceptance Scenarios**:

1. **Given** the locate state is Show or Follow on the Smart preset
   and the watcher has just delivered one fix, **When** the next fix
   arrives within ≤ 30 s and its great-circle distance from the
   previous fix divided by the timestamp delta is ≥ 1 m/s, **Then**
   the controller MUST start a second `watchPosition` subscription
   with `enableHighAccuracy: true`, `maximumAge: 0`, `timeout: 10_000`
   and schedule a tear-down 5 000 ms later.
2. **Given** a burst is active, **When** 5 000 ms elapse since the
   burst started, **Then** the controller MUST call `clearWatch` on
   the burst subscription, reset its `previousFixWasMoving` flag,
   and resume relying solely on the base Smart subscription.
3. **Given** a burst is active, **When** another pair of fixes again
   shows ≥ 1 m/s motion, **Then** the controller MUST NOT start a
   second simultaneous burst (a single burst is in flight at any
   time); the existing burst's timer is left untouched.
4. **Given** the preset is switched from Smart to Fast (or Slow)
   while a burst is active, **When** `start(preset)` is invoked
   with the new preset, **Then** the controller MUST tear down the
   burst subscription before swapping the base subscription's
   options.
5. **Given** the locate state transitions to Off (via Stop —
   long-press, `Shift+Enter`, `Shift+Space`, permission revoke, or
   component destroy), **When** `stop()` or `dispose()` runs,
   **Then** the controller MUST tear down both the base AND the
   burst subscriptions and clear any pending burst timer.
6. **Given** Smart promote logic is enabled, **When** the *first*
   fix of a session is delivered (no previous fix exists), **Then**
   the controller MUST treat `previousFixWasMoving` as false and
   simply record the fix as the new baseline — it MUST NOT start a
   burst on a single fix.

### Edge Cases

- **Stationary user with GPS jitter**. If two consecutive fixes
  arrive 0.3 s apart with 5 m of jitter, the naive `distance / dt`
  computation would report 16 m/s and trigger a burst. The spec
  guards against this with the "**two consecutive** fixes show
  ≥ 1 m/s" rule plus a minimum-elapsed-time guard (`dt > 0`
  enforced; sub-second deltas are accepted because GPS jitter
  rarely produces *two* false-positives in a row, but a stricter
  `dt ≥ 1_000 ms` filter is a viable alternative — see Assumptions).
- **Preset is not Smart**. The promote-on-movement code path MUST
  short-circuit when `currentPreset !== 'smart'`. Fast already runs
  at high accuracy; Slow's throttle would defeat the purpose of a
  burst.
- **Fix delivered after `dispose()`**. The native geolocation API
  can deliver a final cached fix after `clearWatch` on some
  browsers. The controller's existing `if (this.disposed) return`
  guard at the top of `handlePosition` MUST continue to short-circuit
  before any promote-on-movement bookkeeping.
- **Two simultaneous bursts**. The "single burst in flight" rule
  is enforced by checking `this.burstWatchId !== null` before
  scheduling a new burst. This avoids racing two high-accuracy
  watchers and double-billing battery.
- **The burst's own fixes feed back into the promote logic**. The
  burst watcher's high-accuracy fixes flow through the same
  `handlePosition` path as the base watcher's. The controller MUST
  treat them as ordinary fixes for the `lastAcceptedFix` /
  `previousFix` bookkeeping; specifically, fixes delivered while a
  burst is active MUST NOT initiate *additional* bursts (the
  `burstWatchId !== null` guard ensures this).
- **`watchPosition` throws when starting the burst**. Like the
  base subscription in the existing `start(preset)` path, the
  burst's `watchPosition` call MUST be wrapped in `try { … } catch
  { … }`. On throw, the controller MUST silently abort the burst —
  it must NOT surface an `onPositionUnavailable` toast for a burst
  failure (the base subscription is still healthy and the user has
  already been given a fix). This is a deviation from feature
  013's base-subscription pattern, where a throw routes through
  `onPositionUnavailable`; rationale is in [`research.md`](./research.md)
  §R3.
- **iOS Safari user-gesture coupling**. The burst's `watchPosition`
  call is initiated from inside a `success` callback of an
  already-running watcher — NOT from a user-gesture handler.
  Research §R2 confirms iOS Safari ≥ 17 permits this because the
  permission was already granted for the base subscription; the
  burst inherits that grant.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Smart preset MUST observe consecutive position
  fixes and start a high-accuracy burst when two consecutive fixes
  show motion ≥ 1 m/s.
- **FR-002**: The burst MUST be a second `watchPosition`
  subscription with `enableHighAccuracy: true`, `maximumAge: 0`,
  `timeout: 10_000` — distinct from and concurrent with the base
  Smart subscription.
- **FR-003**: The burst MUST be torn down 5 000 ms after it
  started, via `clearWatch` on its subscription handle plus
  `clearTimeout` on its 5 s timer.
- **FR-004**: The motion threshold MUST be computed via the
  haversine great-circle distance between two consecutive
  `(lat, lon, timestamp)` triples; `Geolocation.speed` MUST NOT be
  consumed (frequently null on desktop / iOS Safari per feature
  013 research §R1).
- **FR-005**: Promote-on-movement logic MUST NOT activate when the
  current preset is `fast` or `slow`.
- **FR-006**: At most one burst MUST be in flight at any time.
- **FR-007**: `stop()` and `dispose()` MUST tear down both the
  base AND the burst subscriptions (clearing all `watchId`s and
  the burst timer).
- **FR-008**: Calling `start(preset)` while a burst is active
  MUST tear down the burst before re-subscribing the base
  watcher (covers user-initiated preset switches).
- **FR-009**: A `watchPosition` call that throws synchronously
  while starting the burst MUST be caught; the controller MUST
  reset burst state and continue with the base subscription
  intact. It MUST NOT call `onPositionUnavailable`.
- **FR-010**: Fixes delivered by the burst subscription MUST flow
  through the existing `onFix` callback path; the
  `LocateButton.svelte` / `locateSignal.ts` consumers MUST NOT
  need awareness that two subscriptions exist.
- **FR-011**: The first fix of a session (no `previousFix` on
  record) MUST be recorded as the baseline only; it MUST NOT
  initiate a burst.

### Key Entities

- **PromoteState** *(controller-internal)*: A small state cluster
  inside `GeolocationController`. Fields:
  - `previousFix: PositionFix | null` — the most recent raw fix
    used for motion comparison (separate from `lastAcceptedFix`,
    which is throttle-state for the Slow preset).
  - `previousFixWasMoving: boolean` — true iff the previous pair
    of fixes showed ≥ 1 m/s motion. Used to require **two
    consecutive** moving pairs before triggering a burst.
  - `burstWatchId: number | null` — `clearWatch` handle for the
    active burst subscription, null when no burst is active.
  - `burstTimer: ReturnType<typeof setTimeout> | null` — handle
    for the 5 s tear-down timer.
  Not persisted to `pwa_map:prefs`; lives entirely in the
  controller instance.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On the Smart preset, after a user starts moving at
  ≥ 1 m/s (walking pace), the next on-screen position update
  arrives within ≤ 5 s in ≥ 95 % of trials across the support
  matrix (iOS Safari ≥ 17, Android Chromium 120+, desktop
  Chromium 120+, desktop Firefox 120+). Restores feature 013's
  SC-005 target for the Smart preset.
- **SC-002**: When the user stops moving, the high-accuracy
  burst MUST cease within ≤ 6 s (5 s burst + 1 frame of timer
  resolution) and no further bursts MUST start within the next
  30 s if subsequent fixes show < 1 m/s motion. Verified by
  fake-timer unit tests on the controller.
- **SC-003**: Entry-chunk gzipped JS delta against the
  post-feature-013 baseline (`scripts/bundle-baseline.json`
  refreshed 2026-05-14, entry JS 103.72 KB) MUST stay ≤ +1.0 KB.
  No CSS delta. Project hard ceiling +6 KB still applies.
- **SC-004**: Battery cost while stationary on Smart MUST NOT
  regress relative to feature 013 — the burst MUST NOT fire when
  the user is not moving. Verified by a unit test that feeds 10
  consecutive fixes with ≤ 0.5 m drift and asserts zero burst
  starts.

## Assumptions

- **Motion threshold**. 1 m/s is the lower bound of a slow walking
  pace and matches feature 013 research §R1. It is intentionally
  permissive — any genuine motion (walking, biking, driving) will
  comfortably exceed it. It is also intentionally low enough that
  the test suite can drive a "moving" scenario with two fixes 5 s
  apart and a great-circle distance of 5 m.
- **Two-consecutive-moving-pairs guard**. The "must be moving for
  two consecutive pairs" rule (~10 s of sustained motion) prevents
  a single GPS jitter spike from triggering a wasteful burst. An
  alternative one-shot rule (single moving pair triggers burst) is
  rejected; rationale in research §R1.
- **Burst duration is fixed at 5 s**, NOT dynamic. Long-tail motion
  scenarios (a user walking for several minutes) will simply
  trigger successive bursts as each pair of fixes continues to
  exceed the threshold. This keeps the controller logic O(1) and
  the worst-case battery cost bounded.
- **Burst's options match the Fast preset's**
  (`enableHighAccuracy: true`, `maximumAge: 0`, `timeout: 10_000`).
  These are the strongest cadence-driving options available; using
  the Fast preset's documented triple keeps the contract surface
  shallow.
- **No persistence**. Promote-on-movement state lives in
  `GeolocationController` instance memory only. There is no
  `pwa_map:prefs` schema change (PREFS_VERSION stays at 4). On
  reload the controller starts fresh.
- **No new i18n strings**. The promote-on-movement branch is
  invisible to the user beyond the cadence change — no toast, no
  Settings label, no a11y announcement. The on-screen position
  dot's behaviour is the only externally observable effect.
- **No documentation surface for the user**. `docs/ui/` is not
  amended because no visible UI changes occur (the same position
  dot, just refreshing more often). Per Principle III, `docs/ui/`
  updates are required for *visible UI changes*; this feature is
  invisible. The decision to defer-then-restore is, however, a
  Constitution Principle V architectural decision, so a new ADR
  (0035) supersedes feature 013's ADR 0033 on this specific point.
