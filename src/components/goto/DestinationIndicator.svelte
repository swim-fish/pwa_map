<script context="module" lang="ts">
  // Module-level constants exposed for tests / other consumers.
  export const HOLD_MS = 3000;
  export const FADE_OUT_MS = 300;
  export const PROGRAM_MOVE_BUFFER_MS = 50;
</script>

<script lang="ts">
  import { onDestroy } from 'svelte';

  export let flyToDurationMs: number = 600;

  let visible = false;
  let hideTimer: ReturnType<typeof setTimeout> | null = null;
  let flyToStartedAt = 0;

  export function start(): void {
    visible = true;
    flyToStartedAt = Date.now();
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      visible = false;
      hideTimer = null;
    }, HOLD_MS);
  }

  export function stop(): void {
    visible = false;
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
  }

  export function onMapMove(now: number = Date.now()): void {
    if (!visible) return;
    if (now - flyToStartedAt < flyToDurationMs + PROGRAM_MOVE_BUFFER_MS) return;
    stop();
  }

  onDestroy(() => {
    if (hideTimer) clearTimeout(hideTimer);
  });
</script>

<div
  class="indicator"
  class:visible
  aria-hidden="true"
  data-testid="dest-indicator"
  data-visible={visible}
></div>

<style>
  .indicator {
    position: fixed;
    left: 50%;
    top: 50%;
    width: 24px;
    height: 24px;
    margin-left: -12px;
    margin-top: -12px;
    border-radius: 50%;
    border: 3px solid var(--color-accent, #0ea5e9);
    background: rgba(14, 165, 233, 0.15);
    pointer-events: none;
    z-index: 60;
    opacity: 0;
    transform: scale(0.6);
    transition:
      opacity 200ms ease-out,
      transform 200ms ease-out;
  }

  .indicator.visible {
    opacity: 1;
    transform: scale(1);
    transition:
      opacity 300ms ease-out,
      transform 300ms ease-out;
  }
</style>
