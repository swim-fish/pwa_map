<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { tStore } from '$i18n/index';
  import type { Candidate } from '$types/goto';

  export let open: boolean = false;
  export let candidates: readonly Candidate[] = [];

  const dispatch = createEventDispatcher<{
    pick: Candidate;
    cancel: void;
  }>();

  function onKeydown(e: KeyboardEvent): void {
    if (!open) return;
    if (e.key === 'Escape') {
      dispatch('cancel');
    }
  }
</script>

<svelte:window on:keydown={onKeydown} />

{#if open}
  <button
    type="button"
    class="backdrop"
    on:click={() => dispatch('cancel')}
    aria-label={$tStore('goto.disambig.cancel')}
    data-testid="goto-disambig-backdrop"
  ></button>
  <section
    class="sheet"
    role="dialog"
    aria-modal="true"
    aria-labelledby="disambig-title"
    data-testid="goto-disambig"
  >
    <header class="head">
      <h3 id="disambig-title">{$tStore('goto.disambig.title')}</h3>
    </header>
    <div role="status" aria-live="polite" class="sr-only" data-testid="disambig-count">
      {$tStore('goto.disambig.countAnnouncement', { count: candidates.length })}
    </div>
    <ul class="list">
      {#each candidates as cand, i (cand.sub + ':' + cand.raw)}
        <li>
          <button
            type="button"
            class="row tap-target"
            data-testid="disambig-row"
            data-disambig-row-index={i}
            data-disambig-sub={cand.sub}
            on:click={() => dispatch('pick', cand)}
          >
            <span class="label">{$tStore(cand.label)}</span>
            <span class="preview">
              {$tStore('goto.disambig.preview', {
                lat: cand.target.lat.toFixed(4),
                lon: cand.target.lon.toFixed(4),
              })}
            </span>
          </button>
        </li>
      {/each}
    </ul>
    <footer class="actions">
      <button
        type="button"
        class="cancel tap-target"
        on:click={() => dispatch('cancel')}
        data-testid="goto-disambig-cancel"
      >
        {$tStore('goto.disambig.cancel')}
      </button>
    </footer>
  </section>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.4);
    z-index: 50;
    border: 0;
    padding: 0;
    cursor: pointer;
  }

  .sheet {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    max-height: 60vh;
    background: var(--color-surface, #ffffff);
    color: var(--color-fg, #0f172a);
    border-radius: 12px 12px 0 0;
    box-shadow: 0 -10px 40px rgba(15, 23, 42, 0.3);
    padding: var(--space-4, 16px);
    z-index: 51;
    overflow-y: auto;
    animation: slide-up 300ms ease-out;
  }

  @keyframes slide-up {
    from {
      transform: translateY(100%);
    }
    to {
      transform: translateY(0);
    }
  }

  .head {
    margin-bottom: var(--space-3, 12px);
  }

  h3 {
    margin: 0;
    font-size: 16px;
  }

  .list {
    list-style: none;
    padding: 0;
    margin: 0 0 var(--space-3, 12px);
    display: flex;
    flex-direction: column;
    gap: var(--space-1, 4px);
  }

  .row {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    text-align: left;
    padding: var(--space-2, 8px) var(--space-3, 12px);
    background: var(--color-surface-elev, #f8fafc);
    color: var(--color-fg, #0f172a);
    border: 1px solid var(--color-border, #cbd5e1);
    border-radius: 8px;
    font: inherit;
    cursor: pointer;
  }

  .row:hover {
    background: var(--color-bg, #f5f5f5);
  }

  .row:focus-visible {
    outline: 2px solid var(--color-accent, #0ea5e9);
    outline-offset: 2px;
  }

  .label {
    font-weight: 600;
    font-size: 14px;
  }

  .preview {
    font: var(--font-numeric, monospace);
    font-size: 12px;
    opacity: 0.8;
    margin-top: var(--space-1, 4px);
  }

  .actions {
    display: flex;
    justify-content: flex-end;
  }

  .cancel {
    padding: var(--space-2, 8px) var(--space-4, 16px);
    background: var(--color-surface-elev, #f8fafc);
    color: var(--color-fg, #0f172a);
    border: 1px solid var(--color-border, #cbd5e1);
    border-radius: 6px;
    cursor: pointer;
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
