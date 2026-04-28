# Research — 013-locate-controls-layout

Phase 0 outputs. Each entry resolves a decision the plan and
contracts depend on. No `NEEDS CLARIFICATION` markers remain after
this document.

## R1 — Frequency-preset cadences (Smart / Fast / Slow)

### Decision

Each preset maps to a fixed `PositionOptions` triple plus an
internal *minimum dispatch interval* enforced by
`geolocationController.ts`:

| Preset | `enableHighAccuracy` | `maximumAge` | `timeout` | Min dispatch interval |
|--------|----------------------|--------------|-----------|-----------------------|
| Smart  | `false`              | 5 000 ms     | 30 000 ms | 0 ms (dispatch every fix); promote to `enableHighAccuracy: true` for 5 s after a movement burst (≥ 1 m/s heading from the previous fix) |
| Fast   | `true`               | 0 ms         | 10 000 ms | 0 ms                  |
| Slow   | `false`              | 30 000 ms    | 60 000 ms | 10 000 ms (drop fixes that arrive sooner than 10 s after the last accepted fix) |

The "Smart promote" branch is the *only* preset-internal adaptive
behaviour and is covered by `tests/unit/locate-frequency-cadence.spec.ts`.

### Rationale

- `watchPosition` dispatch cadence is largely browser-controlled;
  the spec contracts the user-visible *feel*, not exact intervals
  (Assumption: "Smart / Fast / Slow are presets, not user-tunable
  parameters"). The chosen options give the perceptual targets in
  SC-005 across the iOS Safari ≥ 17 / Android Chrome 120+ /
  desktop matrix:
  - Fast: ≤ 1 s perceived (high accuracy, no cache, short timeout
    pushes the OS to re-acquire).
  - Smart: ≤ 5 s while moving, 5–30 s while stationary
    (`maximumAge: 5000` lets the OS reuse a fresh cached fix; the
    promote-to-high-accuracy burst tightens cadence during real
    motion).
  - Slow: 10–15 s (`maximumAge: 30000` lets the OS skip costly
    GPS reacquire; the 10 s dispatch throttle clamps any
    burst-mode hardware cadence).
- `enableHighAccuracy` is the strongest driver of battery /
  perceptual-cadence tradeoff per the W3C Geolocation API
  guidance and the Mozilla developer docs; tuning `maximumAge` and
  `timeout` alone does not produce three perceptually distinct
  modes.
- Internal min-dispatch throttle (Slow only) is implemented by
  comparing `position.timestamp` to the last *accepted* fix and
  dropping if `delta < 10 000 ms`. It is NOT implemented by
  calling `clearWatch` / `watchPosition` repeatedly (that would
  rebuild the OS subscription on every cycle and cost battery).

### Alternatives considered

- **Three independent intervals exposed as numeric inputs**
  ("update every N seconds"). Rejected: the spec explicitly says
  "presets, not user-tunable parameters" (Assumption); a numeric
  input pushes a complex cadence-vs-battery tradeoff onto the
  user when three labelled choices already cover the realistic
  use cases.
- **Polling with `getCurrentPosition` + `setInterval`**.
  Rejected: `watchPosition` is the single API designed for
  continuous tracking; using `getCurrentPosition` in a loop
  prevents the browser from coalescing requests with the OS and
  produces noticeably worse battery on Android in informal
  testing.
- **Smart adapts via `Geolocation.heading` / `Geolocation.speed`**.
  Speed / heading are device-dependent and frequently null on
  desktop and iOS Safari. Rejected for a delta-based heuristic
  on previous fix's lat/lon (which is universally available).

## R2 — Long-press detection mechanism

### Decision

Use the `PointerEvent` family + a single `setTimeout(1500)`
scoped to a press lifetime. The detector lives inside
`LocateButton.svelte`:

```text
on:pointerdown   → record press-start; arm timer
on:pointerup     → if timer fired → Stop; else short-tap
on:pointercancel → cancel timer; no-op
on:pointerleave  → cancel timer; no-op (the pointer left the
                   button, treat as a moved-off press)
on:lostpointercapture → cancel timer; no-op
```

Browser support: `PointerEvent` is supported on every browser in
the project's matrix (iOS Safari ≥ 13, Android Chrome ≥ 55,
desktop Chrome / Firefox / Safari current). No `TouchEvent`
fallback is needed.

