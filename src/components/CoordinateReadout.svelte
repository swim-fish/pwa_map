<script lang="ts">
  import { createEventDispatcher, onDestroy } from 'svelte';
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
  import { DEFAULT_FORMAT_ORDER, type FormatPreferences } from '$storage/preferences';
  import { tStore } from '$i18n/index';
  import { copyReadout } from './copy';

  export let position: WGS84DD;
  export let visible: readonly CoordinateKind[];
  export let formatOrder: readonly CoordinateKind[] = DEFAULT_FORMAT_ORDER;
  export let mgrsPrecision: FormatPreferences['mgrsPrecision'] = 5;
  export let taipowerPrecision: FormatPreferences['taipowerPrecision'] = 9;

  const dispatch = createEventDispatcher<{
    'copy-success': { kind: CoordinateKind };
    'copy-fallback': { text: string };
  }>();

  // Two matchMedia subscriptions decide the DEFAULT collapse state:
  // narrow viewport (< 600 CSS px wide) OR short viewport (< 800 CSS px
  // tall) defaults to `collapsed`; wide+tall viewports default to
  // `expanded`. The user can toggle either way; the toggle resets when
  // the viewport crosses a threshold.
  const NARROW_QUERY = '(max-width: calc(600px - 0.02px))';
  const SHORT_QUERY = '(max-height: calc(800px - 0.02px))';
  let isNarrow = false;
  let isShort = false;
  let narrowMql: MediaQueryList | null = null;
  let shortMql: MediaQueryList | null = null;
  let narrowListener: ((e: MediaQueryListEvent | MediaQueryList) => void) | null = null;
  let shortListener: ((e: MediaQueryListEvent | MediaQueryList) => void) | null = null;

  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    narrowMql = window.matchMedia(NARROW_QUERY);
    isNarrow = narrowMql.matches;
    narrowListener = (e: MediaQueryListEvent | MediaQueryList): void => {
      isNarrow = e.matches;
    };
    narrowMql.addEventListener('change', narrowListener as (e: MediaQueryListEvent) => void);

    shortMql = window.matchMedia(SHORT_QUERY);
    isShort = shortMql.matches;
    shortListener = (e: MediaQueryListEvent | MediaQueryList): void => {
      isShort = e.matches;
    };
    shortMql.addEventListener('change', shortListener as (e: MediaQueryListEvent) => void);
  }

  onDestroy(() => {
    if (narrowMql && narrowListener) {
      narrowMql.removeEventListener('change', narrowListener as (e: MediaQueryListEvent) => void);
    }
    if (shortMql && shortListener) {
      shortMql.removeEventListener('change', shortListener as (e: MediaQueryListEvent) => void);
    }
  });

  // `userToggled` is the user's explicit override of the viewport-derived
  // default. It is component-local (never persisted) and clears whenever
  // the default flips so the user always sees the viewport's natural
  // state on a fresh threshold crossing.
  let userToggled = false;

  $: enabled = formatOrder.filter((k) => visible.includes(k));

  // Default collapse only applies when there is something to collapse
  // (≥ 2 enabled formats) AND the viewport is narrow OR short.
  $: defaultCollapsed = enabled.length >= 2 && (isNarrow || isShort);

  // Reset user toggle on a default-state change (viewport threshold
  // crossing or enabled-set change), so the user always sees the
  // viewport's natural state on a fresh entry.
  let lastDefaultCollapsed = defaultCollapsed;
  $: if (defaultCollapsed !== lastDefaultCollapsed) {
    lastDefaultCollapsed = defaultCollapsed;
    userToggled = false;
  }

  // XOR: collapsed iff default differs from user toggle. With < 2
  // formats there's nothing to collapse, so always expanded.
  $: viewMode = enabled.length >= 2 && defaultCollapsed !== userToggled ? 'collapsed' : 'expanded';

  // Surface "this row is interactively toggleable" to CSS + ARIA.
  $: toggleable = enabled.length >= 2;

  type Row = {
    kind: CoordinateKind;
    labelKey: string;
    /** Canonical single-string value used by the copy button. */
    canonical: string;
    /** Per-Go-To-layout segments rendered as separate labelled fields. */
    segments: readonly CoordinateSegment[];
    coverage: 'ok' | 'out-of-coverage';
  };

  // Presentation-only: these segment label keys carry parameters that
  // are configured in Settings (TM2 zone, Taipower precision) rather
  // than primary coordinate values. Hiding them in the readout reduces
  // visual noise without changing the canonical copy string (the copy
  // button still emits the full kind-specific format) and without
  // changing the `coordinateSegments()` contract used by Go To
  // (feature 009).
  const HIDDEN_SEGMENT_LABEL_KEYS = new Set<string>(['goto.fields.zone', 'goto.fields.precision']);

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
      segments: seg.segments.filter((s) => !HIDDEN_SEGMENT_LABEL_KEYS.has(s.labelKey)),
      coverage: 'ok',
    };
  }

  $: allRows = enabled.map((k) => rowFor(k, position));

  // In `collapsed` mode the component only emits the priority-one row to
  // the DOM (Invariant 1 — keeps the contract jsdom-testable AND avoids
  // mounting copy buttons that the user cannot see). The CSS @media rule
  // remains the visual fallback for any future widening.
  $: rows = viewMode === 'collapsed' ? allRows.slice(0, 1) : allRows;

  async function onCopy(row: Row, ev: MouseEvent): Promise<void> {
    // Copy clicks must not bubble to the body tap-handler that toggles
    // tap-expanded (Invariant 3 / FR-010).
    ev.stopPropagation();
    if (row.coverage !== 'ok' || row.canonical === '') return;
    const r = await copyReadout(row.canonical);
    if (r.ok) {
      dispatch('copy-success', { kind: row.kind });
    } else {
      dispatch('copy-fallback', { text: row.canonical });
    }
  }

  function onBodyTap(): void {
    if (toggleable) {
      userToggled = !userToggled;
    }
  }

  function onBodyKeydown(ev: KeyboardEvent): void {
    if (!toggleable) return;
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      onBodyTap();
    }
  }
