<script lang="ts">
  import { createEventDispatcher, onDestroy, onMount } from 'svelte';
  import maplibregl from 'maplibre-gl';
  import 'maplibre-gl/dist/maplibre-gl.css';
  import type { Lat, Lon, WGS84DD } from '$types/coord';
  import type { LayerSelection } from '$types/map';
  import { findSource } from '$map/sources';
  import { buildStyle } from '$map/styleBuilder';
  import { MapController, type MapMoveEvent } from '$map/MapController';

  export let initialCenter: WGS84DD;
  export let initialZoom: number = 13;
  export let controller: MapController | null = null;
  export let layer: LayerSelection = { basemap: 'osm-standard', overlay: false };

  const dispatch = createEventDispatcher<{
    move: MapMoveEvent;
    moveend: MapMoveEvent;
  }>();

  let container: HTMLDivElement | null = null;
  let map: maplibregl.Map | null = null;
  let moveRaf = 0;
  let lastApplied: LayerSelection | null = null;

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

  function styleFor(selection: LayerSelection): maplibregl.StyleSpecification {
    const base = findSource(selection.basemap) ?? findSource('osm-standard');
    if (!base) {
      throw new Error('osm-standard fallback missing from catalogue');
    }
    const over = selection.overlay ? (findSource('google-road-overlay') ?? null) : null;
    return buildStyle(base, over) as maplibregl.StyleSpecification;
  }

  $: if (map && lastApplied) {
    if (layer.basemap !== lastApplied.basemap || layer.overlay !== lastApplied.overlay) {
      map.setStyle(styleFor(layer));
      lastApplied = { ...layer };
    }
  }

  onMount(() => {
    if (!container) return;

    map = new maplibregl.Map({
      container,
      style: styleFor(layer),
      center: [initialCenter.lon, initialCenter.lat],
      zoom: initialZoom,
      attributionControl: false,
      hash: false,
    });
    lastApplied = { ...layer };

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

    map.on('error', (e) => {
      const ev = e as {
        sourceId?: string;
        error?: { status?: number; message?: string };
      };
      const src = ev.sourceId ?? '';
      if (!src || !controller) return;
      // Only count actual fetch failures (HTTP ≥ 400 or network error). Decode
      // / style-validation errors still show on the canvas but the previous
      // basemap was clearly reachable, so reverting from them would create
      // false positives (see ADR 0022 — the rule is "tile origin unreachable").
      const status = ev.error?.status;
      const msg = ev.error?.message ?? '';
      const fatal = typeof status === 'number' && (status === 0 || status >= 400);
      const looksLikeFetchFailure =
        fatal || (status === undefined && /fetch|network|abort/i.test(msg));
      if (looksLikeFetchFailure) {
        controller.recordTileError(src, { fatal });
      }
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