`pointerdown` calls `event.target.setPointerCapture(event.pointerId)`
to ensure `pointerup` fires on the button even if the pointer
moves slightly during the hold.

`event.preventDefault()` is called on `pointerdown` to suppress
iOS Safari's text-selection menu / context-menu on prolonged
press. The button has `touch-action: manipulation` and
`user-select: none` in CSS to belt-and-suspenders the same
intent.

### Rationale

- `PointerEvent` unifies mouse / touch / stylus into one event
  stream, so the long-press detector is a single code path on
  every platform. `TouchEvent` + `MouseEvent` dual handling is
  the older idiom and is unnecessary on the project's matrix.
- `setTimeout` (vs `requestAnimationFrame` polling) is the
  cheapest mechanism — one timer slot, one callback. The radial
  progress visual is CSS-only (a conic-gradient driven by a CSS
  custom property animated via a CSS `transition` from `0%` to
  `100%` over 1.5 s), so no JS frame loop is needed for the
  visual.
- `pointercancel` is fired by the OS when an interrupt steals
  the pointer (system gesture, scroll, modal). Treating it as
  cancel matches OS-native behaviour — the user did not complete
  the long-press intentionally.
- `setPointerCapture` keeps the press alive across small
  movements within the button without false `pointerleave`
  cancellations, which improves robustness on touch devices
  where finger drift is common.

### Alternatives considered

- **`touchstart` / `touchend` + manual time delta**.
  Rejected: needs a parallel `mousedown` / `mouseup` path; double
  the surface area and a known double-fire bug on Android Chrome
  when both event families are listened to.
- **`KeyboardEvent.repeat` for keyboard "long-press"**.
  Rejected per Clarifications Q2 (Option C): hold-Enter timing
  is unreliable across browsers (different repeat intervals,
  different behaviour during IME composition). Keyboard uses an
  explicit `Shift+Enter` / `Shift+Space` chord instead.
- **`requestAnimationFrame` polling for elapsed time**.
  Rejected: a single `setTimeout` is exactly equivalent for a
  one-shot threshold, costs less, and is easier to test with
  fake timers.

## R3 — Marker rendering choice

### Decision

Render the "you are here" position dot as a MapLibre `Marker`
(DOM-based). The marker DOM element is owned by App.svelte; it
is mounted via a small helper added to `MapController` and
unmounted when the locate state returns to Off.

```text
controller.attachLocateMarker(element) → handle
handle.setPosition(lat, lon)
handle.remove()
```

The element is a plain `<div>` with CSS classes that toggle on
the `LocateState` value (a CSS custom property
`--locate-state` driven by Svelte reactivity).

### Rationale

- A DOM Marker lets the position dot honour
  `prefers-reduced-motion: reduce` directly via CSS (the "pulse"
  animation can be disabled with one media query). A symbol /
  circle layer driven by GL would need engine-level animation
  control which is more complex.
- The element's accessible name (`role="presentation"`,
  `aria-hidden="true"`) is straightforward on a DOM element; on
  a GL layer it would need a sibling DOM proxy.
- Marker positioning is cheap on MapLibre — the engine
  re-projects the lat/lon on every frame anyway.
- Existing pattern: features 002 / 011 already use DOM elements
  for `DestinationIndicator.svelte` and `Crosshair.svelte`. The
  Marker is consistent with that idiom.

### Alternatives considered

- **GL circle layer with paint properties**. Rejected: more
  engine surface for an effect that has no zoom-dependent
  rendering needs; harder to apply reduced-motion overrides.
- **Custom canvas overlay**. Rejected: reinvents what
  `maplibregl.Marker` already provides.

## R4 — Permission API usage and user-gesture invocation

### Decision

