# Contract: Drag-to-reorder interaction (Pointer Events)

**Feature**: 010-mobile-collapsed-readout
**Surface**: Svelte components `src/components/FormatPriorityRow.svelte` (per-row) and `src/components/FormatToggle.svelte` (parent)
**Author**: `/speckit.plan` (Phase 1)
**Spec FRs**: FR-004, FR-005, FR-011, FR-012 · **Spec SCs**: SC-002

## Public surfaces

```svelte
<!-- FormatPriorityRow.svelte (NEW) -->
<FormatPriorityRow
  kind={kind}
  enabled={visible.includes(kind)}
  on:reorderRequest={(e) => handleReorder(e.detail)}
  on:toggle={(e) => handleToggle(e.detail.kind)}
/>
```

```svelte
<!-- FormatToggle.svelte (AMENDED) -->
<FormatToggle
  visible={prefs.visible}
  formatOrder={prefs.formatOrder}     {/* NEW prop */}
  open={dialogOpen}
  on:change={(e) => savePrefs({ visible: e.detail.visible })}
  on:reorder={(e) => savePrefs({ formatOrder: e.detail.formatOrder })}  {/* NEW event */}
  on:close={() => (dialogOpen = false)}
/>
```

## Pointer Events lifecycle

```text
pointerdown on .drag-handle (touch-action: none)
  → setPointerCapture(e.pointerId)
  → dragKind = kind; pointerStartY = e.clientY; dropPreviewIndex = currentIndex

pointermove
  → recompute dropPreviewIndex from translateY delta
  → live row gets transform: translateY(${delta}px)
  → CSS placeholder row at dropPreviewIndex shows insertion gap

pointerup (no cancel)
  → if dropPreviewIndex !== currentIndex:
       newOrder = reorderArray(formatOrder, currentIndex, dropPreviewIndex)
       dispatch('reorderRequest', { kind, from: currentIndex, to: dropPreviewIndex })
       parent updates formatOrder + persists
  → reset state

pointercancel  OR  pointerup with pointerCancelGuard
  → discard preview; do NOT commit
  → reset state
```

`reorderArray` is a pure function:

```ts
export function reorderArray<T>(arr: readonly T[], from: number, to: number): readonly T[] {
  if (from === to) return arr;
  const next = [...arr];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
```

## Invariants

1. **Touch + mouse parity.** The same handler chain runs for touch (`pointerType: 'touch'`) and mouse (`pointerType: 'mouse'`). No separate `MouseEvent` / `TouchEvent` listeners.
2. **Touch-action discipline.** `.drag-handle` has `touch-action: none` so the browser does not interpret the gesture as a scroll or pan-zoom (research.md §R1).
3. **Tap-target floor.** `.drag-handle` is `≥ 44 × 44 CSS px` (uses `class="tap-target"` from feature 009 / ADR 0029).
4. **Cancel discards.** A `pointercancel` (e.g. system gesture interrupt, focus shift) does NOT commit the reorder — the preview is discarded.
5. **Same-position no-op.** If the user releases at the original index, no `reorder` event fires and `formatOrder` is unchanged (no spurious save).
6. **Disabled rows reorder.** Rows whose format is currently disabled (`!visible.includes(kind)`) are still draggable; reordering still emits `reorder` (FR-011).
7. **Order monotone with rect.** The visible Y-position of each row's bounding-rect midpoint is strictly increasing top-to-bottom in render order — the drag math relies on this and the test asserts it.

## A11y contract

- The wrapping `<ul>` carries `role="list"` and `aria-label` from `tStore('toggle.title')`.
- A `<span class="sr-only" aria-live="polite" data-testid="reorder-announcer">` lives inside `FormatToggle.svelte`; on commit, its text is set to `${tStore(\`format.labels.\${kind}\`)} · ${newIndex + 1} / 6`.
- Keyboard reordering is **NOT** implemented in this feature (deferred to a future feature; ADR 0030 §"Future work"). Each row remains keyboard-focusable and the checkbox remains keyboard-toggleable.

## Verification

| Spec | Asserts |
| ---- | ------- |
| `tests/unit/format-priority-list.spec.ts` | `reorderArray` correctness (Invariant 5 same-position no-op + permutation property); `pointerdown` / `move` / `up` / `cancel` lifecycle (Invariants 1, 4); a11y announcer text; disabled-row drag (Invariant 6). |
| `tests/integration/settings-format-priority.spec.ts` | End-to-end: drag → `reorder` event → `formatOrder` save → readout updates within 200 ms (SC-002). |
| `tests/e2e/mobile-collapsed-readout.e2e.spec.ts` | Real Pointer Events on Mobile Chrome / iOS Safari; tap-target floor (Invariant 3) preserved. |

## Non-goals

- Multi-row drag selection.
- Cross-list drag (no other DnD list exists in the app).
- Animated row reflow on commit (CSS `transition: transform` is acceptable; FLIP-style position-keyed re-animation is out of scope).
- Keyboard reorder (`↑` / `↓`) — deferred to a future feature; the visible affordance remains decorative-only for keyboard users.
- A "Restore default order" button — the user can drag back manually; out of scope.
