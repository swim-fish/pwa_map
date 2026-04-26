<script lang="ts">
  import { tStore } from '$i18n/index';
  import { updateSignal, postpone, confirm } from '$pwa/updateSignal';

  function onKeydown(e: KeyboardEvent): void {
    if (!$updateSignal.visible) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      postpone();
    }
  }

  function onConfirm(): void {
    void confirm();
  }

  function onLater(): void {
    postpone();
  }
</script>

<svelte:window on:keydown={onKeydown} />

{#if $updateSignal.visible}
  <section class="update-prompt" role="status" aria-live="polite" data-testid="update-prompt">
    <p class="update-prompt-title">{$tStore('pwa.update.title')}</p>
    <div class="update-prompt-actions">
      <button
        type="button"
        class="update-prompt-confirm"
        data-testid="update-prompt-confirm"
        on:click={onConfirm}
      >
        {$tStore('pwa.update.confirm')}
      </button>
      <button
        type="button"
        class="update-prompt-later"
        data-testid="update-prompt-later"
        on:click={onLater}
      >
        {$tStore('pwa.update.later')}
      </button>
    </div>
  </section>
{/if}

<style>
  .update-prompt {
    position: fixed;
    top: var(--space-4, 16px);
    left: 50%;
    transform: translateX(-50%);
    z-index: 6;
    display: flex;
    flex-direction: column;
    gap: var(--space-2, 8px);
    padding: var(--space-3, 12px) var(--space-4, 16px);
    background: var(--color-surface-elev, rgba(255, 255, 255, 0.95));
    color: var(--color-fg, #0f172a);
    border: 1px solid var(--color-border, #cbd5e1);
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(15, 23, 42, 0.18);
    max-width: min(420px, calc(100vw - 32px));
  }

  .update-prompt-title {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
  }

  .update-prompt-actions {
    display: flex;
    gap: var(--space-2, 8px);
    justify-content: flex-end;
  }

  .update-prompt-confirm,
  .update-prompt-later {
    min-width: 36px;
    min-height: 36px;
    padding: var(--space-2, 8px) var(--space-3, 12px);
    border-radius: 6px;
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }

  .update-prompt-confirm {
    background: var(--color-accent, #0ea5e9);
    color: #ffffff;
    border: 1px solid var(--color-accent, #0ea5e9);
  }

  .update-prompt-later {
    background: transparent;
    color: var(--color-fg, #0f172a);
    border: 1px solid var(--color-border, #cbd5e1);
  }
</style>
