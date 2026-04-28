<script lang="ts">
  import { tStore } from '$i18n/index';
  import type { MapController } from '$map/MapController';
  import { bearingSignal } from '$map/bearingSignal';

  export let controller: MapController;

  const reducedMotion =
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false;

  function onClick(): void {
    controller.resetBearing(!reducedMotion);
  }

  // Shortest-path bearing accumulator. The raw bearing is normalised to
  // a 0–360 ring; mirroring it directly to a CSS rotate() makes the
  // browser interpolate the long way round whenever the bearing
  // crosses the 0°/360° seam (e.g. 20° → 350° spins three quarters of
  // the way back instead of nudging 30° forward). We track an
  // unbounded `displayedDeg` that always moves by the shortest signed
  // delta and let CSS interpolate against it.
  let displayedDeg = 0;
  let lastTarget: number | null = null;

  $: {
    const target = -$bearingSignal.bearing;
    if (lastTarget === null) {
      displayedDeg = target;
    } else if (target !== lastTarget) {
      let delta = target - displayedDeg;
      // Bring delta into (-180, 180] so the rotation always picks the
      // shortest arc. The double-mod handles JavaScript's signed `%`
      // for negative dividends.
      delta = (((delta + 180) % 360) + 360) % 360;
      delta = delta - 180;
      // Map the half-open interval (-180, 180] correctly: a raw delta
      // that wrapped exactly to 0 (i.e. no real change) stays at 0;
      // a 180° flip resolves to -180 here, which is fine — both arcs
      // are equal-length and CSS picks one consistently.
      if (delta === -180) delta = 180;
      displayedDeg += delta;
    }
    lastTarget = target;
  }
</script>

<button
  type="button"
  class="compass"
  data-testid="compass"
  aria-label={$tStore('controls.compass.reset')}
  on:click={onClick}
  style="--compass-bearing: {displayedDeg}deg"
>
  <svg width="24" height="24" viewBox="0 0 48 48" aria-hidden="true">
    <circle cx="24" cy="24" r="20" fill="none" stroke="currentColor" stroke-width="1.5" />
    <text x="24" y="11" text-anchor="middle" fill="currentColor" font-size="9" font-weight="700"
      >N</text
    >
    <path d="M24 14 L20 24 L24 22 L28 24 Z" fill="currentColor" />
    <circle cx="24" cy="24" r="2" fill="currentColor" />
  </svg>
</button>

<style>
  .compass {
    min-width: var(--tap-min);
    min-height: var(--tap-min);
    padding: 0;
    background: var(--color-surface-elev, rgba(255, 255, 255, 0.95));
    color: var(--color-fg, #0f172a);
    border: 1px solid var(--color-border, #cbd5e1);
    border-radius: 50%;
    box-shadow: 0 1px 3px rgba(15, 23, 42, 0.12);
    cursor: pointer;
    transform: rotate(var(--compass-bearing, 0deg));
    transition: transform 200ms ease-out;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .compass:hover {
    background: var(--color-surface, #ffffff);
  }

  @media (prefers-reduced-motion: reduce) {
    .compass {
      transition: none !important;
    }
  }
</style>
