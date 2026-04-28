<script lang="ts">
  import { onMount } from 'svelte';
  import MapView from '$components/MapView.svelte';
  import Crosshair from '$components/Crosshair.svelte';
  import CoordinateReadout from '$components/CoordinateReadout.svelte';
  import AttributionBar from '$components/AttributionBar.svelte';
  import FormatToggle from '$components/FormatToggle.svelte';
  import GoToDialog from '$components/GoToDialog.svelte';
  import DestinationIndicator from '$components/goto/DestinationIndicator.svelte';
  import CopyFallback from '$components/CopyFallback.svelte';
  import LayerPicker from '$components/LayerPicker.svelte';
  import LocalePicker from '$components/LocalePicker.svelte';
  import UpdatePrompt from '$components/UpdatePrompt.svelte';
  import InstallBanner from '$components/InstallBanner.svelte';
  import InstallIosSheet from '$components/InstallIosSheet.svelte';
  import NotificationRegion from '$components/NotificationRegion.svelte';
  import Compass from '$components/Compass.svelte';
  import ZoomControls from '$components/ZoomControls.svelte';
  import LocateButton from '$components/LocateButton.svelte';
  import { applyLocateEvent, locateSignal } from '$map/locateSignal';
  import { get } from 'svelte/store';
  import SettingsSheet from '$components/SettingsSheet.svelte';
  import type { GoToRequestOk } from '$coord/index';
  import type { CoordinateKind as CoordinateKindType, Locale } from '$types/coord';
  import type { LayerSelection } from '$types/map';
  import { findSource } from '$map/sources';
  import { MapController, type MapMoveEvent, type TileFailEvent } from '$map/MapController';
  import type { CoordinateKind, Lat, Lon, WGS84DD } from '$types/coord';
  import { formatWGS84DD } from '$coord/index';
  import { t, tStore, setLocale } from '$i18n/index';
  import {
    loadLastView,
    loadPreferences,
    saveLastView,
    savePreferences,
    type FormatPreferences,
  } from '$storage/preferences';
  import { offlineReadySignal, dismissOfflineReady, fireNeedRefresh } from '$pwa/updateSignal';
  import {
    captureBeforeInstallPrompt,
    markInstalled,
    type BeforeInstallPromptEvent,
  } from '$pwa/installSignal';

  let offlineReadyTimer: ReturnType<typeof setTimeout> | null = null;
  $: if ($offlineReadySignal.visible) {
    if (offlineReadyTimer) clearTimeout(offlineReadyTimer);
    offlineReadyTimer = setTimeout(() => {
      dismissOfflineReady();
      offlineReadyTimer = null;
    }, 5000);
  }

  const DEFAULT_CENTER: WGS84DD = {
    kind: 'wgs84-dd',
    lat: 24.190793 as Lat,
    lon: 120.654919 as Lon,
  };

  let prefs: FormatPreferences = loadPreferences();
  setLocale(prefs.locale);

  let layerSelection: LayerSelection = {
    basemap: prefs.mapLayer ?? 'nlsc-emap5',
    overlay: prefs.overlay ?? false,
  };

  const lastView = loadLastView();
  const initialCenter: WGS84DD = lastView?.center ?? DEFAULT_CENTER;
  const initialZoom = lastView?.zoom ?? 13;

  const controller = new MapController({
    container: document.createElement('div'),
    center: initialCenter,
    zoom: initialZoom,
  });

  let crosshair: WGS84DD = initialCenter;
  let formatToggleOpen = false;
  let goToOpen = false;
  let layerPickerOpen = false;
  let localePickerOpen = false;
  let settingsOpen = false;
  let zoneHint: { zone: number; ts: number } | null = null;
  let copyToast: { ts: number } | null = null;
  let copyFallback: { text: string; ts: number } | null = null;
  let layerFailToast: { messageKey: string; ts: number } | null = null;
  let locateErrorToast: { key: string; ts: number } | null = null;

  function showLocateError(detail: { key: string }): void {
    locateErrorToast = { key: detail.key, ts: Date.now() };
    setTimeout(() => {
      if (locateErrorToast && Date.now() - locateErrorToast.ts >= 4900) locateErrorToast = null;
    }, 5000);
  }
  let destinationIndicator: {
    start: () => void;
    stop: () => void;
    onMapMove: (now?: number) => void;
  } | null = null;

  controller.setLayerSelection(layerSelection);
  controller.onTileFail((ev: TileFailEvent) => {
    const failed = findSource(ev.failedId);
    const groupKey =
      failed?.group === 'nlsc'
        ? 'map.failure.nlsc'
        : failed?.group === 'google'
          ? 'map.failure.google'
          : 'map.failure.other';
    layerSelection = controller.layerSelection;
    prefs = { ...prefs, mapLayer: layerSelection.basemap, overlay: layerSelection.overlay };
    savePreferences(prefs);
    layerFailToast = { messageKey: groupKey, ts: Date.now() };
    setTimeout(() => {
      if (layerFailToast && Date.now() - layerFailToast.ts >= 4900) layerFailToast = null;
    }, 5000);
  });

  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  function scheduleSave(ev: MapMoveEvent): void {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      saveLastView({ center: ev.center, zoom: ev.zoom, bearing: 0, pitch: 0 });
    }, 250);
  }

  function onMove(ev: CustomEvent<MapMoveEvent>): void {
    crosshair = ev.detail.center;
    destinationIndicator?.onMapMove();
  }

  function onMoveEnd(ev: CustomEvent<MapMoveEvent>): void {
    crosshair = ev.detail.center;
    scheduleSave(ev.detail);
  }

  function onFormatChange(ev: CustomEvent<{ visible: readonly CoordinateKind[] }>): void {
    prefs = { ...prefs, visible: ev.detail.visible };
    savePreferences(prefs);
  }

  function onFormatReorder(ev: CustomEvent<{ formatOrder: readonly CoordinateKind[] }>): void {
    prefs = { ...prefs, formatOrder: ev.detail.formatOrder };
    savePreferences(prefs);
  }

  function onLayerChange(ev: CustomEvent<LayerSelection>): void {
    const next = ev.detail;
    const overlayToggleOnly = next.basemap === layerSelection.basemap;
    layerSelection = next;
    controller.setBasemap(next.basemap, next.overlay);
    prefs = { ...prefs, mapLayer: next.basemap, overlay: next.overlay };
    savePreferences(prefs);
    // A pure overlay toggle keeps the picker open per `contracts/layer-picker.md` §3;
    // a basemap pick closes it.
    if (!overlayToggleOnly) {
      layerPickerOpen = false;
    }
  }

  function onLocaleChange(ev: CustomEvent<Locale>): void {
    const next = ev.detail;
    setLocale(next);
    prefs = { ...prefs, locale: next };
    savePreferences(prefs);
    localePickerOpen = false;
  }

  function onKeydown(e: KeyboardEvent): void {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (e.key === 'f' || e.key === 'F') {
      formatToggleOpen = !formatToggleOpen;
      e.preventDefault();
      return;
    }
    if (e.key === 'g' || e.key === 'G') {
      goToOpen = !goToOpen;
      e.preventDefault();
    }
  }

  function onCopySuccess(_ev: CustomEvent<{ kind: CoordinateKindType }>): void {
    copyToast = { ts: Date.now() };
    setTimeout(() => {
      if (copyToast && Date.now() - copyToast.ts >= 1900) copyToast = null;
    }, 2000);
  }

  function onCopyFallback(ev: CustomEvent<{ text: string }>): void {
    copyFallback = { text: ev.detail.text, ts: Date.now() };
  }

  function onGoToSubmit(ev: CustomEvent<GoToRequestOk>): void {
    const { target, zoneAutoResolved } = ev.detail;
    controller.flyTo(target);
    crosshair = target;
    goToOpen = false;
    destinationIndicator?.start();
    if (zoneAutoResolved) {
      zoneHint = { zone: zoneAutoResolved, ts: Date.now() };
      setTimeout(() => {
        if (zoneHint && Date.now() - zoneHint.ts >= 2900) zoneHint = null;
      }, 3000);
    }
  }

  $: ariaLabel = t('a11y.crosshair.label', {
    lat: crosshair.lat.toFixed(4),
    lon: crosshair.lon.toFixed(4),
  });

  // Feature 009: notification-region anchor flips when a primary dialog
  // is open, so transient banners do not cover the dialog's CTA row.
  $: dialogOpen = goToOpen || settingsOpen;
  $: if (typeof document !== 'undefined') {
    if (dialogOpen) {
      document.body.dataset.dialogOpen = '';
    } else {
      delete document.body.dataset.dialogOpen;
    }
  }

  onMount(() => {
    const onBeforeInstall = (e: Event): void => {
      e.preventDefault();
      captureBeforeInstallPrompt(e as BeforeInstallPromptEvent);
    };
    const onAppInstalled = (): void => {
      markInstalled();
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onAppInstalled);

    // Feature 013 FR-018 — manual pan in Follow auto-demotes to Show.
    // Listen on the underlying MapLibre map's `dragstart` event; when
    // `originalEvent` is truthy (user-initiated) AND the locate state
    // is Follow AND the controller is NOT mid-recenter (our own
    // programmatic moves), dispatch the manualPan event.
    const map = controller.getUnderlying() as {
      on?: (event: string, handler: (ev: { originalEvent?: unknown }) => void) => void;
    } | null;
    map?.on?.('dragstart', (ev) => {
      if (!ev?.originalEvent) return;
      if (controller.isRecenteringForLocate) return;
      if (get(locateSignal).state !== 'follow') return;
      applyLocateEvent({ type: 'manualPan' });
    });

    const hooks = {
      setCenter(lat: number, lon: number): void {
        const map = controller.getUnderlying() as {
          setCenter: (c: [number, number]) => void;
        } | null;
        map?.setCenter([lon, lat]);
      },
      startScriptedPan(): void {
        const map = controller.getUnderlying() as {
          panBy: (offset: [number, number], opts?: { duration?: number }) => void;
        } | null;
        let i = 0;
        const tick = (): void => {
          if (i++ > 12) return;
          map?.panBy([20, 0], { duration: 80 });
          setTimeout(tick, 90);
        };
        tick();
      },
      openFormatToggle(): void {
        formatToggleOpen = true;
      },
      closeFormatToggle(): void {
        formatToggleOpen = false;
      },
    };
    const mapHooksHost = window as unknown as Record<string, unknown>;
    mapHooksHost.__mapTestHooks ??= {};
    Object.assign(mapHooksHost.__mapTestHooks as Record<string, unknown>, hooks);

    // Test-only hook for the deterministic update-prompt E2E flow
    // (research D7). Real SW upgrade lifecycle is too slow + flaky for
    // E2E; this hook produces the same `fireNeedRefresh` signal the
    // production registerSW callback would emit. Gated to non-prod.
    if (import.meta.env.DEV || import.meta.env.MODE === 'test') {
      const w = window as unknown as Record<string, unknown>;
      w.__pwaTestHooks ??= {};
      const pwaHooks = w.__pwaTestHooks as Record<string, unknown>;
      pwaHooks.triggerUpdateAvailable = () => {
        fireNeedRefresh(async () => {
          /* test no-op — real path calls updateSW(true) */
        });
      };
      pwaHooks.triggerBeforeInstallPrompt = (opts?: {
        outcome?: 'accepted' | 'dismissed';
      }): void => {
        const evt = new Event('beforeinstallprompt') as unknown as BeforeInstallPromptEvent & {
          prompt: () => Promise<void>;
          userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
        };
        evt.prompt = async () => undefined;
        evt.userChoice = Promise.resolve({
          outcome: opts?.outcome ?? 'accepted',
          platform: 'web',
        });
        window.dispatchEvent(evt);
      };
      pwaHooks.triggerAppInstalled = (): void => {
        window.dispatchEvent(new Event('appinstalled'));
      };
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  });
</script>

<svelte:window on:keydown={onKeydown} />

<main class="shell">
  <MapView
    {initialCenter}
    {initialZoom}
    {controller}
    layer={layerSelection}
    on:move={onMove}
    on:moveend={onMoveEnd}
  />
  <Crosshair {ariaLabel} />

  <header class="toolbar">
    <button
      type="button"
      class="toolbar-btn"
      on:click={() => (goToOpen = true)}
      data-testid="open-goto"
      aria-haspopup="dialog"
      aria-expanded={goToOpen}
    >
      {$tStore('goto.open.button')}
    </button>
    <button
      type="button"
      class="toolbar-btn"
      on:click={() => (formatToggleOpen = true)}
      data-testid="open-format-toggle"
      aria-haspopup="dialog"
      aria-expanded={formatToggleOpen}
    >
      {$tStore('toggle.open.button')}
    </button>
    <button
      type="button"
      class="toolbar-btn"
      on:click={() => (layerPickerOpen = !layerPickerOpen)}
      data-testid="open-layers"
      aria-haspopup="menu"
      aria-expanded={layerPickerOpen}
    >
      {$tStore('toolbar.layers.button')}
    </button>
    <button
      type="button"
      class="toolbar-btn"
      on:click={() => (localePickerOpen = !localePickerOpen)}
      data-testid="open-locale"
      aria-haspopup="menu"
      aria-expanded={localePickerOpen}
    >
      {$tStore('toolbar.locale.button')}
    </button>
    <button
      type="button"
      class="toolbar-btn settings-toolbar-btn"
      on:click={() => (settingsOpen = true)}
      data-testid="settings-toolbar-button"
      aria-haspopup="dialog"
      aria-expanded={settingsOpen}
      aria-label={$tStore('settings.toolbar.button')}
    >
      <span aria-hidden="true">⚙</span>
    </button>
  </header>

  <CoordinateReadout
    position={crosshair}
    visible={prefs.visible}
    formatOrder={prefs.formatOrder}
    mgrsPrecision={prefs.mgrsPrecision}
    taipowerPrecision={prefs.taipowerPrecision}
    on:copy-success={onCopySuccess}
    on:copy-fallback={onCopyFallback}
  />
  <AttributionBar basemap={layerSelection.basemap} overlay={layerSelection.overlay} />

  <LayerPicker
    open={layerPickerOpen}
    selection={layerSelection}
    on:change={onLayerChange}
    on:close={() => (layerPickerOpen = false)}
  />

  <LocalePicker
    open={localePickerOpen}
    selection={prefs.locale}
    on:change={onLocaleChange}
    on:close={() => (localePickerOpen = false)}
  />

  <FormatToggle
    visible={prefs.visible}
    formatOrder={prefs.formatOrder}
    open={formatToggleOpen}
    on:change={onFormatChange}
    on:reorder={onFormatReorder}
    on:close={() => (formatToggleOpen = false)}
  />

  <GoToDialog open={goToOpen} on:submit={onGoToSubmit} on:close={() => (goToOpen = false)} />

  <SettingsSheet open={settingsOpen} on:close={() => (settingsOpen = false)} />

  <NotificationRegion>
    {#if zoneHint}
      <div class="toast" role="status" aria-live="polite" data-testid="zone-toast">
        {$tStore('goto.zone.auto.toast', { zone: zoneHint.zone })}
      </div>
    {/if}

    {#if copyToast}
      <div class="toast" role="status" aria-live="polite" data-testid="copy-toast">
        {$tStore('copy.toast.success')}
      </div>
    {/if}

    {#if layerFailToast}
      <div class="toast" role="status" aria-live="polite" data-testid="layer-fail-toast">
        {$tStore(layerFailToast.messageKey)}
      </div>
    {/if}

    {#if locateErrorToast}
      <div class="toast" role="alert" aria-live="assertive" data-testid="locate-error-toast">
        {$tStore(locateErrorToast.key)}
      </div>
    {/if}

    {#if $offlineReadySignal.visible}
      <div class="toast" role="status" aria-live="polite" data-testid="offline-ready-toast">
        {$tStore('pwa.offline.ready')}
      </div>
    {/if}

    <UpdatePrompt />
    <InstallBanner />
  </NotificationRegion>

  <InstallIosSheet />

  <div class="map-controls">
    <Compass {controller} />
    <LocateButton {controller} on:error={(ev) => showLocateError(ev.detail)} />
    <ZoomControls {controller} />
  </div>

  <CopyFallback
    open={copyFallback !== null}
    text={copyFallback?.text ?? ''}
    on:close={() => (copyFallback = null)}
  />

  <DestinationIndicator bind:this={destinationIndicator} />

  <span class="sr-only" aria-hidden="true"
    >{$tStore('readout.dd.lat')} {formatWGS84DD(crosshair)}</span
  >
</main>

<style>
  .shell {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }

  .toolbar {
    position: absolute;
    top: calc(var(--space-3) + var(--top-stack-zone-top));
    right: calc(var(--space-3) + var(--inline-stack-zone-right));
    display: flex;
    gap: var(--space-2, 8px);
    z-index: 10;
  }

  .toolbar-btn {
    min-height: var(--tap-min);
    padding: var(--space-2, 8px) var(--space-3, 12px);
    background: var(--color-surface-elev, rgba(255, 255, 255, 0.95));
    color: var(--color-fg, #0f172a);
    border: 1px solid var(--color-border, #cbd5e1);
    border-radius: 6px;
    font: inherit;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 1px 3px rgba(15, 23, 42, 0.12);
  }

  .toolbar-btn:hover {
    background: var(--color-surface, #ffffff);
  }

  .settings-toolbar-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: var(--tap-min);
    padding: var(--space-2, 8px);
  }

  /* Cluster anchored at the upper-left corner (feature 013, supersedes
     the left-center placement from feature 011). DOM order is compass
     → my-location → zoom-in → zoom-out, top-to-bottom. Reasons: (a) a
     fixed top-left anchor leaves the entire vertical centre of the
     viewport free for map gestures (most users two-finger pan from
     mid-screen), (b) the my-location button sits directly under the
     compass so orientation + position controls form one visual unit,
     (c) the top + left edges already honour the device safe-area
     inset via the shared --top-stack-zone-top / --inline-stack-zone-left
     tokens. */
  .map-controls {
    position: fixed;
    top: calc(var(--space-3) + var(--top-stack-zone-top));
    left: calc(var(--space-3) + var(--inline-stack-zone-left));
    z-index: 6;
    display: flex;
    flex-direction: column;
    gap: var(--space-2, 8px);
  }

  .toast {
    padding: var(--space-2, 8px) var(--space-4, 16px);
    background: rgba(15, 23, 42, 0.92);
    color: #ffffff;
    border-radius: 6px;
    font-size: 13px;
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
