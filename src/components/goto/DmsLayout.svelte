<script lang="ts">
  import { tStore } from '$i18n/index';
  export let latDeg: string = '';
  export let latMin: string = '';
  export let latSec: string = '';
  export let latHem: 'N' | 'S' = 'N';
  export let lonDeg: string = '';
  export let lonMin: string = '';
  export let lonSec: string = '';
  export let lonHem: 'E' | 'W' = 'E';
</script>

<div class="layout" data-testid="goto-layout-wgs84-dms">
  <div class="row">
    <label class="field"
      ><span>{$tStore('goto.fields.latDeg')}</span><input
        type="text"
        inputmode="numeric"
        bind:value={latDeg}
        data-testid="goto-field-dms-lat-deg"
      /></label
    >
    <label class="field"
      ><span>{$tStore('goto.fields.latMin')}</span><input
        type="text"
        inputmode="numeric"
        bind:value={latMin}
        data-testid="goto-field-dms-lat-min"
      /></label
    >
    <label class="field"
      ><span>{$tStore('goto.fields.latSec')}</span><input
        type="text"
        inputmode="decimal"
        bind:value={latSec}
        data-testid="goto-field-dms-lat-sec"
      /></label
    >
    <div role="radiogroup" aria-label={$tStore('goto.fields.hemNS')} class="hem">
      <button
        type="button"
        role="radio"
        aria-checked={latHem === 'N'}
        class:active={latHem === 'N'}
        data-testid="goto-field-dms-lat-hem-n"
        on:click={() => (latHem = 'N')}>{$tStore('goto.fields.hemN')}</button
      >
      <button
        type="button"
        role="radio"
        aria-checked={latHem === 'S'}
        class:active={latHem === 'S'}
        data-testid="goto-field-dms-lat-hem-s"
        on:click={() => (latHem = 'S')}>{$tStore('goto.fields.hemS')}</button
      >
    </div>
  </div>
  <div class="row">
    <label class="field"
      ><span>{$tStore('goto.fields.lonDeg')}</span><input
        type="text"
        inputmode="numeric"
        bind:value={lonDeg}
        data-testid="goto-field-dms-lon-deg"
      /></label
    >
    <label class="field"
      ><span>{$tStore('goto.fields.lonMin')}</span><input
        type="text"
        inputmode="numeric"
        bind:value={lonMin}
        data-testid="goto-field-dms-lon-min"
      /></label
    >
    <label class="field"
      ><span>{$tStore('goto.fields.lonSec')}</span><input
        type="text"
        inputmode="decimal"
        bind:value={lonSec}
        data-testid="goto-field-dms-lon-sec"
      /></label
    >
    <div role="radiogroup" aria-label={$tStore('goto.fields.hemEW')} class="hem">
      <button
        type="button"
        role="radio"
        aria-checked={lonHem === 'E'}
        class:active={lonHem === 'E'}
        data-testid="goto-field-dms-lon-hem-e"
        on:click={() => (lonHem = 'E')}>{$tStore('goto.fields.hemE')}</button
      >
      <button
        type="button"
        role="radio"
        aria-checked={lonHem === 'W'}
        class:active={lonHem === 'W'}
        data-testid="goto-field-dms-lon-hem-w"
        on:click={() => (lonHem = 'W')}>{$tStore('goto.fields.hemW')}</button
      >
    </div>
  </div>
</div>

<style>
  .layout {
    display: flex;
    flex-direction: column;
    gap: var(--space-2, 8px);
    margin-bottom: var(--space-3, 12px);
  }

  .row {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr)) auto;
    gap: var(--space-1, 4px);
    align-items: end;
  }

  /* Feature 012 — narrow-phone collapse (FR-010..FR-014). The 3-cell
     numeric row + hemisphere stacks vertically below 360 px. */
  @media (max-width: calc(360px - 0.02px)) {
    .row {
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

  .hem {
    display: flex;
    border: 1px solid var(--color-border, #cbd5e1);
    border-radius: 6px;
    overflow: hidden;
  }

  .hem button {
    width: 32px;
    height: 36px;
    border: 0;
    background: var(--color-surface-elev, #f8fafc);
    color: var(--color-fg, #0f172a);
    font: inherit;
    cursor: pointer;
  }

  .hem button.active {
    background: var(--color-accent, #0ea5e9);
    color: #ffffff;
    font-weight: 600;
  }
</style>
