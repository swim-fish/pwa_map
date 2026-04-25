<script lang="ts">
  import { tStore } from '$i18n/index';
  export let lat: string = '';
  export let lon: string = '';
</script>

<div class="grid" data-testid="goto-layout-wgs84-dd">
  <label class="field">
    <span>{$tStore('goto.fields.lat')}</span>
    <input
      type="text"
      inputmode="decimal"
      bind:value={lat}
      data-testid="goto-field-dd-lat"
      autocomplete="off"
      spellcheck="false"
    />
  </label>
  <label class="field">
    <span>{$tStore('goto.fields.lon')}</span>
    <input
      type="text"
      inputmode="decimal"
      bind:value={lon}
      data-testid="goto-field-dd-lon"
      autocomplete="off"
      spellcheck="false"
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
    color: var(--color-fg, #0f172a);
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
