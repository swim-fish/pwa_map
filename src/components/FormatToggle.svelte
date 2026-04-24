<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { CoordinateKind } from '$types/coord';
  import { ALL_COORDINATE_KINDS } from '$types/coord';
  import { tStore } from '$i18n/index';

  export let visible: readonly CoordinateKind[];
  export let open: boolean = false;

  const dispatch = createEventDispatcher<{
    change: { visible: readonly CoordinateKind[] };
    close: void;
  }>();

  function isVisible(k: CoordinateKind): boolean {
    return visible.includes(k);
  }

  function toggle(k: CoordinateKind): void {
    const next = isVisible(k) ? visible.filter((x) => x !== k) : [...visible, k];
    // Preserve canonical order from ALL_COORDINATE_KINDS for predictability.
    const ordered = ALL_COORDINATE_KINDS.filter((x) => next.includes(x));
    dispatch('change', { visible: ordered });
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
    <ul class="list">
      {#each ALL_COORDINATE_KINDS as kind (kind)}
        <li>
          <label>
            <input
              type="checkbox"
              checked={isVisible(kind)}
              on:change={() => toggle(kind)}
              data-testid="toggle-{kind}"
            />
            <span>{$tStore(`format.labels.${kind}`)}</span>
          </label>
        </li>
      {/each}
    </ul>
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
    gap: var(--space-2, 8px);
    list-style: none;
    margin: 0;
    padding: 0;
  }

  label {
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
