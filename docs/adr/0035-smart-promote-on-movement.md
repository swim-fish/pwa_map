# 0035. Smart preset — promote-on-movement cadence boost

**Status**: Accepted
**Date**: 2026-05-14
**Feature**: `specs/014-smart-promote-cadence/`
**Supersedes**: 0033 (partial — the "deferred Smart-promote burst" bullet of its Consequences section)

## Context

Feature 013 introduced the Smart / Fast / Slow update-frequency presets but deferred the Smart preset's _promote-on-movement_ adaptive branch during bundle-budget trim — see ADR 0033 Consequences and `specs/013-locate-controls-layout/plan.md` Complexity Tracking. With the deferral, Smart's user-visible cadence while moving became device-dependent: typically 5–10 s on modern Chromium and iOS Safari ≥ 17, but allowed to drift to 15–30 s on devices whose default `enableHighAccuracy: false` cadence is slow. The Fast preset already met SC-005 (≤ 1 s) deterministically and the Slow preset was application-throttled (≤ 15 s), so Smart was the only preset whose user-visible cadence was non-deterministic.

Three things changed between 2026-04-28 (ADR 0033) and 2026-05-14 to make this affordable now:

1. The post-feature-013 bundle baseline was refreshed via `npm run bundle-size -- --update-baseline`. Entry-chunk gzipped JS was 103.72 KB at the refresh — well within the 200 KB project entry budget — so any feature could afford a small delta.
2. Feature 013's measured +4.71 KB delta was already absorbed into the new baseline, freeing the entire +6 KB per-feature ceiling for the next feature.
3. Manual quickstart testing of the shipped Smart preset on real devices flagged perceivable cadence drift while walking on Smart on one Android Chromium build, increasing the priority of restoring the burst.

## Decision

Restore the deferred branch inside `src/map/geolocationController.ts`:

