> **Post-implementation note (Addendum 2026-04-28)**: the realised
> component diverges from the original design in three ways:
>
> 1. **Press visual** — the original radial conic-gradient fill driven
>    by `--progress` was simplified to a `box-shadow: 0 0 0 2px
>    var(--color-accent)` ring with a 1.5 s linear transition (bundle
>    trim). Reduced-motion fallback (aria-live announcement) unchanged.
> 2. **Press-state local fields** — the implementation does NOT keep a
>    standalone `pressStartedAt: number | null` field; press timing is
>    derived from `pressTimerId !== null`. The flag set listed below
>    (`pressTimerId`, `pressing`, `activePointerId`, `reducedMotionAnnouncement`)
>    is faithful; only the timestamp diary entry was dropped.
> 3. **On-map marker** — the marker is rendered directly via
>    `maplibregl.Marker` inside `LocateButton.svelte`'s `onFix`
>    callback (CSS class `:global(.locate-marker)`); the original
>    `MapController.attachLocateMarker` indirection was inlined.
>
> The behavioural contracts (gestures, a11y attrs, threshold, reduced
> motion fallback) below remain authoritative.

# Contract — `src/components/LocateButton.svelte`

The visible Svelte component. Owns the gesture-detection wiring,
the radial progress visual, the accessible name selection, and
the keyboard-shortcut announcement. State transitions delegate
to `locateMachine` via `locateSignal`.

## Public props

```ts
export let controller: MapController;
```

That is the only prop — the same shape the existing `Compass.svelte`
and `ZoomControls.svelte` consume. The component is component-
local for everything else (no `open` prop because the button is
always rendered when the cluster is rendered).

## Emitted events

None. State changes are observed via the `locateSignal` store.

## Internal state fields (not exposed)

```ts
let pressTimerId: ReturnType<typeof setTimeout> | null = null;
let pressStartedAt: number | null = null;
let activePointerId: number | null = null;
let reducedMotionAnnouncement = '';   // bound to aria-live element
let geo: GeolocationController;        // constructed lazily on first start
```

## Gesture wiring

### Pointer events (touch + mouse + stylus)

```text
on:pointerdown
  → if state ∈ {show, follow}: armPressTimer(1500)
                                pressStartedAt = Date.now()
                                set CSS class `pressing` on the button (drives the radial fill)
                                if reducedMotion: reducedMotionAnnouncement = $tStore('locate.button.aria.holdToStop')
                                event.target.setPointerCapture(event.pointerId)
                                activePointerId = event.pointerId
                                event.preventDefault()
on:pointerup
  → if pressTimerId fired (long-press completed): applyLocateEvent({ type: 'longPress' })
    else if pressStartedAt set and (Date.now() - pressStartedAt) < 1500: applyLocateEvent({ type: 'shortTap' })
                                                                        if state was 'off' → fire start(preset)
                                                                        if next state was 'follow' → recenterTo(lastFix)
    cleanupPress()
on:pointercancel | pointerleave | lostpointercapture
  → cleanupPress()
```

`armPressTimer(ms)` sets a `setTimeout` that, on fire, dispatches
`{ type: 'longPress' }` to `applyLocateEvent` and stops the
watcher. `cleanupPress()` clears the timer, resets
`pressStartedAt`, removes the `pressing` class, clears
`reducedMotionAnnouncement`, releases pointer capture, and
nulls `activePointerId`.

### Keyboard events

```text
on:keydown
  → if (event.key === 'Enter' || event.key === ' ') and not event.shiftKey:
        event.preventDefault()
        if state === 'off' → fire start(preset) synchronously
        applyLocateEvent({ type: 'shortTap' })
  → if (event.key === 'Enter' || event.key === ' ') and event.shiftKey:
        event.preventDefault()
        if state ∈ {show, follow}: applyLocateEvent({ type: 'longPress' })
        else: no-op (matches FR-014g)
```

The `event.preventDefault()` for Space prevents the page from
scrolling. Enter prevents form submission semantics if the button
is somehow nested (defensive).

### A11y attributes

```html
<button
  type="button"
  data-testid="locate"
  aria-label={accessibleNameForState($locateSignal)}
  aria-pressed={$locateSignal.state !== 'off'}
  aria-keyshortcuts="Enter Space Shift+Enter Shift+Space"
  aria-disabled={$locateSignal.permission === 'unavailable'}
  class="locate"
  class:state-off={$locateSignal.state === 'off'}
  class:state-show={$locateSignal.state === 'show'}
  class:state-follow={$locateSignal.state === 'follow'}
  class:disabled={$locateSignal.permission === 'unavailable'}
  on:pointerdown={onPointerDown}
  ...
>
  <svg aria-hidden="true">…</svg>
</button>
<span class="aria-live" aria-live="polite">{reducedMotionAnnouncement}</span>
```

`accessibleNameForState`:

