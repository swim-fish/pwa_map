<script lang="ts">
  import { createEventDispatcher, onDestroy, onMount } from 'svelte';
  import maplibregl from 'maplibre-gl';
  import 'maplibre-gl/dist/maplibre-gl.css';
  import type { Lat, Lon, WGS84DD } from '$types/coord';
  import { osmTileSource, buildOsmStyle } from '$map/tileSource';
  import { MapController, type MapMoveEvent } from '$map/MapController';

  export let initialCenter: WGS84DD;
  export let initialZoom: number = 13;
  export let controller: MapController | null = null;

  const dispatch = createEventDispatcher<{
    move: MapMoveEvent;
    moveend: MapMoveEvent;
  }>();

  let container: HTMLDivElement | null = null;
  let map: maplibregl.Map | null = null;
  let moveRaf = 0;

  function currentEvent(): MapMoveEvent {
    if (!map) {
      return { center: initialCenter, zoom: initialZoom };
    }
    const c = map.getCenter();
    return {
      center: {
        kind: 'wgs84-dd',
        lat: c.lat as Lat,
        lon: c.lng as Lon,
      },
      zoom: map.getZoom(),
    };
  }

  onMount(() => {
    if (!container) return;

    map = new maplibregl.Map({
      container,
      style: buildOsmStyle(osmTileSource) as maplibregl.StyleSpecification,
      center: [initialCenter.lon, initialCenter.lat],
      zoom: initialZoom,
      attributionControl: false,
      hash: false,
    });

    map.on('move', () => {
      if (moveRaf) cancelAnimationFrame(moveRaf);
      moveRaf = requestAnimationFrame(() => {
        moveRaf = 0;
        const ev = currentEvent();
        controller?.emitMove(ev);
        dispatch('move', ev);
      });
    });

    map.on('moveend', () => {
      const ev = currentEvent();
      controller?.emitMoveEnd(ev);
      dispatch('moveend', ev);
    });

    if (controller) controller.attachUnderlying(map);
  });

  onDestroy(() => {
    if (moveRaf) cancelAnimationFrame(moveRaf);
    map?.remove();
    map = null;
  });
</script>

<div bind:this={container} class="map-root" data-testid="map-root"></div>

<style>
  .map-root {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    background: var(--color-bg, #f5f5f5);
  }
</style>
