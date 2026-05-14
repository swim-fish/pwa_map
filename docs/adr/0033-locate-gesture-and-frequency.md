# 0033. Locate gesture model + frequency preset architecture

**Status**: Accepted
**Date**: 2026-04-28
**Feature**: `specs/013-locate-controls-layout/`

## Context

Feature 013 introduces a "my location" button as the third member of the on-map control cluster. Three architectural decisions had to be settled before the implementation could land:

1. **Gesture model** — how does the user transition between the three states (Off, Show, Follow)?
2. **Frequency presets** — how is the watcher's update cadence exposed to the user?
3. **Permission flow** — when and how is `navigator.geolocation` invoked, given iOS Safari's user-gesture requirement?

Each was contested during `/speckit.clarify` 2026-04-28 (Q1–Q5) and the chosen options shape the runtime architecture beyond the scope of any single component.

## Decision

### 1. Two-gesture model: short-tap toggle + long-press stop

The button has three states (Off, Show, Follow). A short-tap toggles between Show and Follow; a press-and-hold ≥ 1.5 s (or `Shift+Enter` / `Shift+Space` while focused) reaches Off from any active state. The first short-tap from Off transitions to Show — never directly to Follow — so the first geolocation fix arrives without a surprise camera move.

Manual map pan in Follow auto-demotes to Show (the marker keeps updating; the map stops chasing). A long-press from Off is a no-op (`FR-014g`); the radial-progress visual is suppressed in this state to avoid implying that Stop is about to fire.

The model lives in a pure state-machine module `src/map/locateMachine.ts` with no DOM, no clock, and no map dependencies — `transition(snapshot, event)` is referentially transparent and verified by 32 unit tests covering all 18 (state × event) cells.

### 2. Three labelled frequency presets, persisted to `pwa_map:prefs` v4

Settings exposes three radios — Smart (default), Fast, Slow — each mapping to a fixed `PositionOptions` triple:

| Preset | `enableHighAccuracy` | `maximumAge` | `timeout` | Internal throttle                 |
| ------ | -------------------- | ------------ | --------- | --------------------------------- |
| Smart  | `false`              | 5 000 ms     | 30 000 ms | none                              |
| Fast   | `true`               | 0 ms         | 10 000 ms | none                              |
| Slow   | `false`              | 30 000 ms    | 60 000 ms | min 10 s between dispatched fixes |

The chosen preset is stored in `pwa_map:prefs` schema v4 alongside `formatOrder`, `tileTtlDays`, etc. — the same key feature 010 already uses (additive evolution per ADR 0021). PREFS_VERSION bumps from 3 → 4; v1/v2/v3 records migrate with `locateFrequency: 'smart'` as the default. Live-apply during an active watcher is wired via a tiny `locateFrequencyStore` Svelte writable: `SettingsSheet.svelte` writes via `setLocateFrequency(preset)`, `LocateButton.svelte` subscribes and calls `geo.start(newPreset)` when the watcher is already running.

### 3. Permission requested only on user gesture; pre-flight via `navigator.permissions.query`

The geolocation API is **never** called at page load (`FR-009`). The first `navigator.geolocation.watchPosition` call is invoked synchronously inside the `click` (or `pointerup` → click bubble) handler that fires the short-tap from Off, satisfying iOS Safari's user-gesture requirement. A pre-flight `navigator.permissions.query({ name: 'geolocation' })` runs at component mount as best-effort detection — if the result is `denied` from a prior session, subsequent taps surface the toast directly without invoking `watchPosition` (which would silently no-op on iOS Safari and reset the prompt count).

The `GeolocationController` class encapsulates the watcher lifecycle: `start(preset)` / `stop()` / `dispose()`, plus error normalisation that maps `PositionError.code` → discrete callbacks (`onPermissionDenied` / `onPositionUnavailable` / `onTimeout`). Repeated codes 2 / 3 are debounced to one toast per 5 s.

## Consequences

- **Bundle delta**: net +4.48 KB gzipped on the entry JS chunk (measured against post-feature-012 baseline). Within the +6 KB per-feature ceiling but exceeds the +3 KiB plan target. Trade-off documented in plan.md Complexity Tracking. The Smart preset's research-suggested "promote to high accuracy on motion" burst was dropped to fit the budget; it can be reintroduced in a future feature if telemetry shows users notice cadence drops while moving on Smart. **Superseded by ADR 0035 (2026-05-14)** — the burst was restored in feature 014 after the post-feature-013 bundle baseline refresh freed budget.
- **iOS Safari coupling**: The user-gesture invariant is enforced by the integration test `tests/integration/locate-button-permission.spec.ts` (T020), which asserts `watchPosition` is invoked synchronously inside the `pointerup`/`click` handler before any `Promise.resolve().then` boundary. A regression on this would break iOS Safari silently; the test is the single load-bearing assertion.
- **Reload behaviour**: After a reload the my-location button always returns to Off (`FR-028`). This protects iOS Safari (no user gesture is in flight at page load) and matches the user's "default off" contract from `/speckit.specify`. Persisting the active state across reloads would silently re-trigger the watcher on every load and is explicitly rejected.
- **Accessibility coupling**: `aria-keyshortcuts="Enter Space Shift+Enter Shift+Space"` is the single advertised contract for screen-reader users to discover the Stop chord. WCAG 2.1 SC 2.5.1 (no path-dependent gestures) is satisfied because every state pair is reachable via either keyboard or pointer.

## Alternatives considered

- **Three-tap cycle (Off → Show → Follow → Off)**, the original draft assumption. Rejected per `/speckit.clarify` Q1 — separating the destructive Stop action onto a deliberately distinct gesture prevents stray short-taps from silently killing the watcher.
- **Numeric interval slider** for the frequency setting (e.g., "update every N seconds"). Rejected: the spec explicitly contracts "presets, not user-tunable parameters" — a numeric input pushes the cadence-vs-battery tradeoff onto the user when three labelled choices already cover the realistic use cases.
- **Auto-resume the watcher on reload** if a prior session ended in Show / Follow. Rejected per `/speckit.clarify` Q3 / FR-028 — iOS Safari's user-gesture rule makes silent re-arming unreliable, and the user explicitly requested "default off".
- **Hold-Enter via `KeyboardEvent.repeat` for keyboard long-press**. Rejected per `/speckit.clarify` Q2 — repeat timing varies across browsers and breaks during IME composition. The `Shift+Enter` chord is the documented, deterministic alternative.
- **Separate top-level storage key (`pwa_map:locateFrequency`)** for the preset. Rejected — ADR 0021 favours additive evolution of `pwa_map:prefs` over key proliferation, keeping the project's persistence surface to two keys.
- **Smart preset adapts via `Geolocation.heading` / `Geolocation.speed`**. Rejected — those fields are device-dependent and frequently null on desktop / iOS Safari. The current Smart preset is purely `maximumAge: 5_000` + `enableHighAccuracy: false` and relies on the browser's built-in governance.

## Cross-references

- **ADR 0021 — `prefs-additive-evolution`**: dictates the v3 → v4 migration pattern.
- **ADR 0026 — `compass-and-crosshair-zoom`**: pattern source for `controller`-prop-based on-map components and the `bearingSignal` Svelte store mirrored by `locateSignal`.
- **`docs/ui/0013-locate-controls-layout.md`**: visible behaviour record.
- **`specs/013-locate-controls-layout/research.md`**: long-form rationale for R1–R7 decisions.
- **`.claude/rules/quality-gates.md`**: bundle budget gate; `pwa-positioning.md`: safe-area token discipline.
