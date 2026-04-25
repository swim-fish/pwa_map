# Contract: Destination Indicator

**Feature**: `002-goto-split-input`
**Surface**: `src/components/goto/DestinationIndicator.svelte`
**Consumers**: `App.svelte` (mounts the indicator), `GoToDialog`
(triggers `start()` after a successful `flyTo`), E2E tests.

This contract defines the transient post-Go-To overlay described by
FR-010 + US3.AS3 / AS4 + SC-007.

---

## 1. Visual + interaction model

- The indicator is a **DOM overlay**, not a MapLibre marker
  (research D4).
- It is fixed to the **viewport center** (`position: fixed; left: 50%;
  top: 50%; transform: translate(-50%, -50%)`).
- It does NOT pan or zoom with the map; it is glued to the screen.
- It fades **in** over 200 ms ease-out on `start()`, holds for ~3 s,
  then fades **out** over 300 ms ease-out.
- The indicator is purely decorative: it has `aria-hidden="true"` and
  carries no labelled text. (Screen-reader feedback for a successful
  Go-To uses the existing `aria-live="polite"` toast region from
  feature 001.)
- `pointer-events: none` so it never blocks map interactions.

---

## 2. Public API

```svelte
<!-- DestinationIndicator.svelte -->
<script lang="ts">
  export function start(): void; // shows / restarts the 3 s timer
  export function stop(): void;  // immediate hide; cancels timer
</script>
```

Or, equivalently, exposed via a Svelte store consumed at the App level:

```ts
// src/components/goto/destinationStore.ts
import { writable } from 'svelte/store';
import type { DestinationIndicator } from '$types/goto';

export const destinationIndicator = writable<DestinationIndicator>({
  visible: false,
  createdAt: 0,
  ttlMs: 3000,
});

export function startIndicator(): void;
export function stopIndicator(): void;
```

The implementation MAY pick whichever style best matches the rest of
`App.svelte`'s composition; the externally-observable behaviour
(start, hide-on-pan, auto-fade-after-3s) is the contract.

---

## 3. Behaviour rules

| Event | Effect |
|---|---|
| Successful `flyTo` returns | `start()` is called → indicator becomes visible, `createdAt = now`. |
| 3 s elapses without interaction | Indicator fades out (`visible = false`). |
| `MapController.onMove` fires before 3 s elapses | `stop()` is called → indicator hides immediately within ≤ 150 ms (SC-007). |
| Second successful `flyTo` while visible | `start()` re-triggered → fade-in restarts; `createdAt = now`. |
| `MapController.onMoveEnd` from the `flyTo`'s own animation | Ignored — only **user-initiated** moves stop the indicator. |

> **User-initiated vs program-initiated `move`**: the indicator MUST
> distinguish between MapLibre's animated `move` events emitted during
> a `flyTo` (which should NOT hide the indicator) and a real user pan
> (which MUST hide it). The implementation does this by ignoring
> `move` events whose timestamp is within the `flyTo` duration window
> (`now - flyToStartedAt < flyToDuration + 50ms`). The 50 ms buffer
> covers MapLibre's tail-end animation frames.

---

## 4. Performance + a11y budgets

- **SC-007**: dismissal latency on user pan ≤ 150 ms. Implementation
  detail: `start()` registers a one-shot listener via
  `MapController.onMove`; the listener calls `stop()` synchronously.
- Fade-out animation: 300 ms ease-out at 60 fps; CSS-only, no JS
  per-frame.
- A11y: `aria-hidden="true"`; never receives focus; never announces
  to assistive tech (those go through the toast region).

---

## 5. Test obligations

### Unit (Svelte component spec)

1. After `start()`, the component renders `[data-testid="dest-indicator"]`
   with class `visible`.
2. After 3 s (with `vi.useFakeTimers()`), the visible class is removed.
3. `stop()` removes the visible class within one tick.
4. Calling `start()` again while visible resets the timer (test by
   advancing 2 s, calling `start()`, advancing another 2 s — the
   indicator is still visible because the second `start()` reset).

### Integration

5. Successful Go-To → indicator becomes visible; mocked `MapController`
   emits a user `move` after 100 ms → indicator hides within 150 ms.

### E2E (`tests/e2e/story-3b-split-and-recents.spec.ts`)

6. US3.AS3 — submit a Go-To, observe `[data-testid="dest-indicator"]`
   becomes visible, then absent after ~3.4 s (3 s + 300 ms fade-out
   tolerance).
7. US3.AS4 — submit a Go-To, programmatically pan the map within 1 s,
   observe the indicator is removed within 150 ms.
