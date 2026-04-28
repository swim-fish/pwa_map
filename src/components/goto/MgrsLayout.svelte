<script lang="ts">
  import { tStore } from '$i18n/index';
  export let gzdBand: string = '';
  export let square: string = '';
  export let easting: string = '';
  export let northing: string = '';

  function upper(e: Event): void {
    const el = e.currentTarget as HTMLInputElement;
    el.value = el.value.toUpperCase();
  }

  function digitsOnly(e: Event): void {
    const el = e.currentTarget as HTMLInputElement;
    el.value = el.value.replace(/\D+/g, '');
  }
</script>

<div class="layout" data-testid="goto-layout-mgrs">
  <div class="row">
    <label class="field">
      <span>{$tStore('goto.fields.gzdBand')}</span>
      <input
        type="text"
        bind:value={gzdBand}
        on:input={upper}
        data-testid="goto-field-mgrs-gzd"
        autocomplete="off"
        autocapitalize="characters"
      />
    </label>
    <label class="field">
      <span>{$tStore('goto.fields.square')}</span>
      <input
        type="text"
        bind:value={square}
        on:input={upper}
        data-testid="goto-field-mgrs-square"
        autocomplete="off"
        autocapitalize="characters"
      />
    </label>
  </div>
  <div class="row">
    <label class="field">
      <span>{$tStore('goto.fields.easting')}</span>
      <input
        type="text"
        inputmode="numeric"
        bind:value={easting}
        on:input={digitsOnly}
        data-testid="goto-field-mgrs-easting"
        autocomplete="off"
      />
    </label>
    <label class="field">
      <span>{$tStore('goto.fields.northing')}</span>
      <input
        type="text"
        inputmode="numeric"
        bind:value={northing}
        on:input={digitsOnly}
        data-testid="goto-field-mgrs-northing"
        autocomplete="off"
      />
    </label>
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
    grid-template-columns: 1fr 1fr;
    gap: var(--space-2, 8px);
  }

  /* Feature 012 — narrow-phone collapse (FR-010..FR-014). */
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
    text-transform: uppercase;
  }
</style>
