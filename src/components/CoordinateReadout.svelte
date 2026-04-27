<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { CoordinateKind, WGS84DD } from '$types/coord';
  import {
    coverageOf,
    formatMGRS,
    formatTaipower,
    formatTWD67TM2,
    formatTWD97TM2,
    formatWGS84DD,
    formatWGS84DMS,
    wgs84DdToDms,
    wgs84ToMgrs,
    wgs84ToTaipower,
    wgs84ToTwd67,
    wgs84ToTwd97,
  } from '$coord/index';
  import { coordinateSegments, type CoordinateSegment } from '$coord/segments';
  import type { FormatPreferences } from '$storage/preferences';
  import { tStore } from '$i18n/index';
  import { copyReadout } from './copy';

  export let position: WGS84DD;
  export let visible: readonly CoordinateKind[];
  export let mgrsPrecision: FormatPreferences['mgrsPrecision'] = 5;
  export let taipowerPrecision: FormatPreferences['taipowerPrecision'] = 9;

  const dispatch = createEventDispatcher<{
    'copy-success': { kind: CoordinateKind };
    'copy-fallback': { text: string };
  }>();

  type Row = {
    kind: CoordinateKind;
    labelKey: string;
    /** Canonical single-string value used by the copy button. */
    canonical: string;
    /** Per-Go-To-layout segments rendered as separate labelled fields. */
    segments: readonly CoordinateSegment[];
    coverage: 'ok' | 'out-of-coverage';
  };

  function canonicalFor(kind: CoordinateKind, pos: WGS84DD): string {
    switch (kind) {
      case 'wgs84-dd':
        return formatWGS84DD(pos);
      case 'wgs84-dms':
        return formatWGS84DMS(wgs84DdToDms(pos));
      case 'twd97-tm2':
        return formatTWD97TM2(wgs84ToTwd97(pos));
      case 'twd67-tm2':
        return formatTWD67TM2(wgs84ToTwd67(pos));
      case 'mgrs':
        return formatMGRS(wgs84ToMgrs(pos, mgrsPrecision));
      case 'taipower': {
        const r = wgs84ToTaipower(pos, taipowerPrecision);
        return r.ok ? formatTaipower(r.value) : '';
      }
    }
  }

  function rowFor(kind: CoordinateKind, pos: WGS84DD): Row {
    const cov = coverageOf(kind, pos);
    const common = { kind, labelKey: `format.labels.${kind}` };
    if (cov === 'out-of-coverage') {
      return { ...common, canonical: '', segments: [], coverage: 'out-of-coverage' };
    }
    const seg = coordinateSegments(kind, pos, { mgrsPrecision, taipowerPrecision });
    if (seg.coverage === 'out-of-coverage') {
      return { ...common, canonical: '', segments: [], coverage: 'out-of-coverage' };
    }
    return {
      ...common,
      canonical: canonicalFor(kind, pos),
      segments: seg.segments,
      coverage: 'ok',
    };
  }

  $: rows = visible.map((k) => rowFor(k, position));

  async function onCopy(row: Row): Promise<void> {
    if (row.coverage !== 'ok' || row.canonical === '') return;
    const r = await copyReadout(row.canonical);
    if (r.ok) {
      dispatch('copy-success', { kind: row.kind });
    } else {
      dispatch('copy-fallback', { text: row.canonical });
    }
  }
</script>

<section class="readout" aria-live="polite" data-testid="readout-panel">
  {#each rows as row (row.kind)}
    <div class="row" data-testid="readout-{row.kind}">
      <span class="label">{$tStore(row.labelKey)}</span>
      {#if row.coverage === 'ok'}
        <span class="segments">
          {#each row.segments as seg, i (i + ':' + seg.labelKey)}
            <span class="segment">
              <span class="seg-label">{$tStore(seg.labelKey)}</span>
              <span class="seg-value">{seg.value}</span>
            </span>
          {/each}
        </span>
        <button
          type="button"
          class="copy"
          on:click={() => onCopy(row)}
          aria-label={$tStore('copy.button.aria', { format: $tStore(row.labelKey) })}
          data-testid="copy-{row.kind}"
        >
          ⧉
        </button>
      {:else}
        <span class="value out-of-coverage" data-testid="out-of-coverage-{row.kind}"
          >{$tStore('coverage.notInTaiwan')}</span
        >
        <span></span>
      {/if}
    </div>
  {/each}
  <span class="sr-only" data-testid="readout-dd">{formatWGS84DD(position)}</span>
</section>

<style>
  .readout {
    position: absolute;
    left: var(--space-3, 12px);
    bottom: var(--space-3, 12px);
    padding: var(--space-3, 12px) var(--space-4, 16px);
    background: var(--readout-bg, rgba(255, 255, 255, 0.95));
    color: var(--readout-fg, #0f172a);
    font: var(--font-ui, 14px/1.4 system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif);
    border-radius: 8px;
    box-shadow: var(--readout-shadow, 0 2px 12px rgba(15, 23, 42, 0.15));
    z-index: 6;
    max-width: min(640px, calc(100vw - 24px));
    display: grid;
    gap: var(--space-1, 4px);
  }

  .row {
    display: grid;
    grid-template-columns: 120px 1fr auto;
    align-items: baseline;
    gap: var(--space-2, 8px);
  }

  .label {
    font-weight: 600;
    color: var(--color-fg-muted, #475569);
  }

  .segments {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2, 8px);
    align-items: baseline;
  }

  .segment {
    display: inline-flex;
    flex-direction: column;
    align-items: flex-start;
    line-height: 1.1;
  }

  .seg-label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--color-fg-muted, #475569);
  }

  .seg-value {
    font-variant-numeric: tabular-nums;
    font-family: var(--font-numeric, monospace);
    font-size: 13px;
  }

  .value {
    font-variant-numeric: tabular-nums;
    font-family: var(--font-numeric, monospace);
  }

  .out-of-coverage {
    color: var(--color-fg-muted, #475569);
    font-style: italic;
  }

  .copy {
    min-width: var(--tap-min);
    min-height: var(--tap-min);
    padding: var(--space-2, 8px);
    border: 0;
    border-radius: 4px;
    background: transparent;
    color: var(--color-fg-muted, #475569);
    cursor: pointer;
    font-size: 14px;
    line-height: 1;
  }

  .copy:hover {
    background: var(--color-bg, #f5f5f5);
    color: var(--color-fg, #0f172a);
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
