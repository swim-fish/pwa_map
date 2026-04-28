<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { tStore } from '$i18n/index';
  import {
    TILE_CACHE_NAMES,
    TTL_OPTIONS,
    MAX_ENTRIES_OPTIONS,
    SOURCE_LABEL_KEY,
    type TileCacheName,
    type TtlDays,
    type TileMaxEntries,
  } from '$pwa/cachePolicy';
  import { countCacheEntries, estimateQuota } from '$pwa/cacheStats';
  import { clearCache, clearAllTileCaches, enforceCachePolicy } from '$pwa/cachePurge';
  import {
    loadTileTtlDays,
    saveTileTtlDays,
    loadTileMaxEntries,
    saveTileMaxEntries,
  } from '$storage/preferences';
  import { installSignal, triggerInstall } from '$pwa/installSignal';
  import { installSettingsSurface } from '$pwa/installSettingsSurface';

  export let open: boolean = false;

  const dispatch = createEventDispatcher<{ close: void }>();

  // Feature 011 — Settings install section local state. The section is a
  // VIEW over installSignal + installSettingsSurface; it owns no install
  // state and only tracks two presentational flags.
  let showIosInstructions = false;
  let installInFlight = false;

  async function onConfirmChromium(): Promise<void> {
    if (installInFlight) return;
    installInFlight = true;
    try {
      await triggerInstall();
    } catch {
      /* defence-in-depth: button is disabled when deferredPrompt is null */
    } finally {
      installInFlight = false;
    }
  }

  function onShowIosInstructions(): void {
    showIosInstructions = true;
  }

  function onCloseIosInstructions(): void {
    showIosInstructions = false;
  }

  type ClearTarget = { kind: 'all' } | { kind: 'one'; name: TileCacheName };

  interface CacheRowState {
    readonly name: TileCacheName;
    readonly count: number | null;
    readonly cap: TileMaxEntries;
  }

  let rows: CacheRowState[] = TILE_CACHE_NAMES.map((name) => ({
    name,
    count: null,
    cap: loadTileMaxEntries(),
  }));
  let quotaUsageMb: number | null = null;
  let ttlDays: TtlDays = loadTileTtlDays();
  let maxEntries: TileMaxEntries = loadTileMaxEntries();
  let confirmTarget: ClearTarget | null = null;
  let busy = false;
  let statusMessage: string = '';

  async function refresh(): Promise<void> {
    const counts = await Promise.all(TILE_CACHE_NAMES.map((name) => countCacheEntries(name)));
    rows = TILE_CACHE_NAMES.map((name, i) => ({
      name,
      count: counts[i],
      cap: maxEntries,
    }));
    const q = await estimateQuota();
    quotaUsageMb = q.usage === null ? null : q.usage / (1024 * 1024);
  }

  $: if (open) {
    void refresh();
  }
  $: if (!open) {
    statusMessage = '';
    confirmTarget = null;
    // Clear iOS instructions overlay so it does not auto-pop on the
    // next sheet open. (PR #3 review — Escape was the only cleanup
    // path; closing via scrim / close-button left this flag stuck.)
    showIosInstructions = false;
  }

  function onClose(): void {
    dispatch('close');
  }

  function onWindowKeydown(e: KeyboardEvent): void {
    if (!open) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      if (confirmTarget) {
        confirmTarget = null;
      } else if (showIosInstructions) {
        showIosInstructions = false;
      } else {
        onClose();
      }
    }
  }

  function onClearAll(): void {
    if (busy) return;
    confirmTarget = { kind: 'all' };
  }

  function onClearOne(name: TileCacheName): void {
    if (busy) return;
    confirmTarget = { kind: 'one', name };
  }

  function onConfirmCancel(): void {
    if (busy) return;
    confirmTarget = null;
  }

  async function onConfirmConfirm(): Promise<void> {
    if (!confirmTarget || busy) return;
    busy = true;
    const target = confirmTarget;
    try {
      if (target.kind === 'all') {
        await clearAllTileCaches();
        statusMessage = $tStore('settings.status.cleared.all');
      } else {
        await clearCache(target.name);
        const sourceLabel = $tStore(SOURCE_LABEL_KEY[target.name]);
        statusMessage = $tStore('settings.status.cleared.one', { source: sourceLabel });
      }
      await refresh();
    } catch {
      statusMessage = $tStore('settings.status.error');
    } finally {
      confirmTarget = null;
      busy = false;
    }
  }

  async function onChangeTtl(): Promise<void> {
    if (busy) return;
    busy = true;
    const newValue = ttlDays;
    try {
      saveTileTtlDays(newValue);
      const result = await enforceCachePolicy(newValue, maxEntries);
      const totalDeleted = TILE_CACHE_NAMES.reduce(
        (sum, name) => sum + result.perCache[name].deleted,
        0,
      );
      statusMessage = $tStore('settings.status.purged.ttl', {
        days: newValue,
        count: totalDeleted,
      });
      await refresh();
    } catch {
      statusMessage = $tStore('settings.status.error');
    } finally {
      busy = false;
    }
  }

  async function onChangeMaxEntries(): Promise<void> {
    if (busy) return;
    busy = true;
    const newValue = maxEntries;
    try {
      saveTileMaxEntries(newValue);
      const result = await enforceCachePolicy(ttlDays, newValue);
      const totalDeleted = TILE_CACHE_NAMES.reduce(
        (sum, name) => sum + result.perCache[name].deleted,
        0,
      );
      statusMessage = $tStore('settings.status.trimmed.maxEntries', {
        cap: newValue,
        count: totalDeleted,
      });
      await refresh();
    } catch {
      statusMessage = $tStore('settings.status.error');
    } finally {
      busy = false;
    }
  }

  function formatUsageMb(v: number | null): string {
    if (v === null) return $tStore('settings.quota.unavailable');
    return $tStore('settings.quota.estimateLabel', { usageMb: v.toFixed(1) });
  }

  function formatEntries(count: number | null, cap: TileMaxEntries): string {
    if (count === null) return $tStore('settings.cache.unavailable');
    return $tStore('settings.cache.entries', { count, cap });
  }

  onMount(() => {
    if (open) void refresh();
  });