| state    | permission       | accessible name key (zh value)         |
|----------|------------------|----------------------------------------|
| `off`    | `prompt`/`granted` | `locate.button.aria.off` (「啟用定位」) |
| `show`   | (any)            | `locate.button.aria.show` (「定位中（顯示）」) |
| `follow` | (any)            | `locate.button.aria.follow` (「定位中（跟隨）」) |
| any      | `unavailable`    | `locate.button.aria.disabled` (「定位不可用」) |

`aria-pressed` reflects active vs Off; not state-specific (Off /
Show / Follow are not a pressed-axis triple, but the spec is
unambiguous about distinguishing them via accessible name +
visual class). `aria-keyshortcuts` advertises both Enter / Space
toggle and Shift+Enter / Shift+Space stop.

### Visual contract — radial progress fill

Driven by a CSS class `pressing` and a custom property:

```css
.locate {
  --progress: 0%;
  background-image: conic-gradient(
    var(--color-accent, #2563eb) var(--progress),
    transparent var(--progress)
  );
}
.locate.pressing {
  --progress: 100%;
  transition: --progress 1500ms linear;
}

@media (prefers-reduced-motion: reduce) {
  .locate.pressing {
    --progress: 0%;
    transition: none;
    background-image: none;
  }
}
```

The CSS `transition: --progress` requires `@property` registration
for the custom property to interpolate; `tokens.css` (or this
component's style block) registers it:

```css
@property --progress {
  syntax: '<percentage>';
  initial-value: 0%;
  inherits: false;
}
```

Cancelling the press by removing the `pressing` class
instantly resets `--progress` to `0%` (no reverse animation),
matching the OS-native long-press cancel feel.

## Reduced-motion branch

- `pressing` class still toggles, but the `@media (prefers-
  reduced-motion: reduce)` rule above suppresses the visual
  transition.
- The aria-live element receives the "按住停止…" string on
  pointerdown and is cleared on press end.
- The 1.5 s threshold still fires Stop.

## Component-local cleanup (per `.claude/rules/pwa-component-state.md`)

```ts
onDestroy(() => {
  cleanupPress();
  geo?.dispose();
});
```

Because the component has no `open` prop, the standard
`$: if (!open) { ... }` cleanup pattern does not apply.
However, every flag (`pressTimerId`, `pressStartedAt`,
`activePointerId`, `reducedMotionAnnouncement`,
`pressing` class) MUST be reset by `cleanupPress` so that a
sequence of pointerdown → pointercancel → pointerdown does not
leave stale state.

## Test contract

`tests/integration/locate-button-permission.spec.ts` (US2):

- First short-tap from Off invokes the geolocation API
  synchronously inside the `pointerup` handler; verified by
  the call-order spy described in the geolocation-controller
  contract.
- Permission deny → toast + state stays `off` + button visual
  returns to Off.
- Permission unavailable → button renders with `disabled`
  class and `aria-disabled="true"`; pointerdown does NOT arm
  the long-press timer (no progress visual).

`tests/integration/locate-button-cycle.spec.ts` (US3):

- shortTap from Off transitions to Show; map does not recenter.
- shortTap from Show transitions to Follow; map recenters via
  `controller.recenterTo`.
- shortTap from Follow transitions to Show; map does not
  recenter on the next position fix.

`tests/integration/locate-button-long-press.spec.ts` (US3):

- Use `vi.useFakeTimers()`. Fire `pointerdown`; advance 1500
  ms; fire `pointerup`. Expect state → `off`.
- Fire `pointerdown`; advance 1000 ms; fire `pointerup`.
  Expect short-tap behaviour (state toggles per the cycle).
- Fire `pointerdown`; advance 800 ms; fire `pointercancel`.
  Expect no state change, no Stop.
- Fire `pointerdown` from `off`; advance 1500 ms; fire
  `pointerup`. Expect no state change (FR-014g) and `pressing`
  class never applied.

`tests/integration/locate-button-keyboard.spec.ts` (US3):

- `Enter` key from Off → Show; `Enter` from Show → Follow;
  `Enter` from Follow → Show.
- `Space` mirrors `Enter`.
- `Shift+Enter` from Show / Follow → Off.
- `Shift+Space` mirrors `Shift+Enter`.
- `Shift+Enter` from Off → no-op (FR-014g).
- `aria-keyshortcuts` attribute equals
  `"Enter Space Shift+Enter Shift+Space"`.

`tests/integration/locate-button-reduced-motion.spec.ts` (US3):

- Stub `window.matchMedia('(prefers-reduced-motion: reduce)')`
  to match. Pointerdown does NOT animate `--progress`; the
  `aria-live` element receives the zh "按住停止…" text. After
  1500 ms with the press still active, Stop fires. After
  pointerup before 1500 ms, the aria-live element clears.

`tests/integration/locate-manual-pan-demote.spec.ts` (US3,
FR-018):

- Drive state to Follow; simulate a MapController `move` event
  with a non-null `originalEvent`. Expect state to demote to
  Show on the same tick. Marker still updates on the next
  `firstFix` event; map does not recenter.
- Programmatic `recenterTo` call (which sets the
  `isRecentering` guard) MUST NOT trigger demotion even if
  the underlying map fires `move` during the eased animation.
