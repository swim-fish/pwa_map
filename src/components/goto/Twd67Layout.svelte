<script lang="ts">
  import { tStore } from '$i18n/index';
  export let easting: string = '';
  export let northing: string = '';
  // Zone selector lives here for label parity with Tm2Layout (FR-017).
  // The TWD67 parser currently treats every TWD67 input as zone 121
  // (Taiwan main island), so the selector is informational; switching to
  // 119 still produces an out-of-range rejection from the parser, which
  // is the existing contract from feature 002.
  let zone: 'auto' | 119 | 121 = 'auto';

  function setZone(z: 'auto' | 119 | 121): void {
    zone = z;
  }

  function composeZoneLabel(zoneNum: 121 | 119, tStoreFn: (k: string) => string): string {
    const tagKey = zoneNum === 121 ? 'goto.fields.zoneTagMainIsland' : 'goto.fields.zoneTagPenghu';
    const numKey = zoneNum === 121 ? 'goto.fields.zone121' : 'goto.fields.zone119';
    const num = tStoreFn(numKey);
    const tag = tStoreFn(tagKey);
    if (tStoreFn('goto.fields.zoneAuto') === 'auto') {
      return `${num} (${tag})`;
    }
    return `${num} ${tag}`;
  }
</script>

<div class="layout" data-testid="goto-layout-twd67-tm2">
  <div class="grid">
    <label class="field">
      <span>{$tStore('goto.fields.easting')}</span>
      <input
        type="text"
        inputmode="decimal"
        bind:value={easting}
        data-testid="goto-field-tm2-easting"
      />
    </label>
    <label class="field">
      <span>{$tStore('goto.fields.northing')}</span>
      <input
        type="text"
        inputmode="decimal"
        bind:value={northing}
        data-testid="goto-field-tm2-northing"
      />
    </label>
  </div>
  <div role="radiogroup" aria-label={$tStore('goto.fields.zone')} class="zone-row">
    <span class="label">{$tStore('goto.fields.zone')}</span>
    <button
      type="button"
      role="radio"
      aria-checked={zone === 'auto'}
      class:active={zone === 'auto'}
      data-testid="goto-field-twd67-zone-auto"
      on:click={() => setZone('auto')}>{$tStore('goto.fields.zoneAuto')}</button
    >
    <button
      type="button"
      role="radio"
      aria-checked={zone === 119}
      class:active={zone === 119}
      data-testid="goto-field-twd67-zone-119"
      on:click={() => setZone(119)}>{composeZoneLabel(119, $tStore)}</button
    >
    <button
      type="button"
      role="radio"
      aria-checked={zone === 121}
      class:active={zone === 121}
      data-testid="goto-field-twd67-zone-121"
      on:click={() => setZone(121)}>{composeZoneLabel(121, $tStore)}</button
    >
  </div>
</div>

<style>
  .layout {
    display: flex;
    flex-direction: column;
    gap: var(--space-2, 8px);
    margin-bottom: var(--space-3, 12px);
  }

  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-2, 8px);
  }

  /* Feature 012 — narrow-phone collapse (FR-010..FR-014). */
  @media (max-width: calc(360px - 0.02px)) {
    .grid {
      grid-template-columns: 1fr;
    }
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1, 4px);
    font-size: 12px;
  }

  input {
    padding: var(--space-2, 8px);
    border: 1px solid var(--color-border, #cbd5e1);
    border-radius: 6px;
    font: var(--font-numeric, monospace);
    font-size: 14px;
    background: var(--color-bg, #f5f5f5);
    color: var(--color-fg, #0f172a);
  }

  .zone-row {
    display: flex;
    align-items: center;
    gap: var(--space-2, 8px);
    flex-wrap: wrap;
  }

  .zone-row .label {
    font-size: 12px;
    color: var(--color-fg, #0f172a);
  }

  .zone-row button {
    padding: var(--space-1, 4px) var(--space-3, 12px);
    border: 1px solid var(--color-border, #cbd5e1);
    border-radius: 6px;
    background: var(--color-surface-elev, #f8fafc);
    color: var(--color-fg, #0f172a);
    font: inherit;
    font-size: 13px;
    cursor: pointer;
  }

  .zone-row button.active {
    background: var(--color-accent, #0ea5e9);
    color: #ffffff;
    border-color: var(--color-accent, #0ea5e9);
    font-weight: 600;
  }
</style>