Permission pre-flight uses `navigator.permissions.query({ name:
'geolocation' })` when available (best-effort). The result drives
the toast / button-disabled UX before the user tries to activate.
The actual permission prompt is invoked by calling
`navigator.geolocation.watchPosition(...)` synchronously inside
the `pointerup` handler that fires the short-tap from Off.

The `watchPosition` call MUST happen *before* any `await` /
`.then(...)` / `Promise.resolve()` boundary in the same handler,
because iOS Safari requires the geolocation API to be invoked in
the same microtask as the user gesture. The
`tests/integration/locate-button-permission.spec.ts` file
asserts this invariant by spying on `navigator.geolocation` and
checking the call order.

Error normalisation: the `PositionError.code` enum is mapped to a
zh notification key:

| `PositionError.code`            | Toast key                       |
|---------------------------------|---------------------------------|
| `1` `PERMISSION_DENIED`         | `locate.error.permissionDenied` |
| `2` `POSITION_UNAVAILABLE`      | `locate.error.positionUnavailable` |
| `3` `TIMEOUT`                   | `locate.error.timeout`          |
| (API absent / insecure context) | `locate.error.unavailable`      |

### Rationale

- The Permissions API is supported on iOS Safari ≥ 16, Android
  Chrome ≥ 43, desktop Chrome ≥ 43, Firefox ≥ 46, but querying
  is *advisory*: the actual prompt only fires when a privileged
  API is invoked. Pre-flight lets us skip the prompt + toast
  flow when the state is already `denied` from a prior session
  (FR-012).
- The user-gesture rule on iOS Safari has been stable since iOS
  13. Failing to satisfy it is a silent no-op (no error, no
  prompt). The integration-test spy is the only reliable way to
  catch a regression where someone refactors the handler to
  await something before the geolocation call.
- Mapping error codes to a finite zh-key catalog keeps i18n
  parity simple (3 locales × 4 keys = 12 entries).

### Alternatives considered

- **Always call `getCurrentPosition` once at app boot to "warm
  up" the permission**. Rejected: violates FR-009 (no
  geolocation API call at page load). Also surfaces an
  unsolicited prompt that users have explicitly told us they do
  not want.
- **Skip `navigator.permissions.query` entirely; rely only on
  the watchPosition error path**. Rejected: forces the user to
  re-trigger the toast on every tap when the permission was
  already permanently denied (FR-012 violation).

## R5 — Manual-pan-detection in Follow

### Decision

In Follow state, attach a `dragstart` listener to the underlying
MapLibre map. If the event has a truthy `originalEvent` (i.e.,
the drag was user-initiated), demote `LocateState` from Follow
to Show. Programmatic recenter calls (`recenterTo`) wrap their
underlying `easeTo` / `setCenter` in a transient `isRecentering`
guard flag set to `true` before the call and cleared after the
next `moveend`; while the flag is set, `dragstart` listeners
ignore the event.

A second listener on `move` / `dragstart` covers user-initiated
movement that does not produce a `dragstart` (e.g., arrow-key
pan on desktop emits `move` with a `KeyboardEvent` as
`originalEvent`).

### Rationale

- MapLibre fires `dragstart` with `originalEvent` set whenever
  the user drives the gesture (mouse drag, touch drag,
  keyboard pan). Programmatic moves from `easeTo` / `flyTo` /
  `setCenter` fire `dragstart` only if the engine internally
  promotes them — the `originalEvent` is null in those cases.
  This is the cleanest discriminator MapLibre exposes.
- The `isRecentering` guard belt-and-suspenders the discriminator
  so a future MapLibre upgrade that changes the originalEvent
  semantics doesn't silently break demotion.
- `move` (vs only `dragstart`) covers the keyboard-arrow case,
  which feature 006 keyboard-pan tests already exercise.

### Alternatives considered

- **Suppress all `dragstart` events while in Follow by calling
  `event.preventDefault()`**. Rejected: this would block the
  user's pan gesture entirely instead of demoting Follow; users
  expect "drag to look around" to actually move the map.
- **Demote Follow to Off on manual pan**. Rejected per
  Clarifications Q4: demoting straight to Off would feel
  destructive (the user just wanted to look around, not stop
  tracking).

