<script lang="ts">
  import { tStore } from '$i18n/index';
  import { installSignal, recordDismissal, triggerInstall } from '$pwa/installSignal';

  $: surface = $installSignal.surface;
  $: deferredPrompt = $installSignal.deferredPrompt;
  $: shown = surface === 'android-chromium' || surface === 'desktop-chromium';

  function onConfirm(): void {
    void (async () => {
      try {
        await triggerInstall();
      } catch {
        /* defence-in-depth: button is disabled when deferredPrompt is null */
      }
    })();
  }

  function onDismiss(): void {
    recordDismissal();
  }

  function onKeydown(e: KeyboardEvent): void {
    if (!shown) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      recordDismissal();
    }
  }
</script>

<svelte:window on:keydown={onKeydown} />

{#if shown}
  <section
    class="install-banner"
    role="dialog"
    aria-label={$tStore('pwa.install.android.title')}
    data-testid="install-banner"
  >
    <p class="install-banner-title">{$tStore('pwa.install.android.title')}</p>
    <div class="install-banner-actions">
      <button
        type="button"
        class="install-banner-confirm"
        data-testid="install-banner-confirm"
        on:click={onConfirm}
        disabled={deferredPrompt === null}
      >
        {$tStore('pwa.install.android.confirm')}
      </button>
      <button
        type="button"
        class="install-banner-dismiss"
        data-testid="install-banner-dismiss"
        on:click={onDismiss}
      >
        {$tStore('pwa.install.android.dismiss')}
      </button>
    </div>
  </section>
{/if}

<style>
  .install-banner {
    position: fixed;
    bottom: calc(var(--space-4, 16px) + var(--space-6, 24px));
    right: var(--space-4, 16px);
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
    animation: install-banner-in 180ms ease-out;
  }

  @keyframes install-banner-in {
    from {
      transform: translateY(16px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }

  .install-banner-title {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
  }

  .install-banner-actions {
    display: flex;
    gap: var(--space-2, 8px);
    justify-content: flex-end;
  }

  .install-banner-confirm,
  .install-banner-dismiss {
    min-width: 36px;
    min-height: 36px;
    padding: var(--space-2, 8px) var(--space-3, 12px);
    border-radius: 6px;
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }

  .install-banner-confirm {
    background: var(--color-accent, #0ea5e9);
    color: #ffffff;
    border: 1px solid var(--color-accent, #0ea5e9);
  }

  .install-banner-confirm:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .install-banner-dismiss {
    background: transparent;
    color: var(--color-fg, #0f172a);
    border: 1px solid var(--color-border, #cbd5e1);
  }

  @media (prefers-reduced-motion: reduce) {
    .install-banner {
      animation: none !important;
      transition: none !important;
      transform: none !important;
    }
  }
</style>
