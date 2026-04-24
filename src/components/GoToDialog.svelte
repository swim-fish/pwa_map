<script lang="ts">
  import { createEventDispatcher, tick } from 'svelte';
  import { parseGoTo, type GoToRequest, type GoToRequestOk } from '$coord/index';
  import { tStore } from '$i18n/index';

  export let open: boolean = false;

  const dispatch = createEventDispatcher<{
    submit: GoToRequestOk;
    close: void;
  }>();

  let raw = '';
  let error: string | null = null;
  let inputEl: HTMLTextAreaElement | null = null;
  let wasOpen = false;

  $: {
    if (open && !wasOpen) {
      raw = '';
      error = null;
      void tick().then(() => inputEl?.focus());
    }
    wasOpen = open;
  }

  function handleSubmit(): void {
    const result: GoToRequest = parseGoTo(raw);
    if (result.ok) {
      error = null;
      dispatch('submit', result);
      return;
    }
    error = result.error.messageKey;
  }

  function close(): void {
    dispatch('close');
  }

  function onKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      close();
      return;
    }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleSubmit();
    }
  }
</script>

{#if open}
  <button
    type="button"
    class="backdrop"
    on:click={close}
    on:keydown={onKeydown}
    aria-label={$tStore('toggle.close')}
    data-testid="goto-backdrop"
  ></button>
  <section
    class="dialog"
    role="dialog"
    aria-modal="true"
    aria-labelledby="goto-title"
    data-testid="goto-dialog"
  >
    <header class="head">
      <h2 id="goto-title">{$tStore('goto.title')}</h2>
      <button type="button" class="close" on:click={close} aria-label={$tStore('toggle.close')}
        >×</button
      >
    </header>
    <label class="field">
      <span class="sr-only">{$tStore('goto.title')}</span>
      <textarea
        bind:this={inputEl}
        bind:value={raw}
        on:keydown={onKeydown}
        placeholder={$tStore('goto.placeholder')}
        rows="3"
        data-testid="goto-input"
      ></textarea>
    </label>
    {#if error}
      <p role="alert" aria-live="assertive" class="error" data-testid="goto-error">
        {$tStore(error)}
      </p>
    {/if}
    <footer class="actions">
      <button type="button" class="primary" on:click={handleSubmit} data-testid="goto-submit">
        {$tStore('goto.submit')}
      </button>
    </footer>
  </section>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.3);
    z-index: 30;
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
    background: var(--color-surface, #ffffff);
    color: var(--color-fg, #0f172a);
    border-radius: 12px;
    box-shadow: 0 10px 40px rgba(15, 23, 42, 0.3);
    padding: var(--space-4, 16px);
    z-index: 31;
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

  .field {
    display: block;
    margin-bottom: var(--space-3, 12px);
  }

  textarea {
    width: 100%;
    padding: var(--space-2, 8px) var(--space-3, 12px);
    border: 1px solid var(--color-border, #cbd5e1);
    border-radius: 6px;
    font: var(--font-numeric, monospace);
    font-size: 14px;
    resize: vertical;
    background: var(--color-bg, #f5f5f5);
    color: var(--color-fg, #0f172a);
  }

  .error {
    margin: 0 0 var(--space-3, 12px);
    color: var(--color-danger, #dc2626);
    font-size: 13px;
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2, 8px);
  }

  .primary {
    padding: var(--space-2, 8px) var(--space-4, 16px);
    background: var(--color-accent, #0ea5e9);
    color: #ffffff;
    border: 0;
    border-radius: 6px;
    font-weight: 600;
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