</script>

<svelte:window on:keydown={onWindowKeydown} />

{#if open}
  <button
    type="button"
    class="scrim"
    on:click={onClose}
    aria-label={$tStore('settings.close')}
    data-testid="settings-scrim"
  ></button>
  <div
    role="dialog"
    aria-modal="true"
    aria-labelledby="settings-title"
    class="sheet"
    data-testid="settings-sheet"
  >
    <header class="header">
      <h2 id="settings-title" class="title">{$tStore('settings.title')}</h2>
      <button
        type="button"
        class="close-btn"
        data-testid="settings-close"
        aria-label={$tStore('settings.close')}
        on:click={onClose}
      >
        ✕
      </button>
    </header>

    <p class="licence" data-testid="settings-licence">{$tStore('settings.licenceNotice')}</p>

    {#if $installSettingsSurface !== 'unsupported'}
      <section
        class="install-section"
        aria-labelledby="install-section-heading"
        data-testid="settings-install-section"
      >
        <h3 id="install-section-heading" class="section-heading">
          {$tStore('settings.install.heading')}
        </h3>
        {#if $installSettingsSurface === 'android-chromium' || $installSettingsSurface === 'desktop-chromium'}
          <button
            type="button"
            class="install-section-confirm tap-target"
            data-testid="settings-install-confirm"
            on:click={onConfirmChromium}
            disabled={$installSignal.deferredPrompt === null || installInFlight}
          >
            {$tStore('pwa.install.android.confirm')}
          </button>
        {:else if $installSettingsSurface === 'ios-safari'}
          <button
            type="button"
            class="install-section-confirm tap-target"
            data-testid="settings-install-show-ios-instructions"
            on:click={onShowIosInstructions}
          >
            {$tStore('pwa.install.ios.title')}
          </button>
        {:else if $installSettingsSurface === 'ios-other'}
          <p class="install-section-hint" data-testid="settings-install-ios-other-hint">
            {$tStore('pwa.install.iosOther.hint')}
          </p>
        {:else if $installSettingsSurface === 'standalone'}
          <p
            class="install-section-status"
            role="status"
            data-testid="settings-install-already-installed"
          >
            {$tStore('settings.install.alreadyInstalled')}
          </p>
        {/if}
      </section>
    {/if}

    <section class="cache-list" aria-labelledby="cache-list-heading">
      <h3 id="cache-list-heading" class="section-heading">{$tStore('settings.cache.heading')}</h3>
      {#each rows as row (row.name)}
        <div class="cache-row" data-testid={`settings-cache-row-${row.name}`}>
          <span class="cache-source">{$tStore(SOURCE_LABEL_KEY[row.name])}</span>
          <span class="cache-count" data-testid={`settings-cache-row-${row.name}-count`}>
            {formatEntries(row.count, row.cap)}
          </span>
          <button
            type="button"
            class="row-clear-btn"
            data-testid={`settings-cache-row-${row.name}-clear`}
            aria-label={`${$tStore('settings.cache.clear.row')} ${$tStore(SOURCE_LABEL_KEY[row.name])}`}
            on:click={() => onClearOne(row.name)}
            disabled={busy || row.count === null || row.count === 0}
          >
            {$tStore('settings.cache.clear.row')}
          </button>
        </div>
      {/each}
    </section>

    <p class="quota" data-testid="settings-quota">{formatUsageMb(quotaUsageMb)}</p>

    <section class="controls">
      <label class="control-row">
        <span class="control-label">{$tStore('settings.ttl.label')}</span>
        <select
          class="control-input"
          data-testid="settings-ttl"
          bind:value={ttlDays}
          on:change={onChangeTtl}
          disabled={busy}
        >
          {#each TTL_OPTIONS as opt (opt)}
            <option value={opt}>{$tStore('settings.ttl.option', { days: opt })}</option>
          {/each}
        </select>
      </label>

      <label class="control-row">
        <span class="control-label">{$tStore('settings.maxEntries.label')}</span>
        <select
          class="control-input"
          data-testid="settings-max-entries"
          bind:value={maxEntries}
          on:change={onChangeMaxEntries}
          disabled={busy}
        >
          {#each MAX_ENTRIES_OPTIONS as opt (opt)}
            <option value={opt}>{opt.toLocaleString()}</option>
          {/each}
        </select>
      </label>
    </section>

    <footer class="actions">
      <button
        type="button"
        class="clear-all-btn danger"
        data-testid="settings-clear-all"
        on:click={onClearAll}
        disabled={busy}
      >
        {$tStore('settings.clear.all.button')}
      </button>
    </footer>

    {#if statusMessage}
      <p class="status" role="status" aria-live="polite" data-testid="settings-status">
        {statusMessage}
      </p>
    {/if}
  </div>

  {#if confirmTarget}
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-confirm-title"
      class="confirm-dialog"
      data-testid="settings-confirm-dialog"
    >
      <h3 id="settings-confirm-title" class="confirm-title">
        {$tStore('settings.confirm.title')}
      </h3>
      <p class="confirm-body">
        {#if confirmTarget.kind === 'all'}
          {$tStore('settings.confirm.body.all')}
        {:else}
          {$tStore('settings.confirm.body.one', {
            source: $tStore(SOURCE_LABEL_KEY[confirmTarget.name]),
          })}
        {/if}
      </p>
      <div class="confirm-actions">
        <button
          type="button"
          class="confirm-cancel-btn"
          data-testid="settings-confirm-cancel"
          on:click={onConfirmCancel}
          disabled={busy}
        >
          {$tStore('settings.confirm.cancel')}
        </button>
        <button
          type="button"
          class="confirm-ok-btn danger"
          data-testid="settings-confirm-ok"
          on:click={onConfirmConfirm}
          disabled={busy}
        >
          {$tStore('settings.confirm.confirm')}
        </button>
      </div>
    </div>
  {/if}

  {#if showIosInstructions}
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-install-ios-instructions-title"
      class="install-ios-instructions-dialog"
      data-testid="settings-install-ios-instructions-dialog"
    >
      <h3 id="settings-install-ios-instructions-title" class="install-ios-instructions-title">
        {$tStore('pwa.install.ios.title')}
      </h3>
      <ol class="install-ios-instructions-steps">
        <li>
          {$tStore('pwa.install.ios.step1')}
          <span
            class="install-ios-instructions-share-icon"
            role="img"
            aria-label={$tStore('pwa.install.ios.shareIconAlt')}
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
      <div class="install-ios-instructions-actions">
        <button
          type="button"
          class="install-ios-instructions-close tap-target"
          data-testid="settings-install-ios-instructions-close"
          on:click={onCloseIosInstructions}
        >
          {$tStore('pwa.install.ios.dismiss')}
        </button>
      </div>
    </div>
  {/if}
{/if}

<style>
  .scrim {
    position: fixed;
    inset: 0;
    background: var(--color-scrim, rgba(15, 23, 42, 0.6));
    border: 0;
    padding: 0;
    cursor: default;
    z-index: 40;
  }

  .sheet {
    position: fixed;
    top: max(var(--space-4), var(--top-stack-zone-top));
    bottom: max(var(--space-4), var(--bottom-stack-zone-bottom));
    left: max(var(--space-4), var(--inline-stack-zone-left));
    right: max(var(--space-4), var(--inline-stack-zone-right));
    margin: auto;
    width: min(
      440px,
      calc(
        100vw - 2 *
          max(var(--space-4), var(--inline-stack-zone-left), var(--inline-stack-zone-right))
      )
    );
    max-height: calc(
      100vh - 2 * max(var(--space-4), var(--top-stack-zone-top), var(--bottom-stack-zone-bottom))
    );
    overflow-y: auto;
    background: var(--color-surface-elev);
    color: var(--color-fg);
    border: 1px solid var(--color-border);
    border-radius: 12px;
    box-shadow: 0 8px 24px rgba(15, 23, 42, 0.18);
    padding: var(--space-5, 20px);
    z-index: 41;
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--space-3, 12px);
  }

  .title {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
  }

  .close-btn {
    min-width: 36px;
    min-height: 36px;
    background: var(--color-surface-elev, #ffffff);
    color: var(--color-fg, #0f172a);
    border: 1px solid var(--color-border, #cbd5e1);
    border-radius: 6px;
    font: inherit;
    font-size: 16px;
    cursor: pointer;
  }

  .licence {
    margin: 0 0 var(--space-3, 12px);
    padding: var(--space-2, 8px) var(--space-3, 12px);
    background: var(--color-surface-elev, #f8fafc);
    color: var(--color-fg, #0f172a);
    border-left: 3px solid var(--color-accent, #0ea5e9);
    border-radius: 4px;
    font-size: 12px;
    line-height: 1.5;
  }

  .section-heading {
    margin: 0 0 var(--space-2, 8px);
    font-size: 13px;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--color-fg, #0f172a);
    opacity: 0.7;
    letter-spacing: 0.05em;
  }

  .install-section {
    margin: 0 0 var(--space-3, 12px);
    display: flex;
    flex-direction: column;
    gap: var(--space-2, 8px);
    align-items: flex-start;
  }

  .install-section-confirm {
    padding: var(--space-2, 8px) var(--space-3, 12px);
    border-radius: 6px;
    font: inherit;
    font-weight: 600;
    background: var(--color-accent);
    color: var(--color-on-accent);
    border: 1px solid var(--color-accent);
    cursor: pointer;
  }

  .install-section-confirm:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .install-section-hint,
  .install-section-status {
    margin: 0;
    font-size: 13px;
    line-height: 1.5;
    color: var(--color-fg, #0f172a);
  }

  .install-ios-instructions-dialog {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: min(360px, calc(100vw - var(--space-4, 16px) * 2));
    background: var(--color-surface-elev, #ffffff);
    color: var(--color-fg, #0f172a);
    border: 1px solid var(--color-border, #cbd5e1);
    border-radius: 12px;
    box-shadow: 0 8px 24px rgba(15, 23, 42, 0.32);
    padding: var(--space-4, 16px);
    z-index: 50;
  }

  .install-ios-instructions-title {
    margin: 0 0 var(--space-2, 8px);
    font-size: 15px;
    font-weight: 600;
  }

  .install-ios-instructions-steps {
    margin: 0 0 var(--space-3, 12px);
    padding-left: var(--space-5, 20px);
    font-size: 13px;
    line-height: 1.5;
  }

  .install-ios-instructions-share-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin-left: var(--space-1, 4px);
    width: 16px;
    height: 16px;
    vertical-align: middle;
  }

  .install-ios-instructions-actions {
    display: flex;
    justify-content: flex-end;
  }

  .install-ios-instructions-close {
    padding: var(--space-2, 8px) var(--space-3, 12px);
    background: transparent;
    color: var(--color-fg, #0f172a);
    border: 1px solid var(--color-border, #cbd5e1);
    border-radius: 6px;
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }

  .cache-list {
    margin-bottom: var(--space-3, 12px);
  }

  .cache-row {
    display: grid;
    grid-template-columns: 1fr auto auto;
    align-items: center;
    gap: var(--space-3, 12px);
    min-height: 36px;
    padding: var(--space-1, 4px) 0;
  }

  .cache-source {
    font-size: 14px;
    font-weight: 500;
  }

  .cache-count {
    font: var(--font-numeric, monospace);
    font-size: 13px;
    color: var(--color-fg, #0f172a);
    opacity: 0.85;
  }

  .row-clear-btn {
    min-width: 36px;
    min-height: 36px;
    padding: var(--space-1, 4px) var(--space-3, 12px);
    background: var(--color-surface-elev, #ffffff);
    color: var(--color-fg, #0f172a);
    border: 1px solid var(--color-border, #cbd5e1);
    border-radius: 6px;
    font: inherit;
    font-size: 13px;
    cursor: pointer;
  }

  .row-clear-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .quota {
    margin: 0 0 var(--space-3, 12px);
    font-size: 12px;
    color: var(--color-fg, #0f172a);
    opacity: 0.7;
  }

  .controls {
    display: flex;
    flex-direction: column;
    gap: var(--space-2, 8px);
    margin-bottom: var(--space-4, 16px);
    padding-top: var(--space-3, 12px);
    border-top: 1px solid var(--color-border, #cbd5e1);
  }

  .control-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3, 12px);
    min-height: 36px;
  }

  .control-label {
    font-size: 13px;
    font-weight: 500;
  }

  .control-input {
    min-width: 96px;
    min-height: 36px;
    padding: var(--space-1, 4px) var(--space-2, 8px);
    background: var(--color-surface-elev, #ffffff);
    color: var(--color-fg, #0f172a);
    border: 1px solid var(--color-border, #cbd5e1);
    border-radius: 6px;
    font: inherit;
    font-size: 13px;
    cursor: pointer;
  }

  .control-input:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .actions {
    display: flex;
    justify-content: flex-end;
  }

  .clear-all-btn {
    min-width: 36px;
    min-height: 36px;
    padding: var(--space-2, 8px) var(--space-4, 16px);
    border-radius: 6px;
    font: inherit;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
  }

  .clear-all-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .danger {
    background: var(--color-danger-bg, #dc2626);
    color: var(--color-danger-fg, #ffffff);
    border: 1px solid var(--color-danger-bg, #dc2626);
  }

  .status {
    margin: var(--space-3, 12px) 0 0;
    padding: var(--space-2, 8px) var(--space-3, 12px);
    background: var(--color-surface-elev, #f8fafc);
    color: var(--color-fg, #0f172a);
    border-radius: 4px;
    font-size: 12px;
    line-height: 1.4;
  }

  .confirm-dialog {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: min(360px, calc(100vw - var(--space-4, 16px) * 2));
    background: var(--color-surface-elev, #ffffff);
    color: var(--color-fg, #0f172a);
    border: 1px solid var(--color-border, #cbd5e1);
    border-radius: 12px;
    box-shadow: 0 8px 24px rgba(15, 23, 42, 0.32);
    padding: var(--space-4, 16px);
    z-index: 50;
  }

  .confirm-title {
    margin: 0 0 var(--space-2, 8px);
    font-size: 15px;
    font-weight: 600;
  }

  .confirm-body {
    margin: 0 0 var(--space-3, 12px);
    font-size: 13px;
    line-height: 1.5;
    color: var(--color-fg, #0f172a);
  }

  .confirm-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2, 8px);
  }

  .confirm-cancel-btn,
  .confirm-ok-btn {
    min-width: 36px;
    min-height: 36px;
    padding: var(--space-2, 8px) var(--space-3, 12px);
    border-radius: 6px;
    font: inherit;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
  }

  .confirm-cancel-btn {
    background: var(--color-surface-elev, #ffffff);
    color: var(--color-fg, #0f172a);
    border: 1px solid var(--color-border, #cbd5e1);
  }

  .confirm-cancel-btn:disabled,
  .confirm-ok-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  button:focus-visible,
  select:focus-visible {
    outline: 2px solid var(--color-accent, #0ea5e9);
    outline-offset: 2px;
  }
</style>