- When the active preset is `'smart'` and `handlePosition` delivers a fix, evaluate motion against the **previous fix**: compute the haversine great-circle distance, divide by the timestamp delta, and treat the pair as moving when speed ≥ 1 m/s.
- Require **two consecutive moving pairs** (≈ 10 s of sustained motion) before initiating a burst. This guards against single GPS-jitter spikes that can synthesise a false ≥ 1 m/s reading from sub-second deltas on stationary devices.
- The burst itself is a second concurrent `navigator.geolocation.watchPosition` subscription with `{ enableHighAccuracy: true, maximumAge: 0, timeout: 10_000 }` (identical to the Fast preset's published triple — `frequencyToWatchOptions('fast')`) and a `setTimeout(endBurst, 5_000)` tear-down.
- At most **one burst** is in flight at any time; the guard is `this.burstWatchId !== null` inside `maybePromoteOnMovement`.
- `endBurst()` is called on `stop()`, `dispose()`, and at the top of `start(preset)` (preset switch, including Smart → Smart). The burst is also self-terminating after 5 s via its `setTimeout`.
- Burst-specific `watchPosition` throws are caught and swallowed silently — the base subscription is still healthy and the user is still seeing fixes; surfacing a toast would confuse the user about a cadence-only failure.

The public surface of `GeolocationController` and the exported `frequencyToWatchOptions(preset)` mapping are unchanged. Consumers (`LocateButton.svelte`, `locateSignal.ts`, `App.svelte`) receive the cadence boost transparently.

## Consequences

- **Bundle delta**: net **+0.45 KB** gzipped on the entry JS chunk against the post-feature-013 baseline (entry JS 103.72 KB → 104.17 KB). CSS gzipped delta is 0 KB. Within the +1.0 KB plan target and the +6 KB per-feature ceiling. Full measurement recorded in `specs/014-smart-promote-cadence/plan.md` Complexity Tracking.
- **SC-005 restored**: the Smart preset's "≤ 5 s while moving" target is now deterministic in ≥ 95 % of trials across the support matrix. Replaces feature 013 spec Addendum A2's "best-effort, device-dependent" caveat.
- **Battery cost while moving**: a high-accuracy `watchPosition` runs concurrently with the base Smart subscription for at most 5 s per burst, at most one burst in flight. Battery cost while stationary is unchanged (SC-004, verified by a 10-stationary-fix unit test that asserts zero burst starts).
- **Battery cost while sustained-moving**: a user walking for several minutes triggers successive bursts as each pair of fixes continues to exceed the threshold — each burst is 5 s of high-accuracy + a refractory window equal to the base Smart cadence's next pair (so ≈ 50 % high-accuracy duty cycle while genuinely moving). This is the intended tradeoff: cadence > battery while the user is moving and watching the map.
- **No persistence**: promote-on-movement state lives in `GeolocationController` instance memory only. Reload starts fresh. `pwa_map:prefs` schema stays at v4 — no migration.
- **iOS Safari user-gesture coupling**: the burst's `watchPosition` is invoked from inside the success callback of the base watcher, NOT from a user-gesture handler. WebKit ≥ 17 permits this because permission was already granted for the base subscription. The base subscription's first call still satisfies feature 013's FR-010 / `tests/integration/locate-button-permission.spec.ts`.
- **Test coverage**: 14 new vitest cases in `tests/unit/geolocation-controller-promote.spec.ts` cover FR-001..FR-011 plus SC-004 (stationary 10-fix). The existing `tests/unit/locate-frequency-cadence.spec.ts` gains one assertion confirming `frequencyToWatchOptions('smart')` still returns the documented non-burst triple — burst options do not bleed into the published API.
- **No visible UI change**: the on-screen position dot uses the same styling and tokens; only the refresh cadence changes. `docs/ui/` is not amended (Principle III requires updates only for visible UI changes).
- **Supersedes ADR 0033 partially**: the "Smart preset's research-suggested 'promote to high accuracy on motion' burst was dropped to fit the budget" sentence in ADR 0033 Consequences is now superseded. The bullet has been amended in-place with a "Superseded by ADR 0035 (2026-05-14)" note rather than rewriting the ADR — feature 013's main gesture-model / preset / permission decisions remain valid.

## Alternatives considered

- **Single-moving-pair trigger** (one pair ≥ 1 m/s → immediate burst). Rejected: GPS jitter false-positive rate is too high. Informal estimate from feature 013 manual testing on stationary devices: ~5 % of consecutive-fix pairs report > 1 m/s drift. Two consecutive pairs drops this to estimated ~0.25 %.
- **Three-consecutive-moving-pairs guard**. Rejected: adds another ~5 s of latency before the burst fires. The whole point is to tighten cadence ≤ 5 s; requiring ~15 s of evidence defeats the contract.
- **Speed via `Geolocation.speed`** instead of haversine delta. Rejected as in feature 013 R1: `speed` is `null` on a non-trivial subset of the support matrix (most desktops, many iOS Safari builds).
- **Velocity from a Kalman filter or moving average over N fixes**. Rejected: increases controller state, complicates testing, and the simple two-pair heuristic is provably sufficient at the precision we need.
- **Custom burst options with even shorter `timeout`** (e.g., 5_000 ms). Rejected: the burst is already only 5 s long; a 5_000 ms timeout means at most one timeout error per burst, which is wasteful telemetry.
- **Dynamic burst duration** (extend to 10 s if motion continues at burst end). Rejected: increases controller state and the worst-case battery cost while a long-walking session triggers a successive-burst chain naturally — each fresh pair re-arms the trigger.
- **Route burst-throw to `onPositionUnavailable`**. Rejected: the base subscription is still healthy and the user is still receiving fixes. Surfacing a toast for a cadence-only failure would confuse the user about what failed. This contrasts with the base subscription's `start(preset)` throw handling (PR #5 review C-2 / Codex P2), which DOES route to `onPositionUnavailable` because a base throw leaves the user with no fixes at all.
- **Re-open ADR 0033 and amend its decision** rather than write a new ADR. Rejected per `docs/adr/README.md` "Amending an ADR" guidance — never rewrite a landed ADR in place; write a new one whose Supersedes column references the older one (here, partially).

## Cross-references

- **ADR 0033 — `locate-gesture-and-frequency`**: the parent decision whose deferred-burst bullet this ADR partially supersedes.
- **ADR 0021 — `prefs-additive-evolution`**: not relied on here (no schema change), referenced for symmetry.
- **`specs/014-smart-promote-cadence/research.md`**: long-form rationale for R1–R5 decisions.
- **`specs/014-smart-promote-cadence/contracts/geolocation-controller-burst.md`**: internal contract: 4 new private fields, 3 new private methods, integration points.
- **`.claude/rules/quality-gates.md`**: bundle budget gate.
