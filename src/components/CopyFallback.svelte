<script lang="ts">
  import { createEventDispatcher, tick } from 'svelte';
  import { tStore } from '$i18n/index';

  export let open: boolean = false;
  export let text: string = '';

  const dispatch = createEventDispatcher<{ close: void }>();
  let inputEl: HTMLTextAreaElement | null = null;
  let wasOpen = false;

  $: {
    if (open && !wasOpen) {
      void tick().then(() => inputEl?.select());
    }
    wasOpen = open;
  }

  function close(): void {
    dispatch('close');
  }
</script>

{#if open}
  <button
    type="button"
    class="backdrop"
    on:click={close}
    aria-label={$tStore('toggle.close')}
    data-testid="copy-fallback-backdrop"
  ></button>
  <section
    class="dialog"
    role="dialog"
    aria-modal="true"
    aria-labelledby="copy-fallback-title"
    data-testid="copy-fallback"
  >
    <header class="head">
      <h2 id="copy-fallback-title">{$tStore('copy.fallback.title')}</h2>
      <button type="button" class="close" on:click={close} aria-label={$tStore('toggle.close')}
        >×</button
      >
    </header>
    <p class="hint">{$tStore('copy.fallback.hint')}</p>
    <textarea bind:this={inputEl} readonly data-testid="copy-fallback-input" rows="2" value={text}
    ></textarea>
  </section>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.3);
    z-index: 40;
    border: 0;
    padding: 0;
    cursor: pointer;
  }

  .dialog {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: min(480px, calc(100vw - 24px));
    background: var(--color-surface, #fff);
    color: var(--color-fg, #0f172a);
    border-radius: 12px;
    padding: var(--space-4, 16px);
    box-shadow: 0 10px 40px rgba(15, 23, 42, 0.3);
    z-index: 41;
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

  textarea {
    width: 100%;
    padding: var(--space-2, 8px);
    font: var(--font-numeric, monospace);
    border-radius: 6px;
    border: 1px solid var(--color-border, #cbd5e1);
    background: var(--color-bg, #f5f5f5);
    color: var(--color-fg, #0f172a);
    resize: none;
  }
</style>
