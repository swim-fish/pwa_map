<script lang="ts">
  import { tStore } from '$i18n/index';
  export let first5: string = '';
  export let last4or6: string = '';
  export let precision: 9 | 11 = 9;

  function upper(e: Event): void {
    const el = e.currentTarget as HTMLInputElement;
    el.value = el.value.toUpperCase();
  }
</script>

<div class="layout" data-testid="goto-layout-taipower">
  <div class="row">
    <label class="field">
      <span>{$tStore('goto.fields.first5')}</span>
      <input
        type="text"
        bind:value={first5}
        on:input={upper}
        data-testid="goto-field-taipower-first5"
        autocomplete="off"
        autocapitalize="characters"
        maxlength="5"
      />
    </label>
    <label class="field">
      <span>{$tStore('goto.fields.last4or6')}</span>
      <input
        type="text"
        bind:value={last4or6}
        on:input={upper}
        data-testid="goto-field-taipower-last4or6"
        autocomplete="off"
        autocapitalize="characters"
        maxlength={precision === 11 ? 6 : 4}
      />
    </label>
  </div>
  <div role="radiogroup" aria-label={$tStore('goto.fields.precision')} class="precision-row">
    <span class="label">{$tStore('goto.fields.precision')}</span>
    <button
      type="button"
      role="radio"
      aria-checked={precision === 9}
      class:active={precision === 9}
      data-testid="goto-field-taipower-precision-9"
      on:click={() => (precision = 9)}>{$tStore('goto.fields.precision9')}</button
    >
    <button
      type="button"
      role="radio"
      aria-checked={precision === 11}
      class:active={precision === 11}
      data-testid="goto-field-taipower-precision-11"
      on:click={() => (precision = 11)}>{$tStore('goto.fields.precision11')}</button
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

  .row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-2, 8px);
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

  .precision-row {
    display: flex;
    align-items: center;
    gap: var(--space-2, 8px);
  }

  .precision-row .label {
    font-size: 12px;
  }

  .precision-row button {
    padding: var(--space-1, 4px) var(--space-3, 12px);
    border: 1px solid var(--color-border, #cbd5e1);
    border-radius: 6px;
    background: var(--color-surface-elev, #f8fafc);
    font: inherit;
    font-size: 13px;
    cursor: pointer;
  }

  .precision-row button.active {
    background: var(--color-accent, #0ea5e9);
    color: #ffffff;
    border-color: var(--color-accent, #0ea5e9);
    font-weight: 600;
  }
</style>
