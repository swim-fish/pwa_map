<script lang="ts">
  import { tStore } from '$i18n/index';
  import { findSource, type BasemapId } from '$map/sources';

  // Backwards-compat: feature 001 / 002 callers still pass `text`. Feature 003
  // callers pass `basemap` + `overlay` and we resolve attribution via i18n.
  export let text: string | undefined = undefined;
  export let basemap: BasemapId | undefined = undefined;
  export let overlay: boolean = false;

  $: composed = (() => {
    if (text !== undefined) return text;
    if (!basemap) return '';
    const base = findSource(basemap);
    if (!base) return '';
    const baseText = $tStore(base.attributionKey);
    if (!overlay) return baseText;
    const over = findSource('google-road-overlay');
    if (!over) return baseText;
    const overText = $tStore(over.attributionKey);
    if (overText === baseText) return baseText;
    return `${baseText} | ${overText}`;
  })();
</script>

<small class="attribution" data-testid="attribution">{composed}</small>

<style>
  .attribution {
    position: absolute;
    right: calc(var(--space-2) + var(--inline-stack-zone-right));
    bottom: calc(var(--space-2) + var(--bottom-stack-zone-bottom));
    padding: 2px var(--space-2, 8px);
    background: var(--attribution-bg);
    color: var(--attribution-fg);
    font-size: 12px;
    line-height: 1.3;
    border-radius: 4px;
    pointer-events: none;
    z-index: 4;
  }
</style>
