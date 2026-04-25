<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { tStore } from '$i18n/index';
  import type { RecentEntry } from '$types/goto';

  export let entries: readonly RecentEntry[] = [];

  const dispatch = createEventDispatcher<{
    pick: RecentEntry;
    longPress: RecentEntry;
  }>();

  const LONG_PRESS_MS = 500;
  const MOVE_TOLERANCE_PX = 6;

  type PressState = {
    entry: RecentEntry;
    timer: ReturnType<typeof setTimeout> | null;
    fired: boolean;
    startX: number;
    startY: number;
  };

  let press: PressState | null = null;
  let suppressClickFor: RecentEntry | null = null;

  function clearPress(): void {
    if (press?.timer) clearTimeout(press.timer);
    press = null;
  }

  function onPointerDown(e: PointerEvent, entry: RecentEntry): void {
    if (press) clearPress();
    const state: PressState = {
      entry,
      fired: false,
      timer: null,
      startX: e.clientX,
      startY: e.clientY,
    };
    state.timer = setTimeout(() => {
      state.fired = true;
      suppressClickFor = state.entry;
      dispatch('longPress', state.entry);
    }, LONG_PRESS_MS);
    press = state;
  }

  function onPointerMove(e: PointerEvent): void {
    if (!press) return;
    const dx = e.clientX - press.startX;
    const dy = e.clientY - press.startY;
    if (Math.hypot(dx, dy) > MOVE_TOLERANCE_PX) {
      clearPress();
    }
  }

  function onPointerUp(_e: PointerEvent): void {
    clearPress();
  }

  function onPointerCancel(): void {
    clearPress();
  }

  function onClick(entry: RecentEntry): void {
    if (suppressClickFor === entry) {
      suppressClickFor = null;
      return;
    }
    dispatch('pick', entry);
  }
</script>

{#if entries.length > 0}
  <div class="row" data-testid="goto-recents-row" aria-label={$tStore('goto.recent.title')}>
    <span class="title">{$tStore('goto.recent.title')}</span>
    <div class="chips">
      {#each entries as entry, i (entry.createdAt + ':' + entry.raw)}
        <button
          type="button"
          class="chip"
          data-testid="goto-recent-chip"
          data-recent-index={i}
          title={$tStore('goto.recent.tooltip')}
          aria-label={entry.raw}
          on:pointerdown={(e) => onPointerDown(e, entry)}
          on:pointermove={onPointerMove}
          on:pointerup={onPointerUp}
          on:pointercancel={onPointerCancel}
          on:pointerleave={onPointerCancel}
          on:click={() => onClick(entry)}
        >
          <span class="text">{entry.raw}</span>
        </button>
      {/each}
    </div>
  </div>
{/if}

<style>
  .row {
    display: flex;
    flex-direction: column;
    gap: var(--space-1, 4px);
    margin-bottom: var(--space-3, 12px);
  }

  .title {
    font-size: 11px;
    color: var(--color-fg, #0f172a);
    opacity: 0.7;
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1, 4px);
  }

  .chip {
    max-width: 100%;
    padding: var(--space-1, 4px) var(--space-3, 12px);
    height: 28px;
    border: 1px solid var(--color-border, #cbd5e1);
    border-radius: 999px;
    background: var(--color-surface-elev, #f8fafc);
    color: var(--color-fg, #0f172a);
    font: var(--font-numeric, monospace);
    font-size: 12px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    overflow: hidden;
  }

  .chip .text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .chip:focus-visible {
    outline: 2px solid var(--color-accent, #0ea5e9);
    outline-offset: 2px;
  }
</style>
