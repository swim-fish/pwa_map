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
</script>

<button
  type="button"
  class="compass"
  data-testid="compass"
  aria-label={$tStore('controls.compass.reset')}
  on:click={onClick}
  style="--compass-bearing: {-$bearingSignal.bearing}deg"
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
    min-width: 36px;
    min-height: 36px;
    width: 36px;
    height: 36px;
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