</script>

<!-- svelte-ignore a11y-no-noninteractive-tabindex -->
<section
  class="readout"
  data-mode={viewMode}
  data-toggleable={toggleable}
  data-testid="readout-panel"
  aria-live="polite"
  role={toggleable ? 'button' : undefined}
  aria-expanded={toggleable ? viewMode === 'expanded' : undefined}
  tabindex={toggleable ? 0 : undefined}
  on:click={onBodyTap}
  on:keydown={onBodyKeydown}
>
  {#each rows as row, i (row.kind)}
    <div
      class="row"
      class:row--priority-one={i === 0 && enabled.length >= 2}
      data-testid="readout-{row.kind}"
    >
      <span class="label">{$tStore(row.labelKey)}</span>
      {#if row.coverage === 'ok'}
        <span class="segments">
          {#each row.segments as seg, j (j + ':' + seg.labelKey)}
            <span class="segment">
              <span class="seg-label">{$tStore(seg.labelKey)}</span>
              <span class="seg-value">{seg.value}</span>
            </span>
          {/each}
        </span>
        <button
          type="button"
          class="copy"
          on:click={(ev) => onCopy(row, ev)}
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
    left: calc(var(--space-3) + var(--inline-stack-zone-left));
    /* +var(--space-5) lifts the panel above the bottom-right attribution
       badge so the badge stays readable on every viewport. */
    bottom: calc(var(--space-3) + var(--space-5) + var(--bottom-stack-zone-bottom));
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
    transition: max-height 200ms ease;
  }

  .row {
    display: grid;
    grid-template-columns: 120px 1fr auto;
    align-items: baseline;
    gap: var(--space-2, 8px);
  }

  /* Collapse: only the priority-one row stays visible whenever the
     view-mode is `collapsed` (regardless of viewport — narrow / short
     viewports trigger it by default; on wider viewports the user can
     toggle into it). */
  .readout[data-mode='collapsed'] .row:not(.row--priority-one) {
    display: none;
  }

  /* Whenever the body is interactively toggleable (≥ 2 enabled formats)
     the cursor reflects clickability in either direction. */
  .readout[data-toggleable='true'] {
    cursor: pointer;
  }

  /* On narrow viewports, when collapsed, cap the panel width so the
     priority-one row never wraps past the right side of the viewport. */
  @media (max-width: calc(var(--readout-collapse-bp) - 0.02px)) {
    .readout[data-mode='collapsed'] {
      max-width: min(360px, calc(100vw - 24px));
    }
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
