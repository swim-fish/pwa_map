<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { tStore } from '$i18n/index';
  import { basemaps, type MapGroup, type MapLayerOption } from '$map/sources';
  import type { LayerSelection } from '$types/map';

  export let open: boolean = false;
  export let selection: LayerSelection = { basemap: 'osm-standard', overlay: false };

  const dispatch = createEventDispatcher<{
    change: LayerSelection;
    close: void;
  }>();

  type Group = { key: MapGroup; titleKey: string; entries: readonly MapLayerOption[] };

  $: groupedBasemaps = ((): Group[] => {
    const list = basemaps();
    return [
      {
        key: 'other' as const,
        titleKey: 'map.layers.group.other',
        entries: list.filter((s) => s.group === 'other'),
      },
      {
        key: 'nlsc' as const,
        titleKey: 'map.layers.group.nlsc',
        entries: list.filter((s) => s.group === 'nlsc'),
      },
      {
        key: 'google' as const,
        titleKey: 'map.layers.group.google',
        entries: list.filter((s) => s.group === 'google'),
      },
    ].filter((g) => g.entries.length > 0);
  })();

  function pickBasemap(id: string): void {
    dispatch('change', { basemap: id as LayerSelection['basemap'], overlay: selection.overlay });
  }

  function toggleOverlay(): void {
    dispatch('change', { basemap: selection.basemap, overlay: !selection.overlay });
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
    aria-label={$tStore('toolbar.layers.button')}
    data-testid="layer-picker-backdrop"
  ></button>
  <div role="menu" aria-labelledby="layer-picker-title" class="picker" data-testid="layer-picker">
    <h3 id="layer-picker-title" class="title">{$tStore('toolbar.layers.button')}</h3>
    {#each groupedBasemaps as group (group.key)}
      <div class="group" data-testid="layer-group" data-layer-group={group.key}>
        <div role="presentation" class="group-title">{$tStore(group.titleKey)}</div>
        {#each group.entries as entry (entry.id)}
          {@const isActive = entry.id === selection.basemap}
          <button
            type="button"
            role="menuitemradio"
            aria-checked={isActive}
            class="row"
            class:active={isActive}
            data-testid="layer-row"
            data-layer-id={entry.id}
            data-layer-group={entry.group}
            on:click={() => pickBasemap(entry.id)}
          >
            <span class="dot" aria-hidden="true"></span>
            <span class="label">{$tStore(entry.labelKey)}</span>
          </button>
        {/each}
      </div>
    {/each}
    <hr class="sep" />
    {#each [{ id: 'google-road-overlay', labelKey: 'map.layers.googleRoadOverlay' }] as overlay (overlay.id)}
      <button
        type="button"
        role="menuitemcheckbox"
        aria-checked={selection.overlay}
        class="row overlay"
        class:active={selection.overlay}
        data-testid="layer-overlay"
        data-layer-id={overlay.id}
        on:click={toggleOverlay}
      >
        <span class="check" aria-hidden="true">{selection.overlay ? '☑' : '☐'}</span>
        <span class="label">{$tStore(overlay.labelKey)}</span>
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
    min-width: 280px;
    max-height: 60vh;
    overflow-y: auto;
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

  .group {
    margin-bottom: var(--space-2, 8px);
  }

  .group-title {
    font-size: 11px;
    text-transform: uppercase;
    color: var(--color-fg, #0f172a);
    opacity: 0.6;
    padding: var(--space-1, 4px) var(--space-2, 8px);
    letter-spacing: 0.05em;
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

  .check {
    font-size: 16px;
    line-height: 1;
    width: 16px;
    flex-shrink: 0;
  }

  .label {
    flex: 1;
    font-size: 13px;
  }

  .sep {
    border: 0;
    border-top: 1px solid var(--color-border, #cbd5e1);
    margin: var(--space-2, 8px) 0;
  }
</style>
