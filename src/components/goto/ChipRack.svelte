<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { tStore } from '$i18n/index';
  import type { FormatSelection } from '$types/goto';

  export let selection: FormatSelection = { kind: 'auto' };

  const dispatch = createEventDispatcher<{ change: FormatSelection }>();

  type ChipDef = { selection: FormatSelection; labelKey: string; testKind: string };

  const CHIPS: readonly ChipDef[] = [
    { selection: { kind: 'auto' }, labelKey: 'goto.chips.auto', testKind: 'auto' },
    {
      selection: { kind: 'fixed', value: 'taipower' },
      labelKey: 'goto.chips.taipower',
      testKind: 'taipower',
    },
    {
      selection: { kind: 'fixed', value: 'wgs84-dd' },
      labelKey: 'goto.chips.wgs84Dd',
      testKind: 'wgs84-dd',
    },
    {
      selection: { kind: 'fixed', value: 'wgs84-dms' },
      labelKey: 'goto.chips.wgs84Dms',
      testKind: 'wgs84-dms',
    },
    {
      selection: { kind: 'fixed', value: 'twd67-tm2' },
      labelKey: 'goto.chips.twd67',
      testKind: 'twd67-tm2',
    },
    {
      selection: { kind: 'fixed', value: 'twd97-tm2' },
      labelKey: 'goto.chips.twd97',
      testKind: 'twd97-tm2',
    },
    { selection: { kind: 'fixed', value: 'mgrs' }, labelKey: 'goto.chips.mgrs', testKind: 'mgrs' },
  ];

  function isActive(chip: FormatSelection, current: FormatSelection): boolean {
    if (chip.kind === 'auto' && current.kind === 'auto') return true;
    if (chip.kind === 'fixed' && current.kind === 'fixed' && chip.value === current.value)
      return true;
    return false;
  }

  function handleClick(chip: FormatSelection): void {
    dispatch('change', chip);
  }

  function handleKeydown(e: KeyboardEvent, idx: number): void {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const dir = e.key === 'ArrowRight' ? 1 : -1;
    const next = (idx + dir + CHIPS.length) % CHIPS.length;
    const buttons = (e.currentTarget as HTMLElement).parentElement?.querySelectorAll(
      '[data-testid="goto-chip"]',
    );
    (buttons?.[next] as HTMLButtonElement | undefined)?.focus();
    dispatch('change', CHIPS[next].selection);
  }
</script>

<div role="tablist" class="rack" data-testid="goto-chip-rack">
  {#each CHIPS as chip, i (chip.testKind)}
    <button
      type="button"
      role="tab"
      class="chip"
      class:active={isActive(chip.selection, selection)}
      aria-selected={isActive(chip.selection, selection)}
      data-testid="goto-chip"
      data-chip-kind={chip.testKind}
      tabindex={isActive(chip.selection, selection) ? 0 : -1}
      on:click={() => handleClick(chip.selection)}
      on:keydown={(e) => handleKeydown(e, i)}
    >
      {$tStore(chip.labelKey)}
    </button>
  {/each}
</div>

<style>
  .rack {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1, 4px);
    margin-bottom: var(--space-3, 12px);
  }

  .chip {
    padding: var(--space-1, 4px) var(--space-3, 12px);
    height: 32px;
    border: 1px solid var(--color-border, #cbd5e1);
    border-radius: 999px;
    background: var(--color-surface-elev, #f8fafc);
    color: var(--color-fg, #0f172a);
    font: inherit;
    font-size: 13px;
    cursor: pointer;
  }

  .chip.active {
    background: var(--color-accent, #0ea5e9);
    color: #ffffff;
    border-color: var(--color-accent, #0ea5e9);
    font-weight: 600;
  }

  .chip:focus-visible {
    outline: 2px solid var(--color-accent, #0ea5e9);
    outline-offset: 2px;
  }
</style>
