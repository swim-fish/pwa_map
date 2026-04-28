<script lang="ts">
  import { tStore } from '$i18n/index';
  export let first5: string = '';
  export let last4or6: string = '';

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
        maxlength="6"
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
