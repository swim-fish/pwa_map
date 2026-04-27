<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { CoordinateKind } from '$types/coord';
  import { tStore } from '$i18n/index';

  export let kind: CoordinateKind;
  export let enabled: boolean;

  const dispatch = createEventDispatcher<{
    reorderRequest: { kind: CoordinateKind; deltaY: number };
    toggle: { kind: CoordinateKind };
  }>();

  // Pointer Events lifecycle (contracts/drag-reorder-interaction.md):
  //   pointerdown    → record starting clientY; capture pointer.
  //   pointermove    → update visual translateY (live preview).
  //   pointerup      → if not cancelled AND deltaY !== 0, emit
  //                    `reorderRequest` and let the parent commit via
  //                    reorderArray().
  //   pointercancel  → set guard; pointerup will skip the commit.
  let pointerStartY: number | null = null;
  let translateY = 0;
  let pointerCancelled = false;

  function onPointerDown(ev: PointerEvent): void {
    pointerStartY = ev.clientY;
    translateY = 0;
    pointerCancelled = false;
    const target = ev.currentTarget as HTMLElement;
    if (typeof target.setPointerCapture === 'function') {
      try {
        target.setPointerCapture(ev.pointerId);
      } catch {
        /* jsdom / unsupported — ignore */
      }
    }
  }

  function onPointerMove(ev: PointerEvent): void {
    if (pointerStartY === null) return;
    translateY = ev.clientY - pointerStartY;
  }

  function onPointerCancel(): void {
    pointerCancelled = true;
    pointerStartY = null;
    translateY = 0;
  }

  function onPointerUp(ev: PointerEvent): void {
    if (pointerStartY === null) return;
    const finalDelta = ev.clientY - pointerStartY;
    pointerStartY = null;
    translateY = 0;
    if (pointerCancelled) {
      pointerCancelled = false;
      return;
    }
    if (finalDelta === 0) return; // same-position no-op (Invariant 5)
    dispatch('reorderRequest', { kind, deltaY: finalDelta });
  }

  function onToggle(): void {
    dispatch('toggle', { kind });
  }
</script>

<li class="row" data-testid="format-priority-row-{kind}">
  <button
    type="button"
    class="drag-handle tap-target"
    aria-label={$tStore('toggle.title') + ' · ' + $tStore('format.labels.' + kind)}
    data-testid="drag-handle-{kind}"
    on:pointerdown={onPointerDown}
    on:pointermove={onPointerMove}
    on:pointerup={onPointerUp}
    on:pointercancel={onPointerCancel}
    style="transform: translateY({translateY}px);"
  >
    <span aria-hidden="true">⋮⋮</span>
  </button>
  <label>
    <input type="checkbox" checked={enabled} on:change={onToggle} data-testid="toggle-{kind}" />
    <span>{$tStore('format.labels.' + kind)}</span>
  </label>
</li>

<style>
  .row {
    display: flex;
    align-items: center;
    gap: var(--space-2, 8px);
    padding: var(--space-1, 4px) 0;
    list-style: none;
  }

  .drag-handle {
    border: 0;
    background: transparent;
    color: var(--color-fg-muted, #475569);
    cursor: grab;
    padding: var(--space-2, 8px);
    border-radius: 6px;
    touch-action: none;
    line-height: 1;
    font-size: 16px;
  }

  .drag-handle:active {
    cursor: grabbing;
    background: var(--color-bg, #f5f5f5);
  }

  label {
    flex: 1;
    display: flex;
    align-items: center;
    gap: var(--space-2, 8px);
    padding: var(--space-2, 8px);
    border-radius: 6px;
    cursor: pointer;
  }

  label:hover {
    background: var(--color-bg, #f5f5f5);
  }

  input[type='checkbox'] {
    width: 18px;
    height: 18px;
    cursor: pointer;
  }
</style>
