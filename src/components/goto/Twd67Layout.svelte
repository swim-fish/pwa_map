<script lang="ts">
  import { tStore } from '$i18n/index';
  export let easting: string = '';
  export let northing: string = '';
</script>

<div class="grid" data-testid="goto-layout-twd67-tm2">
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

<style>
  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-2, 8px);
    margin-bottom: var(--space-3, 12px);
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
</style>
