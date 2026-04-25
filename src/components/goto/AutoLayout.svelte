<script lang="ts">
  import { tStore } from '$i18n/index';
  export let raw: string = '';
</script>

<label class="field" data-testid="goto-layout-auto">
  <span class="sr-only">{$tStore('goto.fields.auto')}</span>
  <textarea
    bind:value={raw}
    placeholder={$tStore('goto.placeholder')}
    rows="3"
    data-testid="goto-input"
  ></textarea>
</label>

<style>
  .field {
    display: block;
    margin-bottom: var(--space-3, 12px);
  }

  textarea {
    width: 100%;
    padding: var(--space-2, 8px) var(--space-3, 12px);
    border: 1px solid var(--color-border, #cbd5e1);
    border-radius: 6px;
    font: var(--font-numeric, monospace);
    font-size: 14px;
    resize: vertical;
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
