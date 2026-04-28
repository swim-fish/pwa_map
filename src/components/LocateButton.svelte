<script lang="ts">
  import { createEventDispatcher, onDestroy } from 'svelte';
  import { tStore } from '$i18n/index';
  import type { MapController } from '$map/MapController';
  import { GeolocationController } from '$map/geolocationController';
  import { applyLocateEvent, locateSignal } from '$map/locateSignal';
  import type { LocateMachineSnapshot, PositionFix } from '$map/locateMachine';
  import { loadLocateFrequency } from '$storage/preferences';
  import { locateFrequencyStore } from '$storage/locateFrequencyStore';

  export let controller: MapController;

  const LONG_PRESS_MS = 1500;

  type LocateErrorKey =
    | 'locate.error.permissionDenied'
    | 'locate.error.positionUnavailable'
    | 'locate.error.timeout'
    | 'locate.error.unavailable';

  const dispatch = createEventDispatcher<{
    error: { key: LocateErrorKey };
    fix: PositionFix;
  }>();

  let geo: GeolocationController | null = null;

  // Press-state machine. Reset by `cleanupPress` on every release /
  // cancel / destroy path so a stale timer never produces a Stop after
  // the user has released.
  let pressTimerId: ReturnType<typeof setTimeout> | null = null;
  let pressing = false;
  let activePointerId: number | null = null;
  let reducedMotionAnnouncement = '';

  const reducedMotion =
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false;

  function ensureController(): GeolocationController {
    if (geo === null) {
      geo = new GeolocationController({
        onFix: (fix) => {
          applyLocateEvent({ type: 'firstFix', fix });
          dispatch('fix', fix);
          // Follow-mode auto-recenter: when state is Follow, every new
          // fix re-centres the map on the user's reported position.
          if ($locateSignal.state === 'follow') {
            controller.recenterTo(
              { kind: 'wgs84-dd', lat: fix.lat as never, lon: fix.lon as never },
              !reducedMotion,
            );
          }
        },
        onPermissionDenied: () => {
          applyLocateEvent({ type: 'permissionDenied' });
          dispatch('error', { key: 'locate.error.permissionDenied' });
        },
        onPositionUnavailable: () => {
          dispatch('error', { key: 'locate.error.positionUnavailable' });
        },
        onTimeout: () => {
          dispatch('error', { key: 'locate.error.timeout' });
        },
      });
    }
    return geo;
  }

  // Initial permission probe — fire-and-forget; if the API is absent
  // the button paints disabled. We do NOT call watchPosition here so
  // FR-009 (no geolocation API at page load) still holds.
  if (typeof navigator !== 'undefined' && !navigator.geolocation) {
    applyLocateEvent({ type: 'permissionUnavailable' });
  } else if (typeof navigator !== 'undefined') {
    void ensureController()
      .queryPermission()
      .then((p) => {
        if (p === 'unavailable') {
          applyLocateEvent({ type: 'permissionUnavailable' });
        } else if (p === 'denied') {
          applyLocateEvent({ type: 'permissionDenied' });
        }
      });
  }

  function ariaLabelFor($snap: LocateMachineSnapshot, $t: (k: string) => string): string {
    if ($snap.permission === 'unavailable') return $t('locate.button.aria.disabled');
    switch ($snap.state) {
      case 'off':
        return $t('locate.button.aria.off');
      case 'show':
        return $t('locate.button.aria.show');
      case 'follow':
        return $t('locate.button.aria.follow');
    }
  }

  function shortTapFromOff(): void {
    const snap = $locateSignal;
    if (snap.permission === 'unavailable') {
      dispatch('error', { key: 'locate.error.unavailable' });
      return;
    }
    if (snap.permission === 'denied') {
      dispatch('error', { key: 'locate.error.permissionDenied' });
      return;
    }
    applyLocateEvent({ type: 'shortTap' });
    const preset = loadLocateFrequency();
    ensureController().start(preset);
  }

  function shortTapToggle(): void {
    const snap = $locateSignal;
    if (snap.state === 'off') {
      shortTapFromOff();
      return;
    }
    const wasFollow = snap.state === 'follow';
    applyLocateEvent({ type: 'shortTap' });
    // Show → Follow: recenter immediately on the last known fix so the
    // user sees the camera lock without waiting for the next watcher fix.
    if (!wasFollow && $locateSignal.state === 'follow' && $locateSignal.lastFix !== null) {
      const fix = $locateSignal.lastFix;
      controller.recenterTo(
        { kind: 'wgs84-dd', lat: fix.lat as never, lon: fix.lon as never },
        !reducedMotion,
      );
    }
  }

  let justFiredStop = false;

  function fireStop(): void {
    const snap = $locateSignal;
    if (snap.state === 'off') return; // FR-014g
    applyLocateEvent({ type: 'longPress' });
    geo?.stop();
    justFiredStop = true;
  }

  function clearPressTimer(): void {
    if (pressTimerId !== null) {
      clearTimeout(pressTimerId);
      pressTimerId = null;
    }
  }

  function cleanupPress(): void {
    clearPressTimer();
    pressing = false;
    reducedMotionAnnouncement = '';
    if (activePointerId !== null) {
      try {
        getButtonEl()?.releasePointerCapture(activePointerId);
      } catch {
        /* jsdom / not captured — ignore */
      }
      activePointerId = null;
    }
  }

  let buttonEl: HTMLButtonElement | null = null;
  function getButtonEl(): HTMLButtonElement | null {
    return buttonEl;
  }

  function onPointerDown(event: PointerEvent): void {
    const snap = $locateSignal;
    if (snap.permission === 'unavailable') return;
    activePointerId = event.pointerId;
    try {
      buttonEl?.setPointerCapture(event.pointerId);
    } catch {
      /* jsdom / cross-origin — ignore */
    }
    if (snap.state === 'off') {
      // FR-014g: long-press from Off is a no-op. Skip arming the timer
      // and skip the `pressing` class so no misleading progress visual
      // appears. The bubbling click handler still drives the Off→Show
      // short-tap activation.
      return;
    }
    pressing = true;
    if (reducedMotion) {
      reducedMotionAnnouncement = $tStore('locate.button.aria.holdToStop');
    }
    pressTimerId = setTimeout(() => {
      // Threshold reached — the next pointerup must NOT toggle.
      pressTimerId = null;
      fireStop();
      cleanupPress();
    }, LONG_PRESS_MS);
  }

  function onPointerUp(): void {
    // Always cleanup (clears any active timer). The bubbling `click`
    // event runs the toggle in real browsers; tests that bypass real
    // pointer→click synthesis call `button.click()` explicitly.
    cleanupPress();
  }

  function onPointerCancel(): void {
    cleanupPress();
  }

  function onPointerLeave(): void {
    cleanupPress();
  }

  function onLostPointerCapture(): void {
    cleanupPress();
  }

  function onClick(): void {
    // Click is the single short-tap path. Suppress only when long-press
    // has just fired Stop on this gesture (so the bubbling click does
    // not immediately re-enter Show).
    if (justFiredStop) {
      justFiredStop = false;
      return;
    }
    shortTapToggle();
  }

  function onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    if (event.shiftKey) {
      // FR-014d Stop chord.
      const snap = $locateSignal;
      if (snap.state === 'off') return; // FR-014g
      applyLocateEvent({ type: 'longPress' });
      geo?.stop();
      return;
    }
    // Short-tap toggle.
    shortTapToggle();
  }

  onDestroy(() => {
    cleanupPress();
    geo?.dispose();
    geo = null;
  });

  $: snapshot = $locateSignal;
  $: t = $tStore;
  $: ariaLabel = ariaLabelFor(snapshot, t);
  $: isDisabled = snapshot.permission === 'unavailable';

  // FR-025 — live-apply preset changes to a running watcher. Subscribing
  // to the writable bridge in $storage/locateFrequencyStore lets a
  // Settings change propagate without toggling the button Off / On.
  let lastAppliedFrequency = loadLocateFrequency();
  $: if ($locateFrequencyStore !== lastAppliedFrequency) {
    lastAppliedFrequency = $locateFrequencyStore;
    if (geo?.isRunning) {
      geo.start($locateFrequencyStore);
    }
  }
