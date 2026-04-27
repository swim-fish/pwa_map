<script lang="ts">
  import { tStore } from '$i18n/index';
  import { installSignal, recordDismissal } from '$pwa/installSignal';

  $: surface = $installSignal.surface;
  $: variant = surface === 'ios-safari' ? 'safari' : surface === 'ios-other' ? 'other' : null;

  function onDismiss(): void {
    recordDismissal();
  }

  function onKeydown(e: KeyboardEvent): void {
    if (variant === null) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      recordDismissal();
    }
  }
</script>

<svelte:window on:keydown={onKeydown} />

{#if variant === 'safari'}
  <section
    class="install-ios-sheet"
    role="dialog"
    aria-label={$tStore('pwa.install.ios.title')}
    data-testid="install-ios-sheet"
    data-variant="safari"
  >
    <header class="install-ios-sheet-header">
      <h2 class="install-ios-sheet-title">{$tStore('pwa.install.ios.title')}</h2>
    </header>
    <ol class="install-ios-sheet-steps">
      <li>
        {$tStore('pwa.install.ios.step1')}
        <span
          class="install-ios-sheet-share-icon"
          role="img"
          aria-label={$tStore('pwa.install.ios.shareIconAlt')}
          data-testid="install-ios-sheet-share-icon"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <path
              d="M8 1 L8 11 M5 4 L8 1 L11 4 M3 7 L3 14 L13 14 L13 7"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </span>
      </li>
      <li>{$tStore('pwa.install.ios.step2')}</li>
      <li>{$tStore('pwa.install.ios.step3')}</li>
    </ol>
    <div class="install-ios-sheet-actions">
      <button
        type="button"
        class="install-ios-sheet-dismiss"
        data-testid="install-ios-sheet-dismiss"
        on:click={onDismiss}
      >
        {$tStore('pwa.install.ios.dismiss')}
      </button>
    </div>
  </section>
{:else if variant === 'other'}
  <section
    class="install-ios-sheet"
    role="status"
    aria-live="polite"
    data-testid="install-ios-sheet"
    data-variant="other"
  >
    <p class="install-ios-sheet-hint">{$tStore('pwa.install.iosOther.hint')}</p>
    <div class="install-ios-sheet-actions">
      <button
        type="button"
        class="install-ios-sheet-dismiss"
        data-testid="install-ios-sheet-dismiss"
        on:click={onDismiss}
      >
        {$tStore('pwa.install.ios.dismiss')}
      </button>
    </div>
  </section>
{/if}

<style>
  .install-ios-sheet {
    position: fixed;
    bottom: var(--space-4, 16px);
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
    border-radius: 12px;
    box-shadow: 0 4px 16px rgba(15, 23, 42, 0.18);
    max-width: min(420px, calc(100vw - 32px));
    animation: install-ios-sheet-in 180ms ease-out;
  }

  @keyframes install-ios-sheet-in {
    from {
      transform: translate(-50%, 16px);
      opacity: 0;
    }
    to {
      transform: translate(-50%, 0);
      opacity: 1;
    }
  }

  .install-ios-sheet-header {
    margin: 0;
  }

  .install-ios-sheet-title {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
  }

  .install-ios-sheet-steps {
    margin: 0;
    padding-left: var(--space-5, 20px);
    font-size: 13px;
    line-height: 1.5;
  }

  .install-ios-sheet-share-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin-left: var(--space-1, 4px);
    width: 16px;
    height: 16px;
    vertical-align: middle;
  }

  .install-ios-sheet-hint {
    margin: 0;
    font-size: 13px;
    line-height: 1.5;
  }

  .install-ios-sheet-actions {
    display: flex;
    gap: var(--space-2, 8px);
    justify-content: flex-end;
  }

  .install-ios-sheet-dismiss {
    min-width: 36px;
    min-height: 36px;
    padding: var(--space-2, 8px) var(--space-3, 12px);
    background: transparent;
    color: var(--color-fg, #0f172a);
    border: 1px solid var(--color-border, #cbd5e1);
    border-radius: 6px;
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }

  @media (prefers-reduced-motion: reduce) {
    .install-ios-sheet {
      animation: none !important;
      transition: none !important;
    }
  }
</style>
