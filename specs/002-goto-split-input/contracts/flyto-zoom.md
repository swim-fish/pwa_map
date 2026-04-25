# Contract: `MapController.flyTo` — Zoom Preservation

**Feature**: `002-goto-split-input` (amends behaviour from feature 001)
**Surface**: `src/map/MapController.ts :: flyTo`
**Consumers**: `App.svelte`, anyone wiring a Go-To submit to the map.

This contract narrows the `flyTo` semantics from feature 001 so that
**Go-To never silently changes the operator's chosen zoom** (FR-011 +
SC-003).

---

## 1. Current behaviour (feature 001)

```ts
// existing
flyTo(target, options = {}) {
  const currentZoom = map.getZoom();
  const nextZoom = options.zoom ?? (currentZoom >= 10 ? currentZoom : 15);
  // ... animates to (target, nextZoom)
}
```

When `options.zoom` is omitted and the current zoom is < 10, the map
silently snaps to zoom level 15. This MVP convenience is what FR-011
forbids in this feature.

---

## 2. Amended behaviour (feature 002)

```ts
flyTo(target, options = {}) {
  const currentZoom = map.getZoom();
  const nextZoom = options.zoom ?? currentZoom; // <-- always preserve
  // ... animates to (target, nextZoom)
}
```

- If `options.zoom` is explicitly passed, it wins (no behavioural
  change for callers that already pass zoom).
- If `options.zoom` is omitted, the **current zoom is preserved
  exactly** — no snap-to-15, no minimum, no maximum.

The signature is unchanged; this is a behaviour amendment to the
existing method.

---

## 3. Why amend `flyTo` instead of fixing call sites

See research D5. Summary: keeping the rule at the controller layer
prevents a future caller from re-introducing the bug. The existing
single call site (Go-To submit in `App.svelte`) already passes no
`zoom`, so the change is observed only at that call site today; future
Go-To-like features (search, share-link landing) get the right
behaviour for free.

---

## 4. Test obligations

### Unit (`tests/unit/map/MapController.spec.ts` — extend existing)

1. With `currentZoom = 5` and `options.zoom` omitted: `flyTo(target)`
   passes `zoom: 5` to the underlying `map.flyTo`. *(Feature 001
   would have passed `zoom: 15`.)*
2. With `currentZoom = 18` and `options.zoom` omitted: `flyTo(target)`
   passes `zoom: 18`.
3. With `options.zoom = 12` regardless of current zoom: `map.flyTo`
   receives `zoom: 12`.

### E2E (`tests/e2e/story-3b-split-and-recents.spec.ts`)

4. SC-003 — for 100 random starting zooms in `[2, 18]`, perform a
   Go-To to a published target; assert `getZoom() === startingZoom`
   after the animation.

---

## 5. Migration risk

The change affects only one production call site
(`App.svelte` → Go-To submit). All Go-To E2E tests in
`tests/e2e/story-3-go-to.spec.ts` already operate at a zoom ≥ 10 (no
snap-to-15 was triggered), so they remain green. The new behaviour is
caught by the new unit tests and the SC-003 E2E.