</script>

<button
  bind:this={buttonEl}
  type="button"
  class="locate"
  class:state-off={snapshot.state === 'off'}
  class:state-show={snapshot.state === 'show'}
  class:state-follow={snapshot.state === 'follow'}
  class:disabled={isDisabled}
  class:pressing
  data-testid="locate"
  data-state={snapshot.state}
  aria-label={ariaLabel}
  aria-pressed={snapshot.state !== 'off'}
  aria-keyshortcuts="Enter Space Shift+Enter Shift+Space"
  aria-disabled={isDisabled}
  on:click={onClick}
  on:keydown={onKeydown}
  on:pointerdown={onPointerDown}
  on:pointerup={onPointerUp}
  on:pointercancel={onPointerCancel}
  on:pointerleave={onPointerLeave}
  on:lostpointercapture={onLostPointerCapture}
>
  <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="3" fill="currentColor" />
    <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.5" />
    <line x1="12" y1="2" x2="12" y2="5" stroke="currentColor" stroke-width="1.5" />
    <line x1="12" y1="19" x2="12" y2="22" stroke="currentColor" stroke-width="1.5" />
    <line x1="2" y1="12" x2="5" y2="12" stroke="currentColor" stroke-width="1.5" />
    <line x1="19" y1="12" x2="22" y2="12" stroke="currentColor" stroke-width="1.5" />
  </svg>
</button>
<span class="aria-live" data-testid="locate-aria-live" aria-live="polite" aria-atomic="true"
  >{reducedMotionAnnouncement}</span
>

<style>
  .locate {
    position: relative;
    min-width: var(--tap-min);
    min-height: var(--tap-min);
    padding: 0;
    background: var(--color-surface-elev, rgba(255, 255, 255, 0.95));
    color: var(--color-fg, #0f172a);
    border: 1px solid var(--color-border, #cbd5e1);
    border-radius: 50%;
    box-shadow: 0 1px 3px rgba(15, 23, 42, 0.12);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: background 120ms ease-out;
    touch-action: manipulation;
    user-select: none;
  }

  .locate:hover {
    background: var(--color-surface, #ffffff);
  }

  .locate.state-show {
    color: var(--color-accent, #0ea5e9);
  }

  .locate.state-follow {
    color: var(--color-on-accent, #ffffff);
    background: var(--color-accent, #0ea5e9);
    border-color: var(--color-accent, #0ea5e9);
  }

  .locate.disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Long-press progress feedback — outline ring that grows in opacity
     while .pressing is applied. The CSS transition runs over 1.5 s so
     the visual completes exactly as the long-press timer fires.
     Suppressed under prefers-reduced-motion (the aria-live element
     announces "按住停止…" instead). */
  .locate.pressing {
    box-shadow:
      0 0 0 2px var(--color-accent),
      0 1px 3px rgba(15, 23, 42, 0.12);
    transition: box-shadow 1500ms linear;
  }

  .aria-live {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    padding: 0;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  @media (prefers-reduced-motion: reduce) {
    .locate,
    .locate.pressing {
      transition: none !important;
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.12);
    }
  }
</style>
