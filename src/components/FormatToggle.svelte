<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { CoordinateKind } from '$types/coord';
  import { ALL_COORDINATE_KINDS } from '$types/coord';
  import { tStore } from '$i18n/index';
  import FormatPriorityRow from './FormatPriorityRow.svelte';
  import { reorderArray } from './formatPriority';
  import { DEFAULT_FORMAT_ORDER } from '$storage/preferences';

  export let visible: readonly CoordinateKind[];
  export let formatOrder: readonly CoordinateKind[] = DEFAULT_FORMAT_ORDER;
  export let open: boolean = false;

  const dispatch = createEventDispatcher<{
    change: { visible: readonly CoordinateKind[] };
    reorder: { formatOrder: readonly CoordinateKind[] };
    close: void;
  }>();

  // Live announcement for screen readers (research §R5). Cleared after
  // the row count's quanta so a re-order to the same kind announces again.
  let announcement = '';
  let announceTimer: ReturnType<typeof setTimeout> | null = null;

  function announceMove(kind: CoordinateKind, newIndex: number, total: number): void {
    if (announceTimer) clearTimeout(announceTimer);
    announcement = `${$tStore('format.labels.' + kind)} · ${newIndex + 1} / ${total}`;
    announceTimer = setTimeout(() => {
      announcement = '';
    }, 2000);
  }

  function isVisible(k: CoordinateKind): boolean {
    return visible.includes(k);
  }

  function onToggle(ev: CustomEvent<{ kind: CoordinateKind }>): void {
    const k = ev.detail.kind;
    const next = isVisible(k) ? visible.filter((x) => x !== k) : [...visible, k];
    // Preserve canonical order from ALL_COORDINATE_KINDS for predictability.
    const ordered = ALL_COORDINATE_KINDS.filter((x) => next.includes(x));
    dispatch('change', { visible: ordered });
  }

  function onReorderRequest(ev: CustomEvent<{ kind: CoordinateKind; deltaY: number }>): void {
    const { kind, deltaY } = ev.detail;
    const from = formatOrder.indexOf(kind);
    if (from < 0) return;
    // Map vertical delta to a target index. The drawer's row layout is
    // approximately 56 px row height (44 px tap-target + 12 px spacing);
    // dividing the delta gives the number of rows to step. Clamp to the
    // valid range — the parent's reorderArray() also no-ops on bounds.
    const ROW_HEIGHT = 56;
    const stepDelta = Math.round(deltaY / ROW_HEIGHT);
    const to = Math.max(0, Math.min(formatOrder.length - 1, from + stepDelta));
    if (to === from) return; // same-position no-op
    const next = reorderArray(formatOrder, from, to);
    dispatch('reorder', { formatOrder: next });
    announceMove(kind, to, formatOrder.length);
  }

  function close(): void {
    dispatch('close');
  }

  function onKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') close();
  }
</script>

{#if open}
  <button
    type="button"
    class="backdrop"
    on:click={close}
    on:keydown={onKeydown}
    aria-label={$tStore('toggle.close')}
    data-testid="format-toggle-backdrop"
  ></button>
  <section
    class="drawer"
    role="dialog"
    aria-modal="true"
    aria-labelledby="format-toggle-title"
    data-testid="format-toggle"
  >
    <header class="head">
      <h2 id="format-toggle-title">{$tStore('toggle.title')}</h2>
      <button type="button" class="close" on:click={close} aria-label={$tStore('toggle.close')}>
        ×
      </button>
    </header>
    <p class="hint">{$tStore('toggle.hint')}</p>
    <ul class="list" role="list" aria-label={$tStore('toggle.title')}>
      {#each formatOrder as kind (kind)}
        <FormatPriorityRow
          {kind}
          enabled={isVisible(kind)}
          on:reorderRequest={onReorderRequest}
          on:toggle={onToggle}
        />
      {/each}
    </ul>
    <span class="sr-only" aria-live="polite" data-testid="reorder-announcer">{announcement}</span>
  </section>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.3);
    z-index: 20;
    border: 0;
    padding: 0;
    cursor: pointer;
  }

  .drawer {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: min(420px, calc(100vw - 24px));
    max-height: 80vh;
    overflow: auto;
    background: var(--color-surface, #ffffff);
    color: var(--color-fg, #0f172a);
    border-radius: 12px;
    box-shadow: 0 10px 40px rgba(15, 23, 42, 0.3);
    padding: var(--space-4, 16px);
    z-index: 21;
  }

  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--space-2, 8px);
  }

  h2 {
    margin: 0;
    font-size: 18px;
  }

  .close {
    width: 32px;
    height: 32px;
    border: 0;
    background: transparent;
    font-size: 24px;
    line-height: 1;
    cursor: pointer;
    color: var(--color-fg, #0f172a);
  }

  .hint {
    margin: 0 0 var(--space-3, 12px);
    color: var(--color-fg-muted, #475569);
    font-size: 13px;
  }

  .list {
    display: grid;
    gap: var(--space-1, 4px);
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
</style>