## R6 — Reduced-motion strategy

### Decision

Three reduced-motion branches:

1. **Long-press radial progress fill** — suppressed entirely
   under `(prefers-reduced-motion: reduce)`. The button instead
   renders an `aria-live="polite"` element that announces
   "按住停止…" (zh) / "Hold to stop…" (en) / "押し続けて停止…"
   (ja) on `pointerdown` and clears it on press end (release or
   threshold). The 1.5 s threshold still fires Stop.
2. **Follow recenter animation** — under reduced motion, use
   `setCenter([lon, lat])` instead of `easeTo({ center: [...] })`.
   Mirrors the existing pattern in `Compass.svelte` line 14
   (`controller.resetBearing(!reducedMotion)`).
3. **Marker pulse** (if rendered) — disabled via
   `@media (prefers-reduced-motion: reduce) { .locate-marker
   { animation: none !important; } }`.

The detection idiom matches `Compass.svelte`:

```ts
const reducedMotion =
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;
```

### Rationale

- Suppressing the radial fill entirely (rather than swapping to a
  different but still-animated visual) is the most conservative
  reduced-motion interpretation per WCAG 2.1 SC 2.3.3.
- The aria-live announcement keeps the long-press *discoverable*
  for screen-reader users — without it, the only signal that
  Stop is about to fire would be the visual progress, which
  reduced-motion users have explicitly opted out of.
- `setCenter` is instantaneous, which exactly matches reduced-
  motion intent. `easeTo` defaults to a 200 ms ease which still
  reads as motion to a reduced-motion user.

### Alternatives considered

- **Ignore reduced-motion for the long-press visual**. Rejected:
  WCAG 2.1 SC 2.3.3 + the project's reduced-motion baseline
  (feature 006) make this non-negotiable.
- **Replace the radial fill with a step-function "0% / 50% /
  100%" indicator that updates without continuous animation**.
  Rejected: any visual progress under reduced-motion is more
  surprising than an audible aria-live announcement; the
  step-function is also more code than the suppress-and-
  announce branch.

## R7 — Preferences v4 additive migration

### Decision

`FormatPreferencesV4` adds exactly one optional-at-the-schema-
level-but-required-at-the-validator-level field:

```ts
export interface FormatPreferencesV4 {
  readonly version: 4;
  // ...all v3 fields, unchanged...
  readonly locateFrequency: LocateFrequencyPreset;  // NEW
}
```

`PREFS_VERSION` bumps from `3` → `4`. The validator
(`validatePreferences`) accepts `version` ∈ {1, 2, 3, 4} and
substitutes `locateFrequency: 'smart'` for any input where the
field is missing or invalid (additive migration per ADR 0021).

The `defaultPreferences()` factory adds `locateFrequency:
'smart'` to its return shape.

The `__TESTING__` export gains `LOCATE_FREQUENCY_DEFAULT` so
tests can assert the migration explicitly.

### Rationale

- ADR 0021 (`prefs-additive-evolution.md`) prescribes this
  exact pattern: bump version, add a v(N+1) interface, accept
  prior versions in the validator, fall back per-field on
  missing / invalid inputs. Following the pattern keeps the
  preference layer immune to "user-on-version-N upgrades to
  version-N+1" failures (a recurring loss mode in projects that
  use a flat key-value blob).
- Default `'smart'` matches FR-023.
- A single bump (rather than a per-feature key
  `pwa_map:locateFrequency`) keeps the project's persistence
  surface to the *same two keys* used since feature 010
  (`pwa_map:prefs` + `pwa_map:lastView` + `pwa_map:installDismissedUntil`).
  A new top-level key would be a new public surface that
  another feature could collide with.

### Alternatives considered

- **A separate `pwa_map:locateFrequency` key**. Rejected: ADR
  0021 favours additive evolution over key proliferation.
- **A non-versioned struct loaded out-of-band**. Rejected: the
  validator + migration discipline is exactly what makes
  `pwa_map:prefs` resilient; bypassing it for one field would
  fragment the storage strategy.
