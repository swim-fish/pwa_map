<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { tStore } from '$i18n/index';
  import type { Locale } from '$types/coord';

  export let open: boolean = false;
  export let selection: Locale = 'zh';

  const dispatch = createEventDispatcher<{
    change: Locale;
    close: void;
  }>();

  // Self-names are intentionally plain literals (NOT i18n keys) so the
  // operator can always recognise their own language.
  const ROWS: ReadonlyArray<{ locale: Locale; name: string }> = [
    { locale: 'zh', name: '中文' },
    { locale: 'en', name: 'English' },
    { locale: 'ja', name: '日本語' },
  ];

  function pick(locale: Locale): void {
    dispatch('change', locale);
  }

  function onKeydown(e: KeyboardEvent): void {
    if (!open) return;
    if (e.key === 'Escape') {
      dispatch('close');
    }
  }
</script>

<svelte:window on:keydown={onKeydown} />

{#if open}
  <button
    type="button"
    class="backdrop"
    on:click={() => dispatch('close')}
    aria-label={$tStore('toolbar.locale.button')}
    data-testid="locale-picker-backdrop"
  ></button>
  <div role="menu" aria-labelledby="locale-picker-title" class="picker" data-testid="locale-picker">
    <h3 id="locale-picker-title" class="title">{$tStore('locale.picker.title')}</h3>
    {#each ROWS as row (row.locale)}
      {@const isActive = row.locale === selection}
      <button
        type="button"
        role="menuitemradio"
        aria-checked={isActive}
        class="row"
        class:active={isActive}
        data-testid="locale-row"
        data-locale={row.locale}
        lang={row.locale}
        on:click={() => pick(row.locale)}
      >
        <span class="dot" aria-hidden="true"></span>
        <span class="name">{row.name}</span>
      </button>
    {/each}
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: transparent;
    z-index: 30;
    border: 0;
    padding: 0;
    cursor: default;
  }

  .picker {
    position: absolute;
    top: calc(var(--space-3, 12px) + 36px + var(--space-1, 4px));
    right: var(--space-3, 12px);
    min-width: 200px;
    background: var(--color-surface, #ffffff);
    color: var(--color-fg, #0f172a);
    border: 1px solid var(--color-border, #cbd5e1);
    border-radius: 8px;
    box-shadow: 0 8px 24px rgba(15, 23, 42, 0.18);
    padding: var(--space-2, 8px);
    z-index: 31;
  }

  .title {
    margin: 0 0 var(--space-2, 8px);
    font-size: 13px;
    font-weight: 600;
    padding: 0 var(--space-2, 8px);
  }

  .row {
    display: flex;
    align-items: center;
    gap: var(--space-2, 8px);
    width: 100%;
    min-height: 36px;
    padding: var(--space-1, 4px) var(--space-2, 8px);
    background: transparent;
    color: var(--color-fg, #0f172a);
    border: 0;
    border-radius: 6px;
    text-align: left;
    font: inherit;
    cursor: pointer;
  }

  .row:hover {
    background: var(--color-surface-elev, #f8fafc);
  }

  .row.active {
    background: var(--color-surface-elev, #f8fafc);
    font-weight: 600;
  }

  .row:focus-visible {
    outline: 2px solid var(--color-accent, #0ea5e9);
    outline-offset: 2px;
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--color-border, #cbd5e1);
    flex-shrink: 0;
  }

  .row.active .dot {
    background: var(--color-accent, #0ea5e9);
  }

  .name {
    flex: 1;
    font-size: 14px;
  }
</style>
