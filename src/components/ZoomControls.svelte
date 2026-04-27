<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { tStore } from '$i18n/index';
  import type { MapController, MapMoveEvent } from '$map/MapController';

  export let controller: MapController;

  const reducedMotion =
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false;

  function readMapState(): { zoom: number; min: number; max: number } {
    const map = controller.getUnderlying() as {
      getMaxZoom?: () => number;
      getMinZoom?: () => number;
      getZoom?: () => number;
    } | null;
    return {
      zoom: map?.getZoom?.() ?? controller.zoom,
      min: map?.getMinZoom?.() ?? -Infinity,
      max: map?.getMaxZoom?.() ?? Infinity,
    };
  }

  const initial = readMapState();
  let currentZoom = initial.zoom;
  const maxZoom = initial.max;
  const minZoom = initial.min;

  $: atMaxZoom = currentZoom >= maxZoom - 1e-6;
  $: atMinZoom = currentZoom <= minZoom + 1e-6;
  $: inLabel = atMaxZoom ? $tStore('controls.zoom.in.disabled') : $tStore('controls.zoom.in.label');
  $: outLabel = atMinZoom
    ? $tStore('controls.zoom.out.disabled')
    : $tStore('controls.zoom.out.label');

  let unsub: (() => void) | null = null;

  onMount(() => {
    unsub = controller.onMove((ev: MapMoveEvent) => {
      currentZoom = ev.zoom;
    });
  });

  onDestroy(() => {
    unsub?.();
  });

  function onZoomIn(): void {
    if (atMaxZoom) return;
    controller.zoomBy(+1, !reducedMotion);
  }

  function onZoomOut(): void {
    if (atMinZoom) return;
    controller.zoomBy(-1, !reducedMotion);
  }
</script>

<button
  type="button"
  class="zoom-btn zoom-in"
  data-testid="zoom-in"
  aria-label={inLabel}
  aria-disabled={atMaxZoom}
  on:click={onZoomIn}>+</button
>
<button
  type="button"
  class="zoom-btn zoom-out"
  data-testid="zoom-out"
  aria-label={outLabel}
  aria-disabled={atMinZoom}
  on:click={onZoomOut}>−</button
>

<style>
  .zoom-btn {
    min-width: var(--tap-min);
    min-height: var(--tap-min);
    padding: 0;
    background: var(--color-surface-elev, rgba(255, 255, 255, 0.95));
    color: var(--color-fg, #0f172a);
    border: 1px solid var(--color-border, #cbd5e1);
    font: inherit;
    font-size: 18px;
    font-weight: 600;
    line-height: 1;
    cursor: pointer;
    transition: opacity 120ms;
    box-shadow: 0 1px 3px rgba(15, 23, 42, 0.12);
  }

  .zoom-in {
    border-radius: 8px 8px 0 0;
    border-bottom: none;
  }

  .zoom-out {
    border-radius: 0 0 8px 8px;
  }

  .zoom-btn:hover {
    background: var(--color-surface, #ffffff);
  }

  .zoom-btn[aria-disabled='true'] {
    opacity: 0.5;
    cursor: not-allowed;
  }

  @media (prefers-reduced-motion: reduce) {
    .zoom-btn {
      transition: none !important;
    }
  }
</style>
